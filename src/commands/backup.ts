import { SlashCommandBuilder, ChatInputCommandInteraction, CacheType, AutocompleteInteraction } from 'discord.js';
import { getUserServers } from '../backend/serverDb';
import { buildEmbed } from '../handlers/embedBuilder';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

const BACKUP_DIR = path.join(__dirname, '../../backups');

export const data = new SlashCommandBuilder()
  .setName('backup')
  .setDescription('Create a backup of your Minecraft server world')
  .addStringOption(option =>
    option.setName('container')
      .setDescription('The container name of the server to backup')
      .setRequired(true)
      .setAutocomplete(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const containerName = interaction.options.getString('container', true);
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

  await interaction.reply({ embeds: [buildEmbed({
    title: 'Backing Up',
    description: `Creating backup for \`${containerName}\`...`,
    color: 0x57a8ff
  })] });

  // Create backup directory for this container
  const serverBackupDir = path.join(BACKUP_DIR, containerName);
  if (!fs.existsSync(serverBackupDir)) {
    fs.mkdirSync(serverBackupDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(serverBackupDir, `world-${timestamp}.tar.gz`);

  // Archive the world folder from the running container
    const backupCmd = `docker exec ${containerName} tar czf - world > "${backupFile}"`;
  exec(backupCmd, async (err, stdout, stderr) => {
    if (err) {
      await interaction.editReply({ embeds: [buildEmbed({
        title: 'Backup Failed',
        description: `Failed to create backup: ${stderr || err.message}`,
        color: 0xff5555
      })] });
    } else {
      await interaction.editReply({ embeds: [buildEmbed({
        title: 'Backup Complete',
        description: `Backup created: \n\`\`\`${backupFile}\`\`\``,
        color: 0x55ff55
      })] });
    }
  });
}

// Autocomplete for container names the user owns
export async function autocomplete(interaction: AutocompleteInteraction<CacheType>) {
  const userId = interaction.user.id;
  const servers = getUserServers(userId);
  const focused = interaction.options.getFocused();
  const choices = servers.map(s => s.containerName).filter(name => name.includes(focused));
  await interaction.respond(
    choices.map(name => ({ name, value: name })).slice(0, 25)
  );
}
