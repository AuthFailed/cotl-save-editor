# Cult of the Lamb Save Editor

Edit *Cult of the Lamb* saves in your browser at **[save.cotl.info](https://save.cotl.info)**. Nothing is uploaded:
the save is read, edited and written back on your own machine, and the editor works offline once opened.

- **Followers**: name, form (with every portrait), level, age, loyalty, needs, traits; revive, clone, remove, and bulk
  "max needs".
- **Inventory**: every item with its icon; set quantities or add anything.
- **Cult and Collection**: doctrines, rituals, structures, crown abilities, tarot, relics, weapons, curses, fleeces,
  outfits and follower forms, each owned or locked, with "unlock all".
- **Raw data**: every field of the save by its in-game name, editable with type checks.
- **Safe by default**: every change is listed and undoable; the export is read back before it downloads, and the first
  export also downloads your original as a backup. A save that wouldn't write back exactly opens read-only.
- **Formats**: PC 1.5+ (`.mp`), PC before 1.5 (`.json`), and, in beta, macOS App Store / Apple Arcade / iOS and Switch.
- Game names in every language the game has, and pictures, from [api.cotl.info](https://api.cotl.info); field names of
  1.5+ saves from its `save-schema.json`, per game version.

## Using it

1. Close the game and back up your `saves` folder.
2. Open [save.cotl.info](https://save.cotl.info) and drop the folder in (the page lists where it is on each platform).
3. Edit, review, and export. Put the downloaded `slot_N.mp` back into the saves folder in place of the old one.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # codec and model tests
npm run e2e        # browser tests against a production build
```

Tests against real saves run when `tests/saves/` holds them (`slot_0.mp`, `meta_0.mp`, `slot_10.mp`, `meta_10.mp`,
`slot_0.json`, `slot_1.json`, `meta_0.json`); the folder is git-ignored. Everything else uses a synthetic save built
from the published schema. Pushes to `main` deploy to GitHub Pages.

Design: [docs/specs](docs/specs/2026-10-31-cotl-save-editor-design.md).

## Credits

The save formats were first worked out by
[Matteo-Fattorini/cotl-save-editor](https://github.com/Matteo-Fattorini/cotl-save-editor),
[Gu-BRA/CultOfTheLamb-SaveEditor](https://github.com/Gu-BRA/CultOfTheLamb-SaveEditor),
[PrivateiFox/cotl-save-converter](https://github.com/PrivateiFox/cotl-save-converter) and
[Sanchos-dev/cotl-save-sync](https://github.com/Sanchos-dev/cotl-save-sync).

Unofficial fan project; *Cult of the Lamb*, its data and art belong to Massive Monster and Devolver Digital.
