#!/usr/bin/env node

import { Command } from 'commander';
import * as readline from 'readline';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import { parseDeckList, summarizeDeck } from './deckParser.js';
import { enrichDeckWithScryfall } from './scryfallClient.js';
import { analyzeDeck } from './claudeAnalyzer.js';
import { enhancedAnalyzeDeck } from './enhancedAnalyzer.js';
import { formatAnalysis } from './formatter.js';
import { compareDecks, formatComparison } from './deckComparison.js';
import { exportToMarkdown, exportToJSON } from './exporter.js';
import { saveToHistory, listHistory, getHistoryEntry } from './history.js';
import { importDeckFromUrl } from './deckSiteImporter.js';
import { findDecksForCard, formatMatches } from './cardMatcher.js';
import { DeckCard } from './types.js';

dotenv.config();

const program = new Command();

program
  .name('mtg-deck-analyzer')
  .description('AI-powered MTG deck analysis using Claude and Scryfall')
  .version('1.0.0');

// Analyze command (default)
program
  .command('analyze', { isDefault: true })
  .description('Analyze a deck from stdin or file')
  .option('-m, --model <model>', 'Claude model to use (sonnet or opus)', 'sonnet')
  .option('-k, --api-key <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY env var)')
  .option('-o, --output <file>', 'Export analysis to file (.md or .json)')
  .option('-n, --name <name>', 'Deck name for history')
  .option('-c, --commander <name>', 'Commander name (enables EDHREC integration)')
  .option('--novelty <level>', 'Novelty level 0-100 (0=best cards, 100=max novelty)', '50')
  .option('--no-combos', 'Disable Commander Spellbook combo search')
  .option('--no-popularity', 'Disable EDHREC popularity scoring')
  .option('--no-history', 'Skip saving to history')
  .action(async (options) => {
    try {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('           🃏 MTG Deck Analyzer powered by Claude 🃏');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');
      console.log('Paste your deck list below (format: "3 Swamp", "1 Arcane Signet", etc.)');
      console.log('Press Ctrl+D (or Cmd+D on Mac) when done.');
      console.log('');
      console.log('───────────────────────────────────────────────────────────────');

      const deckListInput = await readStdin();

      if (!deckListInput.trim()) {
        console.error('❌ No deck list provided. Exiting.');
        process.exit(1);
      }

      console.log('───────────────────────────────────────────────────────────────');
      console.log('');

      const cards = parseDeckList(deckListInput);
      if (cards.length === 0) {
        console.error('❌ No valid cards found in deck list. Exiting.');
        process.exit(1);
      }

      console.log(`📋 ${summarizeDeck(cards)}`);
      console.log('');

      console.log('🔍 Fetching card data from Scryfall...');
      const enrichedCards = await enrichDeckWithScryfall(cards);

      const notFoundCount = enrichedCards.filter(c => !c.card).length;
      if (notFoundCount > 0) {
        console.log(`⚠️  Warning: ${notFoundCount} card(s) could not be found on Scryfall`);
      }

      console.log('✅ Card data fetched');
      console.log('');

      const apiKey = getApiKey(options);
      const model = validateModel(options.model);

      const novelty = parseInt(options.novelty, 10);
      if (isNaN(novelty) || novelty < 0 || novelty > 100) {
        console.error('❌ Error: Novelty must be a number between 0 and 100');
        process.exit(1);
      }

      // Use enhanced analyzer if any advanced options are set
      const useEnhanced = options.commander || novelty !== 50 || options.combos !== false || options.popularity !== false;

      const analysis = useEnhanced
        ? await enhancedAnalyzeDeck(enrichedCards, apiKey, {
            model,
            novelty,
            commander: options.commander,
            enableCombos: options.combos !== false,
            enablePopularity: options.popularity !== false,
          })
        : await analyzeDeck(enrichedCards, apiKey, model);

      console.log('');
      console.log(formatAnalysis(analysis));

      // Save to history
      if (options.history !== false) {
        const historyId = await saveToHistory(enrichedCards, analysis, model, options.name);
        console.log(`\n💾 Saved to history (ID: ${historyId})`);
      }

      // Export if requested
      if (options.output) {
        await exportAnalysis(enrichedCards, analysis, options.output);
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// Compare command
program
  .command('compare <deck1> <deck2>')
  .description('Compare two decks from files')
  .option('-m, --model <model>', 'Claude model to use (sonnet or opus)', 'sonnet')
  .option('-k, --api-key <key>', 'Anthropic API key')
  .action(async (deck1Path, deck2Path, options) => {
    try {
      console.log('🔄 Loading decks...\n');

      const deck1Text = await fs.readFile(deck1Path, 'utf-8');
      const deck2Text = await fs.readFile(deck2Path, 'utf-8');

      const cards1 = parseDeckList(deck1Text);
      const cards2 = parseDeckList(deck2Text);

      console.log(`Deck 1: ${summarizeDeck(cards1)}`);
      console.log(`Deck 2: ${summarizeDeck(cards2)}`);
      console.log('');

      console.log('🔍 Fetching card data from Scryfall...');
      const enriched1 = await enrichDeckWithScryfall(cards1);
      const enriched2 = await enrichDeckWithScryfall(cards2);
      console.log('✅ Card data fetched\n');

      const apiKey = getApiKey(options);
      const model = validateModel(options.model);

      const comparison = await compareDecks(enriched1, enriched2, apiKey, model);

      console.log('');
      console.log(formatComparison(comparison));
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// Import command
program
  .command('import <url>')
  .description('Import a deck from Moxfield, Archidekt, or TappedOut')
  .action(async (url) => {
    try {
      const { cards, deckName } = await importDeckFromUrl(url);

      console.log(`\n✅ Imported: ${deckName}`);
      console.log(`   ${summarizeDeck(cards)}\n`);

      // Print the deck list
      cards.forEach(({ quantity, name }) => {
        console.log(`${quantity} ${name}`);
      });
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// History command
program
  .command('history')
  .description('View analysis history')
  .option('-l, --list', 'List all history entries', true)
  .option('-s, --show <id>', 'Show specific history entry')
  .action(async (options) => {
    try {
      if (options.show) {
        const entry = await getHistoryEntry(options.show);
        if (!entry) {
          console.error('❌ History entry not found');
          process.exit(1);
        }

        console.log(`\nDeck: ${entry.deckName || 'Unnamed'}`);
        console.log(`Date: ${new Date(entry.timestamp).toLocaleString()}`);
        console.log(`Model: ${entry.model}`);
        console.log(`Cards: ${entry.totalCards} (${entry.uniqueCards} unique)`);
        console.log('');
        console.log(formatAnalysis(entry.analysis));
      } else {
        const history = await listHistory();

        if (history.length === 0) {
          console.log('No analysis history found.');
          return;
        }

        console.log('\n📚 Analysis History\n');
        history.forEach((entry, i) => {
          const date = new Date(entry.timestamp).toLocaleDateString();
          const name = entry.deckName || 'Unnamed Deck';
          console.log(`${i + 1}. [${entry.id}] ${name}`);
          console.log(`   ${entry.archetype} • Bracket ${entry.bracketRating}/4 • ${entry.model} • ${date}`);
          console.log('');
        });

        console.log('Use "mtg-deck-analyzer history --show <id>" to view details\n');
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// Find card command
program
  .command('find-card <cardName>')
  .description('Find which of your decks would benefit from adding a specific card')
  .action(async (cardName) => {
    try {
      const matches = await findDecksForCard(cardName);

      if (matches.length === 0) {
        console.log(`\nNo suitable decks found for "${cardName}".`);
        console.log('The card may not match any deck colors, or you may not have any deck history yet.\n');
        return;
      }

      console.log(formatMatches(matches));

      // Show top match details
      if (matches.length > 0 && matches[0].score >= 50) {
        console.log(`💡 Best match: "${matches[0].deckName}" (ID: ${matches[0].deckId})`);
        console.log(`   Use "mtg-deck-analyzer history --show ${matches[0].deckId}" to view the deck\n`);
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program.parse();

// Helper functions

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    const lines: string[] = [];

    rl.on('line', (line) => {
      lines.push(line);
    });

    rl.on('close', () => {
      resolve(lines.join('\n'));
    });
  });
}

function getApiKey(options: any): string {
  const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: ANTHROPIC_API_KEY not found.');
    console.error('   Set it in your .env file or pass it with --api-key');
    console.error('   Get your key at: https://console.anthropic.com');
    process.exit(1);
  }
  return apiKey;
}

function validateModel(model: string): 'sonnet' | 'opus' {
  const m = model.toLowerCase();
  if (m !== 'sonnet' && m !== 'opus') {
    console.error('❌ Error: Model must be "sonnet" or "opus"');
    process.exit(1);
  }
  return m as 'sonnet' | 'opus';
}

async function exportAnalysis(cards: DeckCard[], analysis: any, outputPath: string): Promise<void> {
  const ext = outputPath.toLowerCase().endsWith('.json') ? 'json' : 'md';

  if (ext === 'json') {
    await exportToJSON(analysis, cards, outputPath);
  } else {
    await exportToMarkdown(analysis, cards, outputPath);
  }
}
