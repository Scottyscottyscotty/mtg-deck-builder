# New Set Cards Support

This application can automatically include recently released Magic: The Gathering cards in deck building, even for cards released after Claude's training cutoff.

## How It Works

**Priority 1: Scryfall API** (when available)
- Fetches latest sets and cards directly from Scryfall
- Filters by color identity
- Ranks by EDHREC popularity

**Priority 2: Local Database** (when API is blocked)
- Falls back to `newcards-full.json` or `newcards.json`
- Automatically filters by color identity
- Works in any environment

## Updating New Cards

### Option 1: Auto-Update Script (Recommended)

Run this script outside the container (on your local machine) to download the latest cards from Scryfall:

```bash
node update-new-cards.js
```

This will:
1. Download Scryfall's complete card database (~100MB)
2. Extract cards from the last 6 months
3. Filter to Commander-legal cards only
4. Save to `newcards-full.json` (~2-5MB)

Then commit `newcards-full.json` to your repo.

### Option 2: Manual Entry

Edit `newcards.json` and add card names:

```json
{
  "sets": [
    {
      "name": "Aetherdrift",
      "releaseDate": "2025-02-14",
      "description": "High-speed racing set",
      "cards": [
        "Omo, Queen of Vesuva",
        "Chandra, Aetherdrifter",
        "..."
      ]
    }
  ]
}
```

## When to Update

- **Before a new set release**: Run the script weekly leading up to release
- **After a new set releases**: Run immediately to get all new cards
- **Monthly**: To stay current with spoilers and releases

## File Priority

1. `newcards-full.json` - Auto-generated, includes full card data (preferred)
2. `newcards.json` - Manual entry, simple card names

The system automatically uses whichever file exists, preferring the full version.

## Testing

To verify the system is working:

1. Build a deck with a recent commander
2. Check the server logs for:
   ```
   🆕 Fetching recent cards for colors: WUBRG...
   📦 Using newcards-full.json (auto-generated bulk data)
   ```
3. Examine the built deck - it should include recent cards

## Deployment

When deploying outside the container:
- Scryfall API will work automatically
- No local file needed (but can still be used as cache)
- Consider running the update script monthly via cron job

When running in restricted environments:
- Commit `newcards-full.json` to your repo
- Update periodically by running the script outside the container
