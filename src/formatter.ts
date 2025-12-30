import { DeckAnalysis } from './types.js';

/**
 * Formats the analysis results for terminal display
 */
export function formatAnalysis(analysis: DeckAnalysis): string {
  const lines: string[] = [];

  // Header
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                    🃏 DECK ANALYSIS RESULTS 🃏');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  // Archetype
  lines.push(`📊 ARCHETYPE: ${analysis.archetype}`);
  lines.push('');

  // Bracket Rating
  const bracketEmoji = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐'][analysis.bracketRating] || '';
  lines.push(`🏆 BRACKET RATING: ${analysis.bracketRating}/4 ${bracketEmoji}`);
  lines.push(`   ${analysis.bracketReasoning}`);
  lines.push('');

  // Mana Curve
  lines.push('📈 MANA CURVE ANALYSIS');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(analysis.manaCurveAnalysis);
  lines.push('');

  // Strengths
  lines.push('💪 STRENGTHS');
  lines.push('───────────────────────────────────────────────────────────────');
  analysis.strengths.forEach((strength, i) => {
    lines.push(`  ${i + 1}. ${strength}`);
  });
  lines.push('');

  // Weaknesses
  lines.push('⚠️  WEAKNESSES');
  lines.push('───────────────────────────────────────────────────────────────');
  analysis.weaknesses.forEach((weakness, i) => {
    lines.push(`  ${i + 1}. ${weakness}`);
  });
  lines.push('');

  // Existing Combos
  if (analysis.existingCombos.length > 0) {
    lines.push('🔗 EXISTING COMBOS & SYNERGIES');
    lines.push('───────────────────────────────────────────────────────────────');
    analysis.existingCombos.forEach((combo, i) => {
      lines.push(`  ${i + 1}. ${combo}`);
    });
    lines.push('');
  }

  // Potential Combos
  if (analysis.potentialCombos.length > 0) {
    lines.push('💡 POTENTIAL COMBOS TO CONSIDER');
    lines.push('───────────────────────────────────────────────────────────────');
    analysis.potentialCombos.forEach((combo, i) => {
      lines.push(`  ${i + 1}. ${combo}`);
    });
    lines.push('');
  }

  // Card Suggestions
  if (analysis.cardSuggestions.length > 0) {
    lines.push('🎯 CARD SUGGESTIONS (Sorted by Price)');
    lines.push('───────────────────────────────────────────────────────────────');
    analysis.cardSuggestions.forEach((suggestion, i) => {
      const priceDisplay = suggestion.price !== undefined
        ? `${suggestion.priceTier} ($${suggestion.price.toFixed(2)})`
        : suggestion.priceTier || '?';
      lines.push(`  ${i + 1}. ${suggestion.card} — ${priceDisplay}`);
      lines.push(`     → ${suggestion.reasoning}`);
      lines.push('');
    });
  }

  // Overall Assessment
  lines.push('📝 OVERALL ASSESSMENT');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(analysis.overallAssessment);
  lines.push('');

  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}
