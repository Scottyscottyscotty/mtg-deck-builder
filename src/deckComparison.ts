import Anthropic from '@anthropic-ai/sdk';
import { DeckCard } from './types.js';

export interface DeckComparison {
  deck1Summary: string;
  deck2Summary: string;
  sharedCards: string[];
  uniqueToDeck1: string[];
  uniqueToDeck2: string[];
  strengthComparison: string;
  whichIsBetter: string;
  matchupAnalysis: string;
  recommendations: {
    forDeck1: string[];
    forDeck2: string[];
  };
}

/**
 * Compares two decks using Claude
 */
export async function compareDecks(
  deck1: DeckCard[],
  deck2: DeckCard[],
  apiKey: string,
  model: 'sonnet' | 'opus' = 'sonnet'
): Promise<DeckComparison> {
  const anthropic = new Anthropic({ apiKey });

  const modelId = model === 'opus'
    ? 'claude-opus-4-5-20251101'
    : 'claude-sonnet-4-5-20250929';

  console.log(`\n🔄 Comparing decks with ${model === 'opus' ? 'Claude Opus 4.5' : 'Claude Sonnet 4.5'}...\n`);

  const deck1List = formatDeckForClaude(deck1, 'Deck 1');
  const deck2List = formatDeckForClaude(deck2, 'Deck 2');

  const prompt = `You are an expert Magic: The Gathering analyst. I'm going to provide you with two complete deck lists, and I need you to compare them comprehensively.

## Deck 1

${deck1List}

## Deck 2

${deck2List}

## Comparison Requirements

Please analyze these two decks and provide:

1. **Deck 1 Summary**: Brief description of Deck 1's strategy and archetype
2. **Deck 2 Summary**: Brief description of Deck 2's strategy and archetype
3. **Shared Cards**: List of cards that appear in both decks
4. **Unique to Deck 1**: Notable cards that only appear in Deck 1
5. **Unique to Deck 2**: Notable cards that only appear in Deck 2
6. **Strength Comparison**: Compare the overall power level and strategy of both decks
7. **Which is Better**: Which deck would you recommend and why? (or if they're equal)
8. **Matchup Analysis**: How would these decks perform against each other?
9. **Recommendations**: Specific improvements for each deck

## Output Format

Respond with ONLY valid JSON in this exact structure (no markdown, no code blocks):

{
  "deck1Summary": "string",
  "deck2Summary": "string",
  "sharedCards": ["card name", ...],
  "uniqueToDeck1": ["card name", ...],
  "uniqueToDeck2": ["card name", ...],
  "strengthComparison": "detailed comparison string",
  "whichIsBetter": "which deck is better and why",
  "matchupAnalysis": "how they would play against each other",
  "recommendations": {
    "forDeck1": ["suggestion 1", "suggestion 2", ...],
    "forDeck2": ["suggestion 1", "suggestion 2", ...]
  }
}`;

  const response = await anthropic.messages.create({
    model: modelId,
    max_tokens: 4096,
    temperature: 0, // Prevent hallucinations - must suggest only real cards
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  let comparisonText = content.text.trim();

  // Remove markdown code blocks if present
  if (comparisonText.startsWith('```')) {
    comparisonText = comparisonText.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
  }

  const comparison: DeckComparison = JSON.parse(comparisonText);

  return comparison;
}

/**
 * Formats a deck for Claude comparison
 */
function formatDeckForClaude(cards: DeckCard[], label: string): string {
  const lines: string[] = [];
  lines.push(`Total Cards: ${cards.reduce((sum, c) => sum + c.quantity, 0)}`);
  lines.push('');

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

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Formats comparison results for display
 */
export function formatComparison(comparison: DeckComparison): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                    🔄 DECK COMPARISON 🔄');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  lines.push('📊 DECK 1 SUMMARY');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(comparison.deck1Summary);
  lines.push('');

  lines.push('📊 DECK 2 SUMMARY');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(comparison.deck2Summary);
  lines.push('');

  if (comparison.sharedCards.length > 0) {
    lines.push('🤝 SHARED CARDS');
    lines.push('───────────────────────────────────────────────────────────────');
    comparison.sharedCards.forEach(card => {
      lines.push(`  • ${card}`);
    });
    lines.push('');
  }

  if (comparison.uniqueToDeck1.length > 0) {
    lines.push('🎯 UNIQUE TO DECK 1');
    lines.push('───────────────────────────────────────────────────────────────');
    comparison.uniqueToDeck1.forEach(card => {
      lines.push(`  • ${card}`);
    });
    lines.push('');
  }

  if (comparison.uniqueToDeck2.length > 0) {
    lines.push('🎯 UNIQUE TO DECK 2');
    lines.push('───────────────────────────────────────────────────────────────');
    comparison.uniqueToDeck2.forEach(card => {
      lines.push(`  • ${card}`);
    });
    lines.push('');
  }

  lines.push('⚔️  STRENGTH COMPARISON');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(comparison.strengthComparison);
  lines.push('');

  lines.push('🏆 VERDICT');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(comparison.whichIsBetter);
  lines.push('');

  lines.push('🎮 MATCHUP ANALYSIS');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(comparison.matchupAnalysis);
  lines.push('');

  if (comparison.recommendations.forDeck1.length > 0) {
    lines.push('💡 RECOMMENDATIONS FOR DECK 1');
    lines.push('───────────────────────────────────────────────────────────────');
    comparison.recommendations.forDeck1.forEach((rec, i) => {
      lines.push(`  ${i + 1}. ${rec}`);
    });
    lines.push('');
  }

  if (comparison.recommendations.forDeck2.length > 0) {
    lines.push('💡 RECOMMENDATIONS FOR DECK 2');
    lines.push('───────────────────────────────────────────────────────────────');
    comparison.recommendations.forDeck2.forEach((rec, i) => {
      lines.push(`  ${i + 1}. ${rec}`);
    });
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}
