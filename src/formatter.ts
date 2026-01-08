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

  // Deck Completeness (if partial)
  if (analysis.deckCompleteness?.isPartial) {
    const { currentSize, targetSize } = analysis.deckCompleteness;
    const missing = targetSize - currentSize;
    lines.push(`⚠️  PARTIAL DECK: ${currentSize}/${targetSize} cards (need ${missing} more)`);
    if (analysis.deckCompleteness.missingCategories) {
      lines.push(`   Missing: ${analysis.deckCompleteness.missingCategories.join(', ')}`);
    }
    lines.push('');
  }

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

  // Weak Point Analysis
  if (analysis.weakPoints && analysis.weakPoints.length > 0) {
    lines.push('🔍 WEAK POINT ANALYSIS');
    lines.push('───────────────────────────────────────────────────────────────');
    const severityEmoji: Record<string, string> = {
      critical: '🔴',
      high: '🟠',
      moderate: '🟡',
      low: '🟢'
    };
    analysis.weakPoints.forEach((wp, i) => {
      const emoji = severityEmoji[wp.severity] || '⚪';
      lines.push(`  ${emoji} ${wp.category} (${wp.severity.toUpperCase()})`);
      lines.push(`     Issue: ${wp.issue}`);
      lines.push(`     Impact: ${wp.impact}`);
      lines.push('');
    });
  }

  // Upgrade Path Analysis
  if (analysis.upgradePathAnalysis) {
    lines.push('🛠️  UPGRADE PATH ROADMAP');
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push(`  🎯 PRIMARY FOCUS: ${analysis.upgradePathAnalysis.primaryWeakPoint}`);
    lines.push('');

    analysis.upgradePathAnalysis.budgetBreakpoints.forEach(tier => {
      lines.push(`  💰 ${tier.budget}`);
      lines.push(`     Impact: ${tier.expectedImpact}`);
      lines.push(`     Cards: ${tier.recommendedUpgrades.join(', ')}`);
      lines.push('');
    });
  }

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

  // Commander Spellbook Combos
  if (analysis.spellbookCombos && analysis.spellbookCombos.length > 0) {
    lines.push('✨ COMMANDER SPELLBOOK COMBOS');
    lines.push('───────────────────────────────────────────────────────────────');
    analysis.spellbookCombos.forEach((combo, i) => {
      lines.push(`  ${i + 1}. ${combo.cards.join(' + ')}`);
      lines.push(`     → ${combo.result}`);
      if (combo.steps) {
        lines.push(`     Steps: ${combo.steps}`);
      }
      lines.push('');
    });
  }

  // Near-Miss Combos
  if (analysis.nearMissCombos && analysis.nearMissCombos.length > 0) {
    lines.push('🔮 NEAR-MISS COMBOS (Add 1-2 cards!)');
    lines.push('───────────────────────────────────────────────────────────────');
    analysis.nearMissCombos.forEach((combo, i) => {
      lines.push(`  ${i + 1}. Add: ${combo.missingCards.join(', ')}`);
      lines.push(`     You have: ${combo.cardsYouHave.join(', ')}`);
      lines.push(`     → ${combo.result}`);
      lines.push('');
    });
  }

  // Card Suggestions
  if (analysis.cardSuggestions.length > 0) {
    lines.push('🎯 CARD SUGGESTIONS (Sorted by Novelty & Price)');
    lines.push('───────────────────────────────────────────────────────────────');
    analysis.cardSuggestions.forEach((suggestion, i) => {
      const priceDisplay = suggestion.price !== undefined
        ? `${suggestion.priceTier} ($${suggestion.price.toFixed(2)})`
        : suggestion.priceTier || '?';

      const popularityTag = suggestion.popularity
        ? ` [${suggestion.popularity}${suggestion.inclusionRate ? ` ${suggestion.inclusionRate.toFixed(0)}%` : ''}]`
        : '';

      lines.push(`  ${i + 1}. ${suggestion.card} — ${priceDisplay}${popularityTag}`);
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
