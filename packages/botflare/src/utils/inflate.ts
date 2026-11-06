// The reader in `inflater` already reports the error.
async function quietly(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch {}
}

// zlib-stream shares one context per connection, and decoded chunks do not line up with payloads.
export function inflater(
  onPayload: (json: string) => void,
  onError: (error: unknown) => void,
): { push: (data: ArrayBuffer) => void; close: () => void } {
  const stream = new DecompressionStream('deflate');
  const writer = stream.writable.getWriter();
  let open = true;
  let buffer = '';
  let depth = 0;
  let inString = false;
  let escaped = false;

  const split = (text: string): void => {
    let from = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
      } else if (char === '"') inString = true;
      else if (char === '{') depth++;
      else if (char === '}' && --depth === 0) {
        onPayload(buffer + text.slice(from, i + 1));
        buffer = '';
        from = i + 1;
      }
    }
    buffer += text.slice(from);
  };

  void (async () => {
    try {
      for await (const text of stream.readable.pipeThrough(new TextDecoderStream())) split(text);
    } catch (error) {
      if (open) onError(error);
    }
  })();

  return {
    push: (data) => void quietly(writer.write(new Uint8Array(data))),
    close: () => {
      open = false;
      void quietly(writer.abort());
    },
  };
}
