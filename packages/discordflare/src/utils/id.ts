export function splitId(id: string): { name: string; value: string | undefined } {
  const colon = id.indexOf(':');
  if (colon === -1) return { name: id, value: undefined };

  return { name: id.slice(0, colon), value: id.slice(colon + 1) };
}
