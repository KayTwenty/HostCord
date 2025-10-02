import { SlashCommandBuilder, ChatInputCommandInteraction, CacheType, AutocompleteInteraction } from 'discord.js';
import { getUserServers } from '../backend/serverDb';
import { buildEmbed } from '../handlers/embedBuilder';
import { exec } from 'child_process';
import { sendRconMessage } from '../backend/rconUtil';

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Show status of one of your Minecraft servers')
  .addStringOption(option =>
    option.setName('container')
      .setDescription('The container name of the server to check')
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
    title: 'Fetching Status',
    description: `Gathering status for \`${containerName}\`...`,
    color: 0x57a8ff
  })] });

  // Get Docker stats (uptime, CPU, memory)
  exec(`docker inspect -f "{{.State.StartedAt}}" ${containerName}`, async (err, stdout) => {
    let uptime = 'Unknown';
    if (!err && stdout) {
      const started = new Date(stdout.trim());
      const now = new Date();
      const diff = Math.floor((now.getTime() - started.getTime()) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      uptime = `${h}h ${m}m ${s}s`;
    }

    exec(`docker stats --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}" ${containerName}`, async (err2, stdout2) => {
      let cpu = 'Unknown', mem = 'Unknown';
      if (!err2 && stdout2) {
        [cpu, mem] = stdout2.trim().split('|');
      }

      // Get player count via RCON
      let players = 'Unknown';
      if (found.rconPort && found.rconPassword && found.ip) {
        const rconRes = await sendRconMessage({
          host: found.ip.split(':')[0],
          port: found.rconPort,
          password: found.rconPassword,
          message: 'list',
          raw: true
        });
        if (rconRes.success && rconRes.result) {
          // Typical response: "There are 1 of a max 20 players online: Player1"
          const match = rconRes.result.match(/There are (\d+) of a max (\d+) players online/);
          if (match) {
            players = `${match[1]} / ${match[2]}`;
          } else {
            players = rconRes.result;
          }
        } else if (rconRes.error) {
          players = `RCON error: ${rconRes.error}`;
        }
      }

      const embed = buildEmbed({
        title: `Status: ${containerName}`,
        color: 0x57a8ff,
        fields: [
          { name: 'Uptime', value: uptime, inline: true },
          { name: 'CPU', value: cpu, inline: true },
          { name: 'Memory', value: mem, inline: true },
          { name: 'Players', value: players, inline: true },
        ],
        timestamp: true
      });
      await interaction.editReply({ embeds: [embed] });
    });
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
