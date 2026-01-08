import Anthropic from '@anthropic-ai/sdk';
import { DeckCard, DeckAnalysis } from './types.js';
import { getCardPrices, formatPrice } from './pricingService.js';

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

7. **Weak Point Analysis**: Identify and prioritize the deck's critical deficiencies:
   - Analyze key categories: Mana Base, Ramp, Card Draw, Removal, Win Conditions, Protection
   - For each weak point, assess severity (critical/high/moderate/low) and gameplay impact
   - **CRITICAL**: Focus on objective weaknesses (e.g., "22 tapped lands" = critical mana base issue)
   - Identify the PRIMARY weak point that most limits the deck's performance

8. **Upgrade Path Analysis**: Create a budget-optimized upgrade roadmap:
   - Define upgrade priorities for different budget tiers ($0-25, $25-75, $75-150, $150+)
   - **PRIORITIZE THE PRIMARY WEAK POINT** - suggest upgrades that fix it first
   - For example: If mana base is critical, budget tier should focus on untapped lands
   - List specific cards for each tier that address the most impactful weaknesses
   - Explain expected impact (e.g., "Fixes mana consistency, enables turn 3-4 plays")

9. **Card Suggestions**: Recommend 8-12 specific cards that would improve this deck across DIFFERENT PRICE RANGES:
   - Include budget options (under $5)
   - Include mid-range options ($5-25)
   - Include premium/expensive options ($25+)

   For each card, provide detailed reasoning explaining why it fits the deck. Try to suggest cards at various price points so players have options regardless of budget.

10. **Bracket Rating**: Rate this deck on the Commander Bracket system (1-4):
   - Bracket 1: Precon level, very casual
   - Bracket 2: Optimized casual, some strong cards
   - Bracket 3: High power, efficient combos, strong interaction
   - Bracket 4: cEDH level, optimized for competitive play

   Provide the number and explain your reasoning.

11. **Overall Assessment**: A 2-3 paragraph summary of the deck's identity, play pattern, and overall power level.

## Output Format

Respond with ONLY valid JSON in this exact structure (no markdown, no code blocks, just the JSON):

{
  "archetype": "string",
  "manaCurveAnalysis": "string",
  "strengths": ["string", "string", ...],
  "weaknesses": ["string", "string", ...],
  "existingCombos": ["string", "string", ...],
  "potentialCombos": ["string", "string", ...],
  "weakPoints": [
    {
      "category": "Mana Base" | "Ramp" | "Card Draw" | "Removal" | "Win Conditions" | "Protection",
      "severity": "critical" | "high" | "moderate" | "low",
      "issue": "description of the problem",
      "impact": "how this affects gameplay"
    },
    ...
  ],
  "upgradePathAnalysis": {
    "primaryWeakPoint": "the #1 thing to fix",
    "budgetBreakpoints": [
      {
        "budget": "$0-25",
        "recommendedUpgrades": ["Card Name 1", "Card Name 2", ...],
        "expectedImpact": "what improvement to expect"
      },
      {
        "budget": "$25-75",
        "recommendedUpgrades": ["Card Name 1", "Card Name 2", ...],
        "expectedImpact": "what improvement to expect"
      },
      {
        "budget": "$75-150",
        "recommendedUpgrades": ["Card Name 1", "Card Name 2", ...],
        "expectedImpact": "what improvement to expect"
      },
      {
        "budget": "$150+",
        "recommendedUpgrades": ["Card Name 1", "Card Name 2", ...],
        "expectedImpact": "what improvement to expect"
      }
    ]
  },
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
    temperature: 0, // Prevent hallucinations - must suggest only real cards
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

  // Enrich card suggestions with pricing data
  console.log('💰 Fetching prices for card suggestions...');
  const cardNames = analysis.cardSuggestions.map(s => s.card);
  const priceMap = await getCardPrices(cardNames);

  // Add price information to each suggestion
  analysis.cardSuggestions = analysis.cardSuggestions.map(suggestion => {
    const priceInfo = priceMap.get(suggestion.card.toLowerCase());
    return {
      ...suggestion,
      price: priceInfo?.price ?? undefined,
      priceTier: priceInfo?.priceTier ?? '?',
    };
  });

  // Sort suggestions by price tier (budget first, then mid-range, then expensive)
  const tierOrder: Record<string, number> = { '$': 1, '$$': 2, '$$$': 3, '?': 4 };
  analysis.cardSuggestions.sort((a, b) => {
    const tierA = tierOrder[a.priceTier || '?'] || 4;
    const tierB = tierOrder[b.priceTier || '?'] || 4;
    return tierA - tierB;
  });

  console.log('✅ Pricing data added\n');

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
