import { expect, it } from 'vitest';

import { formOf, uploadsOf } from '#utils/upload';

it('puts the payload and each file where Discord expects them, and reads them back', async () => {
  const form = formOf({ content: 'hi' }, [
    { name: 'a.txt', data: 'hello' },
    { name: 'b.bin', data: new Uint8Array([1, 2]) },
  ]);

  const { payload, files } = await uploadsOf(form);
  const first = form.get('files[0]');

  expect(form.get('payload_json')).toBe('{"content":"hi"}');
  expect(first instanceof File && (await first.text())).toBe('hello');
  expect(payload).toEqual({ content: 'hi' });
  expect(files.map((f) => f.name)).toEqual(['a.txt', 'b.bin']);
});
