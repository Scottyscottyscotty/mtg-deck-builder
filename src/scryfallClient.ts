import axios from 'axios';
import { ScryfallCard } from './types.js';

const SCRYFALL_API_BASE = 'https://api.scryfall.com';
const RATE_LIMIT_DELAY = 100; // ms between requests (Scryfall asks for 50-100ms)
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// In-memory cache for card data
interface CacheEntry {
  data: ScryfallCard | null;
  expires: number;
}

const cardCache = new Map<string, CacheEntry>();

/**
 * Clears the card cache (useful for testing or manual refresh)
 */
export function clearCache(): void {
  cardCache.clear();
  console.log('🗑️  Scryfall cache cleared');
}

/**
 * Gets cache statistics
 */
export function getCacheStats(): { size: number; hitRate?: number } {
  return { size: cardCache.size };
}

/**
 * Searches for a card by name using Scryfall's fuzzy search with retry logic
 * Results are cached for 24 hours to reduce API calls
 */
export async function searchCard(cardName: string): Promise<ScryfallCard | null> {
  // Check cache first
  const cacheKey = cardName.toLowerCase().trim();
  const cached = cardCache.get(cacheKey);

  if (cached && cached.expires > Date.now()) {
    console.log(`💾 Cache hit: ${cardName}`);
    return cached.data;
  }
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

      const card = response.data as ScryfallCard;

      // Cache the result
      cardCache.set(cacheKey, {
        data: card,
        expires: Date.now() + CACHE_TTL,
      });

      return card;
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
            const card = exactResponse.data as ScryfallCard;

            // Cache the result
            cardCache.set(cacheKey, {
              data: card,
              expires: Date.now() + CACHE_TTL,
            });

            return card;
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

          // Cache 404s to avoid repeated lookups
          cardCache.set(cacheKey, {
            data: null,
            expires: Date.now() + CACHE_TTL,
          });

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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
