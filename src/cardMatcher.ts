import { listHistory, getHistoryEntry } from './history.js';
import { searchCard } from './scryfallClient.js';
import { DeckCard } from './types.js';

export interface DeckMatch {
  deckId: string;
  deckName: string;
  score: number;
  reasons: string[];
  isPartial: boolean;
  currentSize: number;
}

/**
 * Finds which decks would benefit most from adding a specific card
 */
export async function findDecksForCard(cardName: string): Promise<DeckMatch[]> {
  console.log(`\n🔍 Finding decks for: ${cardName}\n`);

  // Get card data from Scryfall
  const card = await searchCard(cardName);
  if (!card) {
    console.log(`❌ Card "${cardName}" not found on Scryfall`);
    return [];
  }

  // Load all deck history
  const history = await listHistory();
  if (history.length === 0) {
    console.log('No deck history found.');
    return [];
  }

  const matches: DeckMatch[] = [];

  for (const entry of history) {
    const fullEntry = await getHistoryEntry(entry.id);
    if (!fullEntry) continue;

    const score = scoreCardForDeck(card, fullEntry.deck, fullEntry.analysis);
    const reasons: string[] = [];

    // Calculate reasons
    const deckCards = fullEntry.deck.map(c => c.name.toLowerCase());
    const isInDeck = deckCards.includes(card.name.toLowerCase());

    if (isInDeck) {
      reasons.push('Already in deck');
      continue; // Skip decks that already have this card
    }

    // Color identity check
    const cardColors = card.color_identity || [];
    const deckColors = getDeckColorIdentity(fullEntry.deck);
    const colorMatch = cardColors.every(c => deckColors.includes(c));

    if (!colorMatch) {
      reasons.push('Color identity mismatch');
      continue;
    } else if (cardColors.length > 0) {
      reasons.push('Color identity match');
    }

    // Type synergy
    const cardTypes = card.type_line.toLowerCase();
    const archetype = fullEntry.analysis.archetype.toLowerCase();

    if (archetype.includes('tribal') || archetype.includes('creature')) {
      if (cardTypes.includes('creature')) {
        reasons.push('Creature synergy');
      }
    }

    if (archetype.includes('spell') || archetype.includes('instant') || archetype.includes('sorcery')) {
      if (cardTypes.includes('instant') || cardTypes.includes('sorcery')) {
        reasons.push('Spell synergy');
      }
    }

    // Check if deck is partial
    const isPartial = fullEntry.totalCards < (entry.archetype.includes('Commander') ? 99 : 60);
    if (isPartial) {
      reasons.push(`Partial deck (${fullEntry.totalCards} cards)`);
    }

    // Check if card was suggested
    const wasSuggested = fullEntry.analysis.cardSuggestions.some(
      s => s.card.toLowerCase() === card.name.toLowerCase()
    );

    if (wasSuggested) {
      reasons.push('Previously suggested for this deck');
    }

    if (score > 0 && reasons.length > 0) {
      matches.push({
        deckId: entry.id,
        deckName: entry.deckName || 'Unnamed Deck',
        score,
        reasons,
        isPartial,
        currentSize: fullEntry.totalCards,
      });
    }
  }

  // Sort by score (highest first)
  matches.sort((a, b) => b.score - a.score);

  return matches;
}

/**
 * Scores how well a card fits a specific deck
 */
function scoreCardForDeck(card: any, deck: Array<{ name: string; quantity?: number }>, analysis: any): number {
  let score = 0;

  // Base score for color match
  const cardColors = card.color_identity || [];
  const deckColors = getDeckColorIdentity(deck as any);
  const colorMatch = cardColors.every((c: string) => deckColors.includes(c));

  if (!colorMatch) return 0; // No score if colors don't match
  score += 10;

  // Type synergy
  const cardTypes = card.type_line.toLowerCase();
  const archetype = analysis.archetype.toLowerCase();

  if (archetype.includes('tribal') || archetype.includes('creature')) {
    if (cardTypes.includes('creature')) score += 20;
  }

  if (archetype.includes('control') || archetype.includes('interaction')) {
    if (cardTypes.includes('instant') || cardTypes.includes('counter')) score += 20;
  }

  if (archetype.includes('ramp') || archetype.includes('lands')) {
    if (cardTypes.includes('land') || card.oracle_text?.toLowerCase().includes('search') || card.oracle_text?.toLowerCase().includes('mana')) {
      score += 20;
    }
  }

  // Check if card was suggested
  const wasSuggested = analysis.cardSuggestions.some(
    (s: any) => s.card.toLowerCase() === card.name.toLowerCase()
  );

  if (wasSuggested) score += 50;

  // Bonus for partial decks
  const totalCards = deck.reduce((sum: number, c: any) => sum + (c.quantity || 1), 0);
  const isPartial = totalCards < 99;

  if (isPartial) score += 15;

  return score;
}

/**
 * Extracts color identity from a deck
 */
function getDeckColorIdentity(deck: Array<{ card?: any; name?: string }>): string[] {
  const colors = new Set<string>();

  for (const entry of deck) {
    const card = entry.card;
    if (!card) continue;

    const cardColors = card.color_identity || [];
    cardColors.forEach((c: string) => colors.add(c));
  }

  return Array.from(colors);
}

/**
 * Formats match results for display
 */
export function formatMatches(matches: DeckMatch[]): string {
  if (matches.length === 0) {
    return 'No suitable decks found.';
  }

  const lines: string[] = [];
  lines.push('🎯 Best Matches:\n');

  matches.slice(0, 10).forEach((match, i) => {
    const partialTag = match.isPartial ? ` [PARTIAL: ${match.currentSize} cards]` : '';
    lines.push(`${i + 1}. ${match.deckName}${partialTag}`);
    lines.push(`   Score: ${match.score}`);
    lines.push(`   Reasons: ${match.reasons.join(', ')}`);
    lines.push('');
  });

  return lines.join('\n');
}
