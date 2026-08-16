import rss from '@astrojs/rss';
import { migratedPosts } from '../lib/posts';
export function GET(context: { site?: URL }) { return rss({ title:'sironekotoro blog', description:'技術メモと日々の記録', site:context.site!, items:migratedPosts.map(post=>({title:post.title,pubDate:new Date(post.publishedAt),link:post.oldPath,description:`カテゴリー: ${post.categories.join(', ')}`})) }); }
