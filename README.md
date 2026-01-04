# MTG Deck Analyzer

AI-powered Magic: The Gathering deck analysis using Claude 4.5, Scryfall, Commander Spellbook, and EDHREC.

## ✨ New Features!

### 🎯 Novelty Mode (Anti-Meta)
- **Novelty Slider (0-100%)**: Control how unique your suggestions should be
  - 0% = Best cards regardless of popularity (classic mode)
  - 50% = Balanced approach (default)
  - 100% = Maximum novelty - only suggest underplayed cards!
- Integrated with EDHREC data to identify overplayed staples
- Get creative alternatives instead of the same cards everyone runs

### 🔮 Commander Spellbook Integration
- **Automatic combo detection** from the premier MTG combo database
- Find all combos **already in your deck**
- Discover **near-miss combos** - you're 1-2 cards away from going infinite!
- Detailed combo steps and results

### 📊 EDHREC Popularity Scoring
- See how popular each card suggestion is
- Cards labeled as "Staple", "Common", or "Spicy"
- Inclusion rates shown (e.g., "Rhystic Study [Staple 78%]")
- Find hidden gems with low play rates but high synergy

### 🏗️ Partial Deck Builder
- Building a deck with only 30-40 cards? We've got you!
- Identifies missing categories (lands, ramp, draw, removal)
- Suggests cards to complete your deck to 60 or 99 cards
- Perfect for iterative deckbuilding

### 🔍 Card-to-Deck Matching
- Just opened a card? Find which of your decks wants it!
- `npm run dev find-card "Sylvan Safekeeper"`
- Scores all your decks (complete AND partial) for fit
- Shows color identity matches and synergies

## Original Features

- 🃏 **Smart Card Recognition** - Paste your deck list and we'll identify every card via Scryfall
- 🧠 **Deep Analysis** - Claude analyzes strategy, synergies, and power level
- 💡 **Combo Detection** - Identifies existing combos and suggests new ones
- 🎯 **Weakness Identification** - Spots vulnerabilities in your deck
- 📈 **Card Suggestions with Pricing** - Get recommendations across all budgets ($, $$, $$$) with real TCGplayer prices
- 🏆 **Bracket Rating** - Power level assessment (1-4 scale)
- 🔄 **Deck Comparison** - Compare two decks side-by-side
- 📥 **Import from URLs** - Support for Moxfield, Archidekt, and TappedOut
- 💾 **Analysis History** - Track all your deck analyses
- 📄 **Export** - Save analyses as Markdown or JSON
- 🌐 **Web Interface** - Beautiful web UI for easy use

## Setup

1. Install dependencies:
```bash
npm install
```

2. Get an Anthropic API key:
   - Visit https://console.anthropic.com
   - Create an account and add credits
   - Generate an API key

3. Create a `.env` file:
```bash
cp .env.example .env
# Edit .env and add your API key
```

## Usage

### CLI Mode - Enhanced Analysis

#### Standard Analysis (with all features enabled)
```bash
npm run dev --commander "Atraxa" < deck.txt
```

#### Maximum Novelty Mode (Anti-Meta)
```bash
npm run dev --commander "Atraxa" --novelty 100 < deck.txt
```
This will **avoid suggesting overplayed staples** and focus on spicy, underplayed cards!

#### Balanced Novelty (Default)
```bash
npm run dev --commander "Atraxa" --novelty 50 < deck.txt
```

#### Classic Mode (No novelty, best cards only)
```bash
npm run dev --novelty 0 < deck.txt
```

#### Partial Deck Completion
Have 40 cards and need suggestions to reach 99?
```bash
npm run dev --commander "Atraxa" < partial-deck.txt
```
The analyzer will detect it's partial and suggest cards to complete it!

#### Find Card in Your Decks
Just opened a pack? See where it fits:
```bash
npm run dev find-card "Sylvan Safekeeper"
```

This searches ALL your analyzed decks (from history) and shows which ones want this card!

### CLI Options

```bash
npm run dev [command] [options]

Commands:
  analyze (default)     Analyze a deck
  compare <d1> <d2>     Compare two decks
  import <url>          Import from Moxfield/Archidekt/TappedOut
  history               View analysis history
  find-card <name>      Find which decks want this card

Analyze Options:
  -m, --model <model>        Model: sonnet or opus (default: sonnet)
  -c, --commander <name>     Commander name (enables EDHREC features)
  --novelty <0-100>          Novelty level (default: 50)
                             0 = best cards, 100 = max novelty
  --no-combos                Disable Commander Spellbook
  --no-popularity            Disable EDHREC popularity
  -o, --output <file>        Export to .md or .json
  -n, --name <name>          Deck name for history
  --no-history               Don't save to history
```

### Examples

#### Build a Unique Commander Deck
```bash
npm run dev \
  --commander "Tinybones, Trinket Thief" \
  --novelty 75 \
  --name "Spicy Tinybones" \
  < tinybones-deck.txt
```

#### Complete a Partial Deck
```bash
# You have 40 cards, need 59 more
npm run dev \
  --commander "Muldrotha" \
  --name "Muldrotha WIP" \
  < muldrotha-partial.txt
```

#### Find Combos in Existing Deck
```bash
npm run dev \
  --commander "Ghave" \
  < ghave-deck.txt
```
Look for the "COMMANDER SPELLBOOK COMBOS" and "NEAR-MISS COMBOS" sections!

#### Match a Card to Your Decks
```bash
npm run dev find-card "Sylvan Safekeeper"
npm run dev find-card "Rhystic Study"
```

### Web Interface

Start the web server:
```bash
npm run web
```

Then open http://localhost:3000

**Note:** Web UI will be updated with new features in the next version!

## How It Works

### Novelty System

The novelty slider controls how the analyzer suggests cards:

**Novelty 0-25% (Classic)**
- Suggests the objectively best cards
- Ignores popularity data
- You'll get staples like Rhystic Study, Sol Ring, etc.

**Novelty 26-74% (Balanced)**
- Avoids the top 25-50% most played cards
- Suggests cards with 10-40% play rates
- Balances power with uniqueness

**Novelty 75-100% (Maximum Spice)**
- Actively avoids overplayed cards
- Only suggests cards with <25% play rates
- Focuses on hidden gems and creative synergies
- Perfect for making unique decks!

### Commander Spellbook Integration

We integrate with [Commander Spellbook](https://commanderspellbook.com), the premier combo database:

1. Your deck is sent to their API
2. They return all possible combos with your cards
3. We show both **complete combos** and **near-misses**
4. Near-miss combos tell you exactly what cards you need to add

### EDHREC Integration

For Commander decks, we fetch data from EDHREC:

1. Get average deck data for your commander
2. Calculate inclusion rates for all cards
3. Identify overplayed staples to avoid (based on novelty setting)
4. Find underplayed cards with high synergy

### Partial Deck Detection

If your deck has <60 cards (or <99 for Commander):

1. Automatically detected as partial
2. Identifies missing categories
3. Claude suggests cards to fill gaps
4. Helps you reach target deck size

## Card Pricing Tiers

Card suggestions include real TCGplayer pricing:

- **$ (Budget)**: Cards under $5 - Great for budget builds
- **$$ (Mid-range)**: Cards $5-$25 - Solid upgrades
- **$$$ (Premium)**: Cards $25+ - Powerful staples

Prices fetched from Scryfall's TCGplayer integration.

## Cost Estimates

### Claude Sonnet 4.5
- Single deck analysis: ~$0.10-0.30
- With Commander Spellbook + EDHREC: ~$0.15-0.40
- Deck comparison: ~$0.20-0.40

### Claude Opus 4.5
- Single deck analysis: ~$0.50-1.00
- With full features: ~$0.60-1.20
- Deck comparison: ~$1.00-2.00

## Project Structure

```
src/
├── index.ts                # Main CLI
├── web.ts                 # Web server
├── deckParser.ts          # Parse deck lists
├── scryfallClient.ts      # Scryfall API
├── claudeAnalyzer.ts      # Basic Claude analysis
├── enhancedAnalyzer.ts    # NEW: Advanced analysis with combos/EDHREC
├── comboService.ts        # NEW: Commander Spellbook integration
├── edhrecService.ts       # NEW: EDHREC data fetching
├── pricingService.ts      # TCGplayer pricing
├── cardMatcher.ts         # NEW: Card-to-deck matching
├── deckComparison.ts      # Deck comparison
├── deckSiteImporter.ts    # Moxfield/Archidekt import
├── exporter.ts            # Markdown/JSON export
├── history.ts             # Analysis history
├── formatter.ts           # Output formatting
└── types.ts               # TypeScript types
```

## Advanced Use Cases

### Building a Budget Deck with Novelty
```bash
npm run dev \
  --commander "Zada, Hedron Grinder" \
  --novelty 80 \
  --name "Budget Zada" \
  < zada-budget.txt
```
You'll get cheap, underplayed cards that still synergize well!

### Finding Near-Miss Combos
After analysis, look for the "NEAR-MISS COMBOS" section to see what cards would complete powerful combos in your deck.

### Tracking Deck Evolution
Every analysis is saved to history. You can:
1. Analyze deck v1
2. Make changes
3. Analyze deck v2
4. Use `history` command to see both versions

### Card Collection Management
When you open packs:
```bash
npm run dev find-card "Smothering Tithe"
```
Instantly see which of your 10+ decks wants this card!

## Troubleshooting

**EDHREC data not loading:**
- EDHREC's JSON endpoints are unofficial and may occasionally be unavailable
- Analysis will still work, just without popularity scoring
- Try again in a few minutes

**Commander Spellbook timeout:**
- The API may be slow for large requests
- Disable with `--no-combos` if needed

**Card matching returns no results:**
- Make sure you have some decks in history first
- Check that the card name is spelled correctly

## Contributing

This tool is open source and welcomes contributions!

Key areas for contribution:
- Web UI updates for new features
- Additional deck site integrations
- Performance optimizations
- Bug fixes

## License

MIT

---

**Built with:**
- Claude 4.5 (Sonnet & Opus)
- [Scryfall API](https://scryfall.com/docs/api)
- [Commander Spellbook](https://commanderspellbook.com/)
- [EDHREC](https://edhrec.com/)
- TypeScript & Node.js
