import { readFileSync } from 'node:fs';
import { parseArgs } from './args.js';
import { add } from './commands/add.js';
import { check } from './commands/check.js';
import { create } from './commands/create.js';
import { pack } from './commands/pack.js';
import { FxError } from './errors.js';
import { renderBanner } from './banner.js';
import { c, setBanner } from './ui.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const help = (logo) => `${logo ? renderBanner('fxforge', `v${pkg.version} · scaffold, lint and package FiveM resources · crafted by FreshDev`) : `\n ${c.orange('▲')} ${c.bold('fxforge')} ${c.gray(`v${pkg.version}`)} ${c.gray('— scaffold, lint and package FiveM resources')}\n`}
 ${c.bold('Usage')}
   fxforge <command> [options]

 ${c.bold('Commands')}
   ${c.cyan('create')} ${c.gray('[name]')}            Scaffold a new resource ${c.gray('(interactive without flags)')}
   ${c.cyan('check')}  ${c.gray('[dir]')}             Lint fxmanifest.lua and the files it references
   ${c.cyan('pack')}   ${c.gray('[dir]')}             Build a release .zip with only the files the manifest uses
   ${c.cyan('add')}    ${c.gray('<kind> [name]')}     Add client | server | shared | locale | nui to a resource

 ${c.bold('create')}
   --framework <standalone|esx|qbcore|qbox>
   --nui <none|vanilla|vite>
   --description <text>   --author <name>   --locale <en|fr>
   --dir <parent folder>  --no-git   --force   -y, --yes

 ${c.bold('check')}
   --json      machine-readable output
   --strict    exit with code 1 on warnings too

 ${c.bold('pack')}
   --out <dir>        output folder ${c.gray('(default: dist/)')}
   --include <globs>  comma-separated extra files
   --all              ship every file except dev-only ones
   --force            pack even if check finds errors
   --verbose          list left-out files

 ${c.bold('Global')}
   --no-banner        hide the FreshDev logo
   -v, --version      print the version

 ${c.bold('Examples')}
   ${c.gray('$')} fxforge create garage --framework esx --nui vanilla
   ${c.gray('$')} fxforge check ./resources/[local]/garage
   ${c.gray('$')} fxforge add server billing
   ${c.gray('$')} fxforge pack --out ./releases
`;

const COMMANDS = {
  create,
  new: create,
  init: create,
  check,
  lint: check,
  pack,
  build: pack,
  add,
};

export async function run(argv) {
  const { positional, flags } = parseArgs(argv);
  const [command, ...rest] = positional;
  setBanner(!flags['no-banner']);

  if (flags.version || flags.v) {
    console.log(pkg.version);
    return 0;
  }
  if (!command || flags.help || flags.h || command === 'help') {
    console.log(help(!flags['no-banner']));
    return 0;
  }
  const handler = COMMANDS[command];
  if (!handler) throw new FxError(`Unknown command '${command}'`, 'Run fxforge --help to see available commands');
  return handler(rest, flags);
}
