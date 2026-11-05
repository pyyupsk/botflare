import { expect, it } from 'vitest';

import { permissionBits } from '#utils/permissions';

it('adds the bits of the named permissions, each name once', () => {
  expect(permissionBits(['Administrator', 'ManageGuild', 'ManageGuild'])).toBe(8 + 32);
  expect(permissionBits(['BypassSlowmode'])).toBe(2 ** 52);
  expect(permissionBits([])).toBe(0);
});

it('accepts only current permission names', () => {
  // @ts-expect-error not a permission
  expect(permissionBits(['ManageEverything'])).toBeNaN();
  // @ts-expect-error the old name of ManageGuildExpressions
  expect(permissionBits(['ManageEmojisAndStickers'])).toBeNaN();
});
