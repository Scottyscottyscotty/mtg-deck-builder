import Anthropic from '@anthropic-ai/sdk';
import { DeckCard, DeckAnalysis } from './types.js';

/**
 * Analyzes a deck using Claude
 */
export async function analyzeDeck(
  cards: DeckCard[],
  apiKey: string,
  model: 'sonnet' | 'opus' = 'sonnet'
): Promise<DeckAnalysis> {
  const anthropic = new Anthropic({ apiKey });

  const modelId = model === 'opus'
    ? 'claude-opus-4-5-20251101'
    : 'claude-sonnet-4-5-20250929';

  console.log(`\n🧠 Analyzing deck with ${model === 'opus' ? 'Claude Opus 4.5' : 'Claude Sonnet 4.5'}...\n`);

  // Build the deck representation for Claude
  const deckList = formatDeckForClaude(cards);

  const prompt = `You are an expert Magic: The Gathering deck analyst. I'm going to provide you with a complete deck list, and I need you to perform a comprehensive analysis.

## Deck List

${deckList}

## Analysis Requirements

Please analyze this deck and provide:

1. **Archetype Identification**: What type of deck is this? (e.g., Aggro, Control, Combo, Midrange, etc.)

2. **Mana Curve Analysis**: Evaluate the mana curve and distribution. Is it optimal for the strategy?

3. **Strengths**: List 3-5 key strengths of this deck. What does it do well?

4. **Weaknesses**: List 3-5 weaknesses or vulnerabilities. What strategies or card types would this deck struggle against?

5. **Existing Combos**: Identify all notable combos, synergies, or powerful interactions already present in the deck.

6. **Potential Combos**: Suggest new combos or synergies that could be added with different card choices.

7. **Card Suggestions**: Recommend 5-10 specific cards that would improve this deck, with detailed reasoning for each.

8. **Bracket Rating**: Rate this deck on the Commander Bracket system (1-4):
   - Bracket 1: Precon level, very casual
   - Bracket 2: Optimized casual, some strong cards
   - Bracket 3: High power, efficient combos, strong interaction
   - Bracket 4: cEDH level, optimized for competitive play

   Provide the number and explain your reasoning.

9. **Overall Assessment**: A 2-3 paragraph summary of the deck's identity, play pattern, and overall power level.

## Output Format

Respond with ONLY valid JSON in this exact structure (no markdown, no code blocks, just the JSON):

{
  "archetype": "string",
  "manaCurveAnalysis": "string",
  "strengths": ["string", "string", ...],
  "weaknesses": ["string", "string", ...],
  "existingCombos": ["string", "string", ...],
  "potentialCombos": ["string", "string", ...],
  "cardSuggestions": [
    {"card": "Card Name", "reasoning": "why this card fits"},
    ...
  ],
  "bracketRating": 1-4,
  "bracketReasoning": "string",
  "overallAssessment": "string"
}`;

  const response = await anthropic.messages.create({
    model: modelId,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  // Extract the JSON from the response
  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  // Parse the JSON response
  let analysisText = content.text.trim();

  // Remove markdown code blocks if present
  if (analysisText.startsWith('```')) {
    analysisText = analysisText.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
  }

  const analysis: DeckAnalysis = JSON.parse(analysisText);

  return analysis;
}

/**
 * Formats the deck list for Claude in a readable way
 */
function formatDeckForClaude(cards: DeckCard[]): string {
  const lines: string[] = [];

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
