import fs from 'fs';
import path from 'path';

export interface PendingServerSetup {
  userId: string;
  difficulty?: string;
  gamemode?: string;
  version?: string;
  motd?: string;
  step: 'difficulty' | 'gamemode' | 'version' | 'motd' | 'complete';
  timestamp: number;
}

const TEMP_PATH = path.join(__dirname, '../../data/pending_servers.json');

function ensureTempFile() {
  if (!fs.existsSync(TEMP_PATH)) {
    fs.mkdirSync(path.dirname(TEMP_PATH), { recursive: true });
    fs.writeFileSync(TEMP_PATH, '[]', 'utf-8');
  }
}

export function savePendingSetup(setup: PendingServerSetup) {
  ensureTempFile();
  const setups = getAllPendingSetups().filter(s => s.userId !== setup.userId);
  setups.push(setup);
  fs.writeFileSync(TEMP_PATH, JSON.stringify(setups, null, 2), 'utf-8');
}

export function getPendingSetup(userId: string): PendingServerSetup | undefined {
  ensureTempFile();
  return getAllPendingSetups().find(s => s.userId === userId);
}

export function getAllPendingSetups(): PendingServerSetup[] {
  ensureTempFile();
  return JSON.parse(fs.readFileSync(TEMP_PATH, 'utf-8'));
}

export function removePendingSetup(userId: string) {
  ensureTempFile();
  const setups = getAllPendingSetups().filter(s => s.userId !== userId);
  fs.writeFileSync(TEMP_PATH, JSON.stringify(setups, null, 2), 'utf-8');
}
