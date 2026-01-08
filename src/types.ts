// Card data from Scryfall
export interface ScryfallCard {
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  color_identity?: string[];
  keywords?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  image_uris?: {
    small?: string;
    normal?: string;
    large?: string;
  };
  prices?: {
    usd?: string | null;
    usd_foil?: string | null;
    usd_etched?: string | null;
  };
}

// Deck list entry
export interface DeckCard {
  quantity: number;
  name: string;
  card?: ScryfallCard;
}

// Analysis result from Claude
export interface DeckAnalysis {
  archetype: string;
  manaCurveAnalysis: string;
  strengths: string[];
  weaknesses: string[];
  existingCombos: string[];
  potentialCombos: string[];
  cardSuggestions: Array<{
    card: string;
    reasoning: string;
    priceTier?: string;
    price?: number;
    popularity?: string; // "Staple", "Common", "Spicy"
    inclusionRate?: number; // 0-100
  }>;
  bracketRating: number;
  bracketReasoning: string;
  overallAssessment: string;

  // New fields for enhanced analysis
  spellbookCombos?: Array<{
    cards: string[];
    result: string;
    steps: string;
  }>;
  nearMissCombos?: Array<{
    missingCards: string[];
    cardsYouHave: string[];
    result: string;
  }>;
  deckCompleteness?: {
    currentSize: number;
    targetSize: number;
    isPartial: boolean;
    missingCategories?: string[];
  };

  // Weak point analysis and upgrade optimization
  weakPoints?: Array<{
    category: string; // e.g., "Mana Base", "Ramp", "Card Draw", "Removal", "Win Conditions"
    severity: 'critical' | 'high' | 'moderate' | 'low';
    issue: string; // Description of the problem
    impact: string; // How this affects gameplay
  }>;
  upgradePathAnalysis?: {
    primaryWeakPoint: string; // The #1 thing to fix
    budgetBreakpoints: Array<{
      budget: string; // e.g., "$0-25", "$25-75", "$75-150", "$150+"
      recommendedUpgrades: string[]; // Card names prioritized for this budget
      expectedImpact: string; // What improvement to expect
    }>;
  };
}
