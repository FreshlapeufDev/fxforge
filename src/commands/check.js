import { relative } from 'node:path';
import { analyze, summarize } from '../analyze.js';
import { banner, c } from '../ui.js';

const LEVELS = {
  error: { icon: () => c.red('✖'), label: (s) => c.red(s) },
  warn: { icon: () => c.yellow('▲'), label: (s) => c.yellow(s) },
  info: { icon: () => c.blue('•'), label: (s) => c.blue(s) },
};

export function printReport(result) {
  const order = ['error', 'warn', 'info'];
  const sorted = [...result.issues].sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
  for (const issue of sorted) {
    const level = LEVELS[issue.level];
    const where = issue.line ? c.gray(`fxmanifest.lua:${issue.line}`) : '';
    console.log(`  ${level.icon()} ${issue.message} ${c.gray(`[${issue.code}]`)} ${where}`.trimEnd());
    if (issue.hint) console.log(`    ${c.gray(`↳ ${issue.hint}`)}`);
  }
  const { errors, warnings, infos } = summarize(result.issues);
  if (result.issues.length === 0) {
    console.log(`  ${c.green('✔')} Manifest looks clean`);
  }
  console.log(
    `\n  ${errors ? c.red(`${errors} error${errors > 1 ? 's' : ''}`) : c.green('0 errors')} ${c.gray('·')} ${
      warnings ? c.yellow(`${warnings} warning${warnings > 1 ? 's' : ''}`) : c.gray('0 warnings')
    } ${c.gray('·')} ${c.gray(`${infos} info`)}\n`,
  );
}

export async function check(args, flags) {
  const dir = args[0] ?? '.';
  const result = analyze(dir);
  const { errors, warnings } = summarize(result.issues);

  if (flags.json) {
    console.log(JSON.stringify({ root: result.root, ...summarize(result.issues), issues: result.issues }, null, 2));
  } else {
    banner(`check ${relative(process.cwd(), result.root) || '.'}`);
    printReport(result);
  }

  if (errors > 0) return 1;
  if (flags.strict && warnings > 0) return 1;
  return 0;
}
