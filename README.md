<div align="center">

# ▲ fxforge

**Scaffold, lint and package FiveM resources from your terminal.**

Zero dependencies · Node 18+ · ESX · QBCore · Qbox · Standalone

</div>

```
$ npx fxforge create garage --framework esx --nui vanilla

 ▲ fxforge · create a resource

✔ Created garage (ESX Legacy · HTML / CSS / JS (no build step))

  └─ garage/
     ├─ bridge/      client.lua · server.lua
     ├─ client/      main.lua
     ├─ locales/     en.lua · fr.lua
     ├─ server/      main.lua
     ├─ shared/      locale.lua
     ├─ web/         index.html · style.css · app.js
     ├─ config.lua
     └─ fxmanifest.lua
```

## Why

Every FiveM resource starts the same way: copy an old folder, rename events, fix the manifest, forget a file in `files {}`, and discover in game that the UI is blank. And once it works on your Windows dev server, it breaks on the Linux production box because of a capital letter.

fxforge handles the boring part and catches those mistakes **before** you `ensure`.

## Install

```bash
npm install -g fxforge
```

or run it once without installing:

```bash
npx fxforge create my_resource
```

## Commands

### `fxforge create [name]`

Generates a ready-to-run resource. Without flags it asks you a few questions.

| Flag | Values | Default |
|---|---|---|
| `--framework` | `standalone` `esx` `qbcore` `qbox` | `standalone` |
| `--nui` | `none` `vanilla` `vite` | `none` |
| `--locale` | `en` `fr` | `en` |
| `--description` / `--author` | text | git user name |
| `--dir` | parent folder | current folder |
| `--no-git` `--force` `-y` | | |

What you get:

- a clean `fxmanifest.lua` with `lua54`, metadata and the right dependencies
- a **bridge layer** (`Bridge.Notify`, `Bridge.GetIdentifier`) written for the chosen framework, so your game logic stays framework-agnostic
- a tiny locale system (`Lang('key', ...)`) with English and French
- a working command → server event round trip
- optionally a NUI, either plain HTML/CSS/JS or **Vite + TypeScript** wired to `web/dist`

### `fxforge check [dir]`

Parses `fxmanifest.lua` (real tokenizer, comments and long strings included) and verifies it against the files on disk.

| Code | Level | What it catches |
|---|---|---|
| `case-mismatch` | error | `Client/Main.lua` vs `client/main.lua`: fine on Windows, broken on Linux |
| `missing-file` | error | referenced file that does not exist (with a hint for unbuilt UIs) |
| `server-file-exposed` | error | server script also listed in `files`, so **every client downloads it** |
| `ui-page-not-shipped` | error | `ui_page` not in `files`: blank screen in game |
| `nui-asset-not-shipped` | error | CSS/JS loaded by your HTML but not shipped: 404 in game |
| `unknown-fx-version` / `missing-game` | error | invalid manifest header |
| `legacy-manifest` | error | old `__resource.lua` |
| `undeclared-dependency` | warn | `@ox_lib/init.lua` used without `dependency 'ox_lib'` |
| `client-server-overlap` | warn | same file loaded on both sides instead of `shared_scripts` |
| `empty-glob` | warn | `client/*.lua` that matches nothing |
| `data-file-not-shipped` | warn | `data_file` whose file is not in `files` |
| `lua54-missing` | warn | Lua 5.4 not enabled |
| `outdated-fx-version` | warn | `bodacious` / `adamant` |
| `duplicate-entry` | warn | same entry listed twice |
| `resource-name` | warn | uppercase or spaces in the folder name |
| `unreferenced-lua` | info | Lua file never loaded |
| `missing-metadata` | info | no version, author or description |

```
$ fxforge check

  ✖ client_script 'client/Main.lua' only exists as 'client/main.lua' [case-mismatch] fxmanifest.lua:8
    ↳ Works on Windows, breaks on Linux servers
  ✖ Server script 'server/main.lua' is also listed in files [server-file-exposed]
    ↳ Every client downloads it: never ship server code or secrets
  ▲ '@ox_lib/…' is used but 'ox_lib' is not in dependencies [undeclared-dependency] fxmanifest.lua:7

  2 errors · 1 warning · 0 info
```

Use `--json` for tooling and `--strict` to fail on warnings. The exit code is `1` when errors are found, which makes it perfect for CI:

```yaml
- run: npx fxforge check --strict
```

### `fxforge pack [dir]`

Builds `dist/<name>-<version>.zip` containing **only what the manifest actually loads**, plus `stream/`, README and LICENSE. Your notes, source maps, `web/src`, `node_modules` and other dev files stay out. Refuses to pack a resource with errors unless you pass `--force`.

| Flag | |
|---|---|
| `--out <dir>` | output folder |
| `--include <globs>` | comma-separated extra files |
| `--all` | ship everything except dev-only files |
| `--verbose` | list left-out files |

### `fxforge add <kind> [name]`

```bash
fxforge add client garage     # client/garage.lua
fxforge add server billing    # server/billing.lua
fxforge add shared utils      # shared/utils.lua
fxforge add locale de         # locales/de.lua, copied from en
fxforge add nui               # web/ + ui_page + files
```

The manifest is only patched when the new file is not already covered by a glob.

## Generated layout

```
my_resource/
├─ bridge/        framework adapter (client + server)
├─ client/        client scripts
├─ server/        server scripts
├─ shared/        locale helper and shared code
├─ locales/       en.lua, fr.lua
├─ web/           NUI (optional)
├─ config.lua
└─ fxmanifest.lua
```

## Development

```bash
git clone https://github.com/<you>/fxforge
cd fxforge
npm test
npm link        # use your local copy as the global fxforge
```

No runtime dependency: the manifest parser, glob matcher and zip writer are written from scratch on top of Node's standard library.

## License

MIT © FreshDev — Fresh&Dev
