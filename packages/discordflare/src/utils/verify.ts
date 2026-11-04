const encoder = new TextEncoder();

function bytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^(?:[\da-f]{2})+$/i.test(hex)) return null;
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
}

export async function verify(
  publicKey: string,
  signature: string,
  timestamp: string,
  body: string,
): Promise<boolean> {
  const key = bytes(publicKey);
  const sig = bytes(signature);
  if (key?.length !== 32 || sig?.length !== 64) return false;
  const imported = await crypto.subtle.importKey('raw', key, { name: 'Ed25519' }, false, [
    'verify',
  ]);
  return crypto.subtle.verify({ name: 'Ed25519' }, imported, sig, encoder.encode(timestamp + body));
}
