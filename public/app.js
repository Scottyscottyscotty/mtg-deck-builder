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
      body: JSON.stringify({ deckList, deckName, model }),
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

  let html = '<h2>Analysis Results</h2>\n\n';
  html += `<strong>Archetype:</strong> ${analysis.archetype}\n\n`;
  html += `<strong>Bracket Rating:</strong> ${analysis.bracketRating}/4 ${'⭐'.repeat(analysis.bracketRating)}\n`;
  html += `${analysis.bracketReasoning}\n\n`;

  html += '<strong>Mana Curve Analysis:</strong>\n';
  html += `${analysis.manaCurveAnalysis}\n\n`;

  html += '<strong>Strengths:</strong>\n';
  analysis.strengths.forEach((s, i) => {
    html += `${i + 1}. ${s}\n`;
  });
  html += '\n';

  html += '<strong>Weaknesses:</strong>\n';
  analysis.weaknesses.forEach((w, i) => {
    html += `${i + 1}. ${w}\n`;
  });
  html += '\n';

  if (analysis.existingCombos.length > 0) {
    html += '<strong>Existing Combos:</strong>\n';
    analysis.existingCombos.forEach((c, i) => {
      html += `${i + 1}. ${c}\n`;
    });
    html += '\n';
  }

  if (analysis.potentialCombos.length > 0) {
    html += '<strong>Potential Combos:</strong>\n';
    analysis.potentialCombos.forEach((c, i) => {
      html += `${i + 1}. ${c}\n`;
    });
    html += '\n';
  }

  if (analysis.cardSuggestions.length > 0) {
    html += '<strong>Card Suggestions:</strong>\n';
    analysis.cardSuggestions.forEach((s, i) => {
      html += `${i + 1}. ${s.card}\n`;
      html += `   → ${s.reasoning}\n\n`;
    });
  }

  html += '<strong>Overall Assessment:</strong>\n';
  html += `${analysis.overallAssessment}\n`;

  el.textContent = html;
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

  el.textContent = html;
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
