import { FRAMEWORKS } from './frameworks.js';
import { vanillaNui, viteNui } from './nui.js';

const luaList = (key, items) => `${key} {\n${items.map((item) => `    '${item}'`).join(',\n')}\n}`;

const luaString = (value) => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export function buildManifest({ name, author, description, version, framework, nui }) {
  const fw = FRAMEWORKS[framework];
  const lines = [
    "fx_version 'cerulean'",
    "game 'gta5'",
    "lua54 'yes'",
    '',
    `name '${luaString(name)}'`,
    `author '${luaString(author)}'`,
    `description '${luaString(description)}'`,
    `version '${luaString(version)}'`,
    '',
    luaList('shared_scripts', [...fw.preload, 'config.lua', 'shared/*.lua', 'locales/*.lua']),
    '',
    luaList('client_scripts', ['bridge/client.lua', 'client/*.lua']),
    '',
    luaList('server_scripts', ['bridge/server.lua', 'server/*.lua']),
  ];
  if (nui) {
    lines.push('', `ui_page '${nui.uiPage}'`, '', luaList('files', nui.files));
  }
  if (fw.dependencies.length > 0) {
    lines.push('', luaList('dependencies', fw.dependencies));
  }
  return `${lines.join('\n')}\n`;
}

const clientWithNui = (name) => `local isOpen = false

local function setOpen(state)
    isOpen = state
    SetNuiFocus(state, state)
    SendNUIMessage({
        action = state and 'open' or 'close',
        title = Lang('title')
    })
end

RegisterCommand(Config.Command, function()
    setOpen(not isOpen)
end, false)

RegisterNUICallback('close', function(_, cb)
    setOpen(false)
    cb('ok')
end)

RegisterNUICallback('ping', function(_, cb)
    TriggerServerEvent('${name}:server:ping')
    cb('ok')
end)

AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() and isOpen then
        SetNuiFocus(false, false)
    end
end)
`;

const clientWithoutNui = (name) => `RegisterCommand(Config.Command, function()
    Bridge.Notify(Lang('title'))
    TriggerServerEvent('${name}:server:ping')
end, false)
`;

const server = (name) => `RegisterNetEvent('${name}:server:ping', function()
    local src = source
    local identifier = Bridge.GetIdentifier(src)

    Bridge.Notify(src, Lang('pong', GetPlayerName(src)))

    if Config.Debug then
        print(('[%s] ping from %s (%s)'):format(GetCurrentResourceName(), src, identifier or 'unknown'))
    end
end)
`;

const localeHelper = `Locales = Locales or {}

function Lang(key, ...)
    local dictionary = Locales[Config.Locale] or Locales.en or {}
    local text = dictionary[key] or key
    if select('#', ...) > 0 then
        return text:format(...)
    end
    return text
end
`;

export const localeFile = (code, title, pong) => `Locales['${code}'] = {
    title = '${luaString(title)}',
    pong = '${luaString(pong)}'
}
`;

export const commandFor = (name) => name.replace(/[^a-z0-9_]/gi, '').toLowerCase() || 'open';

const config = ({ name, locale }) => `Config = {}

Config.Locale = '${locale}'
Config.Command = '${commandFor(name)}'
Config.Debug = false
`;

const readme = ({ name, description, framework, nui }) => {
  const fw = FRAMEWORKS[framework];
  const deps = fw.dependencies.length ? fw.dependencies.map((dep) => `\`${dep}\``).join(', ') : 'none';
  const build = nui === 'vite'
    ? `\n## Interface\n\n\`\`\`bash\ncd web\nnpm install\nnpm run build\n\`\`\`\n\nUse \`npm run dev\` to work on the UI in a browser.\n`
    : '';
  return `# ${name}

${description}

- Framework: **${fw.label}**
- Dependencies: ${deps}

## Installation

1. Drop the \`${name}\` folder into your \`resources\` directory.
2. Add \`ensure ${name}\` to your \`server.cfg\`.
3. Adjust \`config.lua\`.
${build}
## Usage

Type \`/${commandFor(name)}\` in game.

---

Scaffolded with [fxforge](https://www.npmjs.com/package/fxforge).
`;
};

const gitignore = (nui) => ['node_modules/', '*.zip', 'dist/', ...(nui === 'vite' ? ['web/dist/'] : []), '.DS_Store', 'Thumbs.db', ''].join('\n');

export function buildResource(options) {
  const opts = {
    author: 'unknown',
    description: 'A FiveM resource',
    version: '1.0.0',
    locale: 'en',
    framework: 'standalone',
    nui: 'none',
    ...options,
  };
  const fw = FRAMEWORKS[opts.framework];
  if (!fw) throw new Error(`Unknown framework '${opts.framework}'`);
  const nui = opts.nui === 'vanilla' ? vanillaNui(opts.name) : opts.nui === 'vite' ? viteNui(opts.name) : null;

  const entries = [
    { path: 'fxmanifest.lua', content: buildManifest({ ...opts, nui }) },
    { path: 'config.lua', content: config(opts) },
    { path: 'shared/locale.lua', content: localeHelper },
    { path: 'locales/en.lua', content: localeFile('en', opts.name, 'Pong! The server heard you, %s.') },
    { path: 'locales/fr.lua', content: localeFile('fr', opts.name, "Pong ! Le serveur t'a bien reçu, %s.") },
    { path: 'bridge/client.lua', content: fw.bridgeClient() },
    { path: 'bridge/server.lua', content: fw.bridgeServer() },
    { path: 'client/main.lua', content: nui ? clientWithNui(opts.name) : clientWithoutNui(opts.name) },
    { path: 'server/main.lua', content: server(opts.name) },
    { path: 'README.md', content: readme(opts) },
    { path: '.gitignore', content: gitignore(opts.nui) },
  ];
  if (nui) entries.push(...nui.entries);
  return entries;
}
