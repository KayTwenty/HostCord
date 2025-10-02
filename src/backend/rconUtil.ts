import { Rcon } from 'rcon-client';

export async function sendRconMessage({ host, port, password, message, raw }: { host: string, port: number, password: string, message: string, raw?: boolean }) {
  const rcon = new Rcon({ host, port, password });
  try {
    await rcon.connect();
    const cmd = raw ? message : `say ${message}`;
    const result = await rcon.send(cmd);
    await rcon.end();
    return { success: true, result };
  } catch (err) {
    await rcon.end().catch(() => {});
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
