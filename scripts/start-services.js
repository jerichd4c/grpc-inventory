// Starts both microservices from a single terminal. Ctrl+C stops both.
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SERVERS = [
  join(ROOT, 'services', 'report', 'src', 'server.js'),
  join(ROOT, 'services', 'audit', 'src', 'server.js'),
];

// Each service runs as its own process, exactly as if started by hand.
// stdio 'inherit' prints their output here; it already says [report] or [audit].
const children = SERVERS.map((server) => spawn(process.execPath, [server], { stdio: 'inherit' }));

// Ctrl+C reaches every process in the terminal, so each service shuts itself
// down. This process just waits for them instead of exiting first.
process.on('SIGINT', () => {});

let running = children.length;
for (const child of children) {
  child.on('exit', (code) => {
    running -= 1;

    // If one service fails (for example, its port is busy), stop the other.
    if (code !== 0) {
      process.exitCode = 1;
      for (const other of children) {
        if (other.exitCode === null) other.kill();
      }
    }

    if (running === 0) process.exit();
  });
}
