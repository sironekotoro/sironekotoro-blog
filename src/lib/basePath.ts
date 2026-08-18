export function normalizeBase(base: string): string {
  const value = base || '/';
  return value.endsWith('/') ? value : `${value}/`;
}

export function baseUrl(): string {
  return normalizeBase(import.meta.env.BASE_URL);
}

/**
 * 移行HTML内のルート相対URL（/entry/..., /images/..., /posts/...）へ
 * GitHub Pages等のsubpath（例: /sironekotoro-blog/）を付与する。
 * BASE_PATH=/ の場合はそのまま返すため、独自ドメイン運用でも同じHTMLで動く。
 */
export function applyBaseUrl(html: string, base: string): string {
  const prefix = normalizeBase(base);
  if (prefix === '/') return html;
  return html.replace(/((?:href|src)=")\/(?=(?:entry|images|posts)\/)/g, `$1${prefix}`);
}
