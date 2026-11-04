import { RuleConfigSeverity, type UserConfig } from '@commitlint/types';

/** Bare `@name` in a commit message notifies that GitHub user. Backticks stop it. */
const BARE_MENTION = /(?:^|[^\w`])@[\w-]+/g;

/**
 * Strips code spans so `@pyyupsk` is exempt, then looks for what is left.
 * A match followed by `/` is an npm scope like @astrojs/mdx, not a mention.
 */
function hasBareMention(message: string): boolean {
  const text = message.replace(/`[^`]*`/g, '');
  for (const match of text.matchAll(BARE_MENTION)) {
    const next = text[match.index + match[0].length];
    if (next !== '/') return true;
  }
  return false;
}

export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'no-bare-mention': ({ raw }) => [
          !hasBareMention(raw ?? ''),
          'wrap mentions in backticks, for example `@pyyupsk`',
        ],
      },
    },
  ],
  rules: {
    'type-enum': [
      RuleConfigSeverity.Error,
      'always',
      ['chore', 'docs', 'feat', 'fix', 'perf', 'refactor', 'style', 'test'],
    ],
    'no-bare-mention': [RuleConfigSeverity.Error, 'always'],
  },
} satisfies UserConfig;
