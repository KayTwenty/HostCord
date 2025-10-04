// Resource usage limits
const CPU_LIMIT_PERCENT = 90;
const MEM_LIMIT_MB = 4096;

import { notifyUserResourceLimit } from '../handlers/discordNotify';
import { getAllServers } from './serverDb';

// Notify the owner of a container if resource limits are exceeded
async function notifyResourceLimit(containerName: string, cpu: number, mem: number) {
  log(`[MC] Resource limit exceeded for ${containerName}: CPU ${cpu}% MEM ${mem}MB. Stopping server.`);
  // Find userId from serverDb
  const server = getAllServers().find(s => s.containerName === containerName);
  if (server) {
    await notifyUserResourceLimit(server.userId, containerName, cpu, mem);
  }
}


// Track consecutive violations for each container
const resourceViolationCounts: Record<string, number> = {};
const REQUIRED_VIOLATIONS = 3; // Number of consecutive violations before stopping

setInterval(async () => {
  exec('docker stats --no-stream --format "{{.Name}} {{.CPUPerc}} {{.MemUsage}}"', async (err, stdout) => {
    if (err || !stdout) return;
    const lines = stdout.split('\n').filter(Boolean);
    const seen: Set<string> = new Set();
    for (const line of lines) {
      const [name, cpuStr, memStr] = line.split(' ');
      if (!name.startsWith('mc_')) continue;
      seen.add(name);
      const cpu = parseFloat(cpuStr.replace('%', ''));
      // memStr example: "1.23GiB/4GiB" or "512MiB/2GiB"
      const memUsed = memStr.split('/')[0];
      let memMB = 0;
      if (memUsed.toLowerCase().endsWith('gib')) memMB = parseFloat(memUsed) * 1024;
      else if (memUsed.toLowerCase().endsWith('mib')) memMB = parseFloat(memUsed);
      else if (memUsed.toLowerCase().endsWith('kb')) memMB = parseFloat(memUsed) / 1024;
      if (cpu > CPU_LIMIT_PERCENT || memMB > MEM_LIMIT_MB) {
        resourceViolationCounts[name] = (resourceViolationCounts[name] || 0) + 1;
        if (resourceViolationCounts[name] >= REQUIRED_VIOLATIONS) {
          exec(`docker stop ${name}`, (stopErr) => {
            if (!stopErr) notifyResourceLimit(name, cpu, memMB);
          });
          resourceViolationCounts[name] = 0; // Reset after action
        }
      } else {
        resourceViolationCounts[name] = 0;
      }
    }
    // Clean up counts for containers that no longer exist
    for (const name in resourceViolationCounts) {
      if (!seen.has(name)) delete resourceViolationCounts[name];
    }
  });
}, 60 * 1000); // Check every 60 seconds
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

/**
 * Checks the status/health of a Minecraft server container by name.
 * Returns { running: boolean, portOpen: boolean, status: string }
 */
export function getMinecraftServerStatus(containerName: string, port: number): Promise<{ running: boolean; portOpen: boolean; status: string }> {
  return new Promise((resolve) => {
    exec(`docker inspect -f '{{.State.Running}}' ${containerName}`, (err, stdout) => {
      if (err || !stdout) {
        resolve({ running: false, portOpen: false, status: 'not found' });
        return;
      }
      const running = stdout.trim() === 'true';
      if (!running) {
        resolve({ running: false, portOpen: false, status: 'stopped' });
        return;
      }
      // Optionally check if the Minecraft port is open
      const net = require('net');
      const socket = new net.Socket();
      let portOpen = false;
      let resolved = false;
      socket.setTimeout(2000);
      socket.on('connect', () => {
        portOpen = true;
        socket.destroy();
      });
      socket.on('timeout', () => {
        socket.destroy();
      });
      socket.on('error', () => {
        socket.destroy();
      });
      socket.on('close', () => {
        if (!resolved) {
          resolved = true;
          resolve({ running: true, portOpen, status: portOpen ? 'running' : 'unreachable' });
        }
      });
      socket.connect(port, '127.0.0.1');
    });
  });
}
