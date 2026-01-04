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

  // Deck completeness info
  if (analysis.deckCompleteness && analysis.deckCompleteness.isPartial) {
    const dc = analysis.deckCompleteness;
    html += `<strong style="color: #ff9f43;">⚠️ Partial Deck Detected:</strong>\n`;
    html += `Currently ${dc.currentSize} cards out of ${dc.targetSize} needed.\n`;
    html += `Suggestions below will help complete your deck!\n\n`;
  }

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

  // Commander Spellbook Combos
  if (analysis.spellbookCombos && analysis.spellbookCombos.length > 0) {
    html += '<strong>🔮 Commander Spellbook Combos (In Your Deck):</strong>\n';
    analysis.spellbookCombos.forEach((combo, i) => {
      html += `${i + 1}. ${wrapCardNames(combo.cards.join(' + '))}\n`;
      html += `   → Result: ${combo.result}\n`;
      if (combo.steps) {
        html += `   → Steps: ${combo.steps}\n`;
      }
      html += '\n';
    });
  }

  // Near-miss combos
  if (analysis.nearMissCombos && analysis.nearMissCombos.length > 0) {
    html += '<strong>🎯 Near-Miss Combos (Add 1-2 Cards):</strong>\n';
    analysis.nearMissCombos.slice(0, 5).forEach((nearMiss, i) => {
      html += `${i + 1}. Missing: ${wrapCardNames(nearMiss.missingCards.join(', '))}\n`;
      html += `   → Result: ${nearMiss.result}\n`;
      html += `   → You have: ${wrapCardNames(nearMiss.cardsYouHave.join(', '))}\n\n`;
    });
  }

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
      const priceDisplay = s.price !== undefined
        ? `${s.priceTier} ($${s.price.toFixed(2)})`
        : (s.priceTier || '?');

      // Popularity tag
      const popTag = s.popularity && s.inclusionRate !== undefined
        ? ` [${s.popularity} ${s.inclusionRate.toFixed(0)}%]`
        : '';

      html += `${i + 1}. ${wrapCardName(s.card)} — ${priceDisplay}${popTag}\n`;
      html += `   → ${s.reasoning}\n`;
      html += `   ${createShopLinks(s.card)}\n\n`;
    });
  }

  html += '<strong>Overall Assessment:</strong>\n';
  html += `${analysis.overallAssessment}\n`;

  el.innerHTML = html.replace(/\n/g, '<br>');

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
