import { spawn } from 'node:child_process';

const port = process.env.PORT || '8787';
const child = spawn(
  'pnpm',
  [
    'exec',
    'wrangler',
    'dev',
    '--config',
    'dist/server/wrangler.json',
    '--ip',
    '0.0.0.0',
    '--port',
    port,
  ],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

const shutdown = (signal) => {
  child.kill(signal);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
