#!/usr/bin/env node
import { run } from '../src/cli.js';
import { FxError } from '../src/errors.js';
import { c } from '../src/ui.js';

run(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code ?? 0;
  })
  .catch((err) => {
    if (err instanceof FxError) {
      console.error(`${c.red('✖')} ${err.message}`);
      if (err.hint) console.error(`  ${c.gray(err.hint)}`);
    } else {
      console.error(c.red(process.env.FXFORGE_DEBUG ? err.stack : err.message));
    }
    process.exitCode = 1;
  });
