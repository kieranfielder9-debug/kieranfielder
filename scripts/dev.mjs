// Runs the API/edge server and the Vite dev server together.
import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';

execSync('npx tsc -b packages/core apps/server', { stdio: 'inherit' });
const procs = [
  spawn('node', ['--watch', 'apps/server/dist/index.js'], { stdio: 'inherit', env: { ...process.env, PORT: process.env.PORT ?? '8787' } }),
  spawn('npx', ['vite', '--host'], { cwd: 'apps/editor', stdio: 'inherit', shell: true }),
];
const stop = () => procs.forEach((p) => p.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
