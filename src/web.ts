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

    const prompt = buildDeckPrompt(commander, novelty);

    console.log(`\n🏗️  Building deck for ${commander} (novelty: ${novelty}%)...\n`);

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

    res.json({
      success: true,
      deck: deckData,
    });
  } catch (error: any) {
    console.error('Build deck error:', error);
    res.status(500).json({ error: error.message || 'Deck building failed' });
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

    // Use Claude to analyze which deck would benefit most
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey });

    const prompt = buildFindCardPrompt(cardName, history);

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
      resultText = resultText.replace(/^```(?:json)?\\n/, '').replace(/\\n```$/, '');
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

function buildDeckPrompt(commander: string, novelty: number): string {
  const noveltyLevel = novelty >= 75 ? 'MAXIMUM' : novelty >= 50 ? 'BALANCED' : 'META';

  return `You are an expert Magic: The Gathering deck builder. Build a complete 99-card Commander deck for ${commander}.

## Novelty Level: ${noveltyLevel} (${novelty}%)

${novelty >= 75
  ? '- Focus on unique, underplayed, and creative card choices\n- Avoid mainstream staples unless absolutely critical\n- Look for hidden gems and spicy tech'
  : novelty >= 50
  ? '- Balance between proven cards and creative alternatives\n- Include some staples but also interesting choices\n- Prefer cards that fit the strategy well'
  : '- Use the best cards available regardless of popularity\n- Include format staples and powerful cards\n- Focus on consistency and power level'}

## Requirements

1. Build a complete 99-card deck (do NOT include the commander in the count)
2. Include appropriate mana base (lands)
3. Balance the mana curve
4. Include ramp, card draw, removal, and win conditions
5. Identify key synergies and combos
6. Explain the deck's strategy

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

CRITICAL: Suggest only REAL Magic cards. Do not hallucinate cards.`;
}

function buildFindCardPrompt(cardName: string, history: any[]): string {
  const deckSummaries = history.map(h => ({
    id: h.id,
    name: h.deckName || 'Unnamed Deck',
    archetype: h.archetype,
    bracketRating: h.bracketRating,
  }));

  return `You are an expert Magic: The Gathering deck analyst. The user has a card "${cardName}" and wants to know which of their saved decks would benefit most from adding it.

## Saved Decks

${deckSummaries.map((d, i) => `${i + 1}. ${d.name} (${d.archetype}) - Bracket ${d.bracketRating}/4`).join('\n')}

## Your Task

Analyze which deck would benefit most from adding "${cardName}". Consider:
- Card synergy with the deck's strategy
- How it fills gaps or weaknesses
- Power level compatibility with bracket rating
- Color identity match

## Output Format

Respond with ONLY valid JSON (no markdown, no code blocks):

{
  "bestMatch": {
    "deckName": "Name of best matching deck",
    "archetype": "Archetype",
    "reasoning": "Why this card fits this deck",
    "synergies": ["What it synergizes with", ...]
  },
  "otherMatches": [
    {
      "deckName": "Name",
      "reasoning": "Why it could fit"
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

app.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('           🃏 MTG Deck Analyzer Web Interface 🃏');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log('');
  console.log('Features:');
  console.log('  • Deck analysis with Claude 4.5');
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
