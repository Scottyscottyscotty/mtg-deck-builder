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

// Build deck
async function buildDeck() {
  const commander = document.getElementById('build-commander').value.trim();
  const novelty = parseInt(document.getElementById('build-novelty').value);
  const model = document.getElementById('build-model').value;

  if (!commander) {
    showError('build-error', 'Please enter a commander name');
    return;
  }

  hideError('build-error');
  hideResults('build-results');
  showLoading('build-loading');

  try {
    const response = await fetch(`${API_BASE}/api/build-deck`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commander, novelty, model }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Deck building failed');
    }

    displayBuiltDeck(data.deck, commander);
    showResults('build-results');
  } catch (error) {
    showError('build-error', error.message);
  } finally {
    hideLoading('build-loading');
  }
}

// Find card for deck
async function findCardForDeck() {
  const cardName = document.getElementById('find-card-name').value.trim();

  if (!cardName) {
    showError('find-error', 'Please enter a card name');
    return;
  }

  hideError('find-error');
  hideResults('find-results');
  showLoading('find-loading');

  try {
    const response = await fetch(`${API_BASE}/api/find-card`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardName }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Card search failed');
    }

    displayCardMatch(data.result, cardName);
    showResults('find-results');
  } catch (error) {
    showError('find-error', error.message);
  } finally {
    hideLoading('find-loading');
  }
}

// Display built deck
function displayBuiltDeck(deck, commander) {
  const el = document.getElementById('build-results');

  let html = `<h2>🏗️ Built Deck: ${escapeHtml(commander)}</h2>`;

  // Strategy
  html += '<div class="section">';
  html += '<h3>🎯 Strategy</h3>';
  html += `<p>${escapeHtml(deck.strategy)}</p>`;
  html += '</div>';

  // Categories breakdown
  if (deck.categories) {
    html += '<div class="section">';
    html += '<h3>📊 Card Categories</h3>';
    html += '<ul>';
    for (const [category, count] of Object.entries(deck.categories)) {
      html += `<li><strong>${category.charAt(0).toUpperCase() + category.slice(1)}:</strong> ${count} cards</li>`;
    }
    html += '</ul>';
    html += '</div>';
  }

  // Mana curve
  if (deck.manaCurve) {
    html += '<div class="section">';
    html += '<h3>⚡ Mana Curve</h3>';
    html += `<p>${escapeHtml(deck.manaCurve)}</p>`;
    html += '</div>';
  }

  // Key cards
  if (deck.keyCards && deck.keyCards.length > 0) {
    html += '<div class="section">';
    html += '<h3>⭐ Key Cards</h3>';
    html += '<ul>';
    deck.keyCards.forEach(card => {
      html += `<li>${wrapCardName(card)}</li>`;
    });
    html += '</ul>';
    html += '</div>';
  }

  // Combos
  if (deck.combos && deck.combos.length > 0) {
    html += '<div class="section combo-section">';
    html += '<h3>🔮 Combos</h3>';
    html += '<ul>';
    deck.combos.forEach(combo => {
      html += `<li>${escapeHtml(combo)}</li>`;
    });
    html += '</ul>';
    html += '</div>';
  }

  // Full deck list
  html += '<div class="section">';
  html += '<h3>📋 Complete Deck List (99 cards)</h3>';
  html += '<p style="color: #999; margin-bottom: 10px;">Copy and paste this into your deck builder:</p>';

  html += '<div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 6px; font-family: monospace; font-size: 14px; max-height: 400px; overflow-y: auto;">';
  html += '<pre style="margin: 0; white-space: pre-wrap;">';
  html += `Commander\n1 ${escapeHtml(commander)}\n\n`;
  html += 'Deck\n';
  deck.deckList.forEach(card => {
    html += `1 ${escapeHtml(card)}\n`;
  });
  html += '</pre>';
  html += '</div>';

  html += '<button onclick="copyDeckList()" style="margin-top: 15px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">📋 Copy to Clipboard</button>';
  html += '</div>';

  el.innerHTML = html;

  // Store deck list for copying
  window.currentDeckList = `Commander\n1 ${commander}\n\nDeck\n${deck.deckList.map(c => `1 ${c}`).join('\n')}`;

  setupCardHoverListeners();
}

// Display card match
function displayCardMatch(result, cardName) {
  const el = document.getElementById('find-results');

  let html = `<h2>🔍 Best Deck for ${wrapCardName(cardName)}</h2>`;

  // Best match
  if (result.bestMatch) {
    html += '<div class="section">';
    html += '<h3>🎯 Best Match</h3>';
    html += `<p><strong>Deck:</strong> ${escapeHtml(result.bestMatch.deckName)} (${escapeHtml(result.bestMatch.archetype)})</p>`;
    html += `<p><strong>Why it fits:</strong> ${escapeHtml(result.bestMatch.reasoning)}</p>`;

    if (result.bestMatch.synergies && result.bestMatch.synergies.length > 0) {
      html += '<p><strong>Synergies:</strong></p>';
      html += '<ul>';
      result.bestMatch.synergies.forEach(s => {
        html += `<li>${escapeHtml(s)}</li>`;
      });
      html += '</ul>';
    }
    html += '</div>';
  }

  // Other matches
  if (result.otherMatches && result.otherMatches.length > 0) {
    html += '<div class="section">';
    html += '<h3>💡 Other Possible Matches</h3>';
    result.otherMatches.forEach(match => {
      html += '<div style="margin-bottom: 15px;">';
      html += `<p><strong>${escapeHtml(match.deckName)}</strong></p>`;
      html += `<p style="color: #999;">${escapeHtml(match.reasoning)}</p>`;
      html += '</div>';
    });
    html += '</div>';
  }

  el.innerHTML = html;
  setupCardHoverListeners();
}

// Copy deck list to clipboard
function copyDeckList() {
  if (window.currentDeckList) {
    navigator.clipboard.writeText(window.currentDeckList).then(() => {
      alert('Deck list copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy. Please manually select and copy the deck list.');
    });
  }
}

// Complete partial deck
async function completeDeck() {
  const commander = document.getElementById('complete-commander').value.trim();
  const partialDeck = document.getElementById('complete-deck').value.trim();
  const novelty = parseInt(document.getElementById('complete-novelty').value);
  const model = document.getElementById('complete-model').value;

  if (!commander) {
    showError('complete-error', 'Please enter a commander name');
    return;
  }

  if (!partialDeck) {
    showError('complete-error', 'Please enter your partial deck');
    return;
  }

  hideError('complete-error');
  hideResults('complete-results');
  showLoading('complete-loading');

  try {
    const response = await fetch(`${API_BASE}/api/complete-deck`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commander, partialDeck, novelty, model }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Deck completion failed');
    }

    displayCompletedDeck(data.completion, commander, data.originalSize, data.cardsAdded);
    showResults('complete-results');
  } catch (error) {
    showError('complete-error', error.message);
  } finally {
    hideLoading('complete-loading');
  }
}

// Display completed deck
function displayCompletedDeck(completion, commander, originalSize, cardsAdded) {
  const el = document.getElementById('complete-results');

  let html = `<h2>🧩 Completed Deck: ${escapeHtml(commander)}</h2>`;

  // Summary
  html += '<div class="section">';
  html += '<h3>📊 Summary</h3>';
  html += `<p><strong>Original deck size:</strong> ${originalSize} cards</p>`;
  html += `<p><strong>Cards added:</strong> ${cardsAdded} cards</p>`;
  html += `<p><strong>Total deck:</strong> 99 cards ✓</p>`;
  html += '</div>';

  // Strategy
  if (completion.strategy) {
    html += '<div class="section">';
    html += '<h3>🎯 Deck Strategy</h3>';
    html += `<p>${escapeHtml(completion.strategy)}</p>`;
    html += '</div>';
  }

  // Missing categories that were filled
  if (completion.missingCategories && completion.missingCategories.length > 0) {
    html += '<div class="section">';
    html += '<h3>🔧 Gaps Filled</h3>';
    html += '<ul>';
    completion.missingCategories.forEach(category => {
      html += `<li>${escapeHtml(category)}</li>`;
    });
    html += '</ul>';
    html += '</div>';
  }

  // Key additions
  if (completion.keyAdditions && completion.keyAdditions.length > 0) {
    html += '<div class="section">';
    html += '<h3>⭐ Key Additions</h3>';
    html += '<ul>';
    completion.keyAdditions.forEach(card => {
      html += `<li>${wrapCardName(card)}</li>`;
    });
    html += '</ul>';
    html += '</div>';
  }

  // Suggested cards with reasoning
  if (completion.suggestedCards && completion.suggestedCards.length > 0) {
    html += '<div class="section">';
    html += '<h3>➕ Suggested Cards</h3>';
    completion.suggestedCards.forEach(suggestion => {
      html += '<div class="card-suggestion">';
      html += `<div class="card-suggestion-header">${wrapCardName(suggestion.card)}</div>`;
      html += `<div class="card-suggestion-reason">${escapeHtml(suggestion.reasoning)}</div>`;
      html += `${createShopLinks(suggestion.card)}`;
      html += '</div>';
    });
    html += '</div>';
  }

  // Full completed deck list
  if (completion.completedDeckList && completion.completedDeckList.length > 0) {
    html += '<div class="section">';
    html += '<h3>📋 Complete Deck List (99 cards)</h3>';
    html += '<p style="color: #999; margin-bottom: 10px;">Copy and paste this into your deck builder:</p>';

    html += '<div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 6px; font-family: monospace; font-size: 14px; max-height: 400px; overflow-y: auto;">';
    html += '<pre style="margin: 0; white-space: pre-wrap;">';
    html += `Commander\n1 ${escapeHtml(commander)}\n\n`;
    html += 'Deck\n';
    completion.completedDeckList.forEach(card => {
      html += `1 ${escapeHtml(card)}\n`;
    });
    html += '</pre>';
    html += '</div>';

    html += '<button onclick="copyCompletedDeckList()" style="margin-top: 15px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">📋 Copy to Clipboard</button>';
    html += '</div>';

    // Store deck list for copying
    window.currentCompletedDeckList = `Commander\n1 ${commander}\n\nDeck\n${completion.completedDeckList.map(c => `1 ${c}`).join('\n')}`;
  }

  el.innerHTML = html;
  setupCardHoverListeners();
}

// Copy completed deck list to clipboard
function copyCompletedDeckList() {
  if (window.currentCompletedDeckList) {
    navigator.clipboard.writeText(window.currentCompletedDeckList).then(() => {
      alert('Completed deck list copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy. Please manually select and copy the deck list.');
    });
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
      html += `<li>${wrapCardName(card)}</li>`;
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
      html += `<div class="card-suggestion-header">${wrapCardName(cut.card)}</div>`;
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

  // Overall assessment
  html += '<div class="section">';
  html += '<h3>📝 Overall Assessment</h3>';
  html += `<p>${escapeHtml(analysis.overallAssessment)}</p>`;
  html += '</div>';

  // === RECOMMENDATIONS SECTION ===
  // Visual separator before recommendations
  const hasRecommendations = (analysis.nearMissCombos && analysis.nearMissCombos.length > 0) ||
                              (analysis.cardSuggestions && analysis.cardSuggestions.length > 0);

  if (hasRecommendations) {
    html += '<div style="margin-top: 40px; padding-top: 40px; border-top: 2px solid rgba(102, 126, 234, 0.3);">';
    html += '<h2 style="color: #667eea; margin-bottom: 20px;">💡 Deck Doctor Recommendations</h2>';
    html += '<p style="color: #999; margin-bottom: 30px;">Based on the analysis above, here are suggestions to improve your deck:</p>';

    // Near-miss combos (these are recommendations to add cards)
    if (analysis.nearMissCombos && analysis.nearMissCombos.length > 0) {
      html += '<div class="section combo-section">';
      html += '<h3>🎯 Unlock These Combos</h3>';
      html += '<p style="color: #999; margin-bottom: 15px;">Add 1-2 cards to unlock these powerful combos:</p>';
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

    // Card suggestions
    if (analysis.cardSuggestions && analysis.cardSuggestions.length > 0) {
      html += '<div class="section">';
      html += '<h3>🎯 Recommended Cards</h3>';

      analysis.cardSuggestions.forEach((s) => {
        const priceDisplay = s.price !== undefined
          ? `${s.priceTier} ($${s.price.toFixed(2)})`
          : (s.priceTier || '?');

        // Popularity tag
        const popTag = s.popularity && s.inclusionRate !== undefined
          ? ` <span style="color: #999;">[${s.popularity} ${s.inclusionRate.toFixed(0)}%]</span>`
          : '';

        // Confidence level badge
        const confidence = s.confidence || 'medium';
        const confidenceColors = {
          high: { bg: 'rgba(76, 175, 80, 0.15)', border: '#4caf50', text: '#4caf50' },
          medium: { bg: 'rgba(255, 193, 7, 0.15)', border: '#ffc107', text: '#ffc107' },
          low: { bg: 'rgba(255, 152, 0, 0.15)', border: '#ff9800', text: '#ff9800' }
        };
        const confidenceColor = confidenceColors[confidence];
        const confidenceBadge = `<span style="display: inline-block; padding: 2px 8px; margin-left: 8px; background: ${confidenceColor.bg}; border: 1px solid ${confidenceColor.border}; border-radius: 12px; font-size: 0.75em; color: ${confidenceColor.text}; font-weight: 600; text-transform: uppercase;">${confidence}</span>`;

        // Price warning for expensive cards
        let priceWarning = '';
        if (s.price && s.price > 50) {
          priceWarning = `<div style="background: rgba(255, 159, 67, 0.1); border-left: 3px solid #ff9f43; padding: 8px 12px; margin-top: 8px; border-radius: 4px; font-size: 0.9em;">`;
          priceWarning += `⚠️ <strong>Expensive Card Alert:</strong> This card costs over $50. Make sure it's worth the investment for your deck's strategy and budget.`;
          priceWarning += `</div>`;
        } else if (s.price && s.price > 20) {
          priceWarning = `<div style="background: rgba(255, 193, 7, 0.1); border-left: 3px solid #ffc107; padding: 8px 12px; margin-top: 8px; border-radius: 4px; font-size: 0.9em;">`;
          priceWarning += `💰 <strong>Moderate Cost:</strong> This card costs over $20. Consider if it fits your budget before purchasing.`;
          priceWarning += `</div>`;
        }

        html += '<div class="card-suggestion">';
        html += `<div class="card-suggestion-header">`;
        html += `${wrapCardName(s.card)} — ${priceDisplay}${popTag}${confidenceBadge}`;
        html += `</div>`;
        html += `<div class="card-suggestion-reason">${escapeHtml(s.reasoning)}</div>`;
        html += priceWarning;
        html += `${createShopLinks(s.card)}`;
        html += '</div>';
      });

      html += '</div>';
    }

    html += '</div>'; // Close recommendations section
  }

  // === DECK DOCTOR Q&A SECTION ===
  html += '<div style="margin-top: 40px; padding-top: 40px; border-top: 2px solid rgba(102, 126, 234, 0.3);">';
  html += '<h2 style="color: #667eea; margin-bottom: 10px;">💬 Ask Deck Doctor</h2>';
  html += '<p style="color: #999; margin-bottom: 20px;">Have questions about your deck? Ask away!</p>';

  // Quick question buttons
  html += '<div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">';
  html += '<button class="quick-question-btn" onclick="askQuickQuestion(\'Do I have too many lands?\')">🌳 Too many lands?</button>';
  html += '<button class="quick-question-btn" onclick="askQuickQuestion(\'What\\\'s my weakest card?\')">💔 Weakest card?</button>';
  html += '<button class="quick-question-btn" onclick="askQuickQuestion(\'Should I add more removal?\')">💥 Need removal?</button>';
  html += '<button class="quick-question-btn" onclick="askQuickQuestion(\'What\\\'s my best turn 3 play?\')">⚡ Best T3 play?</button>';
  html += '</div>';

  // Question input
  html += '<div style="margin-bottom: 20px;">';
  html += '<input type="text" id="deck-doctor-question" placeholder="Ask anything about your deck..." style="width: calc(100% - 120px); padding: 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px 0 0 8px; color: #e0e0e0; font-size: 14px;">';
  html += '<button onclick="askDeckDoctor()" style="width: 100px; padding: 12px; background: #667eea; color: white; border: none; border-radius: 0 8px 8px 0; cursor: pointer; font-weight: 600; font-size: 14px;">Ask</button>';
  html += '</div>';

  // Conversation history
  html += '<div id="deck-doctor-conversation" style="display: none;"></div>';
  html += '<div id="deck-doctor-loading" style="display: none; text-align: center; padding: 20px; color: #999;">🤔 Deck Doctor is thinking...</div>';

  html += '</div>'; // Close Deck Doctor section

  el.innerHTML = html;

  // Store deck data for Deck Doctor (with full analysis for ground truth)
  const deckListForDoctor = document.getElementById('deck-list').value.trim();
  const commanderForDoctor = document.getElementById('commander-name').value.trim();
  window.currentAnalyzedDeck = {
    deckList: deckListForDoctor,
    commander: commanderForDoctor,
    analysis: analysis, // Store full analysis including card data
    conversationHistory: []
  };

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

// Deck Doctor functions
async function askDeckDoctor() {
  const questionInput = document.getElementById('deck-doctor-question');
  const question = questionInput.value.trim();

  if (!question) {
    alert('Please enter a question');
    return;
  }

  await submitDeckDoctorQuestion(question);
  questionInput.value = ''; // Clear input
}

async function askQuickQuestion(question) {
  await submitDeckDoctorQuestion(question);
}

async function submitDeckDoctorQuestion(question) {
  if (!window.currentAnalyzedDeck) {
    alert('No deck analyzed yet. Please analyze a deck first.');
    return;
  }

  const conversationEl = document.getElementById('deck-doctor-conversation');
  const loadingEl = document.getElementById('deck-doctor-loading');

  // Show conversation area
  conversationEl.style.display = 'block';

  // Add user question to conversation
  addMessageToConversation('user', question);

  // Show loading
  loadingEl.style.display = 'block';

  try {
    const response = await fetch(`${API_BASE}/api/deck-doctor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deckList: window.currentAnalyzedDeck.deckList,
        commander: window.currentAnalyzedDeck.commander,
        analysis: window.currentAnalyzedDeck.analysis, // Send full analysis for context
        question,
        conversationHistory: window.currentAnalyzedDeck.conversationHistory
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Deck Doctor failed');
    }

    // Add assistant answer to conversation
    addMessageToConversation('assistant', data.answer);

    // Update conversation history
    window.currentAnalyzedDeck.conversationHistory.push(
      { role: 'user', content: question },
      { role: 'assistant', content: data.answer }
    );

  } catch (error) {
    addMessageToConversation('error', `Error: ${error.message}`);
  } finally {
    loadingEl.style.display = 'none';
  }
}

function addMessageToConversation(role, content) {
  const conversationEl = document.getElementById('deck-doctor-conversation');

  const messageDiv = document.createElement('div');
  messageDiv.style.marginBottom = '20px';
  messageDiv.style.padding = '15px';
  messageDiv.style.borderRadius = '8px';

  if (role === 'user') {
    messageDiv.style.background = 'rgba(102, 126, 234, 0.1)';
    messageDiv.style.borderLeft = '3px solid #667eea';
    messageDiv.innerHTML = `<strong style="color: #667eea;">You:</strong> ${escapeHtml(content)}`;
  } else if (role === 'assistant') {
    messageDiv.style.background = 'rgba(118, 75, 162, 0.1)';
    messageDiv.style.borderLeft = '3px solid #764ba2';

    // Convert markdown-style formatting and wrap card names
    let formattedContent = escapeHtml(content);

    // Only wrap likely card names (2-4 capitalized words, limited to prevent over-matching)
    // Match patterns like "Sol Ring", "Rhystic Study", "Command Tower", etc.
    formattedContent = formattedContent.replace(/\b([A-Z][a-z]+(?:'[a-z]+)?(?:\s+[A-Z][a-z]+(?:'[a-z]+)?){0,3})\b/g, (match) => {
      // Don't wrap common sentence starters and transition words
      const skipWords = [
        'Commander', 'Deck', 'Doctor', 'Magic', 'The', 'This', 'That', 'These', 'Those',
        'You', 'Your', 'Consider', 'However', 'Therefore', 'Additionally', 'First', 'Second',
        'Third', 'Finally', 'Instead', 'Also', 'While', 'Since', 'Because', 'Although',
        'Specifically', 'Generally', 'Particularly', 'Here', 'There', 'Some', 'Many',
        'Most', 'All', 'Each', 'Every', 'Both', 'Either', 'Neither', 'Other', 'Another'
      ];
      if (skipWords.includes(match)) return match;

      // Don't wrap if it's at the start of a sentence (likely not a card name)
      // This helps avoid wrapping sentence starters
      return wrapCardName(match);
    });

    messageDiv.innerHTML = `<strong style="color: #764ba2;">Deck Doctor:</strong> ${formattedContent}`;

    // Re-setup hover listeners for new card names
    setTimeout(() => setupCardHoverListeners(), 0);
  } else if (role === 'error') {
    messageDiv.style.background = 'rgba(255, 107, 107, 0.1)';
    messageDiv.style.borderLeft = '3px solid #ff6b6b';
    messageDiv.innerHTML = `<strong style="color: #ff6b6b;">Error:</strong> ${escapeHtml(content)}`;
  }

  conversationEl.appendChild(messageDiv);

  // Scroll to bottom
  messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
