import fs from 'fs';
import path from 'path';

export interface UserServer {
  userId: string;
  containerName: string;
  port: number;
  ip: string;
  createdAt: number;
  rconPort: number;
  rconPassword: string;
}

const DB_PATH = path.join(__dirname, '../../data/servers.json');

function ensureDbFile() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, '[]', 'utf-8');
  }
}

// Functions to manage user servers in a JSON file
export function addUserServer(server: UserServer) {
  ensureDbFile();
  const servers = getAllServers();
  servers.push(server);
  fs.writeFileSync(DB_PATH, JSON.stringify(servers, null, 2), 'utf-8');
}

// Remove a server by container name
export function removeUserServer(containerName: string) {
  ensureDbFile();
  let servers = getAllServers();
  servers = servers.filter(s => s.containerName !== containerName);
  fs.writeFileSync(DB_PATH, JSON.stringify(servers, null, 2), 'utf-8');
}

// Get all servers for a specific user
export function getUserServers(userId: string): UserServer[] {
  ensureDbFile();
  return getAllServers().filter(s => s.userId === userId);
}

// Get all servers
export function getAllServers(): UserServer[] {
  ensureDbFile();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}
