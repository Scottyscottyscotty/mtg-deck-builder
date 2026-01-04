import { DeckCard } from './types.js';

/**
 * Cleans up card names by removing set codes, collector numbers, and other metadata
 * Examples:
 * - "Sol Ring (m3c) 305" -> "Sol Ring"
 * - "Lightning Bolt [KLD]" -> "Lightning Bolt"
 * - "Swamp - Full Art" -> "Swamp"
 * - "Plains (123)" -> "Plains"
 */
function cleanCardName(name: string): string {
  let cleaned = name;

  // Remove set codes in parentheses with optional collector number
  // Matches: (ABC) 123, (ABC), (ab1) 456, etc.
  cleaned = cleaned.replace(/\s*\([a-z0-9]{3,4}\)\s*\d*/gi, '');

  // Remove set codes in square brackets
  // Matches: [ABC], [AB1], etc.
  cleaned = cleaned.replace(/\s*\[[a-z0-9]{2,4}\]/gi, '');

  // Remove Arena IDs
  // Matches: [arena:12345]
  cleaned = cleaned.replace(/\s*\[arena:\d+\]/gi, '');

  // Remove trailing collector numbers that weren't caught
  // Matches: " 123", " 45a", etc. at the end
  cleaned = cleaned.replace(/\s+\d+[a-z]?\s*$/i, '');

  // Remove "Full Art", "Showcase", "Borderless" suffixes
  cleaned = cleaned.replace(/\s*-\s*(full art|showcase|borderless|extended art)/gi, '');

  // Trim any extra whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Parses a deck list in the format: "3 Swamp", "1 Arcane Signet", etc.
 * Also handles variations like:
 * - "3x Swamp"
 * - "Swamp x3"
 * - Just "Swamp" (defaults to 1)
 * - "Sol Ring (m3c) 305" (strips set codes and collector numbers)
 */
export function parseDeckList(input: string): DeckCard[] {
  const lines = input.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const cards: DeckCard[] = [];

  for (const line of lines) {
    // Skip comments or section headers
    if (line.startsWith('#') || line.startsWith('//')) {
      continue;
    }

    // Try different formats
    let quantity = 1;
    let name = '';

    // Format: "3 Card Name" or "3x Card Name"
    const match1 = line.match(/^(\d+)x?\s+(.+)$/i);
    if (match1) {
      quantity = parseInt(match1[1], 10);
      name = match1[2].trim();
    }
    // Format: "Card Name x3"
    else {
      const match2 = line.match(/^(.+?)\s+x(\d+)$/i);
      if (match2) {
        name = match2[1].trim();
        quantity = parseInt(match2[2], 10);
      } else {
        // Default: just the card name (quantity = 1)
        name = line.trim();
      }
    }

    if (name) {
      // Clean up the card name (remove set codes, collector numbers, etc.)
      const cleanedName = cleanCardName(name);
      cards.push({ quantity, name: cleanedName });
    }
  }

  return cards;
}

/**
 * Summarizes the deck for display
 */
export function summarizeDeck(cards: DeckCard[]): string {
  const totalCards = cards.reduce((sum, card) => sum + card.quantity, 0);
  const uniqueCards = cards.length;

  return `Parsed ${totalCards} total cards (${uniqueCards} unique)`;
}
