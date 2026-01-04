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
