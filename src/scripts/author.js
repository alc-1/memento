/** "Unknown" is a placeholder for the data model (author is mandatory), not something to show visitors. */
export function isKnownAuthor(author) {
  const name = String(author ?? '').trim().toLowerCase();
  return name !== '' && name !== 'unknown';
}
