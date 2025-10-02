import { SlashCommandBuilder, ChatInputCommandInteraction, CacheType, AutocompleteInteraction } from 'discord.js';
import { getUserServers } from '../backend/serverDb';
import { sendRconMessage } from '../backend/rconUtil';
import { buildEmbed } from '../handlers/embedBuilder';
import { exec } from 'child_process';

export const data = new SlashCommandBuilder()
  .setName('restartserver')
  .setDescription('Restart one of your Minecraft servers')
  .addStringOption(option =>
    option.setName('container')
      .setDescription('The container name of the server to restart')
      .setRequired(true)
      .setAutocomplete(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const containerName = interaction.options.getString('container', true);
  const servers = getUserServers(userId);
  const found = servers.find(s => s.containerName === containerName);

  if (!found) {
    await interaction.reply({ content: 'You do not own a server with that container name.', ephemeral: true });
    return;
  }

  await interaction.reply({ content: 'Sending in-game warning to players. Server will restart in 30 seconds...' });

  // Send RCON warning
  const { rconPort, rconPassword, ip } = found;
  let rconResult: { success: boolean; error?: string; result?: string } = { success: false, error: 'Not attempted' };
  if (rconPort && rconPassword && ip) {
    rconResult = await sendRconMessage({
      host: ip.split(':')[0],
      port: rconPort,
      password: rconPassword,
      message: 'Server will restart in 30 seconds! Please prepare.'
    });
  }

  if (!rconResult.success) {
    await interaction.editReply({ content: `Could not send in-game warning (RCON failed): ${rconResult.error || 'Unknown error'}. Restarting anyway in 30 seconds.` });
  }

  // Wait 30 seconds before restarting
  await new Promise(res => setTimeout(res, 30000));

  await interaction.editReply({ content: `Restarting server \n\`\`\`${containerName}\`\`\`...` });
  exec(`docker restart ${containerName}`, (error, stdout, stderr) => {
    if (error) {
      interaction.editReply({ content: `Failed to restart server: ${stderr || error.message}` });
    } else {
      interaction.editReply({ content: `Server \n\`\`\`${containerName}\`\`\` restarted.` });
    }
  });
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
