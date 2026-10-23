export interface CachedCard {
  blob: Blob;
  url: string;
}

interface MemoryCard extends CachedCard {
  lastUsed: number;
}

interface StoredCard {
  key: string;
  blob: Blob;
  etag: string;
  lastUsed: number;
}

const MEMORY_LIMIT = 20;
const STORAGE_LIMIT = 30;
const DATABASE_NAME = 'dexbotx-card-cache';
const STORE_NAME = 'cards';
const memory = new Map<string, MemoryCard>();
const pins = new Map<string, number>();
const knownEtags = new Map<string, { etag: string; lastUsed: number }>();
let databasePromise: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return databasePromise;
}

async function readStored(key: string): Promise<StoredCard | null> {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as StoredCard | undefined) ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function persist(key: string, blob: Blob): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  try {
    const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
    store.put({ key, blob, etag: knownEtags.get(key)?.etag ?? '', lastUsed: Date.now() } satisfies StoredCard);
    const allRequest = store.getAll();
    allRequest.onsuccess = () => {
      const records = (allRequest.result as StoredCard[]).sort((a, b) => b.lastUsed - a.lastUsed);
      for (const record of records.slice(STORAGE_LIMIT)) store.delete(record.key);
    };
  } catch {
    // Preview remains usable from memory when browser storage is unavailable.
  }
}

function rememberEtag(key: string, etag: string): void {
  knownEtags.delete(key);
  knownEtags.set(key, { etag, lastUsed: Date.now() });
  while (knownEtags.size > STORAGE_LIMIT) {
    const oldest = knownEtags.keys().next().value;
    if (!oldest) return;
    knownEtags.delete(oldest);
  }
}

function evictMemory(): void {
  while (memory.size > MEMORY_LIMIT) {
    const candidate = [...memory.entries()].find(([key]) => !pins.has(key));
    if (!candidate) return;
    memory.delete(candidate[0]);
    URL.revokeObjectURL(candidate[1].url);
  }
}

export async function getCard(key: string): Promise<CachedCard | null> {
  const existing = memory.get(key);
  if (existing) {
    existing.lastUsed = Date.now();
    memory.delete(key);
    memory.set(key, existing);
    return existing;
  }
  const stored = await readStored(key);
  if (!stored) return null;
  if (stored.etag) rememberEtag(key, stored.etag);
  const card: MemoryCard = { blob: stored.blob, url: URL.createObjectURL(stored.blob), lastUsed: Date.now() };
  memory.set(key, card);
  return card;
}

export async function putCard(key: string, blob: Blob): Promise<CachedCard> {
  const existing = memory.get(key);
  if (existing) {
    existing.lastUsed = Date.now();
    memory.delete(key);
    memory.set(key, existing);
    return existing;
  }
  const card: MemoryCard = { blob, url: URL.createObjectURL(blob), lastUsed: Date.now() };
  const imageKey = key.slice(key.lastIndexOf(':') + 1);
  rememberEtag(key, `"${imageKey}"`);
  memory.set(key, card);
  void persist(key, blob);
  return card;
}

export function getCardEtag(key: string): string | null {
  const entry = knownEtags.get(key);
  if (!entry) return null;
  entry.lastUsed = Date.now();
  return entry.etag;
}

export function retainCard(key: string): void {
  pins.set(key, (pins.get(key) ?? 0) + 1);
  evictMemory();
}

export function releaseCard(key: string): void {
  const count = pins.get(key) ?? 0;
  if (count <= 1) pins.delete(key);
  else pins.set(key, count - 1);
  evictMemory();
}
