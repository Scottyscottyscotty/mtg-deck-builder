/**
 * Deck formatting utilities for AI prompts
 */

import { DeckCard } from '../types.js';

/**
 * Format a deck list for Claude AI analysis with full card details
 * Includes quantity, name, mana cost, type, oracle text, and P/T or loyalty
 * @param cards Array of deck cards
 * @param label Optional label prefix (not used, kept for compatibility)
 * @returns Formatted string for AI prompt
 */
export function formatDeckForClaude(cards: DeckCard[], label?: string): string {
  const lines: string[] = [];

  // Optionally add total card count if label is provided
  if (label) {
    lines.push(`Total Cards: ${cards.reduce((sum, c) => sum + c.quantity, 0)}`);
    lines.push('');
  }

  for (const { quantity, name, card } of cards) {
    if (!card) {
      lines.push(`${quantity}x ${name} [CARD NOT FOUND]`);
      continue;
    }

    const manaCost = card.mana_cost || '';
    const type = card.type_line;
    const oracle = card.oracle_text || 'No text';

    lines.push(`${quantity}x ${card.name} ${manaCost}`);
    lines.push(`   Type: ${type}`);
    lines.push(`   ${oracle}`);

    if (card.power && card.toughness) {
      lines.push(`   P/T: ${card.power}/${card.toughness}`);
    }
    if (card.loyalty) {
      lines.push(`   Loyalty: ${card.loyalty}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}
