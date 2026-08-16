import type { MigratedPost } from '../types';

const modules = import.meta.glob<{ default: MigratedPost }>('../data/posts/*.json', {
  eager: true,
});

export const migratedPosts = Object.values(modules)
  .map((module) => module.default)
  .filter((post) => post.status === 'Publish')
  .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
