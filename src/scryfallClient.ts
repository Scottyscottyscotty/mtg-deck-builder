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

/**
 * Fetches the latest Magic set(s) from Scryfall
 * Returns the most recent 1-2 standard-legal or expansion sets
 */
export async function getLatestSets(count: number = 2): Promise<Array<{ code: string; name: string; released_at: string }>> {
  try {
    const response = await axios.get(`${SCRYFALL_API_BASE}/sets`, {
      timeout: 10000,
    });

    const sets = response.data.data;

    // Filter for expansion/core sets, exclude promos, funny sets, etc.
    const relevantSets = sets.filter((set: any) =>
      (set.set_type === 'expansion' || set.set_type === 'core') &&
      !set.digital_only
    );

    // Sort by release date (newest first)
    relevantSets.sort((a: any, b: any) =>
      new Date(b.released_at).getTime() - new Date(a.released_at).getTime()
    );

    // Return the latest N sets
    return relevantSets.slice(0, count).map((set: any) => ({
      code: set.code,
      name: set.name,
      released_at: set.released_at,
    }));
  } catch (error) {
    console.error('❌ Failed to fetch latest sets:', error);
    return [];
  }
}

/**
 * Fetches notable cards from a set, filtered by color identity
 * Returns cards that match the specified colors and are likely to be relevant
 */
export async function getSetCardsByColor(
  setCode: string,
  colorIdentity: string[],
  limit: number = 30
): Promise<ScryfallCard[]> {
  try {
    // Build color filter query
    // If colorIdentity is empty (colorless), search for colorless cards
    // Otherwise, search for cards that are subsets of the color identity
    let colorQuery = '';
    if (colorIdentity.length === 0) {
      colorQuery = 'c:c'; // Colorless only
    } else {
      // Search for cards that contain only colors from the identity
      colorQuery = `ci<=${colorIdentity.sort().join('')}`;
    }

    const query = `set:${setCode} ${colorQuery} (t:creature OR t:instant OR t:sorcery OR t:enchantment OR t:artifact OR t:planeswalker) -t:basic`;

    const response = await axios.get(`${SCRYFALL_API_BASE}/cards/search`, {
      params: {
        q: query,
        order: 'edhrec',
        dir: 'desc',
        unique: 'cards',
      },
      timeout: 15000,
    });

    await sleep(RATE_LIMIT_DELAY);

    const cards = response.data.data as ScryfallCard[];

    // Return top N cards by EDH popularity
    return cards.slice(0, limit);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      // No cards found matching criteria
      console.warn(`⚠️  No cards found in set ${setCode} for colors ${colorIdentity.join('')}`);
      return [];
    }
    console.error(`❌ Failed to fetch cards from set ${setCode}:`, error);
    return [];
  }
}

/**
 * Builds a formatted summary of new cards from recent sets
 * Useful for including in prompts to make Claude aware of recent releases
 */
export async function getNewCardsSummary(colorIdentity: string[], maxCards: number = 20): Promise<string> {
  try {
    const latestSets = await getLatestSets(2);

    if (latestSets.length === 0) {
      return '';
    }

    let summary = '\n## 🆕 Recently Released Cards\n\n';
    summary += `The following cards from recent sets (${latestSets.map(s => s.name).join(', ')}) may be relevant:\n\n`;

    for (const set of latestSets) {
      const cards = await getSetCardsByColor(set.code, colorIdentity, Math.floor(maxCards / latestSets.length));

      if (cards.length > 0) {
        summary += `**${set.name}:**\n`;
        for (const card of cards) {
          const colorStr = card.color_identity?.join('') || 'C';
          summary += `- ${card.name} ${card.mana_cost || ''} [${colorStr}] - ${card.type_line}\n`;
          if (card.oracle_text) {
            // Truncate long oracle text
            const text = card.oracle_text.length > 120
              ? card.oracle_text.substring(0, 120) + '...'
              : card.oracle_text;
            summary += `  ${text.replace(/\n/g, ' ')}\n`;
          }
        }
        summary += '\n';
      }
    }

    summary += '**Note:** These are recent cards you may not be familiar with. Feel free to use them if they fit the strategy.\n\n';

    return summary;
  } catch (error) {
    console.error('❌ Failed to build new cards summary:', error);
    return '';
  }
}
