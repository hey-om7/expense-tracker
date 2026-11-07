// Caching for the Investments page.
// Live prices are saved to the backend, so after a refresh the investments already in
// AppContext *are* the cached data; we only need to remember when we last refreshed.
// Price-history charts are cached in sessionStorage with the same lifetime.

export const PRICE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

const refreshKey = (userId) => `vestor_invest_refreshed_${userId || 'anon'}`;

export const getLastRefresh = (userId) => {
  const v = Number(localStorage.getItem(refreshKey(userId)));
  return Number.isFinite(v) && v > 0 ? v : null;
};

export const setLastRefresh = (userId, at = Date.now()) => {
  localStorage.setItem(refreshKey(userId), String(at));
  return at;
};

export const isStale = (at) => !at || Date.now() - at > PRICE_TTL_MS;

// Returns cached value for `key` if younger than the TTL, otherwise calls `load` and caches it.
export const cachedFetch = async (key, load) => {
  const storageKey = `vestor_cache_${key}`;
  try {
    const hit = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    if (hit && !isStale(hit.at)) return hit.data;
  } catch { /* ignore bad cache entries */ }
  const data = await load();
  try { sessionStorage.setItem(storageKey, JSON.stringify({ at: Date.now(), data })); } catch { /* storage full */ }
  return data;
};

export const timeAgo = (at) => {
  if (!at) return 'never';
  const min = Math.floor((Date.now() - at) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min ago` : `${h} h ago`;
};
