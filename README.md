# cotl-save-editor

A browser-only save editor for *Cult of the Lamb*: every PC, Mac/Apple Arcade, iOS and Switch save, with
in-game names and pictures from [cotl-api](https://github.com/AuthFailed/cotl-api). Nothing is uploaded.
Design: [docs/specs](docs/specs/2026-10-31-cotl-save-editor-design.md).

`npm test` runs the codec tests. Tests against real saves run when `tests/saves/` holds them (`slot_0.mp`,
`meta_0.mp`, `slot_10.mp`, `meta_10.mp`, `slot_0.json`, `slot_1.json`, `meta_0.json`); it is git-ignored.

Credits: the save formats were first worked out by
[Matteo-Fattorini/cotl-save-editor](https://github.com/Matteo-Fattorini/cotl-save-editor),
[Gu-BRA/CultOfTheLamb-SaveEditor](https://github.com/Gu-BRA/CultOfTheLamb-SaveEditor),
[PrivateiFox/cotl-save-converter](https://github.com/PrivateiFox/cotl-save-converter) and
[Sanchos-dev/cotl-save-sync](https://github.com/Sanchos-dev/cotl-save-sync). Unofficial fan project; the game
belongs to Massive Monster and Devolver Digital.
