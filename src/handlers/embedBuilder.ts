import { EmbedBuilder, APIEmbedField } from 'discord.js';

interface EmbedOptions {
  title?: string;
  description?: string;
  color?: number;
  fields?: APIEmbedField[];
  footer?: string;
  timestamp?: boolean;
  thumbnail?: string;
  image?: string;
}

export function buildEmbed(options: EmbedOptions = {}) {
  const embed = new EmbedBuilder();
  if (options.title) embed.setTitle(options.title);
  if (options.description) embed.setDescription(options.description);
  if (options.color) embed.setColor(options.color);
  if (options.fields) embed.addFields(options.fields);
  if (options.footer) embed.setFooter({ text: options.footer });
  if (options.timestamp) embed.setTimestamp();
  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  if (options.image) embed.setImage(options.image);
  return embed;
}
