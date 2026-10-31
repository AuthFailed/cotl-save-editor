# Cult of the Lamb save editor: design

A public, browser-only save editor for *Cult of the Lamb* that is easy to use, shows every value with its
in-game name and picture, and never puts a save at risk. Game data comes from
[cotl-api](https://github.com/AuthFailed/cotl-api) (`https://api.cotl.info/v1/`).

## Why another editor

| Editor | Strength | Gap |
|---|---|---|
| Matteo-Fattorini/cotl-save-editor | Only correct 1.5+ codec (AES + LZ4 + MessagePack), byte-exact round trip, re-check before download | Raw JSON tree of unnamed arrays: `[0][417] = 7` |
| Gu-BRA/CultOfTheLamb-SaveEditor | Friendliest feature set: followers, clothing, tarot, doctrines, Apple Arcade | Catalog frozen at game 1.4.12 |
| xhayper/cotl-save-editor | Polished Nuxt app | Untouched since 2023, pre-1.5 only |
| CheatMenu (BepInEx) | Edits in game | Needs a mod install |

This editor combines the first one's safety with the second one's features, and adds what none has: field
names for 1.5+ saves and a catalog that follows each game update automatically, both from cotl-api.

## Users and success

Any player on any platform, mostly non-technical. Success: a player drops their saves folder in, finds a
follower or item by its in-game name and picture, changes it, reviews the change and loads the exported save
in the game, without reading a guide.

## Formats

All detection is by content, not file name.

| Format | Layout | Tested against |
|---|---|---|
| PC/Steam 1.5+ (`slot_N.mp`, `meta_N.mp`) | `0x45`, 16-byte key, 16-byte IV, AES-128-CBC/PKCS#7. `slot` payload: MessagePack-CSharp `LZ4BlockArray` (fixarray: ext 98 with each block's uncompressed length, then the LZ4 blocks), MessagePack inside. `meta` payload: MessagePack, uncompressed | real saves (`slot_0.mp`, `slot_10.mp`, `meta_0.mp`, `meta_10.mp`, game 1.5.26.1058) |
| PC/Steam pre-1.5 (`slot_N.json`, `meta_N.json`) | same AES wrapper, or plain, around JSON with field names | real saves (`slot_0.json`, `slot_1.json`) |
| macOS App Store / Apple Arcade, iOS (`slot_N`) | `ZB` header + gzip-compressed JSON, ported from Gu-BRA (MIT) and PrivateiFox/cotl-save-converter (MIT) | no sample: marked **beta** |
| Switch | LZ4 + MessagePack without the AES wrapper, ported from Sanchos-dev/cotl-save-sync | no sample: marked **beta** |

`persistence.json` and `settings.json` are recognised and listed but not edited in v1.

**Convert**: any opened slot can be exported in another format (e.g. Switch → PC 1.5+). For pre-1.5
JSON → 1.5+ MessagePack, values are mapped by field name through the save schema.

## Architecture

```
cotl-save-editor/
  src/codec/        pure TS, no DOM: detect, aes, lz4, msgpack, json, zb; encode(decode(x)) == x
  src/schema/       loads save-schema.json, names a decoded tree, finds fields by name
  src/data/         api.cotl.info client: slim per-language lists, entities, icons
  src/model/        typed views over the tree (followers, inventory, unlocks) and the change list
  src/ui/           Svelte 5 screens and components
  tests/            vitest (codec, schema, model) + playwright (end to end)
  tests/saves/      real saves, git-ignored
```

- Vite + Svelte 5 + TypeScript, static build on GitHub Pages at `authfailed.github.io/cotl-save-editor`
  (custom domain possible later). A service worker caches the app and API responses so it works offline.
- No server, no analytics, no upload. AES uses WebCrypto; LZ4 and MessagePack are our own small modules
  (as Matteo's are), so the codec has no runtime dependencies.
- The MessagePack decoder keeps each value's wire type (`int8`…`int64`, `float32/64`, `bin`/`str` widths,
  ext types). The encoder writes an unchanged value with the same type, and an edited one with the narrowest
  type the original field allowed, so untouched data stays byte-identical.
- `src/codec` is published as an npm package (`cotl-save`) once stable, for bots and other tools.

### Save schema (cotl-api change)

1.5+ saves are MessagePack-CSharp `[MessagePackObject]` classes serialised as arrays: no field names on disk.
Game 1.5.26 has 1,393 keyed fields on `DataManager` and keyed fields on 137 types overall.

- `CotlDataDump` gets a `SaveSchema` job (phase 1): starting at `DataManager`, it walks every type with
  `[MessagePackObject]` by reflection and records, per type, each `[Key(n)]` field or property: key, name,
  CLR type (element type for lists and arrays, key and value types for dictionaries, enum names and values
  for enums).
- `pack.py` publishes it as `v1/save-schema.json` (shape below) and a copy per game version at
  `v1/save-schema/{gameVersion}.json`, with a JSON Schema and an entry in `index.json`, following the
  existing pattern (fixture dump, tests, `check.sh`).

```json
{ "gameVersion": "1.5.26.1058", "root": "DataManager",
  "types": { "DataManager": { "fields": [ { "key": 0, "name": "AllowSaving", "type": "bool" } ] },
             "FollowerInfo": { "fields": [ { "key": 3, "name": "Name", "type": "string" } ] } },
  "enums": { "InventoryItem.ITEM_TYPE": { "0": "NONE", "1": "LOG" } } }
```

- The editor reads the game version from the slot's `meta_N.mp`, loads the matching schema, and otherwise
  falls back to the newest older one with a visible warning. Fields the schema doesn't name show as
  `#key` in Raw data and stay editable.

### Game data

`{lang}/{kind}.json` slim lists for search and pickers, `{kind}/{id}.json` on demand for details,
`icons/{kind}/64/{id}.png` for thumbnails, `icons/skins/{id}.png` for portraits. Game-data language follows
the browser and can be switched to any language the game ships. The UI text is English in v1.

## Screens

Layout B from the design canvas: top bar, left section nav, main area, right inspector.

- **Top bar**: file name, game version, day, difficulty; ⌘K search across followers, items, unlocks and
  raw fields; change count (opens Review); Export.
- **Open**: drop zone for the whole `saves` folder or single files; per-platform save paths with a copy
  button; detected slots listed with cult name, day, play time and format. Opening a single `slot_N`
  without its `meta_N` works; the game version then comes from the save if present, else the newest schema.
- **Overview**: cult name, lamb name, day, difficulty, gold, devotion, faith, follower count.
- **Followers**: table (portrait, name, form, status, level, loyalty, hunger, traits) with status filters,
  sort and multi-select; inspector with name, form picker (every follower form with its portrait), colour
  and outfit, level, age, needs, traits (add from the trait list with icon and description, remove).
  Actions: revive, clone, remove, and bulk "max needs" / "max loyalty".
- **Inventory**: searchable grid of items with icon, name and quantity stepper; add any item; filter by the
  API's item category.
- **Cult**: doctrines (by sermon, with the choice made), rituals, structure unlocks, crown abilities.
- **Collection**: tarot, relics, weapons, curses, fleeces, outfits, follower forms: owned/locked grids
  with icon and description, "unlock all" per group.
- **Raw data**: the whole save as a named tree, searchable by field name or value, editable with type-checked
  inputs. Edits here join the same change list.
- Phone width: nav becomes a top menu, tables scroll horizontally, the inspector becomes a bottom sheet.

Visual system from variant B: neutral dark ground `#0D0E10`, surfaces `#121316`/`#17181B`, borders
`#23252A`, text `#ECECEE`/`#A1A3AB`, one accent `#FF5A4E`; Geist and Geist Mono; status colours that also
differ in lightness; a light theme from the same tokens. Visible focus, 44 px targets on touch, text at
4.5:1, `prefers-reduced-motion` respected, keyboard reachable throughout.

## Safety

1. **Open**: decode, then re-encode the untouched tree. If the bytes differ from the file, the slot opens
   read-only with an explanation and a "report this" link.
2. **Edit**: every edit is a change `{path, label, before, after}`. Inputs keep the field's type (an integer
   field refuses `7.5`) and known ranges (needs and loyalty 0–100, quantities ≥ 0). ⌘Z / ⇧⌘Z undo and redo.
3. **Review**: lists the changes by their readable labels, each one revertible.
4. **Export**: encode, decode the result, and compare it with the edited tree; download only if they match.
   The file keeps its original name. The first export of a slot in a session also downloads the untouched
   original as `<name>.backup`.
5. Beta formats say so in the Open list and on Export.

## Testing

- **Codec** (vitest): byte-exact round trip of every real save in `tests/saves/` (skipped when the folder is
  empty, as on CI); a committed synthetic save built by our encoder; AES against WebCrypto test vectors;
  LZ4 and MessagePack edge cases (each int width, empty blocks, ext types, 64-bit integers).
- **Schema**: names on the real 1.5.26 save resolve (e.g. key 0 is `AllowSaving`), unknown keys survive.
- **Model**: follower, inventory and unlock edits change exactly the intended paths.
- **End to end** (playwright): open the synthetic save, rename a follower, add an item, export, re-open,
  see both changes.
- **cotl-api**: the `SaveSchema` job's output goes through `pack.py` with a fixture, as the other kinds do.

## Not in v1

Editing a running game; cloud saves; writing directly to a console; editing `persistence.json` and
`settings.json`; translated UI text.
