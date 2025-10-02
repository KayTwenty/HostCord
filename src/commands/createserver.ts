import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { buildEmbed } from '../handlers/embedBuilder';
import { startMinecraftServer } from '../backend/minecraftManager';
import { addUserServer } from '../backend/serverDb';

export const data = new SlashCommandBuilder()
  .setName('createserver')
  .setDescription('Request a new game server')
  .addStringOption(option =>
    option.setName('game')
      .setDescription('The game to create a server for')
      .setRequired(true)
      .addChoices(
        { name: 'Minecraft', value: 'minecraft' }
      )
  )
  // TODO: Fetch versions from Docker Hub API
  .addStringOption(option =>
    option.setName('version')
      .setDescription('Minecraft server version (e.g., latest, 1.20.1, 1.19.4)')
      .setRequired(false)
      .addChoices(
        { name: 'Latest', value: 'latest' },
        { name: '1.20.4', value: '1.20.4' },
        { name: '1.20.2', value: '1.20.2' },
        { name: '1.20.1', value: '1.20.1' },
        { name: '1.19.4', value: '1.19.4' },
        { name: '1.19.3', value: '1.19.3' },
        { name: '1.19.2', value: '1.19.2' },
        { name: '1.18.2', value: '1.18.2' },
        { name: '1.17.1', value: '1.17.1' },
        { name: '1.16.5', value: '1.16.5' },
        { name: '1.15.2', value: '1.15.2' },
        { name: '1.14.4', value: '1.14.4' },
        { name: '1.13.2', value: '1.13.2' },
        { name: '1.12.2', value: '1.12.2' },
        { name: '1.8.9', value: '1.8.9' }
      )
  )
  .addIntegerOption(option =>
    option.setName('maxplayers')
      .setDescription('Maximum number of players (default: 20)')
      .setMinValue(1)
      .setMaxValue(100)
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const game = interaction.options.getString('game');
  if (game !== 'minecraft') {
    await interaction.reply({ content: 'Only Minecraft is supported at this time.', ephemeral: true });
    return;
  }

  const version = interaction.options.getString('version') || 'latest';
  const maxPlayers = interaction.options.getInteger('maxplayers') || 20;

  // Generate a unique name, port, rcon port, and rcon password
  const userId = interaction.user.id;
  const username = interaction.user.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const shortId = Math.random().toString(36).substring(2, 7);
  const port = Math.floor(Math.random() * (40000 - 30000 + 1)) + 30000; // Random port between 30000-40000
  const rconPort = Math.floor(Math.random() * (50000 - 45000 + 1)) + 45000; // Random port between 45000-50000
  const rconPassword = Math.random().toString(36).slice(2, 12);
  const name = `${username}_${userId}_${shortId}`;

  await interaction.reply({ content: 'Starting your Minecraft server, please wait...' });
  const result = await startMinecraftServer({ port, name, version, maxPlayers, rconPort, rconPassword });

  const localAddress = `127.0.0.1:${port}`;
  if (result.success) {
    addUserServer({
      userId,
      containerName: `mc_${name}`,
      port,
      ip: localAddress, // For now, store the local address
      createdAt: Date.now(),
      rconPort,
      rconPassword
    });
  }

  const embed = buildEmbed({
    title: 'Minecraft Server Request',
    description: result.success
      ? `Your Minecraft server is starting!`
      : `There was an error starting your server.`,
    color: result.success ? 0x57a8ff : 0xff5555,
    fields: [
      { name: 'Game', value: 'Minecraft', inline: true },
      { name: 'Server Name', value: `mc_${name}`, inline: true },
      { name: 'IP', value: localAddress, inline: true },
      { name: 'Port', value: result.success ? `${port}` : 'N/A', inline: true },
      { name: 'Version', value: version, inline: true },
      { name: 'Max Players', value: maxPlayers.toString(), inline: true },
      { name: 'Status', value: result.success ? 'Running' : 'Error', inline: true },
      ...(result.success ? [{ name: 'Connection Info', value: `\`\`\`${localAddress}\`\`\`` }] : [{ name: 'Error', value: result.message }])
    ],
    footer: result.success
      ? `Need help? Make sure your port is open and your firewall allows connections.`
      : undefined,
    timestamp: true
  });
  await interaction.editReply({ content: '', embeds: [embed] });

}
