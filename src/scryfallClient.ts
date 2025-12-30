import axios from 'axios';
import { ScryfallCard } from './types.js';

const SCRYFALL_API_BASE = 'https://api.scryfall.com';
const RATE_LIMIT_DELAY = 100; // ms between requests (Scryfall asks for 50-100ms)

/**
 * Searches for a card by name using Scryfall's fuzzy search
 */
export async function searchCard(cardName: string): Promise<ScryfallCard | null> {
  try {
    const response = await axios.get(`${SCRYFALL_API_BASE}/cards/named`, {
      params: {
        fuzzy: cardName,
      },
    });

    return response.data as ScryfallCard;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.warn(`⚠️  Card not found: "${cardName}"`);
      return null;
    }
    throw error;
  }
}

/**
 * Fetches card data for an entire deck list
 */
export async function enrichDeckWithScryfall(cards: Array<{ quantity: number; name: string }>): Promise<Array<{ quantity: number; name: string; card?: ScryfallCard }>> {
  const enrichedCards = [];

  for (const { quantity, name } of cards) {
    console.log(`🔍 Looking up: ${name}`);

    const card = await searchCard(name);
    enrichedCards.push({ quantity, name, card: card || undefined });

    // Rate limiting
    await sleep(RATE_LIMIT_DELAY);
  }

  return enrichedCards;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
