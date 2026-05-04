import net from 'node:net';
import { execFileSync } from 'node:child_process';

const port = Number(process.env.NEXT_DEV_PORT ?? 3000);
const host = process.env.NEXT_DEV_HOST ?? '127.0.0.1';

if (process.env.ALLOW_BUILD_WITH_DEV === '1') {
  process.exit(0);
}

if (hasRunningDevProcess()) {
  failWithDevServerMessage();
}

const socket = net.createConnection({ host, port });
const timeout = setTimeout(() => {
  socket.destroy();
  process.exit(0);
}, 500);

socket.once('connect', () => {
  clearTimeout(timeout);
  socket.destroy();
  failWithDevServerMessage();
});

socket.once('error', () => {
  clearTimeout(timeout);
  process.exit(0);
});

function hasRunningDevProcess() {
  try {
    const currentPid = process.pid;
    const output = execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' });
    return output.split('\n').some((line) => {
      const match = line.trim().match(/^(\d+)\s+(.+)$/);
      if (!match) return false;
      const pid = Number(match[1]);
      const command = match[2];
      if (pid === currentPid) return false;
      return command.includes('npm run dev') || command.includes('next dev');
    });
  } catch {
    return false;
  }
}

function failWithDevServerMessage() {
  console.error(
    `Refusing to run production build while a dev server is active on ${host}:${port}.\n` +
    'Stop `npm run dev` first, then rerun `npm run build`. This prevents Next from corrupting the localhost webpack cache.'
  );
  process.exit(1);
}
