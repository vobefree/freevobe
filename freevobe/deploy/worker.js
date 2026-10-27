/**
 * Freevobe landningssida – statisk Next.js-export serverad från assets-bindningen.
 *
 * Ingen serverlogik behövs: allt är förrenderad HTML/CSS/JS. Workern gör tre saker:
 *  1. serverar filen från ASSETS,
 *  2. svarar med den riktiga 404-sidan i stället för en tom Cloudflare-404,
 *  3. sätter rätt content-type på den extensionslösa delningsbilden, om assets-lagret
 *     hann servera den först (cache-headers sköts i public/_headers).
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const response = await env.ASSETS.fetch(request);

    if (response.status === 404) {
      const fallback = await env.ASSETS.fetch(new URL('/404.html', url).toString());
      return new Response(fallback.body, {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    if (url.pathname === '/opengraph-image' && !response.headers.get('content-type')) {
      const headers = new Headers(response.headers);
      headers.set('content-type', 'image/png');
      headers.set('cache-control', 'public, max-age=3600');
      return new Response(response.body, { status: response.status, headers });
    }

    return response;
  },
};
