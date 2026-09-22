const MAX_BODY = 7 * 1024 * 1024;
const recent = new Map();
const reply = (status, message) => Response.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function handleReport(request, env, send = (...args) => fetch(...args)) {
  if (request.method !== 'POST') return reply(405, 'Use POST to send a report.');
  if (request.headers.get('Origin') !== new URL(request.url).origin) return reply(403, 'Please submit reports from this website.');
  if (!request.headers.get('Content-Type')?.startsWith('multipart/form-data')) return reply(400, 'Invalid report format.');
  if (Number(request.headers.get('Content-Length')) > MAX_BODY) return reply(413, 'Attachments are too large. Use up to three images, 2 MB each.');
  const now = Date.now(), ip = request.headers.get('CF-Connecting-IP') || 'local';
  for (const [key, expiry] of recent) if (expiry <= now) recent.delete(key);
  if (recent.has(ip)) return reply(429, 'Please wait one minute before sending another report.');
  if (recent.size >= 10000) return reply(503, 'Reports are busy. Please try again shortly.');
  recent.set(ip, now + 60000);
  let deliveryAttempted = false;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply(400, 'The report is empty.');
    const chunks = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); return reply(413, 'Attachments are too large. Use up to three images, 2 MB each.'); }
      chunks.push(value);
    }
    const form = await new Response(new Blob(chunks), { headers: { 'Content-Type': request.headers.get('Content-Type') } }).formData();
    const type = form.get('type');
    if (type !== null && type !== 'report' && type !== 'server-request') return reply(400, 'Unknown request type.');
    const serverRequest = type === 'server-request';
    const webhookSecret = serverRequest ? 'DISCORD_SERVER_REQUEST_WEBHOOK' : 'DISCORD_REPORT_WEBHOOK';
  let webhook;
  try {
    webhook = new URL(env[webhookSecret]);
    if (webhook.protocol !== 'https:' || webhook.hostname !== 'discord.com' || !/^\/api(?:\/v\d+)?\/webhooks\/\d+\/[\w-]+$/.test(webhook.pathname)) throw Error();
  } catch { return reply(503, `This submission type is not configured. The site owner needs to set ${webhookSecret} in the matching Cloudflare environment and redeploy.`); }

    const serverName = form.get('serverName');
    if (serverRequest && (typeof serverName !== 'string' || !serverName.trim() || serverName.length > 100)) return reply(400, 'Provide a server name up to 100 characters.');
    if (serverRequest && !form.has('skin')) return reply(400, 'An example skin JSON is required.');
    const message = form.get('message');
    if (typeof message !== 'string' || !message.trim() || message.length > 2000) return reply(400, 'Write a report message between 1 and 2,000 characters.');
    const images = form.getAll('images');
    if (images.length > 3) return reply(400, 'Attach no more than three images.');
    const body = new FormData();
    const embeds = [{ title: serverRequest ? 'Server support request' : 'SkinForge report', description: message.trim(), color: 0x5ae0cd, timestamp: new Date().toISOString() }];
    const species = form.get('species');
    if (typeof species === 'string' && species.trim()) embeds[0].fields = [{ name: 'Viewer species', value: species.slice(0, 100) }];
    if (serverRequest) embeds[0].fields = [{ name: 'Requested server', value: serverName.trim() }];
    let skin = form.get('skin');
    if (skin !== null) {
      if (typeof skin !== 'string' || skin.length > 20000) return reply(400, 'Skin JSON must be smaller than 20,000 characters.');
      try {
        const parsed = JSON.parse(skin);
        if (!parsed || typeof parsed !== 'object' || (!serverRequest && Array.isArray(parsed))) throw Error();
        skin = JSON.stringify(parsed, null, 2);
      } catch { return reply(400, serverRequest ? 'The example must be a valid JSON object or array.' : 'The included skin code is not a valid JSON object.'); }
      const safe = skin.replace(/`/g, '\\u0060');
      const heading = serverRequest ? '\n\n**Example server JSON**\n' : '\n\n**Current skin JSON**\n';
      const available = 4096 - embeds[0].description.length - heading.length - 12;
      const shortened = safe.length > available;
      const note = '\n? Preview shortened; full code is attached.';
      const preview = shortened ? safe.slice(0, available - note.length) + note : safe;
      embeds[0].description += heading + '```json\n' + preview + '\n```';
      if (shortened) body.append(`files[${images.length}]`, new Blob([skin], { type: 'application/json' }), 'skin.json');
    }
    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      if (!(file instanceof Blob) || !file.size || file.size > 2 * 1024 * 1024) return reply(400, 'Each image must be between 1 byte and 2 MB.');
      const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const ascii = (start, end) => String.fromCharCode(...bytes.slice(start, end));
      const extension = bytes[0] === 137 && ascii(1, 4) === 'PNG' ? 'png'
        : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'jpg'
        : ['GIF87a', 'GIF89a'].includes(ascii(0, 6)) ? 'gif'
        : ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP' ? 'webp' : null;
      if (!extension) return reply(400, 'Images must be PNG, JPEG, GIF or WebP files.');
      const filename = `image-${i + 1}.${extension}`;
      body.append(`files[${i}]`, file, filename);
      if (i === 0) embeds[0].image = { url: `attachment://${filename}` };
    }
    body.append('payload_json', JSON.stringify({ embeds, allowed_mentions: { parse: [] } }));
    webhook.searchParams.set('wait', 'true');
    let response;
    deliveryAttempted = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try { response = await send(webhook.toString(), { method: 'POST', body, signal: controller.signal, redirect: 'manual' }); }
    catch (error) {
      const kind = controller.signal.aborted ? 'timeout' : error?.name === 'TypeError' ? 'network-or-runtime' : 'connection';
      console.error('Report delivery failed', { stage: 'discord-fetch', kind });
      return reply(502, `The report reached SkinForge, but the Discord connection failed (${kind}). Delivery is uncertain; check the channel before retrying.`);
    } finally { clearTimeout(timeout); }
    if (response.status === 429) return reply(429, 'Discord is busy. Please wait a minute and try again.');
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 404) return reply(502, 'Discord rejected the webhook URL. The site owner needs to check that the webhook still exists, update the secret and redeploy.');
      if (response.status === 403) return reply(502, 'Discord denied access to the report channel. The site owner needs to check the webhook and channel permissions.');
      if (error.code === 220001) return reply(502, 'This webhook targets a forum channel. The site owner must use a text-channel webhook or include a thread_id in its URL.');
      return reply(502, `Discord rejected the report (HTTP ${response.status}${Number.isInteger(error.code) ? `, code ${error.code}` : ''}). Your draft has been kept.`);
    }
    const confirmation = await response.json().catch(() => null);
    if (!confirmation || typeof confirmation.id !== 'string' || !/^\d+$/.test(confirmation.id)) return reply(502, 'Discord did not confirm a message ID. Delivery is uncertain; please check the report channel before retrying.');
    return Response.json({ delivered: true, messageId: confirmation.id, message: `Report sent. Discord reference: ${confirmation.id}` }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return reply(400, 'The report could not be read. Please check the attachments and try again.'); }
  finally { if (!deliveryAttempted) recent.delete(ip); }
}
