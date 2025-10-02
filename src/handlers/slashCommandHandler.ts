import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types.ts';
import { config } from 'dotenv';

config();

export async function registerSlashCommands(commands: Command[]) {
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN!);
  const commandsForAPI = commands.map(cmd => cmd.data.toJSON());
  try {
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID),
        { body: commandsForAPI },
      );
      return 'Guild slash commands registered!';
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID!),
        { body: commandsForAPI },
      );
      return 'Global slash commands registered!';
    }
  } catch (error) {
    throw error;
  }
}
