import fs from 'fs';
import path from 'path';

// Suppress all Node.js deprecation warnings
delete process.env.NODE_DEBUG;
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name !== 'DeprecationWarning') {
    console.warn(warning);
  }
});

const LOGS_DIR = path.join(__dirname, '../../logs');
const sessionDate = new Date().toISOString().split('T')[0];
const LOG_FILE = path.join(LOGS_DIR, `bot-${sessionDate}.log`);
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

export function log(message: string) {
  const now = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timeStr = now.toLocaleString('en-US', { timeZone: tz, hour12: false });
  const logMsg = `[${timeStr} ${tz}] ${message}`;
  console.log(logMsg);
  fs.appendFileSync(LOG_FILE, logMsg + '\n', 'utf-8');
}
