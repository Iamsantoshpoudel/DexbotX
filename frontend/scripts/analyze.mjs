import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const nextCli = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const processBuild = spawn(process.execPath, [nextCli, 'build', '--webpack'], {
  stdio: 'inherit',
  env: { ...process.env, ANALYZE: 'true' },
});

processBuild.on('error', (error) => {
  console.error(`Unable to start the bundle analysis build: ${error.message}`);
  process.exitCode = 1;
});

processBuild.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
