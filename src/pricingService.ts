import axios from 'axios';
import { sleep } from './utils/async.js';
import { API_ENDPOINTS, RATE_LIMITS, PRICE_TIERS } from './constants.js';

const SCRYFALL_API_BASE = API_ENDPOINTS.SCRYFALL;
const RATE_LIMIT_DELAY = RATE_LIMITS.SCRYFALL;

export interface CardPrice {
  name: string;
  price: number | null;
  priceTier: string;
}

/**
 * Fetches price for a single card from Scryfall
 */
export async function getCardPrice(cardName: string): Promise<CardPrice> {
  try {
    const response = await axios.get(`${SCRYFALL_API_BASE}/cards/named`, {
      params: {
        fuzzy: cardName,
      },
    });

    const card = response.data;
    const usdPrice = card.prices?.usd ? parseFloat(card.prices.usd) : null;

    return {
      name: card.name,
      price: usdPrice,
      priceTier: getPriceTier(usdPrice),
    };
  } catch (error) {
    return {
      name: cardName,
      price: null,
      priceTier: '?',
    };
  }
}

/**
 * Fetches prices for multiple cards
 */
export async function getCardPrices(cardNames: string[]): Promise<Map<string, CardPrice>> {
  const priceMap = new Map<string, CardPrice>();

  for (const name of cardNames) {
    const priceInfo = await getCardPrice(name);
    priceMap.set(name.toLowerCase(), priceInfo);

    // Rate limiting
    await sleep(RATE_LIMIT_DELAY);
  }

  return priceMap;
}

/**
 * Categorizes a price into tiers
 * $ = Budget (< $5)
 * $$ = Mid-range ($5 - $25)
 * $$$ = Expensive ($25+)
 */
export function getPriceTier(price: number | null): string {
  if (price === null) return '?';

  if (price < PRICE_TIERS.BUDGET) return '$';
  if (price < PRICE_TIERS.MODERATE) return '$$';
  return '$$$';
}

/**
 * Formats price for display
 */
export function formatPrice(price: number | null, tier: string): string {
  if (price === null) return tier;
  return `${tier} ($${price.toFixed(2)})`;
}
