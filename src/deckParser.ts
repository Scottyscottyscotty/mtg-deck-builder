import { DeckCard } from './types.js';

/**
 * Parses a deck list in the format: "3 Swamp", "1 Arcane Signet", etc.
 * Also handles variations like:
 * - "3x Swamp"
 * - "Swamp x3"
 * - Just "Swamp" (defaults to 1)
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
      cards.push({ quantity, name });
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
