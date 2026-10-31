/** A file that is not a save, or a save cut short or damaged. The message is meant for the player. */
export class SaveFormatError extends Error {
  override name = 'SaveFormatError'
}
