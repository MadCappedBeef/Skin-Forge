import { handleCommunity } from './community-handler.mjs';
import { handleReport } from './report-handler.mjs';
const PREFIX = '/SkinViewer/assets/';

function notModified(request, etag) {
  return (request.headers.get('If-None-Match') || '').split(',').some(value =>
    value.trim() === '*' || value.trim().replace(/^W\//, '') === etag
  );
}

function respond(request, response) {
  if (notModified(request, response.headers.get('ETag'))) {
    const headers = new Headers(response.headers);
    headers.delete('Content-Length');
    return new Response(null, { status: 304, headers });
  }
  return request.method === 'HEAD'
    ? new Response(null, { status: response.status, headers: response.headers })
    : response;
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/community/')) return handleCommunity(request, env);
    if (url.pathname === '/api/report') return handleReport(request, env);
    if (!url.pathname.startsWith(PREFIX)) return env.ASSETS.fetch(request);
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    let key;
    try { key = decodeURIComponent(url.pathname).slice(1); }
    catch { return new Response('Invalid asset path', { status: 400 }); }
    if (key.split('/').some(part => part === '..' || part === '.' || part.includes('\\')) ||
        !/\.(png|psk)$/i.test(key)) return new Response('Not found', { status: 404 });
    const cacheKey = new Request(url.toString(), { method: 'GET' });
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) return respond(request, cached);
    if (!env.SKIN_ASSETS) return new Response('Asset storage is unavailable', { status: 503 });
    try {
      const object = await env.SKIN_ASSETS[request.method === 'HEAD' ? 'head' : 'get'](key);
      if (!object) return new Response('Asset not found', { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('Content-Type', key.endsWith('.png') ? 'image/png' : 'application/octet-stream');
      headers.set('Content-Length', String(object.size));
      headers.set('ETag', object.httpEtag);
      headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      headers.set('X-Content-Type-Options', 'nosniff');
      if (notModified(request, object.httpEtag)) {
        if (object.body) await object.body.cancel();
        headers.delete('Content-Length');
        return new Response(null, { status: 304, headers });
      }
      const response = new Response(request.method === 'HEAD' ? null : object.body, { headers });
      if (request.method === 'GET') context.waitUntil(cache.put(cacheKey, response.clone()).catch(console.error));
      return response;
    } catch (error) {
      console.error('R2 asset request failed', error);
      return new Response('Asset temporarily unavailable. Please retry.', { status: 503 });
    }
  }
};
