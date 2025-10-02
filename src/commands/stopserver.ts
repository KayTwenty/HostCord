import { SlashCommandBuilder, ChatInputCommandInteraction, CacheType, AutocompleteInteraction } from 'discord.js';
import { getUserServers, removeUserServer } from '../backend/serverDb';
import { sendRconMessage } from '../backend/rconUtil';
import { buildEmbed } from '../handlers/embedBuilder';
import { exec } from 'child_process';

export const data = new SlashCommandBuilder()
  .setName('stopserver')
  .setDescription('Stop one of your Minecraft servers')
  .addStringOption(option =>
    option.setName('container')
      .setDescription('The container name of the server to stop')
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

  // Check player count via RCON first
  const { rconPort, rconPassword, ip } = found;
  let playerCount = undefined;
  if (rconPort && rconPassword && ip) {
    const rconRes = await sendRconMessage({
      host: ip.split(':')[0],
      port: rconPort,
      password: rconPassword,
      message: 'list',
      raw: true
    });
    if (rconRes.success && rconRes.result) {
      const match = rconRes.result.match(/There are (\d+) of a max (\d+) players online/);
      if (match) playerCount = parseInt(match[1], 10);
    }
  }

  if (playerCount === 0) {
    await interaction.reply({ embeds: [buildEmbed({
      title: 'No Players Online',
      description: `No players are online. Stopping and deleting server immediately.`,
      color: 0xffaa00
    })] });
    exec(`docker stop ${containerName} && docker rm -v ${containerName}`, (error, stdout, stderr) => {
      if (error) {
        interaction.editReply({ embeds: [buildEmbed({
          title: 'Failed to Stop Server',
          description: `Failed to stop and delete server:\n\n\`\`\`${stderr || error.message}\`\`\``,
          color: 0xff5555
        })] });
      } else {
        removeUserServer(containerName);
        interaction.editReply({ embeds: [buildEmbed({
          title: 'Server Stopped',
          description: `Server \n\`\`\`${containerName}\`\`\` stopped and deleted (including its data volume).`,
          color: 0x55ff55
        })] });
      }
    });
    return;
  }

  await interaction.reply({ embeds: [buildEmbed({
    title: 'Warning Players',
    description: `Sending in-game warning to players. Server will stop in 30 seconds...`,
    color: 0xffaa00
  })] });

  // Send RCON warning
  let rconResult: { success: boolean; error?: string; result?: string } = { success: false, error: 'Not attempted' };
  if (rconPort && rconPassword && ip) {
    rconResult = await sendRconMessage({
      host: ip.split(':')[0],
      port: rconPort,
      password: rconPassword,
      message: 'Server will stop in 30 seconds! Please disconnect safely.'
    });
  }

  if (!rconResult.success) {
    await interaction.editReply({ embeds: [buildEmbed({
      title: 'Warning Failed',
      description: `Could not send in-game warning (RCON failed): ${rconResult.error || 'Unknown error'}. Stopping anyway in 30 seconds.`,
      color: 0xffaa00
    })] });
  }

  // Wait 30 seconds before stopping
  await new Promise(res => setTimeout(res, 30000));

  await interaction.editReply({ embeds: [buildEmbed({
    title: 'Stopping Server',
    description: `Stopping and deleting server (this cannot be undone):\n\n\`\`\`${containerName}\`\`\`...`,
    color: 0xffaa00
  })] });
  exec(`docker stop ${containerName} && docker rm -v ${containerName}`, (error, stdout, stderr) => {
    if (error) {
      interaction.editReply({ embeds: [buildEmbed({
        title: 'Failed to Stop Server',
        description: `Failed to stop and delete server:\n\n\`\`\`${stderr || error.message}\`\`\``,
        color: 0xff5555
      })] });
    } else {
      removeUserServer(containerName);
      interaction.editReply({ embeds: [buildEmbed({
        title: 'Server Stopped',
        description: `Server \n\`\`\`${containerName}\`\`\` stopped and deleted (including its data volume).`,
        color: 0x55ff55
      })] });
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
