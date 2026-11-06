import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { defineCollection } from 'astro:content';

export const collections = {
  guides: defineCollection({
    loader: glob({ pattern: '*.mdx', base: './src/content/guides' }),
    schema: z.object({ title: z.string(), description: z.string(), order: z.number() }),
  }),
  api: defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/api' }) }),
};
