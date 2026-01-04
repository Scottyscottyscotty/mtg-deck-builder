import axios from 'axios';

const EDHREC_JSON_BASE = 'https://json.edhrec.com/pages';

export interface CardPopularity {
  name: string;
  inclusion: number; // percentage (0-100)
  synergy: number; // synergy score
  label: 'Staple' | 'Common' | 'Spicy' | 'Unknown';
}

export interface EDHRECData {
  commander: string;
  popularCards: Map<string, CardPopularity>;
  avgDeckSize: number;
  numDecks: number;
}

/**
 * Fetches EDHREC data for a commander
 */
export async function fetchCommanderData(commanderName: string): Promise<EDHRECData | null> {
  console.log(`🔍 Fetching EDHREC data for ${commanderName}...`);

  try {
    // Convert commander name to EDHREC URL format
    const urlName = commanderName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const url = `${EDHREC_JSON_BASE}/commanders/${urlName}.json`;

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'MTG-Deck-Analyzer/1.0',
      },
    });

    const data = response.data;

    // Parse card recommendations
    const popularCards = new Map<string, CardPopularity>();

    // EDHREC data structure includes card lists by category
    const cardLists = data.cardlists || [];

    for (const cardList of cardLists) {
      const cards = cardList.cardviews || [];

      for (const card of cards) {
        const name = card.name;
        const numDecks = card.num_decks || 0;
        const totalDecks = data.container?.json_dict?.num_decks || 1;
        const inclusion = (numDecks / totalDecks) * 100;
        const synergy = card.synergy || 0;

        let label: 'Staple' | 'Common' | 'Spicy' | 'Unknown';
        if (inclusion >= 75) {
          label = 'Staple';
        } else if (inclusion >= 25) {
          label = 'Common';
        } else if (inclusion > 0) {
          label = 'Spicy';
        } else {
          label = 'Unknown';
        }

        popularCards.set(name.toLowerCase(), {
          name,
          inclusion,
          synergy,
          label,
        });
      }
    }

    console.log(`✅ Found data for ${popularCards.size} cards\n`);

    return {
      commander: commanderName,
      popularCards,
      avgDeckSize: 99, // Commander default
      numDecks: data.container?.json_dict?.num_decks || 0,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.warn(`⚠️  Could not fetch EDHREC data: ${error.message}`);
    }
    return null;
  }
}

/**
 * Gets the popularity label for a card
 */
export function getPopularityLabel(inclusionRate: number): 'Staple' | 'Common' | 'Spicy' | 'Unknown' {
  if (inclusionRate >= 75) return 'Staple';
  if (inclusionRate >= 25) return 'Common';
  if (inclusionRate > 0) return 'Spicy';
  return 'Unknown';
}

/**
 * Gets cards to avoid (overplayed staples)
 */
export function getOverplayedCards(edhrecData: EDHRECData, threshold: number = 50): string[] {
  const overplayed: string[] = [];

  for (const [cardName, popularity] of edhrecData.popularCards) {
    if (popularity.inclusion >= threshold) {
      overplayed.push(popularity.name);
    }
  }

  return overplayed;
}

/**
 * Gets underplayed cards with high synergy
 */
export function getHiddenGems(edhrecData: EDHRECData, maxInclusion: number = 25, minSynergy: number = 0): Array<{ name: string; inclusion: number; synergy: number }> {
  const gems: Array<{ name: string; inclusion: number; synergy: number }> = [];

  for (const [cardName, popularity] of edhrecData.popularCards) {
    if (popularity.inclusion <= maxInclusion && popularity.synergy >= minSynergy) {
      gems.push({
        name: popularity.name,
        inclusion: popularity.inclusion,
        synergy: popularity.synergy,
      });
    }
  }

  // Sort by synergy (highest first)
  gems.sort((a, b) => b.synergy - a.synergy);

  return gems;
}
