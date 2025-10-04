import { Client } from 'discord.js';
import { log } from './logger';

// This should be set to your bot client instance in index.ts
let discordClient: Client | null = null;

export function setDiscordClient(client: Client) {
  discordClient = client;
}

/**
 * Notify a user in Discord that their server was stopped for resource overuse.
 * @param userId Discord user ID
 * @param serverName Name of the Minecraft server/container
 * @param cpu CPU usage percent
 * @param mem Memory usage in MB
 */
export async function notifyUserResourceLimit(userId: string, serverName: string, cpu: number, mem: number) {
  if (!discordClient) {
    log('[DiscordNotify] Discord client not set!');
    return;
  }
  try {
    const user = await discordClient.users.fetch(userId);
    if (user) {
      await user.send(`⚠️ Your Minecraft server \`${serverName}\` was stopped for exceeding resource limits.\nCPU: ${cpu}% | Memory: ${mem}MB`);
    }
  } catch (err) {
    log(`[DiscordNotify] Failed to notify user ${userId}: ${err}`);
  }
}
