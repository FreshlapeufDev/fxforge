<div align="center">

# ▲ fxforge

**Créer, vérifier et empaqueter des resources FiveM depuis ton terminal.**

[![npm](https://img.shields.io/npm/v/fxforge?color=ff7a1a&label=npm)](https://www.npmjs.com/package/fxforge)
[![CI](https://github.com/FreshlapeufDev/fxforge/actions/workflows/ci.yml/badge.svg)](https://github.com/FreshlapeufDev/fxforge/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/fxforge?color=339933)](https://nodejs.org)
[![licence](https://img.shields.io/npm/l/fxforge?color=blue&label=licence)](https://github.com/FreshlapeufDev/fxforge/blob/main/LICENSE)

Aucune dépendance · ESX · QBCore · Qbox · Standalone

[English](https://github.com/FreshlapeufDev/fxforge/blob/main/README.md) · **Français**

</div>

```
$ npx fxforge create garage --framework esx --nui vanilla

 ▲ fxforge · create a resource

✔ Created garage (ESX Legacy · HTML / CSS / JS (no build step))

  └─ garage/
     ├─ bridge/
     │  ├─ client.lua
     │  └─ server.lua
     ├─ client/
     │  └─ main.lua
     ├─ locales/
     │  ├─ en.lua
     │  └─ fr.lua
     ├─ server/
     │  └─ main.lua
     ├─ shared/
     │  └─ locale.lua
     ├─ web/
     │  ├─ app.js
     │  ├─ index.html
     │  └─ style.css
     ├─ config.lua
     ├─ fxmanifest.lua
     └─ README.md
```

## Pourquoi

Chaque resource FiveM commence de la même façon : on copie un ancien dossier, on renomme les events, on corrige le manifest, on oublie un fichier dans `files {}`, et on découvre en jeu que l'interface reste blanche. Ensuite, tout marche sur le serveur de dev Windows… et plante sur le serveur Linux de production à cause d'une seule majuscule.

fxforge fait la partie répétitive à ta place et repère ces erreurs **avant** ton `ensure`.

## Prérequis

- [Node.js](https://nodejs.org) 18 ou plus récent (prends la version **LTS**). npm est inclus.
- Fonctionne sous Windows, Linux et macOS.

## Installation

```bash
npm install -g fxforge
```

ou lance-le une seule fois sans rien installer :

```bash
npx fxforge create ma_resource
```

## Commandes

| Commande | Rôle |
|---|---|
| [`fxforge create [nom]`](#fxforge-create-nom) | générer une resource prête à lancer |
| [`fxforge check [dossier]`](#fxforge-check-dossier) | vérifier le `fxmanifest.lua` par rapport aux fichiers |
| [`fxforge pack [dossier]`](#fxforge-pack-dossier) | créer un `.zip` de release propre |
| [`fxforge add <type> [nom]`](#fxforge-add-type-nom) | ajouter un script, une langue ou une NUI |

### `fxforge create [nom]`

Génère une resource qui fonctionne dès le premier `ensure`. Sans options, l'outil te pose quelques questions.

| Option | Valeurs | Par défaut |
|---|---|---|
| `--framework` | `standalone` `esx` `qbcore` `qbox` | `standalone` |
| `--nui` | `none` `vanilla` `vite` | `none` |
| `--locale` | `en` `fr` | `en` |
| `--description` | texte | `A FiveM resource` |
| `--author` | texte | ton nom d'utilisateur git |
| `--dir` | dossier parent | dossier courant |
| `--no-git` `--force` `-y` | | |

Ce que tu obtiens :

- un `fxmanifest.lua` propre avec `lua54`, les métadonnées et les bonnes dépendances
- une **couche bridge** (`Bridge.Notify`, `Bridge.GetIdentifier`) écrite pour le framework choisi, pour que ta logique de jeu n'en dépende pas
- un petit système de traduction (`Lang('cle', ...)`) en anglais et en français
- un aller-retour commande → event serveur déjà fonctionnel, sur lequel construire
- en option, une NUI en HTML/CSS/JS simple ou en **Vite + TypeScript** compilée dans `web/dist`

### `fxforge check [dossier]`

Lit le `fxmanifest.lua` avec un vrai analyseur (commentaires et chaînes longues compris) et le compare aux fichiers présents sur le disque.

```
$ fxforge check

  ✖ client_script 'client/Main.lua' only exists as 'client/main.lua' [case-mismatch] fxmanifest.lua:8
    ↳ Works on Windows, breaks on Linux servers
  ✖ Server script 'server/main.lua' is also listed in files [server-file-exposed]
    ↳ Every client downloads it: never ship server code or secrets
  ▲ '@ox_lib/…' is used but 'ox_lib' is not in dependencies [undeclared-dependency] fxmanifest.lua:7
    ↳ The resource may start before it and crash

  2 errors · 1 warning · 0 info
```

| Code | Niveau | Ce qui est détecté |
|---|---|---|
| `case-mismatch` | erreur | `Client/Main.lua` au lieu de `client/main.lua` : marche sous Windows, plante sous Linux |
| `missing-file` | erreur | un fichier référencé qui n'existe pas (avec un conseil si l'interface n'est pas compilée) |
| `server-file-exposed` | erreur | un script serveur aussi listé dans `files` : **chaque joueur le télécharge** |
| `ui-page-not-shipped` | erreur | `ui_page` absent de `files` : écran blanc en jeu |
| `nui-asset-not-shipped` | erreur | un CSS ou JS chargé par ton HTML mais pas envoyé : erreur 404 en jeu |
| `unknown-fx-version` / `missing-game` | erreur | en-tête du manifest invalide |
| `legacy-manifest` | erreur | ancien `__resource.lua` |
| `undeclared-dependency` | avertissement | `@ox_lib/init.lua` utilisé sans `dependency 'ox_lib'` |
| `client-server-overlap` | avertissement | un même fichier chargé des deux côtés au lieu de `shared_scripts` |
| `empty-glob` | avertissement | un motif comme `client/*.lua` qui ne correspond à aucun fichier |
| `data-file-not-shipped` | avertissement | un `data_file` dont le fichier n'est pas dans `files` |
| `lua54-missing` | avertissement | Lua 5.4 non activé |
| `outdated-fx-version` | avertissement | `bodacious` ou `adamant` |
| `duplicate-entry` | avertissement | une même entrée listée deux fois |
| `resource-name` | avertissement | majuscules ou espaces dans le nom du dossier |
| `unreferenced-lua` | info | un fichier Lua jamais chargé |
| `missing-metadata` | info | pas de version, d'auteur ou de description |

Ajoute `--json` pour l'utiliser dans d'autres outils, et `--strict` pour échouer aussi sur les avertissements. Le code de sortie vaut `1` en cas d'erreur, ce qui permet de l'utiliser directement en intégration continue :

```yaml
- run: npx fxforge check --strict
```

### `fxforge pack [dossier]`

Crée `dist/<nom>-<version>.zip` avec **uniquement les fichiers réellement chargés par le manifest**, plus `stream/`, le README et la LICENSE. Tes notes, les sources de la NUI, `node_modules` et autres fichiers de dev restent en dehors. La commande refuse d'empaqueter une resource qui contient des erreurs, sauf avec `--force`.

```
$ fxforge pack

  ✔ dist/garage-1.0.0.zip
    13 files · 6.8 KB → 4.9 KB
    1 file left out (not used by the manifest)
```

| Option | |
|---|---|
| `--out <dossier>` | dossier de sortie |
| `--include <motifs>` | fichiers supplémentaires, séparés par des virgules |
| `--all` | tout inclure sauf les fichiers de dev |
| `--verbose` | lister les fichiers laissés de côté |

### `fxforge add <type> [nom]`

```bash
fxforge add client garage     # client/garage.lua
fxforge add server billing    # server/billing.lua
fxforge add shared utils      # shared/utils.lua
fxforge add locale de         # locales/de.lua, copié depuis en
fxforge add nui               # web/ + ui_page + files
```

Le manifest n'est modifié que si le nouveau fichier n'est pas déjà couvert par un motif comme `client/*.lua`.

## Structure générée

```
ma_resource/
├─ bridge/        adaptateur de framework (client + serveur)
├─ client/        scripts client
├─ server/        scripts serveur
├─ shared/        traductions et code partagé
├─ locales/       en.lua, fr.lua
├─ web/           NUI (optionnelle)
├─ config.lua
└─ fxmanifest.lua
```

## Développement

```bash
git clone https://github.com/FreshlapeufDev/fxforge
cd fxforge
npm test
npm link
```

`npm link` fait pointer la commande `fxforge` globale vers ta copie locale.

Aucune dépendance à l'exécution : l'analyseur de manifest, le moteur de motifs et la création de zip sont écrits de zéro avec la bibliothèque standard de Node.

Un bug ou une idée ? [Ouvre une issue](https://github.com/FreshlapeufDev/fxforge/issues).

## Voir aussi

[**fxguard**](https://github.com/FreshlapeufDev/fxguard) — scanner de sécurité pour resources FiveM : events réseau exploitables, injections SQL, backdoors et secrets exposés.

## Licence

MIT © FreshDev — Fresh&Dev
