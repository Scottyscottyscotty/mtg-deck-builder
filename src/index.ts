#!/usr/bin/env node

import { Command } from 'commander';
import * as readline from 'readline';
import * as dotenv from 'dotenv';
import { parseDeckList, summarizeDeck } from './deckParser.js';
import { enrichDeckWithScryfall } from './scryfallClient.js';
import { analyzeDeck } from './claudeAnalyzer.js';
import { formatAnalysis } from './formatter.js';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('mtg-deck-analyzer')
  .description('AI-powered MTG deck analysis using Claude and Scryfall')
  .version('1.0.0')
  .option('-m, --model <model>', 'Claude model to use (sonnet or opus)', 'sonnet')
  .option('-k, --api-key <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY env var)')
  .parse();

const options = program.opts();

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('           🃏 MTG Deck Analyzer powered by Claude 🃏');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Paste your deck list below (format: "3 Swamp", "1 Arcane Signet", etc.)');
  console.log('Press Ctrl+D (or Cmd+D on Mac) when done.');
  console.log('');
  console.log('───────────────────────────────────────────────────────────────');

  // Read deck list from stdin
  const deckListInput = await readStdin();

  if (!deckListInput.trim()) {
    console.error('❌ No deck list provided. Exiting.');
    process.exit(1);
  }

  console.log('───────────────────────────────────────────────────────────────');
  console.log('');

  // Parse the deck list
  console.log('📋 Parsing deck list...');
  const cards = parseDeckList(deckListInput);

  if (cards.length === 0) {
    console.error('❌ No valid cards found in deck list. Exiting.');
    process.exit(1);
  }

  console.log(`✅ ${summarizeDeck(cards)}`);
  console.log('');

  // Enrich with Scryfall data
  console.log('🔍 Fetching card data from Scryfall...');
  const enrichedCards = await enrichDeckWithScryfall(cards);

  const notFoundCount = enrichedCards.filter(c => !c.card).length;
  if (notFoundCount > 0) {
    console.log(`⚠️  Warning: ${notFoundCount} card(s) could not be found on Scryfall`);
  }

  console.log('✅ Card data fetched');
  console.log('');

  // Get API key
  const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: ANTHROPIC_API_KEY not found.');
    console.error('   Set it in your .env file or pass it with --api-key');
    console.error('   Get your key at: https://console.anthropic.com');
    process.exit(1);
  }

  // Validate model
  const model = options.model.toLowerCase();
  if (model !== 'sonnet' && model !== 'opus') {
    console.error('❌ Error: Model must be "sonnet" or "opus"');
    process.exit(1);
  }

  // Analyze with Claude
  try {
    const analysis = await analyzeDeck(enrichedCards, apiKey, model as 'sonnet' | 'opus');

    // Display results
    console.log('');
    console.log(formatAnalysis(analysis));

  } catch (error) {
    console.error('❌ Error during analysis:', error);
    process.exit(1);
  }
}

/**
 * Reads all input from stdin
 */
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

// Run the CLI
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
