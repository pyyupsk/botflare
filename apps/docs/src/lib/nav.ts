import { getCollection } from 'astro:content';

export type NavItem = { label: string; href: string; hint: string };
export type NavGroup = { label: string; items: NavItem[] };

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

// TypeDoc folders, in the order the sidebar shows them.
const API_GROUPS: [string, string][] = [
  ['botflare/functions', 'Functions'],
  ['botflare/variables', 'Values'],
  ['botflare/type-aliases', 'Types'],
  ['botflare/gateway/functions', 'botflare/gateway'],
  ['botflare/gateway/type-aliases', 'botflare/gateway types'],
  ['botflare/gateway/other-types/type-aliases', 'More gateway types'],
  ['botflare/other-types/type-aliases', 'More types'],
  ['botflare/other-types/functions', 'More functions'],
];

/** The title an API page gives itself in its first `# Heading`, without the kind. */
export function apiTitle(body = ''): string {
  const heading = /^# (.+)$/m.exec(body)?.[1] ?? '';
  return heading.replace(/^[A-Za-z ]+: /, '').replace(/\\/g, '');
}

/** Every page of the docs, grouped as the sidebar shows them. */
export async function nav(): Promise<NavGroup[]> {
  const guides = (await getCollection('guides')).toSorted((a, b) => a.data.order - b.data.order);
  const api = await getCollection('api');

  const groups: NavGroup[] = [
    {
      label: 'Guides',
      items: guides.map((g) => ({
        label: g.data.title,
        href: `${BASE}/guides/${g.id}/`,
        hint: g.data.description,
      })),
    },
  ];

  for (const [dir, label] of API_GROUPS) {
    const items = api
      .filter(
        (page) => page.id.startsWith(`${dir}/`) && !page.id.slice(dir.length + 1).includes('/'),
      )
      .map((page) => ({
        label: apiTitle(page.body),
        href: `${BASE}/api/${page.id}/`,
        hint: label,
      }))
      .toSorted((a, b) => a.label.localeCompare(b.label));
    if (items.length) groups.push({ label, items });
  }

  return groups;
}

/** The pages before and after `href` in reading order. */
export function neighbors(groups: NavGroup[], href: string): { prev?: NavItem; next?: NavItem } {
  const flat = groups.flatMap((g) => g.items);
  const at = flat.findIndex((item) => item.href === href);

  return { prev: flat[at - 1], next: flat[at + 1] };
}
