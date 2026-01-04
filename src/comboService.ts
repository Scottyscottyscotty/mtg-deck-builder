import axios from 'axios';

const COMMANDER_SPELLBOOK_API = 'https://backend.commanderspellbook.com';

export interface ComboResult {
  id: string;
  cards: string[];
  colorIdentity: string[];
  prerequisites: string;
  steps: string;
  result: string;
  commanders?: string[];
  popularity?: number;
  spoiler: boolean;
}

export interface NearMissCombo {
  combo: ComboResult;
  missingCards: string[];
  cardsYouHave: string[];
}

export interface ComboAnalysis {
  completeCombos: ComboResult[];
  nearMissCombos: NearMissCombo[];
  totalCombosInDatabase: number;
}

/**
 * Finds all combos possible with the given card list
 */
export async function findCombos(cardNames: string[]): Promise<ComboAnalysis> {
  console.log('🔍 Searching Commander Spellbook for combos...');

  try {
    const response = await axios.post(`${COMMANDER_SPELLBOOK_API}/find-my-combos/`, {
      cards: cardNames,
    });

    const data = response.data;

    const completeCombos: ComboResult[] = data.included || [];
    const almostCombos: any[] = data.almost || [];

    // Process near-miss combos
    const nearMissCombos: NearMissCombo[] = almostCombos.map((almost) => {
      const comboCards = new Set(almost.uses.map((c: any) => c.name));
      const deckCards = new Set(cardNames.map(n => n.toLowerCase()));

      const missingCards: string[] = [];
      const cardsYouHave: string[] = [];

      almost.uses.forEach((cardUse: any) => {
        const cardName = cardUse.name;
        if (deckCards.has(cardName.toLowerCase())) {
          cardsYouHave.push(cardName);
        } else {
          missingCards.push(cardName);
        }
      });

      return {
        combo: {
          id: almost.id,
          cards: almost.uses.map((c: any) => c.name),
          colorIdentity: almost.identity || [],
          prerequisites: almost.prerequisites || '',
          steps: almost.description || '',
          result: almost.produces || '',
          spoiler: almost.spoiler || false,
        },
        missingCards,
        cardsYouHave,
      };
    });

    console.log(`✅ Found ${completeCombos.length} complete combos, ${nearMissCombos.length} near-miss combos\n`);

    return {
      completeCombos,
      nearMissCombos,
      totalCombosInDatabase: data.total || 0,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.warn(`⚠️  Commander Spellbook API error: ${error.message}`);
    }
    return {
      completeCombos: [],
      nearMissCombos: [],
      totalCombosInDatabase: 0,
    };
  }
}

/**
 * Formats a combo for display
 */
export function formatCombo(combo: ComboResult): string {
  const lines: string[] = [];

  lines.push(`Cards: ${combo.cards.join(' + ')}`);

  if (combo.prerequisites) {
    lines.push(`Prerequisites: ${combo.prerequisites}`);
  }

  if (combo.steps) {
    lines.push(`Steps: ${combo.steps}`);
  }

  lines.push(`Result: ${combo.result}`);

  return lines.join('\n');
}

/**
 * Formats near-miss combo suggestions
 */
export function formatNearMiss(nearMiss: NearMissCombo): string {
  const lines: string[] = [];

  lines.push(`Missing: ${nearMiss.missingCards.join(', ')}`);
  lines.push(`You have: ${nearMiss.cardsYouHave.join(', ')}`);
  lines.push(formatCombo(nearMiss.combo));

  return lines.join('\n');
}
