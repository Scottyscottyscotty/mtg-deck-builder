# MTG Deck Analyzer

AI-powered Magic: The Gathering deck analysis using Claude 4.5 and Scryfall.

## Features

- 🃏 **Smart Card Recognition** - Paste your deck list and we'll identify every card via Scryfall
- 🧠 **Deep Analysis** - Claude analyzes strategy, synergies, and power level
- 💡 **Combo Detection** - Identifies existing combos and suggests new ones
- 🎯 **Weakness Identification** - Spots vulnerabilities in your deck
- 📈 **Card Suggestions** - Get recommendations with detailed reasoning
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

### CLI Mode

#### Analyze a Deck

Paste your deck interactively:
```bash
npm run dev
```

Or analyze from a file:
```bash
npm run dev < sample-deck.txt
```

Export to Markdown:
```bash
npm run dev -- --output analysis.md < sample-deck.txt
```

Export to JSON:
```bash
npm run dev -- --output analysis.json < sample-deck.txt
```

Use Claude Opus 4.5 for deeper analysis:
```bash
npm run dev -- --model opus < sample-deck.txt
```

Name your deck for history:
```bash
npm run dev -- --name "My Awesome Deck" < sample-deck.txt
```

#### Compare Two Decks

```bash
npm run dev compare deck1.txt deck2.txt
```

With Opus:
```bash
npm run dev compare deck1.txt deck2.txt --model opus
```

#### Import from Deck Sites

Import from Moxfield:
```bash
npm run dev import "https://www.moxfield.com/decks/DECK_ID"
```

Import from Archidekt:
```bash
npm run dev import "https://archidekt.com/decks/123456"
```

Import from TappedOut:
```bash
npm run dev import "https://tappedout.net/mtg-decks/deck-name/"
```

The imported deck list will be printed to stdout, which you can pipe to analyze:
```bash
npm run dev import "https://www.moxfield.com/decks/DECK_ID" > deck.txt
npm run dev < deck.txt
```

#### View History

List all analyses:
```bash
npm run dev history
```

View a specific analysis:
```bash
npm run dev history --show <history-id>
```

### Web Interface

Start the web server:
```bash
npm run web
```

Then open http://localhost:3000 in your browser.

Features available in the web UI:
- ✨ Analyze decks with a beautiful interface
- 🔄 Compare two decks side-by-side
- 📥 Import from Moxfield, Archidekt, TappedOut
- 📚 Browse your analysis history
- 🎨 Clean, modern design

### Deck List Format

The analyzer supports multiple formats:

```
3 Swamp
1 Arcane Signet
4 Lightning Bolt
2 Counterspell
```

Also works with:
- `3x Swamp`
- `Swamp x3`
- `Swamp` (defaults to 1)

## Command Reference

### CLI Commands

```bash
# Analyze (default command)
npm run dev [options] < deck.txt

Options:
  -m, --model <sonnet|opus>   Model to use (default: sonnet)
  -k, --api-key <key>         API key (or use ANTHROPIC_API_KEY env var)
  -o, --output <file>         Export to file (.md or .json)
  -n, --name <name>           Deck name for history
  --no-history                Don't save to history

# Compare two decks
npm run dev compare <deck1> <deck2> [options]

Options:
  -m, --model <sonnet|opus>   Model to use
  -k, --api-key <key>         API key

# Import from URL
npm run dev import <url>

# View history
npm run dev history [options]

Options:
  -l, --list                  List all entries (default)
  -s, --show <id>            Show specific entry
```

## Cost Estimates

### Claude Sonnet 4.5
- Single deck analysis: ~$0.10-0.30
- Deck comparison: ~$0.20-0.40

### Claude Opus 4.5
- Single deck analysis: ~$0.50-1.00
- Deck comparison: ~$1.00-2.00

Costs vary based on deck size and complexity.

## Examples

### Basic Analysis
```bash
npm run dev < sample-deck.txt
```

### Full Analysis with Export
```bash
npm run dev --model opus --name "Mono Blue Control" --output analysis.md < deck.txt
```

### Compare Two Versions
```bash
npm run dev compare deck-v1.txt deck-v2.txt
```

### Import and Analyze
```bash
npm run dev import "https://www.moxfield.com/decks/abc123" > imported.txt
npm run dev --name "Imported Deck" < imported.txt
```

## Project Structure

```
src/
├── index.ts              # Main CLI entry point
├── web.ts               # Web server
├── deckParser.ts        # Deck list parser
├── scryfallClient.ts    # Scryfall API integration
├── claudeAnalyzer.ts    # Claude analysis engine
├── deckComparison.ts    # Deck comparison logic
├── deckSiteImporter.ts  # Import from Moxfield/Archidekt/TappedOut
├── exporter.ts          # Markdown/JSON export
├── history.ts           # Analysis history tracking
├── formatter.ts         # Output formatting
└── types.ts             # TypeScript types

public/
├── index.html           # Web UI
└── app.js              # Web UI logic
```

## Development

Build the TypeScript:
```bash
npm run build
```

Run in development mode:
```bash
npm run dev
```

Start web server:
```bash
npm run web
```

## Supported Deck Sites

- **Moxfield**: Full support for mainboard and commanders
- **Archidekt**: Full support, excludes sideboard/maybeboard
- **TappedOut**: Full support via text export

## History Storage

Analysis history is stored locally in `.mtg-analyzer-history/` (gitignored).

Each analysis includes:
- Full deck list
- Complete analysis from Claude
- Timestamp and metadata
- Model used

## Troubleshooting

**API Key not found:**
- Make sure you've created a `.env` file with `ANTHROPIC_API_KEY=your_key`
- Or pass it with `--api-key` flag

**Card not found on Scryfall:**
- Check the card name spelling
- Scryfall uses English card names
- The analyzer will continue with partial data

**Import fails:**
- Verify the URL is correct
- Check the deck is public (not private)
- Some sites may rate-limit requests

## License

MIT

## Contributing

Issues and pull requests welcome! This is a community tool for MTG players.

---

Built with Claude 4.5, Scryfall API, and TypeScript
