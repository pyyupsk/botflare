import { expect, it } from 'vitest';

import { type Button, buttonComponent } from '#utils/button';

it('builds each kind of button in the shape Discord expects', () => {
  const buttons: Button[] = [
    { id: 'save', label: 'Save' },
    { id: 'delete', label: 'Delete', style: 'danger', disabled: true },
    { url: 'https://discord.com', label: 'Docs' },
    { id: 'like', emoji: '👍' },
    { id: 'wave', label: 'Wave', emoji: '<a:wave:123>' },
  ];

  expect(buttons.map(buttonComponent)).toEqual([
    { type: 2, style: 1, label: 'Save', custom_id: 'save' },
    { type: 2, style: 4, label: 'Delete', custom_id: 'delete', disabled: true },
    { type: 2, style: 5, label: 'Docs', url: 'https://discord.com' },
    { type: 2, style: 1, custom_id: 'like', emoji: { name: '👍' } },
    { type: 2, style: 1, label: 'Wave', custom_id: 'wave', emoji: { name: 'wave', id: '123' } },
  ]);
});

it('needs a label or an emoji, and keeps link buttons without a style', () => {
  // @ts-expect-error a button needs a label or an emoji
  const bare: Button = { id: 'x' };
  // @ts-expect-error a link button has no style
  const styled: Button = { url: 'https://discord.com', label: 'x', style: 'danger' };

  expect([bare, styled]).toHaveLength(2);
});
