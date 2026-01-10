#!/usr/bin/env node

/**
 * Downloads Scryfall's bulk card data and extracts recent sets
 * Run this script outside the container to update newcards-full.json
 *
 * Usage: node update-new-cards.js
 */

import https from 'https';
import fs from 'fs/promises';
import path from 'path';

const OUTPUT_FILE = 'newcards-full.json';
const MONTHS_BACK = 6; // How many months of sets to include

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // Follow redirect
        return httpsGet(res.headers.location).then(resolve).catch(reject);
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function downloadBulkData() {
  console.log('📦 Fetching Scryfall bulk data metadata...');

  const bulkInfo = await httpsGet('https://api.scryfall.com/bulk-data');

  // Debug: Log the response structure
  console.log('   Response keys:', Object.keys(bulkInfo));

  // Scryfall returns an object with a 'data' array, but check if it's there
  const bulkDataList = bulkInfo.data || bulkInfo;

  if (!Array.isArray(bulkDataList)) {
    console.error('   Unexpected response format:', JSON.stringify(bulkInfo, null, 2));
    throw new Error('Scryfall bulk data response is not in expected format');
  }

  // Find the "Default Cards" bulk data (unique cards only)
  const defaultCards = bulkDataList.find(d => d.type === 'default_cards');

  if (!defaultCards) {
    console.error('   Available types:', bulkDataList.map(d => d.type).join(', '));
    throw new Error('Could not find default_cards bulk data');
  }

  console.log(`📥 Downloading ${defaultCards.name}...`);
  console.log(`   Size: ${(defaultCards.size / 1024 / 1024).toFixed(1)} MB`);
  console.log(`   Updated: ${defaultCards.updated_at}`);

  // Download the full card database
  console.log(`   Fetching from: ${defaultCards.download_uri.substring(0, 50)}...`);
  const allCards = await httpsGet(defaultCards.download_uri);

  if (!Array.isArray(allCards)) {
    throw new Error('Downloaded data is not an array of cards');
  }

  console.log(`✅ Downloaded ${allCards.length.toLocaleString()} cards`);

  return allCards;
}

function filterRecentSets(allCards) {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - MONTHS_BACK);

  console.log(`\n🔍 Filtering cards released after ${cutoffDate.toISOString().split('T')[0]}...`);

  const recentCards = allCards.filter(card => {
    if (!card.released_at) return false;
    const releaseDate = new Date(card.released_at);
    return releaseDate >= cutoffDate;
  });

  console.log(`✅ Found ${recentCards.length.toLocaleString()} recent cards`);

  // Group by set
  const cardsBySet = {};

  for (const card of recentCards) {
    const setCode = card.set.toUpperCase();
    const setName = card.set_name;

    if (!cardsBySet[setCode]) {
      cardsBySet[setCode] = {
        code: setCode,
        name: setName,
        releaseDate: card.released_at,
        cards: []
      };
    }

    // Only include cards legal in Commander
    if (card.legalities?.commander === 'legal' || card.legalities?.commander === 'restricted') {
      cardsBySet[setCode].cards.push({
        name: card.name,
        mana_cost: card.mana_cost || '',
        type_line: card.type_line,
        oracle_text: card.oracle_text || '',
        color_identity: card.color_identity || [],
        power: card.power,
        toughness: card.toughness,
        loyalty: card.loyalty
      });
    }
  }

  // Convert to array and sort by release date
  const sets = Object.values(cardsBySet)
    .sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));

  console.log('\n📊 Sets found:');
  for (const set of sets) {
    console.log(`   ${set.name} (${set.code}) - ${set.releaseDate} - ${set.cards.length} cards`);
  }

  return sets;
}

async function main() {
  try {
    console.log('🎯 Scryfall New Cards Updater\n');

    // Download all cards
    const allCards = await downloadBulkData();

    // Filter to recent sets
    const recentSets = filterRecentSets(allCards);

    // Save to file
    const outputPath = path.join(process.cwd(), OUTPUT_FILE);
    await fs.writeFile(
      outputPath,
      JSON.stringify({ sets: recentSets }, null, 2),
      'utf-8'
    );

    console.log(`\n✅ Saved to ${OUTPUT_FILE}`);
    console.log(`\n💡 Next steps:`);
    console.log(`   1. Review ${OUTPUT_FILE}`);
    console.log(`   2. Commit it to your repo`);
    console.log(`   3. The app will automatically use it when Scryfall API is unavailable`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
