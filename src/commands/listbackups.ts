import { SlashCommandBuilder, ChatInputCommandInteraction, CacheType, AutocompleteInteraction } from 'discord.js';
import { getUserServers } from '../backend/serverDb';
import { buildEmbed } from '../handlers/embedBuilder';
import path from 'path';
import fs from 'fs';

const BACKUP_DIR = path.join(__dirname, '../../backups');

export const data = new SlashCommandBuilder()
  .setName('listbackups')
  .setDescription('List backups for one of your Minecraft servers')
  .addStringOption(option =>
    option.setName('container')
      .setDescription('The container name of the server')
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

  const serverBackupDir = path.join(BACKUP_DIR, containerName);
  if (!fs.existsSync(serverBackupDir)) {
    await interaction.reply({ embeds: [buildEmbed({
      title: 'No Backups',
      description: 'No backups found for this server.',
      color: 0xffaa00
    })], flags: 64 });
    return;
  }
  const files = fs.readdirSync(serverBackupDir).filter(f => f.endsWith('.tar.gz'));
  if (!files.length) {
    await interaction.reply({ embeds: [buildEmbed({
      title: 'No Backups',
      description: 'No backups found for this server.',
      color: 0xffaa00
    })], flags: 64 });
    return;
  }
  const fields = files.map(f => ({ name: f, value: path.join(serverBackupDir, f) }));
  await interaction.reply({ embeds: [buildEmbed({
    title: `Backups for ${containerName}`,
    description: `Found ${files.length} backup(s):`,
    color: 0x57a8ff,
    fields,
    timestamp: true
  })], flags: 64 });
}

export async function autocomplete(interaction: AutocompleteInteraction<CacheType>) {
  const userId = interaction.user.id;
  const servers = getUserServers(userId);
  const focused = interaction.options.getFocused();
  const choices = servers.map(s => s.containerName).filter(name => name.includes(focused));
  await interaction.respond(
    choices.map(name => ({ name, value: name })).slice(0, 25)
  );
}
