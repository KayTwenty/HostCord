import type { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

import type { AutocompleteInteraction } from 'discord.js';

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}
