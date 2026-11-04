import { RuleConfigSeverity, type UserConfig } from '@commitlint/types';

const BARE_MENTION = /(?:^|[^\w`])@[\w-]+/g;

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
