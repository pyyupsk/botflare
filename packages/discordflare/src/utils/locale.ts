import type { Locale } from 'discord-api-types/v10';

export type Locales = Partial<Record<`${Locale}`, { name?: string; description?: string }>>;

export function localePayload(locales: Locales | undefined): {
  name_localizations?: Record<string, string>;
  description_localizations?: Record<string, string>;
} {
  const names: Record<string, string> = {};
  const descriptions: Record<string, string> = {};
  for (const [locale, text] of Object.entries(locales ?? {})) {
    if (text.name !== undefined) names[locale] = text.name;
    if (text.description !== undefined) descriptions[locale] = text.description;
  }

  const fields: ReturnType<typeof localePayload> = {};
  if (Object.keys(names).length > 0) fields.name_localizations = names;
  if (Object.keys(descriptions).length > 0) fields.description_localizations = descriptions;

  return fields;
}
