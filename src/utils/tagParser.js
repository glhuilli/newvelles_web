/**
 * Tag parser utility for extracting individual tags from bracket-delimited strings
 */

/**
 * Parse tags from a bracket-delimited string
 * @param {string} bracketString - String like "[Tag A] [Tag B] [Tag C]"
 * @returns {Array<string>} - Array of individual tags ["Tag A", "Tag B", "Tag C"]
 */
export function parseTags(bracketString) {
  if (!bracketString || typeof bracketString !== 'string') {
    return [];
  }

  // Trim the string
  const trimmed = bracketString.trim();

  if (trimmed === '') {
    return [];
  }

  // Match all content within square brackets
  const regex = /\[([^\]]+)\]/g;
  const tags = [];
  let match;

  while ((match = regex.exec(trimmed)) !== null) {
    // Extract the content between brackets and trim it
    tags.push(match[1].trim());
  }

  return tags;
}
