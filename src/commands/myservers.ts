import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { getUserServers } from '../backend/serverDb';
import { buildEmbed } from '../handlers/embedBuilder';

export const data = new SlashCommandBuilder()
  .setName('myservers')
  .setDescription('List your running Minecraft servers');

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const servers = getUserServers(userId);

  if (!servers.length) {
    await interaction.reply({ content: 'You have no running Minecraft servers.', flags: MessageFlags.Ephemeral });
    return;
  }

  const fields = servers.map((s, i) => ({
    name: `Server #${i + 1}`,
    value: `Container: \
\`\`\`${s.containerName}\`\`\`\nPort: \
\`\`\`${s.port}\`\`\`\nCreated: <t:${Math.floor(s.createdAt / 1000)}:R>`
  }));

  const embed = buildEmbed({
    title: 'Your Minecraft Servers',
    description: 'Here are your currently running servers:',
    color: 0x57a8ff,
    fields,
    timestamp: true
  });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
