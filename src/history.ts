import * as fs from 'fs/promises';
import * as path from 'path';
import { DeckAnalysis, DeckCard } from './types.js';

interface HistoryEntry {
  id: string;
  timestamp: string;
  deckName?: string;
  totalCards: number;
  uniqueCards: number;
  archetype: string;
  bracketRating: number;
  model: string;
}

interface FullHistoryEntry extends HistoryEntry {
  deck: Array<{ quantity: number; name: string }>;
  analysis: DeckAnalysis;
}

const HISTORY_DIR = path.join(process.cwd(), '.mtg-analyzer-history');
const INDEX_FILE = path.join(HISTORY_DIR, 'index.json');

/**
 * Saves an analysis to history
 */
export async function saveToHistory(
  cards: DeckCard[],
  analysis: DeckAnalysis,
  model: string,
  deckName?: string
): Promise<string> {
  await ensureHistoryDir();

  const id = generateId();
  const timestamp = new Date().toISOString();

  const entry: FullHistoryEntry = {
    id,
    timestamp,
    deckName,
    totalCards: cards.reduce((sum, c) => sum + c.quantity, 0),
    uniqueCards: cards.length,
    archetype: analysis.archetype,
    bracketRating: analysis.bracketRating,
    model,
    deck: cards.map(({ quantity, name }) => ({ quantity, name })),
    analysis,
  };

  // Save full entry to file
  const entryPath = path.join(HISTORY_DIR, `${id}.json`);
  await fs.writeFile(entryPath, JSON.stringify(entry, null, 2), 'utf-8');

  // Update index
  await updateIndex(entry);

  return id;
}

/**
 * Lists all history entries
 */
export async function listHistory(): Promise<HistoryEntry[]> {
  await ensureHistoryDir();

  try {
    const content = await fs.readFile(INDEX_FILE, 'utf-8');
    const index = JSON.parse(content) as { entries: HistoryEntry[] };
    return index.entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch {
    return [];
  }
}

/**
 * Gets a specific history entry
 */
export async function getHistoryEntry(id: string): Promise<FullHistoryEntry | null> {
  const entryPath = path.join(HISTORY_DIR, `${id}.json`);

  try {
    const content = await fs.readFile(entryPath, 'utf-8');
    return JSON.parse(content) as FullHistoryEntry;
  } catch {
    return null;
  }
}

/**
 * Deletes a history entry
 */
export async function deleteHistoryEntry(id: string): Promise<boolean> {
  const entryPath = path.join(HISTORY_DIR, `${id}.json`);

  try {
    await fs.unlink(entryPath);

    // Update index
    const entries = await listHistory();
    const filtered = entries.filter(e => e.id !== id);
    await fs.writeFile(INDEX_FILE, JSON.stringify({ entries: filtered }, null, 2), 'utf-8');

    return true;
  } catch {
    return false;
  }
}

/**
 * Clears all history
 */
export async function clearHistory(): Promise<void> {
  await ensureHistoryDir();

  const files = await fs.readdir(HISTORY_DIR);
  for (const file of files) {
    await fs.unlink(path.join(HISTORY_DIR, file));
  }

  await fs.writeFile(INDEX_FILE, JSON.stringify({ entries: [] }, null, 2), 'utf-8');
}

// Helper functions

async function ensureHistoryDir(): Promise<void> {
  try {
    await fs.access(HISTORY_DIR);
  } catch {
    await fs.mkdir(HISTORY_DIR, { recursive: true });
  }
}

async function updateIndex(entry: FullHistoryEntry): Promise<void> {
  const entries = await listHistory();

  const indexEntry: HistoryEntry = {
    id: entry.id,
    timestamp: entry.timestamp,
    deckName: entry.deckName,
    totalCards: entry.totalCards,
    uniqueCards: entry.uniqueCards,
    archetype: entry.archetype,
    bracketRating: entry.bracketRating,
    model: entry.model,
  };

  entries.push(indexEntry);

  await fs.writeFile(INDEX_FILE, JSON.stringify({ entries }, null, 2), 'utf-8');
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}
