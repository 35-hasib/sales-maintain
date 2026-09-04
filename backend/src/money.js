// Money safety helpers.
// All money is stored as NUMERIC(14,2) and round-tripped as strings.
// We never use floating point for money in the app layer.

import Decimal from "decimal.js-light";

// Fixed precision, 2 decimal places, ROUND_HALF_UP
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export function parseMoney(value) {
  if (value === null || value === undefined || value === "") return new Decimal(0);
  return new Decimal(String(value));
}

export function moneyToString(value) {
  return parseMoney(value).toFixed(2);
}

// Compact two-scale comparison helpers
export function eq(a, b) {
  return parseMoney(a).eq(parseMoney(b));
}
export function gt(a, b) {
  return parseMoney(a).gt(parseMoney(b));
}
export function gte(a, b) {
  return parseMoney(a).gte(parseMoney(b));
}
export function lt(a, b) {
  return parseMoney(a).lt(parseMoney(b));
}
export function lte(a, b) {
  return parseMoney(a).lte(parseMoney(b));
}
