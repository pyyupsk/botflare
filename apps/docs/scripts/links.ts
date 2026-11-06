import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

const DIR = 'src/content/api';
const BASE = '/botflare/api/';

function sitePath(file: string): string {
  const slug = relative(DIR, file)
    .replace(/\.md$/, '')
    .replace(/(^|\/)index$/, '')
    .toLowerCase();

  return slug ? `${BASE}${slug}/` : BASE;
}

const files = (await readdir(DIR, { recursive: true })).filter((f) => f.endsWith('.md'));
await Promise.all(
  files.map(async (name) => {
    const file = join(DIR, name);
    const text = await readFile(file, 'utf8');
    const fixed = text.replace(/\]\(([^):]+?\.md)(#[^)]*)?\)/g, (_, link: string, hash = '') => {
      return `](${sitePath(join(dirname(file), link))}${hash})`;
    });
    await writeFile(file, fixed);
  }),
);
