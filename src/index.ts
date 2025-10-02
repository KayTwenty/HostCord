
import { Client, GatewayIntentBits, Events, Collection, Interaction } from 'discord.js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { registerSlashCommands } from './handlers/slashCommandHandler';
import { log } from './handlers/logger';
import type { Command } from './types';

// Shitty workaround for dotenv warning spam
config({quiet : true});

interface CustomClient extends Client {
  commands: Collection<string, Command>;
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
}) as CustomClient;
client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
const commands: Command[] = [];

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    commands.push(command);
  }
}


client.once(Events.ClientReady, async (readyClient) => {
  log(`Logged in as ${readyClient.user.tag}!`);
  try {
    log('Registering slash commands...');
    const result = await registerSlashCommands(commands);
    log(result);
  } catch (error) {
    log('Error registering slash commands: ' + error);
  }
});


client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (error) {
      log('Error executing command: ' + error);
      await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
    }
  } else if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (command && typeof command.autocomplete === 'function') {
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        log('Error in autocomplete handler: ' + error);
      }
    }
  }
});

client.login(process.env.BOT_TOKEN);
