# MTG Deck Analyzer

AI-powered Magic: The Gathering deck analysis using Claude 4.5 and Scryfall.

## Features

- 🃏 **Smart Card Recognition** - Paste your deck list and we'll identify every card via Scryfall
- 🧠 **Deep Analysis** - Claude analyzes strategy, synergies, and power level
- 💡 **Combo Detection** - Identifies existing combos and suggests new ones
- 🎯 **Weakness Identification** - Spots vulnerabilities in your deck
- 📈 **Card Suggestions** - Get recommendations with detailed reasoning
- 🏆 **Bracket Rating** - Power level assessment (1-4 scale)

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

### Interactive Mode

Run the analyzer and paste your deck:
```bash
npm run dev
```

Paste your deck list in this format:
```
3 Swamp
1 Arcane Signet
4 Lightning Bolt
2 Counterspell
...
```

Press Ctrl+D (or Cmd+D on Mac) when done to start analysis.

### From a File

Analyze a deck from a file:
```bash
npm run dev < sample-deck.txt
```

### Using Claude Opus 4.5

For deeper analysis (costs more but better insights):
```bash
npm run dev -- --model opus < sample-deck.txt
```

### Command-Line Options

- `--model <sonnet|opus>` - Choose which Claude model to use (default: sonnet)
- `--api-key <key>` - Provide API key directly instead of using .env file

## Cost

Analysis costs approximately $0.10-0.50 per deck using Claude Sonnet 4.5.

## License

MIT
