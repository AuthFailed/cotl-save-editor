// English source strings. Every other language has the same keys (tests/i18n.test.ts checks).
// {name} placeholders are filled by t(); an object is a plural, chosen by {n} with Intl.PluralRules.
export type Plural = { zero?: string; one?: string; two?: string; few?: string; many?: string; other: string }
export type Dict = Record<keyof typeof en, string | Plural>

const en = {
  // navigation and shell
  'nav.open': 'Open', 'nav.overview': 'Overview', 'nav.followers': 'Followers', 'nav.inventory': 'Inventory',
  'nav.cult': 'Cult', 'nav.collection': 'Collection', 'nav.raw': 'Raw data', 'nav.sections': 'Sections', 'nav.menu': 'Menu',
  'top.search': 'Search', 'top.export': 'Export', 'top.changes': { one: '{n} change', other: '{n} changes' } as Plural,
  'prefs.language': 'Language', 'prefs.theme': 'Theme: {theme}', 'prefs.system': 'System', 'prefs.light': 'Light', 'prefs.dark': 'Dark',
  'common.close': 'Close', 'common.search': 'Search', 'common.nothing': 'Nothing matches.', 'common.nothingFor': 'Nothing matches “{q}”.',
  'common.all': 'All', 'common.owned': 'Owned', 'common.locked': 'Locked', 'common.clear': 'Clear', 'common.unknown': 'unknown',

  // notices
  'note.offline': 'Game names and pictures are unavailable offline; ids are shown instead.',
  'banner.readOnly': "This save doesn't write back exactly as it was read, so it's open read-only to keep it safe.",
  'banner.report': 'Report it', 'banner.reportTail': "and we'll look.",
  'banner.schema': 'Field names come from game version {schema}; your save is from {save}. Fields added since may show as #numbers in Raw data.',
  'banner.unknownVersion': 'an unknown version',
  'banner.beta': 'This save format is in beta: no real save of it has been tested yet. Keep the backup the export gives you.',
  'banner.exported': 'Downloaded {files}. With the game closed, put {file} into your saves folder in place of the old one.',
  'banner.dismiss': 'Dismiss', 'banner.and': ' and ',
  'export.betaConfirm': '{file} is in a format no real save has been tested with yet. Export anyway? Keep the backup.',

  // open screen
  'open.title': 'Open your saves',
  'open.lead': 'Drop your saves folder here, or choose it. Everything stays in this browser: nothing is uploaded.',
  'open.dropRegion': 'Drop saves here', 'open.reading': 'Reading…', 'open.drop': 'Drop the saves folder or files',
  'open.chooseFolder': 'Choose folder', 'open.chooseFiles': 'Choose files',
  'open.chooseFolderLabel': 'Choose your saves folder', 'open.chooseFilesLabel': 'Choose save files',
  'open.none': 'No Cult of the Lamb saves found there. Pick the saves folder itself, or slot_N and meta_N files.',
  'open.slots': 'Slots', 'open.unnamed': 'Unnamed cult', 'open.day': 'Day {n}', 'open.time': '{h}h {m}m', 'open.open': 'Open',
  'open.beta': 'Beta', 'open.betaHint': 'No real save of this format has been tested yet',
  'open.where': 'Where the saves are',
  'open.hint': 'Close the game first. The editor never changes your files: it downloads an edited copy (and a backup) for you to put back.',
  'open.copy': 'Copy the {os} path', 'open.discard': { one: 'Discard {n} unexported change?', other: 'Discard {n} unexported changes?' } as Plural,
  'os.windows': 'Windows', 'os.macSteam': 'macOS (Steam)', 'os.macStore': 'macOS (App Store, Apple Arcade)', 'os.linux': 'Linux, Steam Deck',
  'format.pc-mp': 'PC 1.5+', 'format.pc-json': 'PC before 1.5', 'format.plain-json': 'JSON', 'format.apple-zb': 'Apple', 'format.switch-mp': 'Switch',

  // overview
  'ov.cultName': 'Cult name', 'ov.day': 'Day', 'ov.playTime': 'Play time', 'ov.followers': 'Followers',
  'ov.dead': { one: '{n} dead', other: '{n} dead' } as Plural, 'ov.gold': 'Gold', 'ov.faith': 'Cult faith',
  'ov.version': 'Game version', 'ov.names': 'field names: {v}',

  // followers
  'status.Faithful': 'Faithful', 'status.Hungry': 'Hungry', 'status.Ill': 'Ill', 'status.Elderly': 'Elderly', 'status.Dead': 'Dead',
  'fol.search': 'Name, form or trait', 'fol.searchLabel': 'Search followers',
  'fol.selected': { one: '{n} selected', other: '{n} selected' } as Plural, 'fol.selectedRegion': 'Selected followers',
  'fol.maxNeeds': 'Max needs', 'fol.maxLoyalty': 'Max loyalty',
  'fol.colSelect': 'Select', 'fol.colFollower': 'Follower', 'fol.colStatus': 'Status', 'fol.colLevel': 'Lv', 'fol.colLoyalty': 'Loyalty',
  'fol.colHunger': 'Hunger', 'fol.colTraits': 'Traits', 'fol.days': { one: '{n} day', other: '{n} days' } as Plural,
  'fol.loyaltyMeter': 'Loyalty {n}%', 'fol.none': 'No followers match.', 'fol.select': 'Select {name}',

  // inspector
  'insp.title': 'Inspector', 'insp.id': 'ID {id}', 'insp.dead': 'dead', 'insp.changeForm': 'Change form', 'insp.name': 'Name',
  'insp.level': 'Level', 'insp.age': 'Age (days)', 'insp.life': 'Life expectancy', 'insp.loyalty': 'Loyalty', 'insp.hunger': 'Hunger',
  'insp.rest': 'Rest', 'insp.illness': 'Illness', 'insp.exhaustion': 'Exhaustion', 'insp.traits': 'Traits', 'insp.noTraits': 'No traits.',
  'insp.removeTrait': 'Remove {name}', 'insp.addTrait': 'Add trait', 'insp.revive': 'Revive', 'insp.clone': 'Clone', 'insp.remove': 'Remove',
  'insp.removeConfirm': 'Remove {name} from the cult? You can undo this until you export.',
  'insp.chooseForm': 'Choose a form', 'insp.searchForms': 'Search forms', 'insp.addTraitTitle': 'Add a trait', 'insp.searchTraits': 'Search traits',

  // number field
  'num.decrease': 'Decrease {label}', 'num.increase': 'Increase {label}', 'num.number': 'Enter a number',
  'num.whole': 'Enter a whole number', 'num.between': 'Between {min} and {max}',

  // inventory
  'inv.kinds': { one: '{n} kind', other: '{n} kinds' } as Plural, 'inv.searchLabel': 'Search items', 'inv.add': 'Add item',
  'inv.empty': 'The inventory is empty.', 'inv.addTitle': 'Add an item',

  // unlock grids
  'grid.count': '{a} of {b} unlocked', 'grid.searchLabel': 'Search {kind}', 'grid.unlockAll': 'Unlock all {n}',
  'grid.failed': "Couldn't load the list of {kind}: game data is unavailable offline.",
  'tab.tarot': 'Tarot', 'tab.relics': 'Relics', 'tab.weapons': 'Weapons', 'tab.curses': 'Curses', 'tab.fleeces': 'Fleeces',
  'tab.outfits': 'Outfits', 'tab.forms': 'Forms', 'tab.doctrines': 'Doctrines', 'tab.rituals': 'Rituals', 'tab.structures': 'Structures',
  'tab.crown': 'Crown abilities',

  // raw data
  'raw.count': '{n} fields · names from game version {v}', 'raw.filter': 'Filter by name', 'raw.filterLabel': 'Filter fields',
  'raw.hint': 'Every value in the save. Changes here join the same list as everywhere else and can be undone.',
  'raw.tree': 'Save fields', 'raw.field': 'Field', 'raw.type': 'Type', 'raw.value': 'Value',
  'raw.items': { one: '{n} item', other: '{n} items' } as Plural, 'raw.entries': { one: '{n} entry', other: '{n} entries' } as Plural,
  'raw.expand': 'Expand {name}', 'raw.collapse': 'Collapse {name}', 'raw.bytes': '{n} bytes',

  // command palette
  'cmd.placeholder': 'Search followers, items, fields, screens', 'cmd.results': 'Results', 'cmd.none': 'No matches.',
  'cmd.follower': 'Follower: {name}', 'cmd.dead': '(dead)', 'cmd.item': 'Item: {name} ×{n}', 'cmd.field': 'Field: {name}',

  // review
  'rev.title': 'Review changes', 'rev.undo': 'Undo', 'rev.undoLabel': 'Undo {label}', 'rev.undoAll': 'Undo all',
  'rev.none': 'No changes yet. Edits you make appear here, each one undoable until you export.',

  // change labels (Review)
  'ch.rename': '{old} renamed to {name}', 'ch.follower': '{name} · {what} {old} → {value}', 'ch.followerFields': '{name} · {label}',
  'ch.root': '{what} {old} → {value}', 'ch.path': '{path} {old} → {value}', 'ch.gains': '{name} gains {trait}', 'ch.loses': '{name} loses {trait}',
  'ch.revived': '{name} revived', 'ch.cloned': '{name} cloned', 'ch.removed': '{name} removed', 'ch.quantity': '{name} {old} → {value}',
  'ch.added': 'Added {n} {name}', 'ch.unlocked': '{name} unlocked', 'ch.locked': '{name} locked', 'ch.unlockedMany': '{n} unlocked in {field}',
  'ch.needsMaxed': 'needs maxed', 'ch.loyaltyMaxed': 'loyalty maxed',
  'what.level': 'level', 'what.age': 'age', 'what.life': 'life expectancy', 'what.loyalty': 'loyalty', 'what.hunger': 'hunger',
  'what.rest': 'rest', 'what.illness': 'illness', 'what.exhaustion': 'exhaustion', 'what.form': 'form',
  // grid group headings
  'group.default': "Base game",
  'group.coop': "Co-op",
  'group.corrupted': "Corrupted",
  'group.dlc': "DLC",
  'group.majorDlc': "Expansion",
  'group.mystic': "Mystic",
  'group.special': "Special",
  'group.pair': "Pairs",
  'group.secondary': "Secondary",
  'group.single': "Single",
  'group.dungeon': "Dungeon {n}",
  'group.other': "Other",
  'group.specialEvents': "Special events",
  'group.aesthetic': "Decorations",
  'group.faith': "Faith",
  'group.follower': "Followers",
  'group.Sword': "Sword",
  'group.Axe': "Axe",
  'group.Dagger': "Dagger",
  'group.Gauntlet': "Gauntlets",
  'group.Hammer': "Hammer",
  'group.Blunderbuss': "Blunderbuss",
  'group.Chain': "Chain",
  'group.Shield': "Shield",
  'group.Barrier': "Barrier",
  'group.EnemyBlast': "Blast",
  'group.Fireball': "Fireball",
  'group.MegaSlash': "Slash",
  'group.ProjectileAOE': "Projectiles",
  'group.Teleport': "Teleport",
  'group.Tentacles': "Tentacles",
}

export default en
