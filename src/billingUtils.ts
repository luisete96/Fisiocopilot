export function extractRpcIdentifier(data: unknown): string | null {
  const record = Array.isArray(data) ? data[0] : data;
  if (typeof record === 'string' && record.trim()) return record;
  if (typeof record !== 'object' || record === null) return null;

  for (const key of ['id', 'transaction_id', 'voucher_id']) {
    if (!(key in record)) continue;
    const value = Reflect.get(record, key);
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}
