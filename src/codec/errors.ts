/** A file that is not a save, or a save cut short or damaged. Codec messages are English; a translated one says so. */
export class SaveFormatError extends Error {
  override name = 'SaveFormatError'
  constructor(message: string, readonly translated = false) { super(message) }
}
