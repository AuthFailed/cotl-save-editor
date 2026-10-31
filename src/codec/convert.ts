// Moving a save between platforms. Switch and PC 1.5+ share the MessagePack layout except for what Switch lacks
// (one trailing element, Twitch settings); Apple and PC JSON differ only in their wrapper.
import { SaveFormatError } from './errors'
import type { Format, Opened } from './formats'
import type { MpNode } from './msgpack'
import { field, type SaveSchema } from '../schema/schema'

type Target = 'pc-mp' | 'switch-mp' | 'pc-json' | 'apple-zb'

const PC_LENGTH = 1396
const SWITCH_LENGTH = 1395
const bool = (v: boolean): MpNode => ({ t: 'bool', v })
// What PC 1.5.2x writes for TwitchSettings where Switch has nil.
const PC_TWITCH: MpNode = { t: 'arr', w: 'fix', v: [{ t: 'nil' }, bool(true), { t: 'int', w: 'pfix', v: 20 }, bool(true), bool(true), bool(true)] }

const freshWrap = () => ({ key: crypto.getRandomValues(new Uint8Array(16)), iv: crypto.getRandomValues(new Uint8Array(16)) })
const JSON_FORMATS: Format[] = ['pc-json', 'plain-json', 'apple-zb']

export function convert(o: Opened, to: Target, schema: SaveSchema | null): Opened {
  if (o.format === to) return o
  const mp = (o.format === 'pc-mp' || o.format === 'switch-mp') && (to === 'pc-mp' || to === 'switch-mp')
  const json = JSON_FORMATS.includes(o.format) && (to === 'pc-json' || to === 'apple-zb')
  if (!mp && !json) throw new SaveFormatError(`Can't convert ${o.format} to ${to}.`)
  const wrapper = { format: to, beta: to === 'switch-mp' || to === 'apple-zb', wrap: to === 'pc-mp' || to === 'pc-json' ? freshWrap() : null }
  if (json || o.file !== 'slot' || o.data.kind !== 'msgpack' || o.data.root.t !== 'arr') return { ...o, ...wrapper }

  const twitch = schema && field(schema, schema.roots.slot, 'TwitchSettings')
  if (!twitch) throw new SaveFormatError('Converting a slot needs the save schema (TwitchSettings).')
  const v = [...o.data.root.v]
  if (to === 'pc-mp') {
    if (v.length === SWITCH_LENGTH) v.push({ t: 'arr', w: 'fix', v: [] })
    v[twitch.key] = PC_TWITCH
  } else {
    if (v.length === PC_LENGTH) v.pop()
    v[twitch.key] = { t: 'nil' }
  }
  return { ...o, ...wrapper, compressed: true, data: { kind: 'msgpack', root: { ...o.data.root, v } } }
}
