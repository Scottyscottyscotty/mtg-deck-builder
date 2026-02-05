import axios from 'axios';
import { ScryfallCard } from './types.js';
import { sleep } from './utils/async.js';
import { API_ENDPOINTS, RATE_LIMITS } from './constants.js';

const SCRYFALL_API_BASE = API_ENDPOINTS.SCRYFALL;
const RATE_LIMIT_DELAY = RATE_LIMITS.SCRYFALL; // ms between requests (Scryfall asks for 50-100ms)

/**
 * Searches for a card by name using Scryfall's fuzzy search with retry logic
 */
export async function searchCard(cardName: string): Promise<ScryfallCard | null> {
  const maxRetries = 3;
  const retryDelay = 200; // ms

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Try fuzzy search first
      const response = await axios.get(`${SCRYFALL_API_BASE}/cards/named`, {
        params: {
          fuzzy: cardName,
        },
        timeout: 10000,
      });

      return response.data as ScryfallCard;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // If 404, try exact match as fallback
        if (error.response?.status === 404 && attempt === 1) {
          try {
            const exactResponse = await axios.get(`${SCRYFALL_API_BASE}/cards/named`, {
              params: {
                exact: cardName,
              },
              timeout: 10000,
            });
            return exactResponse.data as ScryfallCard;
          } catch (exactError) {
            // Continue to retry logic
          }
        }

        // Network errors or rate limiting - retry
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.response?.status === 429) {
          if (attempt < maxRetries) {
            console.warn(`⚠️  Retry ${attempt}/${maxRetries} for "${cardName}" (${error.code || 'rate limit'})`);
            await sleep(retryDelay * attempt); // Exponential backoff
            continue;
          }
        }

        // Final 404 - card genuinely not found
        if (error.response?.status === 404) {
          console.warn(`⚠️  Card not found after ${attempt} attempts: "${cardName}"`);
          return null;
        }
      }

      // Other errors on final attempt
      if (attempt === maxRetries) {
        console.error(`❌ Failed to fetch "${cardName}": ${error}`);
        return null;
      }

      // Retry for unknown errors
      await sleep(retryDelay * attempt);
    }
  }

  return null;
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
