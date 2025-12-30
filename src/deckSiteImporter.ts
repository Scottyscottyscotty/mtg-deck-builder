import axios from 'axios';
import { DeckCard } from './types.js';

/**
 * Imports a deck from Moxfield, Archidekt, or other popular sites
 */
export async function importDeckFromUrl(url: string): Promise<{ cards: DeckCard[]; deckName: string }> {
  const normalizedUrl = url.trim().toLowerCase();

  if (normalizedUrl.includes('moxfield.com')) {
    return importFromMoxfield(url);
  } else if (normalizedUrl.includes('archidekt.com')) {
    return importFromArchidekt(url);
  } else if (normalizedUrl.includes('tappedout.net')) {
    return importFromTappedOut(url);
  } else {
    throw new Error('Unsupported deck site. Supported: Moxfield, Archidekt, TappedOut');
  }
}

/**
 * Imports from Moxfield
 * URL format: https://www.moxfield.com/decks/{deckId}
 */
async function importFromMoxfield(url: string): Promise<{ cards: DeckCard[]; deckName: string }> {
  // Extract deck ID from URL
  const match = url.match(/moxfield\.com\/decks\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    throw new Error('Invalid Moxfield URL format');
  }

  const deckId = match[1];
  const apiUrl = `https://api2.moxfield.com/v3/decks/all/${deckId}`;

  console.log(`🔍 Fetching deck from Moxfield...`);

  try {
    const response = await axios.get(apiUrl);
    const data = response.data;

    const cards: DeckCard[] = [];

    // Process mainboard
    if (data.boards?.mainboard) {
      for (const [cardName, cardData] of Object.entries(data.boards.mainboard) as [string, any][]) {
        cards.push({
          quantity: cardData.quantity || 1,
          name: cardData.card?.name || cardName,
        });
      }
    }

    // Process commanders
    if (data.boards?.commanders) {
      for (const [cardName, cardData] of Object.entries(data.boards.commanders) as [string, any][]) {
        cards.push({
          quantity: cardData.quantity || 1,
          name: cardData.card?.name || cardName,
        });
      }
    }

    const deckName = data.name || 'Unnamed Deck';

    console.log(`✅ Imported "${deckName}" from Moxfield (${cards.length} unique cards)`);

    return { cards, deckName };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch from Moxfield: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Imports from Archidekt
 * URL format: https://archidekt.com/decks/{deckId}
 */
async function importFromArchidekt(url: string): Promise<{ cards: DeckCard[]; deckName: string }> {
  // Extract deck ID from URL
  const match = url.match(/archidekt\.com\/decks\/(\d+)/);
  if (!match) {
    throw new Error('Invalid Archidekt URL format');
  }

  const deckId = match[1];
  const apiUrl = `https://archidekt.com/api/decks/${deckId}/small/`;

  console.log(`🔍 Fetching deck from Archidekt...`);

  try {
    const response = await axios.get(apiUrl);
    const data = response.data;

    const cards: DeckCard[] = [];

    // Process cards
    if (data.cards && Array.isArray(data.cards)) {
      for (const cardData of data.cards) {
        // Skip sideboard/maybeboard
        if (cardData.categories?.includes('Sideboard') ||
            cardData.categories?.includes('Maybeboard')) {
          continue;
        }

        cards.push({
          quantity: cardData.quantity || 1,
          name: cardData.card?.oracleCard?.name || cardData.card?.name || 'Unknown',
        });
      }
    }

    const deckName = data.name || 'Unnamed Deck';

    console.log(`✅ Imported "${deckName}" from Archidekt (${cards.length} unique cards)`);

    return { cards, deckName };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch from Archidekt: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Imports from TappedOut
 * URL format: https://tappedout.net/mtg-decks/{deckSlug}/
 */
async function importFromTappedOut(url: string): Promise<{ cards: DeckCard[]; deckName: string }> {
  console.log(`🔍 Fetching deck from TappedOut...`);

  try {
    // TappedOut provides a plaintext export
    const textUrl = url.endsWith('/') ? url + '?fmt=txt' : url + '/?fmt=txt';

    const response = await axios.get(textUrl);
    const text = response.data;

    // Parse the text format
    const lines = text.split('\n');
    const cards: DeckCard[] = [];
    let deckName = 'TappedOut Deck';

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and section headers
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
        continue;
      }

      // Skip sideboard marker
      if (trimmed.toLowerCase().includes('sideboard')) {
        break;
      }

      // Parse card line: "3 Card Name" or "3x Card Name"
      const match = trimmed.match(/^(\d+)x?\s+(.+)$/);
      if (match) {
        const quantity = parseInt(match[1], 10);
        const name = match[2].trim();
        cards.push({ quantity, name });
      }
    }

    console.log(`✅ Imported deck from TappedOut (${cards.length} unique cards)`);

    return { cards, deckName };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch from TappedOut: ${error.message}`);
    }
    throw error;
  }
}
