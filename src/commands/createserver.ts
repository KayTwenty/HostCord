import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
  InteractionCollector,
  ModalSubmitInteraction,
  MessageFlags
} from 'discord.js';
import { buildEmbed } from '../handlers/embedBuilder';
import { startMinecraftServer } from '../backend/minecraftManager';
import { addUserServer } from '../backend/serverDb';
import {
  savePendingSetup,
  getPendingSetup,
  removePendingSetup
} from '../backend/pendingServerSetup';
import { PendingServerSetup } from '../backend/pendingServerSetup';

export const data = new SlashCommandBuilder()
  .setName('createserver')
  .setDescription('Interactively create a customized Minecraft server');

function buildSetupEmbed(setup: PendingServerSetup) {
  return buildEmbed({
    title: 'Minecraft Server Setup',
    description: 'Customize your server before creation.',
    color: 0x57a8ff,
    fields: [
      { name: 'Difficulty', value: setup.difficulty || 'Not selected', inline: true },
      { name: 'Game Mode', value: setup.gamemode || 'Not selected', inline: true },
      { name: 'Version', value: setup.version || 'Not selected', inline: true },
      { name: 'MOTD', value: setup.motd || 'Not set', inline: false },
    ],
    footer: 'Select each option, then click Create Server.'
  });
}

function getSetupComponents(setup: PendingServerSetup) {
  const difficultyMenu = new StringSelectMenuBuilder()
    .setCustomId('difficulty')
    .setPlaceholder('Select difficulty')
    .setDisabled(!!setup.difficulty)
    .addOptions([
      { label: 'Peaceful', value: 'peaceful' },
      { label: 'Easy', value: 'easy' },
      { label: 'Normal', value: 'normal' },
      { label: 'Hard', value: 'hard' },
    ]);
  const gamemodeMenu = new StringSelectMenuBuilder()
    .setCustomId('gamemode')
    .setPlaceholder('Select game mode')
    .setDisabled(!setup.difficulty || !!setup.gamemode)
    .addOptions([
      { label: 'Survival', value: 'survival' },
      { label: 'Creative', value: 'creative' },
      { label: 'Adventure', value: 'adventure' },
      { label: 'Spectator', value: 'spectator' },
    ]);
  const versionMenu = new StringSelectMenuBuilder()
    .setCustomId('version')
    .setPlaceholder('Select Minecraft version')
    .setDisabled(!setup.gamemode || !!setup.version)
    .addOptions([
      { label: '1.20.4', value: '1.20.4' },
      { label: '1.20.1', value: '1.20.1' },
      { label: '1.19.4', value: '1.19.4' },
      { label: 'Latest', value: 'latest' },
    ]);
  const motdButton = new ButtonBuilder()
    .setCustomId('motd')
    .setLabel(setup.motd ? 'Edit MOTD' : 'Set MOTD')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(!setup.version);
  const createButton = new ButtonBuilder()
    .setCustomId('create_server')
    .setLabel('Create Server')
    .setStyle(ButtonStyle.Success)
    .setDisabled(!(setup.difficulty && setup.gamemode && setup.version && setup.motd));
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(difficultyMenu),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(gamemodeMenu),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(versionMenu),
    new ActionRowBuilder<ButtonBuilder>().addComponents(motdButton, createButton)
  ];
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const setup: PendingServerSetup = {
    userId,
    difficulty: undefined,
    gamemode: undefined,
    version: undefined,
    motd: undefined,
    step: 'difficulty',
    timestamp: Date.now()
  };
  savePendingSetup(setup);
  await interaction.reply({
    embeds: [buildSetupEmbed(setup)],
    components: getSetupComponents(setup),
    flags: 64
  });
}

export async function handleComponentInteraction(interaction: any) {
  const userId = interaction.user.id;
  let setup = getPendingSetup(userId) as PendingServerSetup;
  if (!setup) {
    setup = {
      userId,
      difficulty: undefined,
      gamemode: undefined,
      version: undefined,
      motd: undefined,
      step: 'difficulty',
      timestamp: Date.now()
    };
  }
  let updateUI = false;
  // Handle select menus
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'difficulty') {
      setup.difficulty = interaction.values[0];
      setup.step = 'gamemode';
      updateUI = true;
    } else if (interaction.customId === 'gamemode') {
      setup.gamemode = interaction.values[0];
      setup.step = 'version';
      updateUI = true;
    } else if (interaction.customId === 'version') {
      setup.version = interaction.values[0];
      setup.step = 'motd';
      updateUI = true;
    }
    savePendingSetup(setup);
    if (updateUI) {
      await interaction.update({
        embeds: [buildSetupEmbed(setup)],
        components: getSetupComponents(setup)
      });
      return;
    }
  }
  // Handle MOTD modal
  if (interaction.isModalSubmit && interaction.isModalSubmit() && interaction.customId === 'motd_modal') {
    setup.motd = interaction.fields.getTextInputValue('motd_input');
    setup.step = 'complete';
    savePendingSetup(setup);
    await interaction.update({
      embeds: [buildSetupEmbed(setup)],
      components: getSetupComponents(setup)
    });
    return;
  }
  // Handle MOTD button
  if (interaction.isButton && interaction.isButton() && interaction.customId === 'motd') {
    const modal = new ModalBuilder()
      .setCustomId('motd_modal')
      .setTitle('Set MOTD')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('motd_input')
            .setLabel('Enter your MOTD')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(60)
            .setRequired(true)
            .setValue(setup.motd || '')
        )
      );
    await interaction.showModal(modal);
    return;
  }
  // Handle Create Server button
  if (interaction.isButton && interaction.isButton() && interaction.customId === 'create_server') {
    // All options collected, create the server
    await interaction.update({
      content: 'Creating your server with your custom settings...',
      embeds: [],
      components: []
    });
    // Generate unique name, ports, rcon, etc.
    const shortId = Math.random().toString(36).substring(2, 7);
    const port = Math.floor(Math.random() * (40000 - 30000 + 1)) + 30000;
    const rconPort = Math.floor(Math.random() * (50000 - 45000 + 1)) + 45000;
    const rconPassword = Math.random().toString(36).slice(2, 12);
    const username = interaction.user.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const name = `${username}_${userId}_${shortId}`;
    const version = setup.version || 'latest';
    const maxPlayers = 20;
    // Start server
    const result = await startMinecraftServer({
      port,
      name,
      version,
      maxPlayers,
      rconPort,
      rconPassword,
      motd: setup.motd,
      gamemode: setup.gamemode
    });
    const localAddress = `127.0.0.1:${port}`;
    if (result.success) {
      addUserServer({
        userId,
        containerName: `mc_${name}`,
        port,
        ip: localAddress,
        createdAt: Date.now(),
        rconPort,
        rconPassword
      });
    }
    // Build and send the embed response with server details
    const embed = buildEmbed({
      title: result.success
        ? '🎉 Minecraft Server Created!'
        : 'Minecraft Server Error',
      description: result.success
        ? `Your Minecraft server is ready! Share the address below with your friends.`
        : `There was an error starting your server.`,
      color: result.success ? 0x43b581 : 0xff5555,
      fields: [
        { name: 'Game', value: 'Minecraft', inline: true },
        { name: 'Server Name', value: `mc_${name}`, inline: true },
        { name: 'Version', value: version, inline: true },
        { name: 'Difficulty', value: setup.difficulty || 'Normal', inline: true },
        { name: 'Game Mode', value: setup.gamemode || 'Survival', inline: true },
        { name: 'MOTD', value: setup.motd || 'No MOTD set', inline: false },
        { name: 'Max Players', value: maxPlayers.toString(), inline: true },
        { name: 'Status', value: result.success ? '🟢 Running' : '🔴 Error', inline: true },
        ...(result.success
          ? [{
              name: 'Connection Info',
              value: `000
${localAddress}
000\nCopy and paste this into Minecraft to join!`
            }]
          : [{ name: 'Error', value: result.message }])
      ],
      footer: result.success
        ? 'Need help? Make sure your port is open and your firewall allows connections.'
        : undefined,
      timestamp: true
    });
    await interaction.editReply({ content: '', embeds: [embed] });
    removePendingSetup(userId);
    return;
  }
}
