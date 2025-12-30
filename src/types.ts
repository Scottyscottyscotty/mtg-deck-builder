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
  }>;
  bracketRating: number;
  bracketReasoning: string;
  overallAssessment: string;
}
