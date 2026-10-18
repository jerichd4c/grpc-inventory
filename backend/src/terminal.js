import * as readline from 'node:readline';
import { stdin, stdout } from 'node:process';

const rl = readline.createInterface({ input: stdin, output: stdout });

// Reading lines through an iterator (instead of rl.question) never loses a
// line, even when the input is piped from a file: lines wait in a queue.
const lines = rl[Symbol.asyncIterator]();

// Ctrl+C closes the input, so the menu loop ends cleanly (same as Ctrl+D).
rl.on('SIGINT', () => rl.close());

// Thrown by ask() when there is no more input to read.
export class InputClosed extends Error {}

export async function ask(question) {
  stdout.write(question);
  const { value, done } = await lines.next();
  if (done) throw new InputClosed();
  return value.trim();
}

export function closeTerminal() {
  rl.close();
}
