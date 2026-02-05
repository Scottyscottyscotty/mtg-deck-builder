/**
 * Application constants and configuration
 */

/**
 * Claude AI model identifiers
 */
export const CLAUDE_MODELS = {
  OPUS: 'claude-opus-4-5-20251101',
  SONNET: 'claude-sonnet-4-5-20250929',
} as const;

/**
 * Get model ID from string identifier
 * @param model 'opus' or 'sonnet'
 * @returns Full Claude model ID
 */
export function getModelId(model: string): string {
  return model === 'opus' ? CLAUDE_MODELS.OPUS : CLAUDE_MODELS.SONNET;
}

/**
 * Card pricing tiers (in USD)
 */
export const PRICE_TIERS = {
  BUDGET: 5,      // Under $5
  MODERATE: 25,   // $5-$25
  EXPENSIVE: 50,  // $25-$50
  PREMIUM: 100,   // $50+
} as const;

/**
 * EDHREC popularity thresholds (percentages)
 */
export const EDHREC_THRESHOLDS = {
  STAPLE: 75,     // 75%+ inclusion rate
  COMMON: 25,     // 25-75% inclusion rate
  SPICY: 25,      // Below 25% inclusion rate
} as const;

/**
 * Deck size constants
 */
export const DECK_SIZES = {
  COMMANDER: 99,  // Commander deck size (excluding commander)
  STANDARD: 60,   // Standard/Modern deck minimum
} as const;

/**
 * Magic color identity order
 */
export const COLOR_IDENTITY_ORDER = 'WUBRG';

/**
 * Rate limiting delays (in milliseconds)
 */
export const RATE_LIMITS = {
  SCRYFALL: 100,  // 100ms between Scryfall requests
} as const;

/**
 * API endpoints for external services
 */
export const API_ENDPOINTS = {
  SCRYFALL: 'https://api.scryfall.com',
  COMMANDER_SPELLBOOK: 'https://backend.commanderspellbook.com',
  EDHREC: 'https://json.edhrec.com',
} as const;

/**
 * Default AI parameters
 */
export const AI_DEFAULTS = {
  TEMPERATURE: 0,       // Prevent hallucinations
  MAX_TOKENS: 4096,     // Default token limit
  NOVELTY_DEFAULT: 50,  // Middle ground between meta and anti-meta
} as const;
