import Anthropic from '@anthropic-ai/sdk';
import { DeckCard, DeckAnalysis } from './types.js';
import { getCardPrices } from './pricingService.js';
import { findCombos, formatCombo, formatNearMiss } from './comboService.js';
import { fetchCommanderData, getOverplayedCards, getHiddenGems } from './edhrecService.js';

export interface AnalysisOptions {
  model?: 'sonnet' | 'opus';
  novelty?: number; // 0-100, where 100 = maximum novelty/anti-meta
  commander?: string; // Commander name (if Commander deck)
  enableCombos?: boolean; // Enable Commander Spellbook integration
  enablePopularity?: boolean; // Enable EDHREC popularity scoring
}

/**
 * Enhanced deck analysis with combo discovery, popularity scoring, and anti-meta suggestions
 */
export async function enhancedAnalyzeDeck(
  cards: DeckCard[],
  apiKey: string,
  options: AnalysisOptions = {}
): Promise<DeckAnalysis> {
  const model = options.model || 'sonnet';
  const novelty = options.novelty !== undefined ? options.novelty : 50;
  const commander = options.commander;
  const enableCombos = options.enableCombos !== false;
  const enablePopularity = options.enablePopularity !== false;

  const anthropic = new Anthropic({ apiKey });
  const modelId = model === 'opus'
    ? 'claude-opus-4-5-20251101'
    : 'claude-sonnet-4-5-20250929';

  console.log(`\n🧠 Enhanced Analysis Mode`);
  console.log(`   Model: ${model === 'opus' ? 'Claude Opus 4.5' : 'Claude Sonnet 4.5'}`);
  console.log(`   Novelty: ${novelty}%`);
  if (commander) console.log(`   Commander: ${commander}`);
  console.log('');

  const totalCards = cards.reduce((sum, c) => sum + c.quantity, 0);
  const isPartialDeck = totalCards < 60 || (!!commander && totalCards < 99);

  // Step 1: Find combos with Commander Spellbook
  let comboAnalysis = null;
  if (enableCombos) {
    const cardNames = cards.map(c => c.name);
    comboAnalysis = await findCombos(cardNames);
  }

  // Step 2: Fetch EDHREC data for popularity scoring
  let edhrecData = null;
  let overplayedCards: string[] = [];
  let hiddenGems: Array<{ name: string; inclusion: number; synergy: number }> = [];

  if (enablePopularity && commander) {
    edhrecData = await fetchCommanderData(commander);

    if (edhrecData) {
      // Calculate threshold based on novelty slider
      // novelty 0 = threshold 100 (avoid nothing)
      // novelty 50 = threshold 50 (avoid top 50%)
      // novelty 100 = threshold 25 (avoid top 25%, focus on spicy picks)
      const avoidanceThreshold = 100 - (novelty * 0.75);
      overplayedCards = getOverplayedCards(edhrecData, avoidanceThreshold);

      // Get hidden gems (underplayed but high synergy)
      const maxInclusion = Math.max(10, 40 - (novelty * 0.3)); // novelty 100 = max 10% inclusion
      hiddenGems = getHiddenGems(edhrecData, maxInclusion, 0);

      console.log(`📊 EDHREC Analysis:`);
      console.log(`   ${edhrecData.numDecks} decks analyzed`);
      console.log(`   ${overplayedCards.length} overplayed cards to avoid`);
      console.log(`   ${hiddenGems.length} hidden gems identified\n`);
    }
  }

  // Step 3: Calculate deck color identity (CRITICAL for suggestions)
  const deckColorIdentity = calculateColorIdentity(cards);
  const colorString = deckColorIdentity.length > 0 ? deckColorIdentity.sort().join('') : 'Colorless';
  console.log(`🎨 Deck Color Identity: ${colorString}\n`);

  // Step 4: Build enhanced prompt for Claude
  const deckList = formatDeckForClaude(cards);
  const prompt = buildEnhancedPrompt({
    deckList,
    totalCards,
    isPartialDeck,
    commander,
    novelty,
    overplayedCards,
    hiddenGems,
    comboAnalysis,
    colorIdentity: deckColorIdentity,
  });

  // Step 5: Call Claude
  console.log('🧠 Running AI analysis...\n');

  const response = await anthropic.messages.create({
    model: modelId,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  let analysisText = content.text.trim();
  if (analysisText.startsWith('```')) {
    analysisText = analysisText.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
  }

  const analysis: DeckAnalysis = JSON.parse(analysisText);

  // Step 6: Enrich card suggestions with pricing
  console.log('💰 Fetching prices for suggestions...');
  const cardNames = analysis.cardSuggestions.map(s => s.card);
  const priceMap = await getCardPrices(cardNames);

  analysis.cardSuggestions = analysis.cardSuggestions.map(suggestion => {
    const priceInfo = priceMap.get(suggestion.card.toLowerCase());

    // Add popularity data if available
    let popularity = undefined;
    let inclusionRate = undefined;

    if (edhrecData) {
      const popData = edhrecData.popularCards.get(suggestion.card.toLowerCase());
      if (popData) {
        popularity = popData.label;
        inclusionRate = popData.inclusion;
      }
    }

    return {
      ...suggestion,
      price: priceInfo?.price ?? undefined,
      priceTier: priceInfo?.priceTier ?? '?',
      popularity,
      inclusionRate,
    };
  });

  // Sort by popularity first (Spicy → Common → Staple), then by price
  const popOrder: Record<string, number> = { 'Spicy': 1, 'Common': 2, 'Staple': 3, 'Unknown': 4 };
  const tierOrder: Record<string, number> = { '$': 1, '$$': 2, '$$$': 3, '?': 4 };

  analysis.cardSuggestions.sort((a, b) => {
    const popA = popOrder[a.popularity || 'Unknown'] || 4;
    const popB = popOrder[b.popularity || 'Unknown'] || 4;

    if (popA !== popB) return popA - popB;

    const tierA = tierOrder[a.priceTier || '?'] || 4;
    const tierB = tierOrder[b.priceTier || '?'] || 4;
    return tierA - tierB;
  });

  console.log('✅ Pricing and popularity data added\n');

  // Step 7: Add combo data
  if (comboAnalysis) {
    analysis.spellbookCombos = comboAnalysis.completeCombos.map(combo => ({
      cards: combo.cards,
      result: combo.result,
      steps: combo.steps,
    }));

    analysis.nearMissCombos = comboAnalysis.nearMissCombos.map(nearMiss => ({
      missingCards: nearMiss.missingCards,
      cardsYouHave: nearMiss.cardsYouHave,
      result: nearMiss.combo.result,
    }));
  }

  // Step 8: Add deck completeness info
  if (isPartialDeck) {
    const targetSize = commander ? 99 : 60; // Commander or 60-card format
    analysis.deckCompleteness = {
      currentSize: totalCards,
      targetSize,
      isPartial: true,
    };
  }

  return analysis;
}

/**
 * Builds an enhanced prompt with anti-meta and combo context
 */
function buildEnhancedPrompt(context: {
  deckList: string;
  totalCards: number;
  isPartialDeck: boolean;
  commander?: string;
  novelty: number;
  overplayedCards: string[];
  hiddenGems: Array<{ name: string; inclusion: number; synergy: number }>;
  comboAnalysis: any;
  colorIdentity: string[];
}): string {
  const {
    deckList,
    totalCards,
    isPartialDeck,
    commander,
    novelty,
    overplayedCards,
    hiddenGems,
    comboAnalysis,
    colorIdentity,
  } = context;

  const colorString = colorIdentity.length > 0
    ? colorIdentity.sort().join('').replace(/W/g, 'White').replace(/U/g, 'Blue').replace(/B/g, 'Black').replace(/R/g, 'Red').replace(/G/g, 'Green')
    : 'Colorless';
  const colorSymbols = colorIdentity.length > 0 ? colorIdentity.sort().join('') : 'Colorless';

  let prompt = `You are an expert Magic: The Gathering deck analyst with deep knowledge of hidden synergies and underplayed cards.

## Deck List (${totalCards} cards)

${deckList}`;

  if (commander) {
    prompt += `\n\n## Commander\n\n${commander}`;
  }

  // CRITICAL: Color identity constraint
  prompt += `\n\n## ⚠️ CRITICAL COLOR IDENTITY CONSTRAINT ⚠️\n\n`;
  prompt += `This deck's color identity is: **${colorSymbols}** (${colorString})\n\n`;
  prompt += `**ABSOLUTE REQUIREMENT:** ALL card suggestions MUST match this color identity.\n`;
  prompt += `- A card's color identity includes ALL mana symbols in its mana cost AND rules text.\n`;
  prompt += `- You CANNOT suggest cards with colors outside of: ${colorSymbols}\n`;
  if (colorIdentity.length > 0) {
    prompt += `- Valid color identities: ${colorSymbols} (exact match) or any subset (e.g., ${colorIdentity[0]} only)\n`;
  } else {
    prompt += `- This is a COLORLESS deck - suggest only colorless cards and lands\n`;
  }
  prompt += `- Double-check EVERY suggestion's color identity before including it\n`;
  prompt += `- If you're unsure about a card's colors, DO NOT suggest it\n`;

  if (isPartialDeck) {
    const targetSize = commander ? 99 : 60;
    const missing = targetSize - totalCards;
    prompt += `\n\n## Partial Deck Alert\n\nThis deck has only ${totalCards} cards out of ${targetSize}. The user needs ${missing} more cards. Please identify what categories are missing (lands, ramp, card draw, removal, win conditions, etc.) and suggest cards to complete the deck.`;
  }

  // Add combo context
  if (comboAnalysis && (comboAnalysis.completeCombos.length > 0 || comboAnalysis.nearMissCombos.length > 0)) {
    prompt += `\n\n## Known Combos (from Commander Spellbook)\n\n`;

    if (comboAnalysis.completeCombos.length > 0) {
      prompt += `**Complete Combos in Deck:**\n`;
      comboAnalysis.completeCombos.slice(0, 5).forEach((combo: any, i: number) => {
        prompt += `${i + 1}. ${combo.cards.join(' + ')} → ${combo.result}\n`;
      });
      prompt += '\n';
    }

    if (comboAnalysis.nearMissCombos.length > 0) {
      prompt += `**Near-Miss Combos (missing 1-2 cards):**\n`;
      comboAnalysis.nearMissCombos.slice(0, 5).forEach((nearMiss: any, i: number) => {
        prompt += `${i + 1}. Missing: ${nearMiss.missingCards.join(', ')} → ${nearMiss.combo.result}\n`;
      });
      prompt += '\n';
    }
  }

  // Add anti-meta instructions
  if (overplayedCards.length > 0) {
    const noveltyLevel = novelty >= 75 ? 'MAXIMUM' : novelty >= 50 ? 'HIGH' : 'MODERATE';

    prompt += `\n\n## Anti-Meta Guidelines (Novelty Level: ${noveltyLevel} - ${novelty}%)\n\n`;
    prompt += `The user wants ${noveltyLevel === 'MAXIMUM' ? 'unique, underplayed' : noveltyLevel === 'HIGH' ? 'creative, less common' : 'balanced'} suggestions.\n\n`;

    if (novelty >= 50) {
      prompt += `**AVOID suggesting these overplayed cards:**\n${overplayedCards.slice(0, 30).join(', ')}\n\n`;
    }

    if (hiddenGems.length > 0 && novelty >= 50) {
      prompt += `**Consider these underplayed gems instead:**\n`;
      hiddenGems.slice(0, 15).forEach((gem, i) => {
        prompt += `- ${gem.name} (${gem.inclusion.toFixed(1)}% inclusion, synergy: ${gem.synergy})\n`;
      });
      prompt += '\n';
    }
  }

  // Main analysis instructions
  prompt += `\n## Analysis Requirements\n\nProvide a comprehensive analysis with:\n\n`;

  prompt += `1. **Archetype**: Identify the deck archetype\n\n`;
  prompt += `2. **Mana Curve**: Analyze the mana curve\n\n`;
  prompt += `3. **Strengths**: 3-5 key strengths\n\n`;
  prompt += `4. **Weaknesses**: 3-5 vulnerabilities\n\n`;
  prompt += `5. **Existing Combos**: Note any synergies or combos you observe\n\n`;
  prompt += `6. **Potential Combos**: Suggest new combo lines\n\n`;

  prompt += `7. **Card Suggestions**: Recommend 10-15 cards across different price ranges:\n`;
  if (novelty >= 75) {
    prompt += `   - PRIORITY: Focus on spicy, underplayed cards (<25% inclusion rate)\n`;
    prompt += `   - Avoid mainstream staples unless absolutely critical\n`;
    prompt += `   - Look for hidden gems and creative synergies\n`;
  } else if (novelty >= 50) {
    prompt += `   - Balance between proven cards and creative alternatives\n`;
    prompt += `   - Prefer cards with 10-40% inclusion rate\n`;
    prompt += `   - Avoid the most overplayed staples\n`;
  } else {
    prompt += `   - Suggest the best cards for the strategy regardless of popularity\n`;
    prompt += `   - Include budget (<$5), mid-range ($5-25), and premium ($25+) options\n`;
  }

  prompt += `\n8. **Bracket Rating**: Rate 1-4 with reasoning\n\n`;
  prompt += `9. **Overall Assessment**: 2-3 paragraph summary\n\n`;

  prompt += `## Output Format\n\nRespond with ONLY valid JSON (no markdown, no code blocks):\n\n`;
  prompt += `{
  "archetype": "string",
  "manaCurveAnalysis": "string",
  "strengths": ["string", ...],
  "weaknesses": ["string", ...],
  "existingCombos": ["string", ...],
  "potentialCombos": ["string", ...],
  "cardSuggestions": [
    {"card": "Card Name", "reasoning": "why it fits"},
    ...
  ],
  "bracketRating": 1-4,
  "bracketReasoning": "string",
  "overallAssessment": "string"
}`;

  return prompt;
}

/**
 * Formats deck for Claude
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

/**
 * Calculates the color identity of the deck
 * Color identity = union of all color_identity fields from all cards
 */
function calculateColorIdentity(cards: DeckCard[]): string[] {
  const colors = new Set<string>();

  for (const { card } of cards) {
    if (card && card.color_identity) {
      card.color_identity.forEach(color => colors.add(color));
    }
  }

  // Return sorted array of color letters: W, U, B, R, G
  return Array.from(colors).sort((a, b) => {
    const order = 'WUBRG';
    return order.indexOf(a) - order.indexOf(b);
  });
}
