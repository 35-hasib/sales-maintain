// Serializes Prisma Decimal values to fixed string form so the API
// never emits floats for money.
export function serializeMoney(obj) {
  if (obj === null || obj === undefined) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object" && typeof v.toFixed === "function") {
      out[k] = v.toFixed(2);
    } else {
      out[k] = v;
    }
  }
  return out;
}
