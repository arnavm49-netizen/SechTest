type RateWindow = {
  count: number;
  reset_at: number;
};

const windows = new Map<string, RateWindow>();

const CLEANUP_INTERVAL_MS = 5 * 60_000;
let last_cleanup = Date.now();

function cleanup_expired_windows() {
  const now = Date.now();

  if (now - last_cleanup < CLEANUP_INTERVAL_MS) {
    return;
  }

  last_cleanup = now;

  for (const [key, window] of windows) {
    if (window.reset_at <= now) {
      windows.delete(key);
    }
  }
}

export function enforce_rate_limit(key: string, limit = 60, window_ms = 60_000) {
  const now = Date.now();

  cleanup_expired_windows();

  const current = windows.get(key);

  if (!current || current.reset_at <= now) {
    windows.set(key, { count: 1, reset_at: now + window_ms });
    return { allowed: true, retry_after_seconds: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retry_after_seconds: Math.max(1, Math.ceil((current.reset_at - now) / 1000)),
    };
  }

  current.count += 1;
  windows.set(key, current);
  return { allowed: true, retry_after_seconds: 0 };
}
