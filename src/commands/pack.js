import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { analyze, summarize } from '../analyze.js';
import { FxError } from '../errors.js';
import { createZip } from '../zip.js';
import { globToRegExp, normalize } from '../glob.js';
import { banner, c, formatBytes } from '../ui.js';
import { printReport } from './check.js';

const ALWAYS = [/^fxmanifest\.lua$/, /^stream\//, /^(readme|license|licence|changelog)(\.[a-z]+)?$/i];
const DEV_ONLY = [/^dist\//, /^\.github\//, /^\.gitignore$/, /^\.gitattributes$/, /\.zip$/i, /(^|\/)node_modules\//, /^web\/src\//, /^web\/(package(-lock)?\.json|tsconfig\.json|vite\.config\.[jt]s|pnpm-lock\.yaml|yarn\.lock)$/];

export async function pack(args, flags) {
  const dir = resolve(args[0] ?? '.');
  banner(`pack ${relative(process.cwd(), dir) || '.'}`);
  const result = analyze(dir);
  const { errors } = summarize(result.issues);

  if (!result.manifest) {
    printReport(result);
    throw new FxError('Nothing to pack');
  }
  if (errors > 0 && !flags.force) {
    printReport(result);
    throw new FxError('Fix the errors above before packing', 'Or pass --force to pack anyway');
  }

  const name = basename(dir);
  const version = result.manifest.meta.version?.value;
  const include = new Set();

  if (flags.all) {
    for (const file of result.files) if (!DEV_ONLY.some((re) => re.test(file))) include.add(file);
  } else {
    const { client, server, shared, files, extras } = result.resolved;
    for (const set of [client, server, shared, files, extras]) for (const file of set) include.add(file);
    for (const file of result.files) if (ALWAYS.some((re) => re.test(file))) include.add(file);
  }

  const extra = typeof flags.include === 'string' ? flags.include.split(',').map((p) => normalize(p.trim())).filter(Boolean) : [];
  for (const pattern of extra) {
    const re = globToRegExp(pattern);
    for (const file of result.files) if (re.test(file)) include.add(file);
  }

  const list = [...include].sort();
  const entries = list.map((file) => {
    const full = join(dir, file);
    return { name: `${name}/${file}`, data: readFileSync(full), date: statSync(full).mtime };
  });

  const outDir = resolve(typeof flags.out === 'string' ? flags.out : join(dir, 'dist'));
  mkdirSync(outDir, { recursive: true });
  const archive = join(outDir, `${name}${version ? `-${version}` : ''}.zip`);
  const zip = createZip(entries);
  writeFileSync(archive, zip);

  const skipped = result.files.filter((file) => !include.has(file) && !file.startsWith(`${relative(dir, outDir)}/`));
  const rawSize = entries.reduce((sum, entry) => sum + entry.data.length, 0);

  console.log(`  ${c.green('✔')} ${c.bold(relative(process.cwd(), archive))}`);
  console.log(`    ${list.length} files ${c.gray('·')} ${formatBytes(rawSize)} → ${formatBytes(zip.length)}`);
  if (skipped.length > 0 && !flags.all) {
    console.log(`    ${c.gray(`${skipped.length} file${skipped.length > 1 ? 's' : ''} left out (not used by the manifest)`)}`);
    if (flags.verbose) for (const file of skipped) console.log(`      ${c.gray(`- ${file}`)}`);
  }
  const { warnings } = summarize(result.issues);
  if (warnings > 0) console.log(`    ${c.yellow(`${warnings} warning${warnings > 1 ? 's' : ''}`)} ${c.gray('— run fxforge check for details')}`);
  console.log('');
  return 0;
}
