import { SlashCommandBuilder, ChatInputCommandInteraction, CacheType, AutocompleteInteraction } from 'discord.js';
import { getUserServers } from '../backend/serverDb';
import { buildEmbed } from '../handlers/embedBuilder';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';

const BACKUP_DIR = path.join(__dirname, '../../backups');

export const data = new SlashCommandBuilder()
  .setName('restorebackup')
  .setDescription('Restore a backup for one of your Minecraft servers')
  .addStringOption(option =>
    option.setName('container')
      .setDescription('The container name of the server')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(option =>
    option.setName('backup')
      .setDescription('The backup file to restore')
      .setRequired(true)
      .setAutocomplete(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const containerName = interaction.options.getString('container', true);
  const backupFile = interaction.options.getString('backup', true);
  const servers = getUserServers(userId);
  const found = servers.find(s => s.containerName === containerName);

  if (!found) {
    await interaction.reply({ embeds: [buildEmbed({
      title: 'Server Not Found',
      description: 'You do not own a server with that container name.',
      color: 0xff5555
    })], flags: 64 });
    return;
  }

  const serverBackupDir = path.join(BACKUP_DIR, containerName);
  let backupPath = path.join(serverBackupDir, backupFile);
  if (!fs.existsSync(backupPath)) {
    await interaction.reply({ embeds: [buildEmbed({
      title: 'Backup Not Found',
      description: 'The selected backup file does not exist.',
      color: 0xff5555
    })], flags: 64 });
    return;
  }

  await interaction.reply({ embeds: [buildEmbed({
    title: 'Restoring Backup',
    description: `Restoring backup \
\`\`\`${backupFile}\`\`\` to server \
\`\`\`${containerName}\`\`\`...`,
    color: 0x57a8ff
  })] });

  // Stop the server before restoring
  exec(`docker stop ${containerName}`, (err) => {
    if (err) {
      interaction.editReply({ embeds: [buildEmbed({
        title: 'Restore Failed',
        description: `Failed to stop server: ${err.message}`,
        color: 0xff5555
      })] });
      return;
    }
    // Extract backup into world folder
    exec(`docker run --rm -v ${containerName}:/data -v "${backupPath}":/backup.tar.gz busybox sh -c "cd /data && rm -rf world && tar xzf /backup.tar.gz"`, (err2) => {
      // Always attempt to start the server again, even if extraction fails
      exec(`docker start ${containerName}`, (err3) => {
        if (err2) {
          interaction.editReply({ embeds: [buildEmbed({
            title: 'Restore Failed',
            description: `Failed to extract backup: ${err2.message}\nServer attempted to restart: ${err3 ? 'Failed' : 'Success'}`,
            color: 0xff5555
          })] });
        } else if (err3) {
          interaction.editReply({ embeds: [buildEmbed({
            title: 'Restore Failed',
            description: `Backup restored, but failed to start server: ${err3.message}`,
            color: 0xffaa00
          })] });
        } else {
          interaction.editReply({ embeds: [buildEmbed({
            title: 'Restore Complete',
            description: `Backup \n\`\`\`${backupFile}\`\`\` restored and server started!`,
            color: 0x55ff55
          })] });
        }
      });
    });
  });
}

export async function autocomplete(interaction: AutocompleteInteraction<CacheType>) {
  const userId = interaction.user.id;
  const option = interaction.options.getFocused(true);
  const servers = getUserServers(userId);
  if (option.name === 'container') {
    const choices = servers.map(s => s.containerName).filter(name => name.includes(option.value));
    await interaction.respond(
      choices.map(name => ({ name, value: name })).slice(0, 25)
    );
  } else if (option.name === 'backup') {
    const containerName = interaction.options.getString('container');
    if (!containerName) {
      await interaction.respond([]);
      return;
    }
    const serverBackupDir = path.join(BACKUP_DIR, containerName);
    if (!fs.existsSync(serverBackupDir)) {
      await interaction.respond([]);
      return;
    }
    const files = fs.readdirSync(serverBackupDir).filter(f => f.endsWith('.tar.gz'));
    const focused = option.value;
    const choices = files.filter(f => f.includes(focused));
    await interaction.respond(
      choices.map(f => ({ name: f, value: f })).slice(0, 25)
    );
  }
}
