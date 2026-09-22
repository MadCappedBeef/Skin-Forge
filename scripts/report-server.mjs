import { handleReport } from '../public/report-handler.mjs';

export async function reportRequest(req, res) {
  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(key, String(value));
    headers.set('CF-Connecting-IP', req.socket.remoteAddress || 'local');
    const request = new Request(`http://${req.headers.host}/api/report`, {
      method: req.method, headers,
      ...(!['GET', 'HEAD'].includes(req.method) ? { body: req, duplex: 'half' } : {})
    });
    const response = await handleReport(request, { DISCORD_REPORT_WEBHOOK: process.env.DISCORD_REPORT_WEBHOOK, DISCORD_SERVER_REQUEST_WEBHOOK: process.env.DISCORD_SERVER_REQUEST_WEBHOOK });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  } catch { res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ message: 'Reports are temporarily unavailable.' })); }
}
