import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { FxError } from '../errors.js';
import { ask, canPrompt, choose, openPrompt } from '../prompt.js';
import { buildResource, commandFor } from '../templates/resource.js';
import { FRAMEWORKS, NUI_KINDS } from '../templates/frameworks.js';
import { banner, c, printTree } from '../ui.js';

const NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

function gitAuthor() {
  try {
    return execSync('git config user.name', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || undefined;
  } catch {
    return undefined;
  }
}

function frameworkFlag(value) {
  if (value === undefined) return undefined;
  const key = String(value).toLowerCase().replace(/[^a-z]/g, '');
  const aliases = { qb: 'qbcore', qbx: 'qbox', none: 'standalone', esxlegacy: 'esx' };
  const resolved = aliases[key] ?? key;
  if (!FRAMEWORKS[resolved]) throw new FxError(`Unknown framework '${value}'`, `Use one of: ${Object.keys(FRAMEWORKS).join(', ')}`);
  return resolved;
}

function nuiFlag(value) {
  if (value === undefined) return undefined;
  if (value === true) return 'vanilla';
  const key = String(value).toLowerCase();
  const aliases = { html: 'vanilla', js: 'vanilla', ts: 'vite', false: 'none', no: 'none' };
  const resolved = aliases[key] ?? key;
  if (!NUI_KINDS[resolved]) throw new FxError(`Unknown NUI kind '${value}'`, `Use one of: ${Object.keys(NUI_KINDS).join(', ')}`);
  return resolved;
}

export async function create(args, flags) {
  banner('create a resource');
  const interactive = canPrompt(flags);
  const rl = interactive ? openPrompt() : null;
  try {
    let name = args[0];
    if (!name && rl) name = await ask(rl, 'Resource name', 'my_resource');
    if (!name) throw new FxError('Missing resource name', 'Usage: fxforge create <name> [--framework esx] [--nui vanilla]');
    if (!NAME_PATTERN.test(name)) {
      throw new FxError(`Invalid resource name '${name}'`, 'Use lowercase letters, digits, - and _ (must start with a letter or digit)');
    }

    let framework = frameworkFlag(flags.framework ?? flags.f);
    if (!framework && rl) {
      framework = await choose(rl, 'Framework', Object.fromEntries(Object.entries(FRAMEWORKS).map(([key, fw]) => [key, fw.label])), 'standalone');
    }
    framework = framework ?? 'standalone';

    let nui = nuiFlag(flags.nui);
    if (!nui && rl) nui = await choose(rl, 'Interface (NUI)', NUI_KINDS, 'none');
    nui = nui ?? 'none';

    let description = typeof flags.description === 'string' ? flags.description : undefined;
    if (!description && rl) description = await ask(rl, 'Description', 'A FiveM resource');

    const author = typeof flags.author === 'string' ? flags.author : gitAuthor() ?? 'unknown';
    const locale = typeof flags.locale === 'string' ? flags.locale.toLowerCase() : 'en';
    if (!['en', 'fr'].includes(locale)) throw new FxError(`Unsupported locale '${locale}'`, 'Use en or fr');

    const parent = resolve(typeof flags.dir === 'string' ? flags.dir : process.cwd());
    const target = join(parent, name);
    if (existsSync(target) && readdirSync(target).length > 0 && !flags.force) {
      throw new FxError(`'${relative(process.cwd(), target) || target}' already exists and is not empty`, 'Pick another name or pass --force to write into it');
    }

    const entries = buildResource({ name, author, description: description ?? 'A FiveM resource', framework, nui, locale });
    for (const entry of entries) {
      const file = join(target, entry.path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, entry.content);
    }

    if (!flags['no-git'] && !existsSync(join(target, '.git'))) {
      try {
        execSync('git init -q', { cwd: target, stdio: 'ignore' });
      } catch {}
    }

    console.log(`${c.green('✔')} Created ${c.bold(name)} ${c.gray(`(${FRAMEWORKS[framework].label} · ${NUI_KINDS[nui]})`)}\n`);
    printTree(entries.map((entry) => `${name}/${entry.path}`));

    const where = relative(process.cwd(), target) || '.';
    console.log(`\n${c.bold('Next steps')}`);
    console.log(`  ${c.gray('1.')} cd ${where}`);
    if (nui === 'vite') console.log(`  ${c.gray('2.')} cd web && npm install && npm run build`);
    console.log(`  ${c.gray(nui === 'vite' ? '3.' : '2.')} add ${c.cyan(`ensure ${name}`)} to server.cfg`);
    console.log(`  ${c.gray(nui === 'vite' ? '4.' : '3.')} type ${c.cyan(`/${commandFor(name)}`)} in game\n`);
    return 0;
  } finally {
    rl?.close();
  }
}
