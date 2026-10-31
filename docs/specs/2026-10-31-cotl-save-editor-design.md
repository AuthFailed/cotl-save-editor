# Cult of the Lamb save editor: design

A public, browser-only save editor for *Cult of the Lamb*. It pairs the save's fields with in-game names
and pictures, keeps edits in a reviewable history, and checks the result before downloading it.
Game data comes from [cotl-api](https://github.com/AuthFailed/cotl-api) (`https://api.cotl.info/v1/`).
This document describes the shipped editor. The implementation plans in `docs/history/` are historical.

## Why this design

Players should be able to open their saves folder, find a follower or item by its name and picture,
change it, review the change and load the exported save in the game. They should not need to understand
the unnamed arrays in a 1.5+ save.

The codec preserves the save's representation. A versioned schema gives the arrays names and types.
Typed views and edits serve the everyday screens; Raw data exposes the same tree for less common fields.
Both routes share the same change history and export checks.

## Formats

The codec detects the format from the contents. The Open screen first selects files named `slot_N` and
`meta_N`, with `.mp`, `.json`, `MP` or no suffix, and pairs them by slot number. It lists readable slots,
sorted by number. MessagePack files take precedence over older JSON files for the same slot.
`persistence.json` and `settings.json` are ignored.

| Format | Layout | Status |
|---|---|---|
| PC/Steam 1.5+ (`slot_N.mp`, `meta_N.mp`) | `0x45`, 16-byte key, 16-byte IV, then AES-128-CBC with PKCS#7 padding around MessagePack, usually an `LZ4BlockArray` | Supported |
| PC/Steam pre-1.5 (`slot_N.json`, `meta_N.json`) | The same AES wrapper around UTF-8 JSON, or plain JSON | Supported |
| macOS App Store / Apple Arcade, iOS (`slot_N`, `meta_N`) | ASCII `ZB`, then gzip-compressed UTF-8 JSON; a leading JSON BOM is accepted | Beta |
| Switch (`slot_NMP`, `meta_NMP`) | ASCII `MP`, then MessagePack, usually an `LZ4BlockArray`, without AES | Beta |

An `LZ4BlockArray` is a MessagePack array starting with extension 98, which holds the uncompressed block
lengths as MessagePack integers. The remaining entries are binary LZ4 blocks. Their decoded contents
form the inner MessagePack save. A payload without this header is read as plain MessagePack.

Apple and Switch remain beta because the codec has not been checked against real saves of those formats.
The editor labels them on Open, shows a banner and asks for confirmation before export.

Export keeps the loaded format and filename. Platform conversion routines exist in `src/codec/convert.ts`,
but the editor has no Convert screen or export-format picker. They support the PC/Switch MessagePack
pair and JSON wrapper changes, not JSON-to-MessagePack conversion.

## Architecture

```text
src/codec/       format detection, AES, LZ4, MessagePack and JSON; no DOM dependency
src/schema/      schema types, version selection and named field lookup
src/data/        API requests, catalogues, pictures and detail text
src/model/       session, typed views, edits, history, JSON mapping and export
src/i18n/        UI strings and language selection
src/ui/          Svelte screens, navigation, pickers and inspectors
src/App.svelte   connects the session, screens, banners, shortcuts and downloads
```

Vite, Svelte 5 and TypeScript build a static site on GitHub Pages at
[save.cotl.info](https://save.cotl.info/). There is no application server, analytics or save upload.
The codec has no runtime package dependencies: it uses WebCrypto for AES, the browser's compression
streams for Apple JSON, and local LZ4 and MessagePack implementations.

A save passes through these layers:

1. Open collects files, identifies slots and reads metadata for the slot list.
2. The session decodes the selected slot and its optional meta file, chooses a schema and prepares the tree.
3. Screens read typed views of the current tree. Each edit creates a labelled change containing operations.
4. Replaying the history against the starting tree produces the edited tree for every screen.
5. Export rebuilds the slot in its original format and reads it back before offering downloads.

The session keeps a slot's tree, schema and history while another slot is open. Switching slots restores
that state, including pending edits and undo history. It does not ask to discard changes. Saves and edit
histories stay in memory; they do not survive a page reload. Only language and theme preferences are stored
in local storage.

### Save schema

MessagePack-CSharp saves serialise objects as arrays. The schema maps array keys to field names, declared
types and enum values. Screens resolve fields by name through `src/schema/`; they do not hard-code array
positions. The schema includes separate roots for slot and meta data:

```json
{ "gameVersion": "1.5.26.1058", "roots": { "slot": "DataManager", "meta": "MetaData" },
  "types": { "DataManager": { "fields": [ { "key": 0, "name": "AllowSaving", "type": "bool" } ] } },
  "enums": { "InventoryItem.ITEM_TYPE": { "0": "NONE", "1": "LOG" } } }
```

The matching meta file supplies the game version. Without it, the editor uses the newest available schema
and shows that the match is not exact. With a known version, selection prefers an exact match, then the
newest older schema, then the oldest available one. The API's `index.json` lists published schema versions;
the client loads `save-schema/{gameVersion}.json` when needed. A bundled schema keeps field lookup available
when the API is unreachable. A fallback or unknown version is shown in a banner.

An inexact schema match is separate from a codec safety failure: the former shows a warning, while the
latter makes the slot read-only. In MessagePack saves, fields the schema does not name appear as `#key` in Raw data; they and paths beneath them are read-only and stay in the tree for export. In JSON saves, properties the schema does not describe are hidden from Raw data and copied unchanged on export.

JSON saves are mapped by field name into the same tree used by the screens. The mapping accounts for
property names such as `Name` where MessagePack uses `_name`. Export maps the tree back to JSON and
preserves original properties that the schema does not describe. This keeps format handling out of the
individual screens.

### Game data and language

Slim `{lang}/{kind}.json` catalogues provide names and thumbnails. Full `{kind}.json` lists provide
multilingual descriptions, grouping data and entity details; detail dialogs find an entry in that list.
Picture paths come from the API, with full follower portraits under `icons/skins/{id}.png`. Skin variants
are mapped to catalogue forms so a save's variant name can still find its picture.

The UI and game-data picker share 15 languages: Arabic, German, English, Spanish, French, Canadian French,
Italian, Japanese, Korean, Dutch, Brazilian Portuguese, Russian, Turkish, Simplified Chinese and Traditional
Chinese. The initial choice follows a saved preference, then the browser's languages, then English.
Arabic switches the page to right-to-left layout. Game text falls back to English or an ID when unavailable.

API requests are cached in memory. A service worker precaches the app, including its fonts, and caches API
responses and pictures as they are requested, refreshing them in the background. Offline use depends on
what was cached during an online visit. Without a cached catalogue, existing follower and inventory values
can still be shown as IDs with picture placeholders. Unlock grids need their catalogue to list entries;
failed catalogue requests show a notice. The bundled schema remains available.

The production page's meta CSP restricts page resource origins. It does not cover the service worker or
Workbox; a response CSP header is tracked in [#222](https://github.com/AuthFailed/cotl-save-editor/issues/222).
The report link for a read-only save includes its format and a validated version number, not save contents.

## Screens

The desktop layout has a top bar, left section navigation, main area and a right follower inspector.
Hash navigation selects screens and tabs; search results can also pass a filter to the destination.

- **Top bar**: slot switcher with pending-change counts, a schema-version tag when metadata is loaded,
  language and theme choices, search, change count and Export. The change count opens Review.
- **Open**: drop a folder or files, choose a folder, or choose individual files. Copyable save paths cover
  Windows, macOS Steam, macOS App Store / Apple Arcade, and Linux / Steam Deck. Slot cards show cult name,
  filename, format and pending changes; day and play time come from metadata when present. A slot opens
  without its meta file, with the schema fallback described above.
- **Overview**: cult name, day, play time, living and dead follower counts, gold, faith, and game and schema
  versions. Cult name, gold and faith are editable; the other cards are summaries.
- **Followers**: portraits, names and forms, age, status, level, loyalty, satiation and traits. Search matches follower names, the save's form (skin) identifiers and trait names in the current language. Each follower gets one status, by priority dead, ill, hungry, elderly, faithful; the status filters select followers by that status. Multi-select
  applies max needs or max loyalty. The inspector edits name, form, level, age, life expectancy, loyalty,
  satiation, rest, illness, exhaustion and traits. Traits have pictures, descriptions and detail dialogs.
  Revive, clone and remove actions join the same history as field edits. Remove asks for confirmation.
- **Inventory**: owned or all schema-supported items, with search, categories derived from API data, sorting
  by name or quantity, icons and quantity controls. The add picker lists supported items not already held.
- **Cult**: doctrines grouped by sermon category, rituals, buildable structures and crown abilities. These
  are unlock grids, rather than a separate doctrine-choice workflow.
- **Collection**: tarot, relics, weapons, curses, fleeces, outfits and follower forms. The same grid handles
  owned/locked filters, search, individual toggles and Unlock all. A shared mapping connects catalogue IDs
  to the save's unlock fields; enum-backed grids only offer entries the selected schema recognises.
- **Details**: item, trait and unlock dialogs show available descriptions, pictures, costs, lore and other
  facts from the API. Items offer quantity controls; unlockable entries offer an owned/locked toggle.
- **Raw data**: the schema-named tree with a filter for top-level field names, not values. Expanded branches
  render their children. Known scalar fields have type-checked inputs and enum choices; unnamed paths
  stay read-only. Raw edits join the same history as all other edits.
- **Search**: ⌘K / Ctrl+K opens a keyboard-navigable palette for screens, followers, items, unlocks, traits
  and top-level raw field names. Results open the relevant screen, inspector or detail dialog.
- **Review**: a modal side drawer lists labelled changes with individual Undo buttons, Undo all and Export.

At phone width the navigation becomes a menu, wide tables scroll horizontally and the follower inspector
becomes a bottom sheet. Native `<dialog>` supplies modal focus handling for Review, search, pickers and details.
See the README's [browser support](../../README.md#browser-support) for feature requirements and file-picking limits.

The dark theme uses neutral backgrounds (`#0D0E10`, `#121316`, `#17181B`), quiet borders, light text and a coral accent (`#FF5A4E`); the light theme sets the same tokens to light values with a darker accent (`#D93A2F`)., with a system preference option. Status chips carry text labels and owned/locked states carry icons, so colour is never the only signal. Focus rings,
labelled controls, larger touch buttons and reduced-motion styles support keyboard and touch use.

## Safety

1. **Open**: the MessagePack decoder keeps each node's wire type, including integer widths, float widths,
   string and binary headers, and extension types. Re-encoding the decoded tree must reproduce the inner
   MessagePack bytes. Compression and outer wrappers need not be byte-identical. JSON parsing flags unsafe
   large integer values that would lose precision. A failed preservation check opens the slot read-only
   with an explanation and a report link. These checks do not prove that a save will load in the game.
2. **Edit**: a change is `{label, ops}`. Operations set values or change lists, using schema-resolved paths.
   The operation layer checks types and declared integer ranges; focused controls also apply limits such
   as needs and loyalty 0–100 and non-negative quantities. Edits replace tree branches rather than mutate
   the starting tree. Guards on targeted operations check that their intended follower or item is still
   there when replayed. Follower actions belong in this layer, so screens do not manage save bookkeeping.
3. **Undo and Review**: ⌘Z / Ctrl+Z and ⇧⌘Z / Ctrl+Shift+Z undo and redo changes outside text inputs.
   Review can remove a single change by replaying the rest. If later operations cannot replay without it,
   removal is refused with an explanation. Each change matches one edit: a field edit, a follower action or Unlock all. Multi-select bulk actions add one change per selected follower.
4. **Export**: rebuild the edited slot, decode the result and compare the inner MessagePack bytes or JSON
   value with the intended data. Only a match reaches the download step. The slot keeps its name and format;
   metadata is read for context and is not exported. The first export also offers the untouched original
   as `<name>.backup`. Export makes the edited tree the new starting point and clears undo and redo history.
   The browser handles the downloads; the player replaces the save in the game folder.

## Validation

Vitest covers the codec, schema and edit layer. Playwright exercises the production build with Chromium,
including opening, editing, reviewing and exporting synthetic saves. CI checks the Svelte components,
runs the tests, builds the site and runs the browser checks before deploying `main` to GitHub Pages.
[CONTRIBUTING.md](../../CONTRIBUTING.md) lists the commands and save-data privacy rules. Documentation and
screenshots use synthetic data only.

## Not yet built

- A published `cotl-save` npm package for the codec: [#230](https://github.com/AuthFailed/cotl-save-editor/issues/230).
- Day and difficulty in the top bar: [#242](https://github.com/AuthFailed/cotl-save-editor/issues/242).
- Listing persistence and settings files, read-only: [#93](https://github.com/AuthFailed/cotl-save-editor/issues/93).
- The Lamb, devotion and difficulty on Overview: [#72](https://github.com/AuthFailed/cotl-save-editor/issues/72), [#73](https://github.com/AuthFailed/cotl-save-editor/issues/73).
- Follower outfits and colours: [#76](https://github.com/AuthFailed/cotl-save-editor/issues/76), [#80](https://github.com/AuthFailed/cotl-save-editor/issues/80).
- Sortable follower columns: [#133](https://github.com/AuthFailed/cotl-save-editor/issues/133).
- Converting between platforms from the editor, driven by the schema: [#190](https://github.com/AuthFailed/cotl-save-editor/issues/190).

Editing a running game, cloud-save access, writing directly to a console, and editing `persistence.json`
or `settings.json` are outside the current editor's scope.
