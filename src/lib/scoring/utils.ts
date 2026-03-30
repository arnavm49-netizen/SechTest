export function as_array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function as_number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function as_record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function as_string(value: unknown): string | null {
  return typeof value === "string" && value.trim().length ? value.trim() : null;
}

export function round_number(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
