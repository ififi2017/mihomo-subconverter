/**
 * Simple in-memory key-value cache with TTL and LRU eviction.
 *
 * Keys are SHA-256 hashes of input parameters. Values are arbitrary JSON.
 * Cache entries expire after TTL_MS and the cache is capped at MAX_ENTRIES.
 */
import crypto from 'crypto'

const TTL_MS        = 5 * 60 * 1000   // 5 minutes
const MAX_ENTRIES    = 50              // cap memory use
const KEY_SEPARATOR  = '\0'            // unlikely to appear in inputs

const store = new Map()

/**
 * Build a SHA-256 hex digest from multiple string/number/boolean arguments.
 */
export function cacheKey(...parts) {
  const h = crypto.createHash('sha256')
  for (const p of parts) {
    if (p === null || p === undefined) continue
    h.update(KEY_SEPARATOR)
    h.update(String(p))
  }
  return h.digest('hex')
}

/**
 * Read a cached value. Returns the parsed payload, or null if missing/expired.
 */
export function cacheGet(key) {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return null
  }
  // Move to end (most-recently-used position) by deleting and re-inserting
  store.delete(key)
  store.set(key, entry)
  return entry.payload
}

/**
 * Store a value in the cache.
 */
export function cacheSet(key, payload, ttl = TTL_MS) {
  // Evict oldest entries when at capacity
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next()
    if (!oldest.done) store.delete(oldest.value)
  }
  store.set(key, {
    payload,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttl,
  })
}

/**
 * Get the number of entries currently in the cache.
 */
export function cacheSize() {
  return store.size
}

/**
 * Drop every entry. Used by tests.
 */
export function cacheClear() {
  store.clear()
}