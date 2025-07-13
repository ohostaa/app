import { spawn } from 'child_process';

const server = spawn('java', [
  '-Xmx600',
  '-Xms600M',
  '-jar',
  'server.jar',
  'nogui'
], { stdio: 'inherit' });

server.on('close', (code) => {
  console.log(`Minecraft server exited with code ${code}`);
});
