const rawBase = import.meta.env.BASE_URL || '/';
const baseUrl = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

export function withBase(path = ''): string {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(path)) return path;
  return `${baseUrl}${path.replace(/^\/+/, '')}`;
}

export function rebaseHtml(html: string): string {
  return html.replace(/\b(href|src)=(['"])\/(?!\/)/gi, (_match, attr: string, quote: string) => `${attr}=${quote}${baseUrl}`);
}
