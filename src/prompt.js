import { createInterface } from 'node:readline/promises';
import { c } from './ui.js';

export function canPrompt(flags) {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY) && !flags.yes && !flags.y;
}

export function openPrompt() {
  return createInterface({ input: process.stdin, output: process.stdout });
}

export async function ask(rl, question, fallback) {
  const suffix = fallback ? c.gray(` ${fallback}`) : '';
  const answer = (await rl.question(`${c.orange('›')} ${question}${suffix} `)).trim();
  return answer || fallback;
}

export async function choose(rl, question, options, fallbackKey) {
  const keys = Object.keys(options);
  const fallbackIndex = Math.max(keys.indexOf(fallbackKey), 0);
  console.log(`${c.orange('›')} ${question}`);
  keys.forEach((key, index) => {
    const marker = index === fallbackIndex ? c.orange('●') : c.gray('○');
    console.log(`  ${marker} ${c.gray(`${index + 1}`)} ${options[key]}`);
  });
  while (true) {
    const raw = (await rl.question(c.gray(`  1-${keys.length} `))).trim();
    if (!raw) return keys[fallbackIndex];
    const byIndex = Number(raw);
    if (Number.isInteger(byIndex) && byIndex >= 1 && byIndex <= keys.length) return keys[byIndex - 1];
    if (keys.includes(raw)) return raw;
    console.log(`  ${c.red('Pick a number between 1 and')} ${keys.length}`);
  }
}
