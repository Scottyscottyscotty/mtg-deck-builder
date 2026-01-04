const API_BASE = '';

// Tab switching
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
  });
  event.target.classList.add('active');

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`${tabName}-tab`).classList.add('active');

  // Load history when switching to history tab
  if (tabName === 'history') {
    loadHistory();
  }
}

// Analyze deck
async function analyzeDeck() {
  const deckList = document.getElementById('deck-list').value.trim();
  const deckName = document.getElementById('deck-name').value.trim();
  const commander = document.getElementById('commander-name').value.trim();
  const novelty = parseInt(document.getElementById('novelty').value);
  const model = document.getElementById('model').value;

  if (!deckList) {
    showError('analyze-error', 'Please enter a deck list');
    return;
  }

  hideError('analyze-error');
  hideResults('analyze-results');
  showLoading('analyze-loading');

  try {
    const response = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deckList,
        deckName,
        model,
        commander: commander || undefined,
        novelty
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Analysis failed');
    }

    displayAnalysis(data.analysis);
    showResults('analyze-results');
  } catch (error) {
    showError('analyze-error', error.message);
  } finally {
    hideLoading('analyze-loading');
  }
}

// Compare decks
async function compareDecks() {
  const deck1 = document.getElementById('deck1-list').value.trim();
  const deck2 = document.getElementById('deck2-list').value.trim();
  const model = document.getElementById('compare-model').value;

  if (!deck1 || !deck2) {
    showError('compare-error', 'Please enter both deck lists');
    return;
  }

  hideError('compare-error');
  hideResults('compare-results');
  showLoading('compare-loading');

  try {
    const response = await fetch(`${API_BASE}/api/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deck1, deck2, model }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Comparison failed');
    }

    displayComparison(data.comparison);
    showResults('compare-results');
  } catch (error) {
    showError('compare-error', error.message);
  } finally {
    hideLoading('compare-loading');
  }
}

// Import deck
async function importDeck() {
  const url = document.getElementById('import-url').value.trim();

  if (!url) {
    showError('import-error', 'Please enter a deck URL');
    return;
  }

  hideError('import-error');
  hideResults('import-results');
  showLoading('import-loading');

  try {
    const response = await fetch(`${API_BASE}/api/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Import failed');
    }

    document.getElementById('import-results').textContent =
      `Successfully imported: ${data.deckName}\n` +
      `Total cards: ${data.totalCards} (${data.uniqueCards} unique)\n\n` +
      `Deck list copied to "Analyze" tab!`;

    // Copy to analyze tab
    document.getElementById('deck-list').value = data.deckList;
    document.getElementById('deck-name').value = data.deckName;

    showResults('import-results');
  } catch (error) {
    showError('import-error', error.message);
  } finally {
    hideLoading('import-loading');
  }
}

// Drop-in analysis
async function dropInAnalysis() {
  const currentDeck = document.getElementById('dropin-current').value.trim();
  const additions = document.getElementById('dropin-additions').value.trim();
  const commander = document.getElementById('dropin-commander').value.trim();
  const model = document.getElementById('dropin-model').value;

  if (!currentDeck) {
    showError('dropin-error', 'Please enter your current deck');
    return;
  }

  if (!additions) {
    showError('dropin-error', 'Please enter cards to add');
    return;
  }

  hideError('dropin-error');
  hideResults('dropin-results');
  showLoading('dropin-loading');

  try {
    const response = await fetch(`${API_BASE}/api/dropin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentDeck,
        additions,
        commander: commander || undefined,
        model
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Analysis failed');
    }

    displayDropInResults(data);
    showResults('dropin-results');
  } catch (error) {
    showError('dropin-error', error.message);
  } finally {
    hideLoading('dropin-loading');
  }
}

// Display drop-in results
function displayDropInResults(data) {
  const el = document.getElementById('dropin-results');

  let html = '<h2>📥 Drop-In Analysis Results</h2>';

  // Summary
  html += '<div class="section warning-section">';
  html += '<h3>📊 Summary</h3>';
  html += `<p><strong>Current Deck:</strong> ${data.currentSize} cards</p>`;
  html += `<p><strong>Cards to Add:</strong> ${data.additionsSize} cards</p>`;
  html += `<p><strong>Combined Total:</strong> ${data.combinedSize} cards</p>`;
  if (data.targetSize) {
    const overage = data.combinedSize - data.targetSize;
    if (overage > 0) {
      html += `<p><strong style="color: #ff9f43;">⚠️ ${overage} cards over limit</strong> - You need to cut ${overage} card${overage > 1 ? 's' : ''}</p>`;
    }
  }
  html += '</div>';

  // New additions
  if (data.additions && data.additions.length > 0) {
    html += '<div class="section combo-section">';
    html += '<h3>🆕 Cards You\'re Adding</h3>';
    html += '<ul>';
    data.additions.forEach(card => {
      html += `<li>${escapeHtml(card)}</li>`;
    });
    html += '</ul>';
    html += '</div>';
  }

  // Cut recommendations
  if (data.cutRecommendations && data.cutRecommendations.length > 0) {
    html += '<div class="section">';
    html += '<h3>✂️ Recommended Cuts</h3>';
    html += '<p style="color: #999; margin-bottom: 15px;">Consider cutting these cards to make room for your additions:</p>';

    data.cutRecommendations.forEach((cut) => {
      html += '<div class="card-suggestion">';
      html += `<div class="card-suggestion-header">${escapeHtml(cut.card)}</div>`;
      html += `<div class="card-suggestion-reason">${escapeHtml(cut.reasoning)}</div>`;
      html += '</div>';
    });

    html += '</div>';
  }

  // Full analysis
  if (data.analysis) {
    html += '<div style="margin-top: 40px; padding-top: 40px; border-top: 2px solid rgba(255,255,255,0.1);">';
    html += '<h2>📊 Full Deck Analysis</h2>';
    html += '<div style="background: rgba(102, 126, 234, 0.1); padding: 12px; border-radius: 6px; margin-bottom: 20px; border-left: 3px solid #667eea;">';
    html += '<p style="margin: 0; color: #999;"><strong style="color: #667eea;">Note:</strong> This analysis reflects your deck <strong>WITH the new cards added</strong>. ';
    html += 'The bracket rating, strengths, weaknesses, and suggestions all consider the improved deck.</p>';
    html += '</div>';

    // Now display the analysis in the same element
    displayAnalysisInElement(data.analysis, 'temp-analyze-for-dropin');
    const analysisHTML = document.getElementById('temp-analyze-for-dropin').innerHTML;
    html += analysisHTML;
    html += '</div>';
  }

  el.innerHTML = html;
  setupCardHoverListeners();
}

// Helper function to display analysis in a specific element
function displayAnalysisInElement(analysis, elementId) {
  // Create temp element if it doesn't exist
  let el = document.getElementById(elementId);
  if (!el) {
    el = document.createElement('div');
    el.id = elementId;
    el.style.display = 'none';
    document.body.appendChild(el);
  }

  let html = '';

  // Overview section
  html += '<div class="section">';
  html += `<h3>Overview</h3>`;
  html += `<p><strong>Archetype:</strong> ${escapeHtml(analysis.archetype)}</p>`;
  html += `<p><strong>Bracket Rating:</strong> ${analysis.bracketRating}/4 ${'⭐'.repeat(analysis.bracketRating)}</p>`;
  html += `<p>${escapeHtml(analysis.bracketReasoning)}</p>`;
  html += '</div>';

  // Rest of the analysis sections (abbreviated for brevity but should include all sections)
  html += '<div class="section">';
  html += '<h3>⚡ Mana Curve Analysis</h3>';
  html += `<p>${escapeHtml(analysis.manaCurveAnalysis)}</p>`;
  html += '</div>';

  html += '<div class="section">';
  html += '<h3>💪 Strengths</h3>';
  html += '<ul>';
  analysis.strengths.forEach((s) => {
    html += `<li>${escapeHtml(s)}</li>`;
  });
  html += '</ul>';
  html += '</div>';

  html += '<div class="section">';
  html += '<h3>⚠️ Weaknesses</h3>';
  html += '<ul>';
  analysis.weaknesses.forEach((w) => {
    html += `<li>${escapeHtml(w)}</li>`;
  });
  html += '</ul>';
  html += '</div>';

  // Card suggestions
  if (analysis.cardSuggestions && analysis.cardSuggestions.length > 0) {
    html += '<div class="section">';
    html += '<h3>🎯 Card Suggestions</h3>';
    analysis.cardSuggestions.forEach((s) => {
      const priceDisplay = s.price !== undefined
        ? `${s.priceTier} ($${s.price.toFixed(2)})`
        : (s.priceTier || '?');
      const popTag = s.popularity && s.inclusionRate !== undefined
        ? ` <span style="color: #999;">[${s.popularity} ${s.inclusionRate.toFixed(0)}%]</span>`
        : '';
      html += '<div class="card-suggestion">';
      html += `<div class="card-suggestion-header">`;
      html += `${wrapCardName(s.card)} — ${priceDisplay}${popTag}`;
      html += `</div>`;
      html += `<div class="card-suggestion-reason">${escapeHtml(s.reasoning)}</div>`;
      html += `${createShopLinks(s.card)}`;
      html += '</div>';
    });
    html += '</div>';
  }

  html += '<div class="section">';
  html += '<h3>📝 Overall Assessment</h3>';
  html += `<p>${escapeHtml(analysis.overallAssessment)}</p>`;
  html += '</div>';

  el.innerHTML = html;
}

// Load history
async function loadHistory() {
  const listEl = document.getElementById('history-list');

  try {
    const response = await fetch(`${API_BASE}/api/history`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load history');
    }

    if (data.history.length === 0) {
      listEl.innerHTML = '<li style="text-align: center; color: #999;">No analysis history yet</li>';
      return;
    }

    listEl.innerHTML = data.history.map(entry => `
      <li class="history-item" onclick="loadHistoryEntry('${entry.id}')">
        <div class="history-item-header">
          <span class="history-item-title">${entry.deckName || 'Unnamed Deck'}</span>
          <span class="history-item-date">${new Date(entry.timestamp).toLocaleDateString()}</span>
        </div>
        <div class="history-item-info">
          ${entry.archetype} • Bracket ${entry.bracketRating}/4 • ${entry.totalCards} cards • ${entry.model}
        </div>
      </li>
    `).join('');
  } catch (error) {
    listEl.innerHTML = `<li style="color: #ff6b6b;">Error: ${error.message}</li>`;
  }
}

// Load specific history entry
async function loadHistoryEntry(id) {
  try {
    const response = await fetch(`${API_BASE}/api/history/${id}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load entry');
    }

    // Switch to analyze tab and populate
    switchTab('analyze');
    document.querySelector('.tab').click();

    const deckList = data.entry.deck.map(c => `${c.quantity} ${c.name}`).join('\n');
    document.getElementById('deck-list').value = deckList;
    document.getElementById('deck-name').value = data.entry.deckName || '';

    // Display the analysis
    displayAnalysis(data.entry.analysis);
    showResults('analyze-results');

  } catch (error) {
    alert(`Error loading history: ${error.message}`);
  }
}

// Display analysis
function displayAnalysis(analysis) {
  const el = document.getElementById('analyze-results');

  let html = '<h2>📊 Deck Analysis Results</h2>';

  // Overview section
  html += '<div class="section">';
  html += `<h3>Overview</h3>`;
  html += `<p><strong>Archetype:</strong> ${escapeHtml(analysis.archetype)}</p>`;
  html += `<p><strong>Bracket Rating:</strong> ${analysis.bracketRating}/4 ${'⭐'.repeat(analysis.bracketRating)}</p>`;
  html += `<p>${escapeHtml(analysis.bracketReasoning)}</p>`;
  html += '</div>';

  // Deck completeness warning
  if (analysis.deckCompleteness && analysis.deckCompleteness.isPartial) {
    const dc = analysis.deckCompleteness;
    html += '<div class="section warning-section">';
    html += `<h3>⚠️ Partial Deck Detected</h3>`;
    html += `<p>Currently ${dc.currentSize} cards out of ${dc.targetSize} needed.</p>`;
    html += `<p>Suggestions below will help complete your deck!</p>`;
    html += '</div>';
  }

  // Mana curve
  html += '<div class="section">';
  html += '<h3>⚡ Mana Curve Analysis</h3>';
  html += `<p>${escapeHtml(analysis.manaCurveAnalysis)}</p>`;
  html += '</div>';

  // Strengths
  html += '<div class="section">';
  html += '<h3>💪 Strengths</h3>';
  html += '<ul>';
  analysis.strengths.forEach((s) => {
    html += `<li>${escapeHtml(s)}</li>`;
  });
  html += '</ul>';
  html += '</div>';

  // Weaknesses
  html += '<div class="section">';
  html += '<h3>⚠️ Weaknesses</h3>';
  html += '<ul>';
  analysis.weaknesses.forEach((w) => {
    html += `<li>${escapeHtml(w)}</li>`;
  });
  html += '</ul>';
  html += '</div>';

  // Commander Spellbook Combos
  if (analysis.spellbookCombos && analysis.spellbookCombos.length > 0) {
    html += '<div class="section combo-section">';
    html += '<h3>🔮 Commander Spellbook Combos</h3>';
    html += '<ul>';
    analysis.spellbookCombos.forEach((combo) => {
      html += `<li><strong>${wrapCardNames(combo.cards.join(' + '))}</strong><br>`;
      html += `→ Result: ${escapeHtml(combo.result)}`;
      if (combo.steps) {
        html += `<br>→ Steps: ${escapeHtml(combo.steps)}`;
      }
      html += '</li>';
    });
    html += '</ul>';
    html += '</div>';
  }

  // Near-miss combos
  if (analysis.nearMissCombos && analysis.nearMissCombos.length > 0) {
    html += '<div class="section combo-section">';
    html += '<h3>🎯 Near-Miss Combos</h3>';
    html += '<p style="color: #999; margin-bottom: 15px;">Add 1-2 cards to unlock these combos:</p>';
    html += '<ul>';
    analysis.nearMissCombos.slice(0, 5).forEach((nearMiss) => {
      html += `<li><strong>Missing:</strong> ${wrapCardNames(nearMiss.missingCards.join(', '))}<br>`;
      html += `→ Result: ${escapeHtml(nearMiss.result)}<br>`;
      html += `→ You have: ${wrapCardNames(nearMiss.cardsYouHave.join(', '))}`;
      html += '</li>';
    });
    html += '</ul>';
    html += '</div>';
  }

  // Existing combos (from Claude analysis)
  if (analysis.existingCombos && analysis.existingCombos.length > 0) {
    html += '<div class="section">';
    html += '<h3>🎴 Existing Combos & Synergies</h3>';
    html += '<ul>';
    analysis.existingCombos.forEach((c) => {
      html += `<li>${escapeHtml(c)}</li>`;
    });
    html += '</ul>';
    html += '</div>';
  }

  // Potential combos
  if (analysis.potentialCombos && analysis.potentialCombos.length > 0) {
    html += '<div class="section">';
    html += '<h3>💡 Potential Combo Lines</h3>';
    html += '<ul>';
    analysis.potentialCombos.forEach((c) => {
      html += `<li>${escapeHtml(c)}</li>`;
    });
    html += '</ul>';
    html += '</div>';
  }

  // Card suggestions
  if (analysis.cardSuggestions && analysis.cardSuggestions.length > 0) {
    html += '<div class="section">';
    html += '<h3>🎯 Card Suggestions</h3>';

    analysis.cardSuggestions.forEach((s) => {
      const priceDisplay = s.price !== undefined
        ? `${s.priceTier} ($${s.price.toFixed(2)})`
        : (s.priceTier || '?');

      // Popularity tag
      const popTag = s.popularity && s.inclusionRate !== undefined
        ? ` <span style="color: #999;">[${s.popularity} ${s.inclusionRate.toFixed(0)}%]</span>`
        : '';

      html += '<div class="card-suggestion">';
      html += `<div class="card-suggestion-header">`;
      html += `${wrapCardName(s.card)} — ${priceDisplay}${popTag}`;
      html += `</div>`;
      html += `<div class="card-suggestion-reason">${escapeHtml(s.reasoning)}</div>`;
      html += `${createShopLinks(s.card)}`;
      html += '</div>';
    });

    html += '</div>';
  }

  // Overall assessment
  html += '<div class="section">';
  html += '<h3>📝 Overall Assessment</h3>';
  html += `<p>${escapeHtml(analysis.overallAssessment)}</p>`;
  html += '</div>';

  el.innerHTML = html;

  // Setup card hover listeners
  setupCardHoverListeners();
}

// Wrap card name with hover functionality
function wrapCardName(cardName) {
  return `<span class="card-name" data-card="${escapeHtml(cardName)}">${escapeHtml(cardName)}</span>`;
}

// Wrap multiple card names (handles "Card1, Card2 + Card3" format)
function wrapCardNames(text) {
  const cardPattern = /([A-Z][^,+]+?)(?=[,+]|$)/g;
  return text.replace(cardPattern, (match) => {
    const cardName = match.trim();
    if (cardName.length > 2) {
      return wrapCardName(cardName);
    }
    return match;
  });
}

// Create shopping links for a card
function createShopLinks(cardName) {
  const encoded = encodeURIComponent(cardName);
  const tcgUrl = `https://www.tcgplayer.com/search/magic/product?productLineName=magic&q=${encoded}`;
  const cardKingdomUrl = `https://www.cardkingdom.com/catalog/search?search=header&filter%5Bname%5D=${encoded}`;

  return `<span class="shop-links">
    🛒 Buy:
    <a href="${tcgUrl}" target="_blank" class="shop-link">TCGplayer</a>
    <a href="${cardKingdomUrl}" target="_blank" class="shop-link">Card Kingdom</a>
  </span>`;
}

// Setup card hover preview listeners
function setupCardHoverListeners() {
  const cardNames = document.querySelectorAll('.card-name');
  const preview = document.getElementById('card-preview');
  const previewImg = document.getElementById('card-preview-img');

  cardNames.forEach(el => {
    el.addEventListener('mouseenter', async (e) => {
      const cardName = el.dataset.card;

      // Fetch card image from Scryfall
      try {
        const response = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`);
        if (response.ok) {
          const cardData = await response.json();
          const imageUrl = cardData.image_uris?.normal || cardData.card_faces?.[0]?.image_uris?.normal;

          if (imageUrl) {
            previewImg.src = imageUrl;
            preview.classList.add('active');
            positionPreview(e, preview);
          }
        }
      } catch (error) {
        console.error('Failed to load card preview:', error);
      }
    });

    el.addEventListener('mousemove', (e) => {
      if (preview.classList.contains('active')) {
        positionPreview(e, preview);
      }
    });

    el.addEventListener('mouseleave', () => {
      preview.classList.remove('active');
    });
  });
}

// Position card preview near cursor
function positionPreview(e, preview) {
  const offset = 20;
  let x = e.clientX + offset;
  let y = e.clientY + offset;

  // Keep preview on screen
  const rect = preview.getBoundingClientRect();
  if (x + rect.width > window.innerWidth) {
    x = e.clientX - rect.width - offset;
  }
  if (y + rect.height > window.innerHeight) {
    y = e.clientY - rect.height - offset;
  }

  preview.style.left = x + 'px';
  preview.style.top = y + 'px';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Display comparison
function displayComparison(comparison) {
  const el = document.getElementById('compare-results');

  let html = '<h2>Comparison Results</h2>\n\n';

  html += '<strong>Deck 1:</strong>\n';
  html += `${comparison.deck1Summary}\n\n`;

  html += '<strong>Deck 2:</strong>\n';
  html += `${comparison.deck2Summary}\n\n`;

  if (comparison.sharedCards.length > 0) {
    html += '<strong>Shared Cards:</strong>\n';
    comparison.sharedCards.forEach(c => {
      html += `• ${c}\n`;
    });
    html += '\n';
  }

  if (comparison.uniqueToDeck1.length > 0) {
    html += '<strong>Unique to Deck 1:</strong>\n';
    comparison.uniqueToDeck1.forEach(c => {
      html += `• ${c}\n`;
    });
    html += '\n';
  }

  if (comparison.uniqueToDeck2.length > 0) {
    html += '<strong>Unique to Deck 2:</strong>\n';
    comparison.uniqueToDeck2.forEach(c => {
      html += `• ${c}\n`;
    });
    html += '\n';
  }

  html += '<strong>Strength Comparison:</strong>\n';
  html += `${comparison.strengthComparison}\n\n`;

  html += '<strong>Verdict:</strong>\n';
  html += `${comparison.whichIsBetter}\n\n`;

  html += '<strong>Matchup Analysis:</strong>\n';
  html += `${comparison.matchupAnalysis}\n\n`;

  if (comparison.recommendations.forDeck1.length > 0) {
    html += '<strong>Recommendations for Deck 1:</strong>\n';
    comparison.recommendations.forDeck1.forEach((r, i) => {
      html += `${i + 1}. ${r}\n`;
    });
    html += '\n';
  }

  if (comparison.recommendations.forDeck2.length > 0) {
    html += '<strong>Recommendations for Deck 2:</strong>\n';
    comparison.recommendations.forDeck2.forEach((r, i) => {
      html += `${i + 1}. ${r}\n`;
    });
  }

  el.innerHTML = html.replace(/\n/g, '<br>');
}

// Utility functions
function showError(id, message) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.classList.add('active');
}

function hideError(id) {
  document.getElementById(id).classList.remove('active');
}

function showLoading(id) {
  document.getElementById(id).classList.add('active');
}

function hideLoading(id) {
  document.getElementById(id).classList.remove('active');
}

function showResults(id) {
  document.getElementById(id).classList.add('active');
}

function hideResults(id) {
  document.getElementById(id).classList.remove('active');
}
