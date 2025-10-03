import { exec } from 'child_process';
import { log } from '../handlers/logger';

export interface MinecraftServerOptions {
  port: number;
  name: string;
  maxPlayers?: number;
  version?: string;
  rconPort: number;
  rconPassword: string;
  motd?: string;
  gamemode?: string;
}

export function startMinecraftServer(options: MinecraftServerOptions): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const containerName = `mc_${options.name}`;
    const port = options.port;
    const maxPlayers = options.maxPlayers || 20;
    const version = options.version || 'latest';
    const rconPort = options.rconPort;
    const rconPassword = options.rconPassword;
    const motd = options.motd;
    const gamemode = options.gamemode;
    // Always use latest image, set VERSION env for custom version
    const versionEnv = version !== 'latest' ? `-e VERSION=${version}` : '';
    // Set MEMORY=2G for JVM and -m 4g for Docker
    const memoryEnv = '-e MEMORY=2G';
    const memoryLimit = '-m 4g';
  const motdEnv = motd ? `-e MOTD=\"${motd.replace(/"/g, '')}\"` : '';
  const gamemodeEnv = gamemode ? `-e GAMEMODE=${gamemode}` : '';
  const cmd = `docker run -d --name ${containerName} ${memoryLimit} -e EULA=TRUE -e MAX_PLAYERS=${maxPlayers} ${versionEnv} ${memoryEnv} -e ENABLE_RCON=true -e RCON_PORT=${rconPort} -e RCON_PASSWORD=${rconPassword} ${motdEnv} ${gamemodeEnv} -p ${port}:25565 -p ${rconPort}:${rconPort} itzg/minecraft-server:latest`;
  log(`[MC] Creating container: ${containerName} on port ${port} (maxPlayers: ${maxPlayers}, version: ${version}, rconPort: ${rconPort}, motd: ${motd || ''}, gamemode: ${gamemode || ''})`);
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        log(`[MC] Error creating container ${containerName}: ${stderr || error.message}`);
        resolve({ success: false, message: stderr || error.message });
      } else {
        log(`[MC] Server started! Container: ${containerName}, Port: ${port}, RCON: ${rconPort}, DockerID: ${stdout.trim()}`);
        resolve({ success: true, message: `Server started! Container: ${containerName}, Port: ${port}` });
      }
    });
  });
}

export function listMinecraftServers(): Promise<string[]> {
  return new Promise((resolve) => {
    exec('docker ps --filter "name=mc_" --format "{{.Names}}"', (error, stdout) => {
      if (error) {
        log(`[MC] Error listing containers: ${error.message}`);
        resolve([]);
      } else {
        const containers = stdout.split('\n').filter(Boolean);
        log(`[MC] Currently running containers: ${containers.join(', ') || 'None'}`);
        resolve(containers);
      }
    });
  });
}
