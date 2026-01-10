import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { parseDeckList } from './deckParser.js';
import { enrichDeckWithScryfall } from './scryfallClient.js';
import { analyzeDeck } from './claudeAnalyzer.js';
import { enhancedAnalyzeDeck } from './enhancedAnalyzer.js';
import { compareDecks } from './deckComparison.js';
import { importDeckFromUrl } from './deckSiteImporter.js';
import { saveToHistory, listHistory, getHistoryEntry } from './history.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Analyze deck endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const {
      deckList,
      model = 'sonnet',
      deckName,
      commander,
      novelty = 50
    } = req.body;

    if (!deckList) {
      return res.status(400).json({ error: 'Deck list is required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    // Parse deck
    const cards = parseDeckList(deckList);
    if (cards.length === 0) {
      return res.status(400).json({ error: 'No valid cards found in deck list' });
    }

    // Enrich with Scryfall
    const enrichedCards = await enrichDeckWithScryfall(cards);

    // Use enhanced analyzer if commander is specified or novelty is not default
    const useEnhanced = commander || novelty !== 50;

    const analysis = useEnhanced
      ? await enhancedAnalyzeDeck(enrichedCards, apiKey, {
          model: model as 'sonnet' | 'opus',
          commander,
          novelty,
          enableCombos: true,
          enablePopularity: true,
        })
      : await analyzeDeck(enrichedCards, apiKey, model as 'sonnet' | 'opus');

    // Save to history
    const historyId = await saveToHistory(enrichedCards, analysis, model, deckName);

    res.json({
      success: true,
      analysis,
      historyId,
      totalCards: enrichedCards.reduce((sum, c) => sum + c.quantity, 0),
      uniqueCards: enrichedCards.length,
    });
  } catch (error: any) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message || 'Analysis failed' });
  }
});

// Compare decks endpoint
app.post('/api/compare', async (req, res) => {
  try {
    const { deck1, deck2, model = 'sonnet' } = req.body;

    if (!deck1 || !deck2) {
      return res.status(400).json({ error: 'Both deck lists are required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    // Parse decks
    const cards1 = parseDeckList(deck1);
    const cards2 = parseDeckList(deck2);

    if (cards1.length === 0 || cards2.length === 0) {
      return res.status(400).json({ error: 'Invalid deck list(s)' });
    }

    // Enrich with Scryfall
    const enriched1 = await enrichDeckWithScryfall(cards1);
    const enriched2 = await enrichDeckWithScryfall(cards2);

    // Compare
    const comparison = await compareDecks(enriched1, enriched2, apiKey, model as 'sonnet' | 'opus');

    res.json({
      success: true,
      comparison,
    });
  } catch (error: any) {
    console.error('Comparison error:', error);
    res.status(500).json({ error: error.message || 'Comparison failed' });
  }
});

// Import from URL endpoint
app.post('/api/import', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const { cards, deckName } = await importDeckFromUrl(url);

    // Convert to deck list format
    const deckList = cards.map(c => `${c.quantity} ${c.name}`).join('\n');

    res.json({
      success: true,
      deckList,
      deckName,
      totalCards: cards.reduce((sum, c) => sum + c.quantity, 0),
      uniqueCards: cards.length,
    });
  } catch (error: any) {
    console.error('Import error:', error);
    res.status(500).json({ error: error.message || 'Import failed' });
  }
});

// Drop-in analysis endpoint
app.post('/api/dropin', async (req, res) => {
  try {
    const {
      currentDeck,
      additions,
      commander,
      model = 'sonnet'
    } = req.body;

    if (!currentDeck || !additions) {
      return res.status(400).json({ error: 'Both current deck and additions are required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    // Parse both deck lists
    const currentCards = parseDeckList(currentDeck);
    const additionCards = parseDeckList(additions);

    if (currentCards.length === 0) {
      return res.status(400).json({ error: 'No valid cards found in current deck' });
    }

    if (additionCards.length === 0) {
      return res.status(400).json({ error: 'No valid cards found in additions' });
    }

    // Combine decks
    const combinedCards = [...currentCards, ...additionCards];

    // Enrich with Scryfall
    const enrichedCurrent = await enrichDeckWithScryfall(currentCards);
    const enrichedAdditions = await enrichDeckWithScryfall(additionCards);
    const enrichedCombined = [...enrichedCurrent, ...enrichedAdditions];

    // Calculate sizes
    const currentSize = currentCards.reduce((sum, c) => sum + c.quantity, 0);
    const additionsSize = additionCards.reduce((sum, c) => sum + c.quantity, 0);
    const combinedSize = combinedCards.reduce((sum, c) => sum + c.quantity, 0);
    const targetSize = commander ? 99 : 60;
    const needToCut = Math.max(0, combinedSize - targetSize);

    // Analyze combined deck
    const analysis = await enhancedAnalyzeDeck(enrichedCombined, apiKey, {
      model: model as 'sonnet' | 'opus',
      commander,
      novelty: 50,
      enableCombos: true,
      enablePopularity: true,
    });

    // Get cut recommendations from Claude if over limit
    let cutRecommendations: Array<{ card: string; reasoning: string }> = [];

    if (needToCut > 0) {
      const cutPrompt = buildCutRecommendationPrompt({
        currentDeck: enrichedCurrent.map(c => c.name),
        additions: enrichedAdditions.map(c => c.name),
        needToCut,
        commander
      });

      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const anthropic = new Anthropic({ apiKey });
      const modelId = model === 'opus'
        ? 'claude-opus-4-5-20251101'
        : 'claude-sonnet-4-5-20250929';

      const cutResponse = await anthropic.messages.create({
        model: modelId,
        max_tokens: 2048,
        temperature: 0, // Prevent hallucinations
        messages: [{ role: 'user', content: cutPrompt }],
      });

      const cutContent = cutResponse.content[0];
      if (cutContent.type === 'text') {
        let cutText = cutContent.text.trim();
        if (cutText.startsWith('```')) {
          cutText = cutText.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
        }
        const cutData = JSON.parse(cutText);
        cutRecommendations = cutData.cutRecommendations || [];
      }
    }

    res.json({
      success: true,
      currentSize,
      additionsSize,
      combinedSize,
      targetSize,
      needToCut,
      additions: additionCards.map(c => c.name),
      cutRecommendations,
      analysis,
    });
  } catch (error: any) {
    console.error('Drop-in analysis error:', error);
    res.status(500).json({ error: error.message || 'Analysis failed' });
  }
});

// History endpoints
app.get('/api/history', async (req, res) => {
  try {
    const history = await listHistory();
    res.json({ success: true, history });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load history' });
  }
});

app.get('/api/history/:id', async (req, res) => {
  try {
    const entry = await getHistoryEntry(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'History entry not found' });
    }
    res.json({ success: true, entry });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load history entry' });
  }
});

// Build deck endpoint
app.post('/api/build-deck', async (req, res) => {
  try {
    const { commander, novelty = 50, model = 'sonnet' } = req.body;

    if (!commander) {
      return res.status(400).json({ error: 'Commander is required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey });
    const modelId = model === 'opus'
      ? 'claude-opus-4-5-20251101'
      : 'claude-sonnet-4-5-20250929';

    console.log(`\n🏗️  Building deck for ${commander} (novelty: ${novelty}%)...\n`);

    // Look up commander to get color identity for new card filtering
    const { searchCard, getNewCardsSummary } = await import('./scryfallClient.js');
    let newCardsSummary = '';
    try {
      console.log('🔍 Looking up commander color identity...');
      const commanderCard = await searchCard(commander);
      if (commanderCard && commanderCard.color_identity) {
        console.log(`🆕 Fetching recent cards for colors: ${commanderCard.color_identity.join('') || 'Colorless'}...`);
        newCardsSummary = await getNewCardsSummary(commanderCard.color_identity, 20);
      }
    } catch (error) {
      console.warn('⚠️  Could not fetch new cards summary:', error);
      // Continue without new cards - not critical
    }

    const prompt = buildDeckPrompt(commander, novelty, newCardsSummary);

    console.log('🧠 Generating deck with Claude...\n');

    const response = await anthropic.messages.create({
      model: modelId,
      max_tokens: 8192,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    let deckText = content.text.trim();
    if (deckText.startsWith('```')) {
      deckText = deckText.replace(/^```(?:json)?\\n/, '').replace(/\\n```$/, '');
    }

    const deckData = JSON.parse(deckText);

    // Validate and fix card count
    const validatedDeck = validateDeckSize(deckData, 99);

    res.json({
      success: true,
      deck: validatedDeck.deck,
      warnings: validatedDeck.warnings,
    });
  } catch (error: any) {
    console.error('Build deck error:', error);
    res.status(500).json({ error: error.message || 'Deck building failed' });
  }
});

// Complete partial deck endpoint
app.post('/api/complete-deck', async (req, res) => {
  try {
    const { commander, partialDeck, novelty = 50, model = 'sonnet' } = req.body;

    if (!commander) {
      return res.status(400).json({ error: 'Commander is required' });
    }

    if (!partialDeck) {
      return res.status(400).json({ error: 'Partial deck is required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    // Parse the partial deck
    const { parseDeckList } = await import('./deckParser.js');
    const parsedDeck = parseDeckList(partialDeck);

    if (parsedDeck.length >= 99) {
      return res.status(400).json({ error: 'Your deck already has 99+ cards! Use "Analyze Deck" instead.' });
    }

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey });
    const modelId = model === 'opus'
      ? 'claude-opus-4-5-20251101'
      : 'claude-sonnet-4-5-20250929';

    console.log(`\n🧩 Completing deck for ${commander} (${parsedDeck.length} cards → 99 cards, novelty: ${novelty}%)...\n`);

    // Look up commander to get color identity for new card filtering
    const { searchCard, getNewCardsSummary } = await import('./scryfallClient.js');
    let newCardsSummary = '';
    try {
      console.log('🔍 Looking up commander color identity...');
      const commanderCard = await searchCard(commander);
      if (commanderCard && commanderCard.color_identity) {
        console.log(`🆕 Fetching recent cards for colors: ${commanderCard.color_identity.join('') || 'Colorless'}...`);
        newCardsSummary = await getNewCardsSummary(commanderCard.color_identity, 20);
      }
    } catch (error) {
      console.warn('⚠️  Could not fetch new cards summary:', error);
      // Continue without new cards - not critical
    }

    const prompt = buildCompleteDeckPrompt(commander, parsedDeck, novelty, newCardsSummary);

    console.log('🧠 Generating completion suggestions with Claude...\n');

    const response = await anthropic.messages.create({
      model: modelId,
      max_tokens: 8192,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    let completionText = content.text.trim();
    if (completionText.startsWith('```')) {
      completionText = completionText.replace(/^```(?:json)?\\n/, '').replace(/\\n```$/, '');
    }

    const completionData = JSON.parse(completionText);

    // Validate the completed deck size
    if (completionData.completedDeckList) {
      const validated = validateDeckSize({ deckList: completionData.completedDeckList }, 99);
      completionData.completedDeckList = validated.deck.deckList;

      res.json({
        success: true,
        completion: completionData,
        originalSize: parsedDeck.length,
        cardsAdded: completionData.suggestedCards?.length || 0,
        warnings: validated.warnings,
      });
    } else {
      res.json({
        success: true,
        completion: completionData,
        originalSize: parsedDeck.length,
        cardsAdded: completionData.suggestedCards?.length || 0,
      });
    }
  } catch (error: any) {
    console.error('Complete deck error:', error);
    res.status(500).json({ error: error.message || 'Deck completion failed' });
  }
});

// Find card for deck endpoint
app.post('/api/find-card', async (req, res) => {
  try {
    const { cardName } = req.body;

    if (!cardName) {
      return res.status(400).json({ error: 'Card name is required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    // Load history
    const history = await listHistory();

    if (history.length === 0) {
      return res.status(400).json({ error: 'No decks in history. Analyze some decks first!' });
    }

    // Look up card on Scryfall to get its details (even if it's brand new)
    const { searchCard } = await import('./scryfallClient.js');
    let cardData = null;

    try {
      cardData = await searchCard(cardName);
    } catch (error) {
      console.warn(`Warning: Could not find card "${cardName}" on Scryfall:`, error);
      // Continue without card data - Claude will do its best
    }

    // Use Claude to analyze which deck would benefit most
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey });

    const prompt = buildFindCardPrompt(cardName, history, cardData);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    let resultText = content.text.trim();
    if (resultText.startsWith('```')) {
      resultText = resultText.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
    }

    const result = JSON.parse(resultText);

    res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error('Find card error:', error);
    res.status(500).json({ error: error.message || 'Card search failed' });
  }
});

/**
 * Validates and fixes deck size issues (duplicates, wrong count)
 * Returns validated deck and warnings about what was changed
 */
function validateDeckSize(
  deckData: { deckList: string[] },
  targetSize: number
): { deck: { deckList: string[] }; warnings: string[] } {
  const warnings: string[] = [];
  let cardList = deckData.deckList || [];

  // Step 1: Remove duplicates (case-insensitive)
  const seen = new Set<string>();
  const uniqueCards: string[] = [];
  const duplicates: string[] = [];

  for (const card of cardList) {
    const normalized = card.toLowerCase().trim();
    if (seen.has(normalized)) {
      duplicates.push(card);
    } else {
      seen.add(normalized);
      uniqueCards.push(card);
    }
  }

  if (duplicates.length > 0) {
    warnings.push(
      `Removed ${duplicates.length} duplicate card(s): ${duplicates.slice(0, 5).join(', ')}${
        duplicates.length > 5 ? '...' : ''
      }`
    );
  }

  cardList = uniqueCards;

  // Step 2: Check if count matches target
  const actualCount = cardList.length;

  if (actualCount > targetSize) {
    const excess = actualCount - targetSize;
    const removed = cardList.slice(targetSize); // Remove from the end
    cardList = cardList.slice(0, targetSize);

    warnings.push(
      `AI generated ${actualCount} cards instead of ${targetSize}. Removed last ${excess} card(s): ${removed.slice(0, 3).join(', ')}${
        excess > 3 ? '...' : ''
      }`
    );
  } else if (actualCount < targetSize) {
    warnings.push(
      `Deck has ${actualCount} cards instead of ${targetSize}. Consider adding ${targetSize - actualCount} more cards.`
    );
  }

  return {
    deck: { deckList: cardList },
    warnings: warnings.length > 0 ? warnings : [],
  };
}

function buildDeckPrompt(commander: string, novelty: number, newCardsSummary: string = ''): string {
  const noveltyLevel = novelty >= 75 ? 'MAXIMUM' : novelty >= 50 ? 'BALANCED' : 'META';

  return `You are an expert Magic: The Gathering deck builder. Build a complete 99-card Commander deck for ${commander}.
${newCardsSummary}
## ⚠️ CRITICAL: COLOR IDENTITY RULES ⚠️

**ABSOLUTE REQUIREMENT:** ALL cards in this deck MUST match ${commander}'s color identity.

**COLOR IDENTITY RULES:**
- A card's color identity = ALL mana symbols in its mana cost + rules text
- **CORE RULE**: A card can ONLY be included if EVERY color in the card is present in the commander's colors
- In other words: The card's colors must be a subset of the commander's colors

**CRITICAL EXAMPLES:**
- If ${commander} is **MONO-GREEN**: Can include colorless, green-only cards. CANNOT include any card with W/U/B/R
- If ${commander} is **BLACK + WHITE**: Can include colorless, black, white, OR black+white cards. CANNOT include any card with G/U/R
- If ${commander} is **RED + GREEN + BLUE**: Can include colorless, R, G, U, RG, RU, GU, or RGB cards. CANNOT include any card with W/B
- If ${commander} is **5-COLOR (WUBRG)**: Can include cards of ANY color combination

**VERIFICATION STEPS:**
1. Determine ${commander}'s exact color identity
2. For EVERY card you add, verify it matches this color identity
3. For EVERY land that produces colored mana, verify it only produces colors in the identity
4. If unsure about a card's color identity, DO NOT include it

## Novelty Level: ${noveltyLevel} (${novelty}%)

${novelty >= 75
  ? '- Focus on unique, underplayed, and creative card choices\n- Avoid mainstream staples unless absolutely critical\n- Look for hidden gems and spicy tech'
  : novelty >= 50
  ? '- Balance between proven cards and creative alternatives\n- Include some staples but also interesting choices\n- Prefer cards that fit the strategy well'
  : '- Use the best cards available regardless of popularity\n- Include format staples and powerful cards\n- Focus on consistency and power level'}

## Requirements

1. Build a complete 99-card deck (do NOT include the commander in the count)
2. Include appropriate mana base (lands) - all lands must match color identity
3. Balance the mana curve
4. Include ramp, card draw, removal, and win conditions
5. Identify key synergies and combos
6. Explain the deck's strategy
7. **EVERY card must match ${commander}'s color identity**

## Output Format

Respond with ONLY valid JSON (no markdown, no code blocks):

{
  "deckList": ["Card Name", "Card Name", ...],
  "strategy": "2-3 sentence explanation of the deck's game plan",
  "keyCards": ["Card Name", ...],
  "combos": ["Description of combo", ...],
  "manaCurve": "Brief analysis of the mana curve",
  "categories": {
    "lands": 36,
    "ramp": 10,
    "draw": 10,
    "removal": 8,
    "threats": 20,
    "other": 15
  }
}

CRITICAL:
- Suggest only REAL Magic cards
- Do not hallucinate cards
- ALL cards must match ${commander}'s color identity`;
}

function buildCompleteDeckPrompt(commander: string, parsedDeck: Array<{name: string, quantity: number}>, novelty: number, newCardsSummary: string = ''): string {
  const noveltyLevel = novelty >= 75 ? 'MAXIMUM' : novelty >= 50 ? 'BALANCED' : 'META';
  const currentCards = parsedDeck.map(c => c.name);
  const cardsNeeded = 99 - parsedDeck.length;

  return `You are an expert Magic: The Gathering deck builder. The user has a partial Commander deck for ${commander} and needs help completing it.
${newCardsSummary}
## Commander
${commander}

## Current Deck (${parsedDeck.length} cards)
${currentCards.join(', ')}

## Cards Needed
You need to suggest **${cardsNeeded} cards** to bring this deck to a total of 99 cards.

## ⚠️ CRITICAL: COLOR IDENTITY RULES ⚠️

**ABSOLUTE REQUIREMENT:** ALL suggested cards MUST match ${commander}'s color identity.

**COLOR IDENTITY RULES:**
- A card's color identity = ALL mana symbols in its mana cost + rules text
- **CORE RULE**: A card can ONLY be suggested if EVERY color in the card is present in the commander's colors
- In other words: The card's colors must be a subset of the commander's colors

**CRITICAL EXAMPLES:**
- If ${commander} is **MONO-WHITE**: Can suggest colorless, white-only cards. CANNOT suggest any card with U/B/R/G
- If ${commander} is **RED + BLUE**: Can suggest colorless, red, blue, OR red+blue cards. CANNOT suggest any card with W/B/G
- If ${commander} is **GREEN + BLACK + BLUE**: Can suggest colorless, G, B, U, GB, GU, BU, or GBU cards. CANNOT suggest any card with W/R
- If ${commander} is **5-COLOR (WUBRG)**: Can suggest cards of ANY color combination

**VERIFICATION STEPS:**
1. Determine ${commander}'s exact color identity
2. For EVERY card you suggest, verify it matches this color identity
3. For EVERY land that produces colored mana, verify it only produces colors in the identity
4. If unsure about a card's color identity, DO NOT suggest it

## Novelty Level: ${noveltyLevel} (${novelty}%)

${novelty >= 75
  ? '- Focus on unique, underplayed, and creative card choices\n- Avoid mainstream staples unless absolutely critical\n- Look for hidden gems and spicy tech'
  : novelty >= 50
  ? '- Balance between proven cards and creative alternatives\n- Include some staples but also interesting choices\n- Prefer cards that fit the strategy well'
  : '- Use the best cards available regardless of popularity\n- Include format staples and powerful cards\n- Focus on consistency and power level'}

## Your Task

Analyze the existing cards and suggest ${cardsNeeded} cards to complete the deck. Consider:
1. What the deck is trying to do based on the existing cards
2. Fill gaps in the mana curve
3. Ensure adequate lands (if missing), ramp, card draw, removal, and threats
4. **CRITICAL**: Maintain color identity compatibility with ${commander}
5. Create synergies with existing cards

## Output Format

Respond with ONLY valid JSON (no markdown, no code blocks):

{
  "suggestedCards": [
    {
      "card": "Card Name",
      "reasoning": "Why this card fits the deck"
    },
    ...
  ],
  "strategy": "2-3 sentence explanation of what the deck is trying to do",
  "missingCategories": ["What the deck was lacking that you filled"],
  "keyAdditions": ["Most impactful cards you added"],
  "completedDeckList": ["Full 99 card list including original + suggested cards"]
}

CRITICAL:
- Suggest only REAL Magic cards
- Do not hallucinate cards
- ALL suggested cards must match ${commander}'s color identity`;
}

function buildFindCardPrompt(cardName: string, history: any[], cardData: any = null): string {
  const deckSummaries = history.map(h => {
    const commander = h.analysis?.commander || h.commander || 'Unknown';

    return {
      id: h.id,
      name: h.deckName || 'Unnamed Deck',
      archetype: h.archetype,
      bracketRating: h.bracketRating,
      commander,
    };
  });

  // Build card details section if we have Scryfall data
  let cardDetailsSection = '';
  if (cardData) {
    const colorIdentity = cardData.color_identity && cardData.color_identity.length > 0
      ? cardData.color_identity.join('')
      : 'Colorless';

    cardDetailsSection = `
## 📋 Card Details (from Scryfall)

**This information is authoritative - use it even if you don't recognize the card from training data.**

- **Name:** ${cardData.name}
- **Mana Cost:** ${cardData.mana_cost || 'N/A'}
- **Type:** ${cardData.type_line}
- **Oracle Text:** ${cardData.oracle_text || 'No text'}
- **Color Identity:** ${colorIdentity}
${cardData.power && cardData.toughness ? `- **P/T:** ${cardData.power}/${cardData.toughness}` : ''}
${cardData.loyalty ? `- **Loyalty:** ${cardData.loyalty}` : ''}

**Use the above information to determine synergies and color identity compatibility.**

`;
  }

  return `You are an expert Magic: The Gathering deck analyst. The user has a card "${cardName}" and wants to know which of their saved decks would benefit most from adding it.
${cardDetailsSection}

## ⚠️ CRITICAL: COLOR IDENTITY RULES ⚠️

Before recommending ANY deck, you MUST verify "${cardName}" matches the deck's color identity.

**COLOR IDENTITY DEFINITION:**
- A card's color identity = ALL mana symbols in mana cost + rules text + color indicator

**CORE RULE:**
- A card can ONLY go in a deck if EVERY color in the card is present in the deck's color identity
- In other words: The card's colors must be a subset of the deck's colors

**CRITICAL EXAMPLES:**
- **Sylvan Safekeeper** (costs {G}) = GREEN identity
  - ✅ Can go in: Mono-green, GW, GU, GB, GR, any deck with G
  - ❌ Cannot go in: Mono-red, Mono-black, WB, UR (no green in deck)

- **Anguished Unmaking** (costs {1}{W}{B}) = WHITE + BLACK identity
  - ✅ Can go in: WB, WBG, WBR, WBU, WUBRG (has both W and B)
  - ❌ Cannot go in: Mono-white, Mono-black, WU, BR (missing either W or B)

- **Sol Ring** (colorless) = COLORLESS identity
  - ✅ Can go in: ANY deck (no color requirements)

**STEP-BY-STEP VERIFICATION:**
1. Look up "${cardName}" and identify its exact color identity
2. For EACH deck, determine the commander's color identity
3. Check: Does the deck have EVERY color that "${cardName}" has?
4. If YES → deck is a match. If NO → REJECT that deck

**IF "${cardName}" DOES NOT MATCH A DECK'S COLOR IDENTITY, DO NOT RECOMMEND THAT DECK.**

## Saved Decks

${deckSummaries.map((d, i) => `${i + 1}. "${d.name}"
   - Commander: ${d.commander}
   - Archetype: ${d.archetype}
   - Bracket: ${d.bracketRating}/4`).join('\n\n')}

## Your Task

1. **FIRST**: Look up "${cardName}" and determine its exact color identity
2. **SECOND**: For each deck, verify the commander's color identity matches
3. **THIRD**: Among valid matches, analyze which would benefit most

Consider:
- Card synergy with the deck's strategy
- How it fills gaps or weaknesses
- Power level compatibility with bracket rating

## Output Format

Respond with ONLY valid JSON (no markdown, no code blocks):

{
  "cardColorIdentity": "The color identity of ${cardName} (e.g., 'WB', 'G', 'Colorless')",
  "bestMatch": {
    "deckName": "Name of best matching deck",
    "commander": "Commander name",
    "reasoning": "Why this card fits this deck",
    "synergies": ["What it synergizes with", ...]
  },
  "otherMatches": [
    {
      "deckName": "Name",
      "commander": "Commander name",
      "reasoning": "Why it could fit"
    }
  ],
  "colorMismatches": [
    {
      "deckName": "Name",
      "commander": "Commander name",
      "reason": "Why color identity doesn't match"
    }
  ]
}`;
}

function buildCutRecommendationPrompt(context: {
  currentDeck: string[];
  additions: string[];
  needToCut: number;
  commander?: string;
}): string {
  const { currentDeck, additions, needToCut, commander } = context;

  return `You are an expert Magic: The Gathering deck builder. The player wants to add new cards to their deck but needs to make cuts to stay within the deck size limit.

## Current Deck (${currentDeck.length} cards)
${currentDeck.join(', ')}

## Cards Being Added (${additions.length} cards)
${additions.join(', ')}

${commander ? `## Commander\n${commander}\n\n` : ''}

## Your Task
The player needs to cut **${needToCut} card${needToCut > 1 ? 's' : ''}** to make room for the new additions.

Recommend which cards from the **CURRENT DECK** should be cut. Consider:
- Cards that are redundant with the new additions
- Lower power level cards
- Cards that don't fit the deck's strategy as well
- Mana curve balance
- Overall deck synergy

Provide ${needToCut} specific cut recommendations with reasoning.

## Output Format
Respond with ONLY valid JSON (no markdown, no code blocks):

{
  "cutRecommendations": [
    {"card": "Card Name from current deck", "reasoning": "why to cut this card"},
    ...
  ]
}`;
}

// Deck Doctor Q&A endpoint
app.post('/api/deck-doctor', async (req, res) => {
  try {
    const { deckList, commander, analysis, question, conversationHistory = [] } = req.body;

    if (!deckList) {
      return res.status(400).json({ error: 'Deck list is required' });
    }

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    // Parse deck
    const { parseDeckList } = await import('./deckParser.js');
    const parsedDeck = parseDeckList(deckList);

    if (parsedDeck.length === 0) {
      return res.status(400).json({ error: 'Invalid deck list' });
    }

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey });

    // Build conversation context
    const messages: Array<{role: 'user' | 'assistant', content: string}> = [];

    // Add conversation history
    conversationHistory.forEach((msg: {role: string, content: string}) => {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      });
    });

    // Add current question with deck context (including analysis if available)
    const prompt = buildDeckDoctorPrompt(parsedDeck, commander, question, analysis);
    messages.push({ role: 'user', content: prompt });

    console.log(`\n💬 Deck Doctor: "${question}"\n`);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      temperature: 0,
      messages,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    res.json({
      success: true,
      answer: content.text.trim(),
    });
  } catch (error: any) {
    console.error('Deck Doctor error:', error);
    res.status(500).json({ error: error.message || 'Deck Doctor failed' });
  }
});

function buildDeckDoctorPrompt(
  parsedDeck: Array<{name: string, quantity: number}>,
  commander: string | undefined,
  question: string,
  analysis?: any
): string {
  const cardList = parsedDeck.map(c => c.name).join(', ');

  // Build detailed deck breakdown if analysis is available
  let deckBreakdown = '';
  if (analysis) {
    // Count card types from parsed deck
    const lands = parsedDeck.filter(c => c.name.toLowerCase().includes('land') ||
      ['Command Tower', 'Sol Ring', 'Arcane Signet'].some(land => c.name === land) === false).length;
    const totalCards = parsedDeck.reduce((sum, c) => sum + c.quantity, 0);

    deckBreakdown = `
## Detailed Deck Breakdown
- **Archetype:** ${analysis.archetype}
- **Bracket Rating:** ${analysis.bracketRating}/4
- **Total Cards:** ${totalCards} (${parsedDeck.length} unique)
- **Approximate Lands:** ~36 (estimate based on Commander conventions)

**Strengths:**
${analysis.strengths?.map((s: string) => `- ${s}`).join('\n') || 'N/A'}

**Weaknesses:**
${analysis.weaknesses?.map((w: string) => `- ${w}`).join('\n') || 'N/A'}

${analysis.existingCombos && analysis.existingCombos.length > 0 ? `**Known Combos:**
${analysis.existingCombos.slice(0, 5).map((c: string) => `- ${c}`).join('\n')}` : ''}
`;
  }

  return `You are "Deck Doctor", an expert Magic: The Gathering deck analyst. Answer the user's question about their Commander deck with detailed, actionable advice.

## Deck Context
${commander ? `**Commander:** ${commander}\n` : ''}**Deck (${parsedDeck.length} unique cards):**
${cardList}
${deckBreakdown}

## User's Question
${question}

## ⚠️ CRITICAL: COLOR IDENTITY RULES (If Suggesting Cards) ⚠️

**IF you suggest ANY cards, they MUST match ${commander ? commander + "'s" : "the deck's"} color identity.**

**COLOR IDENTITY RULES:**
- A card's color identity = ALL mana symbols in mana cost + rules text
- **CORE RULE**: A card can ONLY be suggested if EVERY color in the card is present in the ${commander ? "commander's" : "deck's"} colors
- In other words: The card's colors must be a subset of the ${commander ? "commander's" : "deck's"} colors

**CRITICAL EXAMPLES:**
- If ${commander || "the commander"} is **MONO-GREEN**: Can suggest colorless, green-only cards. CANNOT suggest any card with W/U/B/R
- If ${commander || "the commander"} is **BLUE + RED**: Can suggest colorless, blue, red, OR blue+red cards. CANNOT suggest any card with W/B/G
- If ${commander || "the commander"} is **WHITE + BLACK + GREEN**: Can suggest colorless, W, B, G, WB, WG, BG, or WBG cards. CANNOT suggest any card with U/R
- If ${commander || "the commander"} is **5-COLOR (WUBRG)**: Can suggest cards of ANY color combination

**BEFORE suggesting ANY card:**
1. Determine ${commander ? commander + "'s" : "the deck's"} exact color identity
2. Verify the suggested card matches this color identity
3. If unsure, DO NOT suggest it

## Instructions
- Give specific, actionable answers based on the cards in this deck
- Reference specific card names from the deck when relevant
- Use the deck breakdown above for ground truth facts (archetype, strengths, weaknesses, combos)
- If asking about numbers (lands, creatures, etc.), make educated guesses based on typical Commander deck composition
- If asking about combos/synergies, suggest real cards that work with cards in this deck **AND match color identity**
- If the question mentions a specific card, focus your analysis on that card in the context of this deck
- Be concise but thorough
- Use your Magic knowledge to provide strategic insights
- Only suggest REAL Magic cards (do not hallucinate cards)
- **ALL card suggestions must match ${commander ? commander + "'s" : "the deck's"} color identity**
- **DO NOT include any URLs or links in your response** - just mention card names (the UI will handle previews and shopping links automatically)

Answer the question directly and helpfully.`;
}

// Optimize collection endpoint
app.post('/api/optimize-collection', async (req: any, res: any) => {
  try {
    const {
      collection,
      commander,
      strategy,
      model = 'sonnet',
    } = req.body;

    if (!collection) {
      return res.status(400).json({ error: 'Collection list is required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    // Parse collection (similar to deck parsing)
    const collectionCards = collection
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && !line.startsWith('//'))
      .map((line: string) => {
        // Remove quantity if present
        const match = line.match(/^(\d+)x?\s+(.+)$/i);
        if (match) {
          return match[2].trim();
        }
        return line;
      });

    if (collectionCards.length < 50) {
      return res.status(400).json({
        error: 'Collection must contain at least 50 cards to build a Commander deck',
      });
    }

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey });
    const modelId = model === 'opus'
      ? 'claude-opus-4-5-20251101'
      : 'claude-sonnet-4-5-20250929';

    console.log(`\n🧠 Building deck from collection (${collectionCards.length} cards) with ${model}...\n`);

    // Look up commander to get color identity for new card filtering (if specified)
    const { searchCard, getNewCardsSummary } = await import('./scryfallClient.js');
    let newCardsSummary = '';
    if (commander) {
      try {
        console.log('🔍 Looking up commander color identity...');
        const commanderCard = await searchCard(commander);
        if (commanderCard && commanderCard.color_identity) {
          console.log(`🆕 Fetching recent cards for colors: ${commanderCard.color_identity.join('') || 'Colorless'}...`);
          newCardsSummary = await getNewCardsSummary(commanderCard.color_identity, 20);
        }
      } catch (error) {
        console.warn('⚠️  Could not fetch new cards summary:', error);
        // Continue without new cards - not critical
      }
    }

    // Build the prompt for collection optimization
    const prompt = buildCollectionOptimizationPrompt(
      collectionCards,
      commander,
      strategy,
      newCardsSummary
    );

    console.log('🧠 Optimizing collection...\n');

    const response = await anthropic.messages.create({
      model: modelId,
      max_tokens: 8192,
      temperature: 0,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    const textContent = response.content.find((c: any) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON response
    const jsonMatch = textContent.text.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from Claude');
    }

    const result = JSON.parse(jsonMatch[1]);

    // Validate deck size (mainDeck should have 99 cards)
    if (result.mainDeck) {
      const validated = validateDeckSize({ deckList: result.mainDeck }, 99);
      result.mainDeck = validated.deck.deckList;

      res.json({
        commander: result.commander,
        deck: result,
        warnings: validated.warnings,
      });
    } else {
      res.json({
        commander: result.commander,
        deck: result,
      });
    }
  } catch (error: any) {
    console.error('Collection optimization error:', error);
    res.status(500).json({
      error: error.message || 'Collection optimization failed',
    });
  }
});

function buildCollectionOptimizationPrompt(
  collection: string[],
  commander: string | null,
  strategy: string | null,
  newCardsSummary: string = ''
): string {
  let prompt = `You are an expert Magic: The Gathering deck builder. Analyze this collection of cards and build an optimized 100-card Commander deck.
${newCardsSummary}
**Your Collection (${collection.length} cards):**
${collection.join(', ')}

## ⚠️ CRITICAL: COLOR IDENTITY RULES ⚠️

**ABSOLUTE REQUIREMENT:** ALL cards in the deck MUST match the commander's color identity.

**COLOR IDENTITY RULES:**
- A card's color identity = ALL mana symbols in mana cost + rules text
- **CORE RULE**: A card can ONLY be included if EVERY color in the card is present in the commander's colors
- In other words: The card's colors must be a subset of the commander's colors

**CRITICAL EXAMPLES:**
- If commander is **MONO-BLACK**: Can include colorless, black-only cards. CANNOT include any card with W/U/R/G
- If commander is **WHITE + BLUE**: Can include colorless, white, blue, OR white+blue cards. CANNOT include any card with B/R/G
- If commander is **RED + GREEN + WHITE**: Can include colorless, R, G, W, RG, RW, GW, or RGW cards. CANNOT include any card with U/B
- If commander is **5-COLOR (WUBRG)**: Can include cards of ANY color combination

**VERIFICATION STEPS:**
1. Determine the commander's exact color identity
2. For EVERY card you add, verify it matches this color identity
3. For EVERY land that produces colored mana, verify it only produces colors in the identity
4. If unsure about a card's color identity, DO NOT include it

**Requirements:**
`;

  if (commander) {
    prompt += `- Commander: ${commander} (MUST be from the collection above)\n`;
  } else {
    prompt += `- Commander: Choose the best legendary creature from the collection that enables the strongest deck\n`;
  }

  if (strategy) {
    prompt += `- Strategy: ${strategy}\n`;
  } else {
    prompt += `- Strategy: Choose the best strategy based on available cards\n`;
  }

  prompt += `
- Deck must contain EXACTLY 99 cards (excluding commander)
- ALL cards must come from the provided collection
- **CRITICAL**: ALL cards must match the commander's color identity
- Include optimal mana base from available lands (matching color identity)
- Prioritize synergies and card quality
- Aim for proper mana curve and card type balance

**Output Format (JSON):**
\`\`\`json
{
  "commander": "Card Name",
  "strategy": "Brief description of the deck's strategy and gameplan",
  "keySynergies": "2-3 sentences about the deck's main synergies and win conditions",
  "mainDeck": [
    "Card Name 1",
    "Card Name 2",
    ...99 cards total
  ],
  "missingCards": [
    "Optional: 3-5 cards that would improve this deck but aren't in the collection"
  ]
}
\`\`\`

**Important:**
- Use ONLY cards from the provided collection
- **ALL cards must match the commander's color identity**
- Each card can only appear once (except basic lands if available)
- Be strategic about card selection - quality over quantity
- Make sure the deck is functional and has clear win conditions
- If the collection lacks certain essentials (e.g., ramp, removal), work with what's available`;

  return prompt;
}

app.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('           🃏 MTG Deck Analyzer Web Interface 🃏');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log('');
  console.log('Features:');
  console.log('  • Deck analysis with Claude 4.5');
  console.log('  • Collection Optimizer (build decks from your cards)');
  console.log('  • Novelty Mode (Anti-Meta suggestions)');
  console.log('  • Commander Spellbook combo detection');
  console.log('  • EDHREC popularity scoring');
  console.log('  • Card hover previews (Moxfield-style)');
  console.log('  • Shopping links (TCGplayer, Card Kingdom)');
  console.log('  • Deck comparison');
  console.log('  • Import from Moxfield, Archidekt, TappedOut');
  console.log('  • Analysis history');
  console.log('');
  console.log('Press Ctrl+C to stop the server');
  console.log('═══════════════════════════════════════════════════════════════');
});
