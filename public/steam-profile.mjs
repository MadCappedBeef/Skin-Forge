function field(xml, name) {
 const value = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] || '';
 if (value.startsWith('<![CDATA[') && value.endsWith(']]>')) return value.slice(9,-3);
 return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity) => {
  const named = { amp:'&',lt:'<',gt:'>',quot:'"',apos:"'" };
  if (named[entity]) return named[entity];
  const code = entity.startsWith('#x') ? parseInt(entity.slice(2),16) : Number(entity.slice(1));
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
 });
}
export async function steamProfile(id, origin, send) {
 const key = new Request(`${origin}/api/community/profile/${id}`);
 const cache = globalThis.caches?.default;
 const cached = await cache?.match(key);
 if (cached) return cached;
 let profile = { steamId:id, name:`Steam ${id}`, avatar:'' }, success = false;
 const controller = new AbortController();
 const timer = setTimeout(() => controller.abort(),5000);
 try {
  const response = await send(`https://steamcommunity.com/profiles/${id}/?xml=1`, { redirect:'manual',signal:controller.signal });
  if (!response.ok) throw Error('Profile unavailable');
  const xml = await response.text();
  if (field(xml,'steamID64') !== id) throw Error('Profile mismatch');
  const name = field(xml,'steamID').trim().slice(0,128);
  const avatar = field(xml,'avatarMedium');
  if (name) { profile.name = name; success = true; }
  if (/^https:\/\/avatars\.(?:akamai\.|cloudflare\.|fastly\.)?steamstatic\.com\/[a-f0-9]+(?:_medium|_full)?\.jpg$/i.test(avatar)) profile.avatar = avatar;
 } catch {} finally { clearTimeout(timer); }
 const response = Response.json(profile, {headers:{'Cache-Control':`public, max-age=${success ? 21600 : 120}`,'X-Content-Type-Options':'nosniff'}});
 try { await cache?.put(key,response.clone()); } catch {}
 return response;
}
