/**
 * Parsing utility functions
 */

/**
 * Remove markdown code block markers from JSON strings
 * @param text Text that may contain markdown code blocks
 * @returns Cleaned text
 */
export function stripMarkdownCodeBlock(text: string): string {
  let cleaned = text.trim();

  // Remove markdown code block markers (```json or ``` at start/end)
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
  }

  return cleaned;
}
