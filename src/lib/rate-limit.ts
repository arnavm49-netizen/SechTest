type RateWindow = {
  count: number;
  reset_at: number;
};

const windows = new Map<string, RateWindow>();

export function enforce_rate_limit(key: string, limit = 60, window_ms = 60_000) {
  const now = Date.now();
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
