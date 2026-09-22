import { communityControl } from './community-control.mjs';
import { steamProfile } from './steam-profile.mjs';
﻿import catalog from './SkinViewer/catalog.json' with { type: 'json' };

const STEAM = 'https://steamcommunity.com/openid/login';
const NS = 'http://specs.openid.net/auth/2.0';
const SESSION = '__Host-skinforge-session';
const STATE = '__Host-skinforge-login';
const colours = ['MaleDisplayColor','MarkingsColor','BodyColor','FlankColor','UnderbellyColor','Detail1Color','EyesColor','TeethColor','MouthColor','ClawsColor'];
const glitchSQL = "EXISTS (SELECT 1 FROM json_each(s.skin_json) colour JOIN json_each(colour.value) channel WHERE colour.key IN ('" + colours.join("','") + "') AND channel.key IN ('R','G','B','A') AND (channel.value < 0 OR channel.value > 1))";
const now = () => Math.floor(Date.now() / 1000);
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
const hash = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('');
const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const cookie = (name, value, age) => `${name}=${value}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`;
const readCookie = (request, name) => (request.headers.get('Cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(name + '='))?.slice(name.length + 1) || '';
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const adminIds = env => String(env.ADMIN_STEAM_IDS || '').split(',').map(s => s.trim()).filter(s => /^\d{17}$/.test(s));
const stmt = (env, sql, ...args) => env.COMMUNITY_DB.prepare(sql).bind(...args);
function redirect(url, cookies = []) {
 const headers = new Headers({ Location: url, 'Cache-Control': 'no-store' });
 for (const value of cookies) headers.append('Set-Cookie', value);
 return new Response(null, { status: 303, headers });
}
async function limited(env, key, maximum, seconds) {
 const time = now();
 const row = await stmt(env, `INSERT INTO community_limits(key,count,expires_at) VALUES(?,1,?)
 ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,
 expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count`, key, time + seconds, time, time).first();
 if (row.count > maximum) fail('Too many requests. Please try again later.', 429);
}
async function session(request, env) {
 const value = readCookie(request, SESSION);
 if (!/^[a-f0-9]{64}$/.test(value)) return null;
 const user = await stmt(env, `SELECT u.*,s.csrf FROM community_sessions s JOIN community_users u ON u.steam_id=s.steam_id WHERE s.token_hash=? AND s.expires_at>?`, await hash(value), now()).first();
 if (user) { user.owner = adminIds(env).includes(user.steam_id); user.admin = user.owner || !!user.is_admin; }
 return user;
}
async function data(request) {
 if (!request.headers.get('Content-Type')?.startsWith('application/json')) fail('Send JSON data.');
 const reader = request.body?.getReader(); if (!reader) fail('Request is empty.');
 const parts = []; let size = 0;
 while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 2 * 1024 * 1024) { await reader.cancel(); fail('Submission is too large.', 413); } parts.push(value); }
 try { const value = JSON.parse(await new Blob(parts).text()); if (!value || Array.isArray(value) || typeof value !== 'object') fail('Invalid request.'); return value; } catch { fail('Invalid JSON.'); }
}
function title(value, env) {
 if (typeof value !== 'string' || value.trim().length < 2 || value.length > 80) fail('Use a skin name between 2 and 80 characters.');
 const clean = value.trim().normalize('NFKC');
 if (/[\p{Cc}\p{Cf}]/u.test(clean) || /https?:\/\/|www\.|@everyone|@here/i.test(clean)) fail('Skin names cannot contain links, mentions or hidden characters.');
 const blocked = ['fuck','shit','nigger','faggot', ...String(env.COMMUNITY_BLOCKED_WORDS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)];
 if (blocked.some(word => clean.toLowerCase().includes(word))) fail('Please choose a different skin name.');
 return clean;
}
function validateSkin(value) {
 if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Invalid skin data.');
 if (typeof value.bIsFemale !== 'boolean') fail('Skin sex must be true or false.');
 const skin = { bIsFemale: value.bIsFemale };
 for (const key of ['SkinVariation','PatternIndex']) { if (!Number.isSafeInteger(value[key]) || value[key] < 0) fail(`${key} must be a non-negative whole number.`); skin[key] = value[key]; }
 for (const key of colours) {
  skin[key] = {};
  for (const channel of ['R','G','B','A']) { const number = value[key]?.[channel]; if (typeof number !== 'number' || !Number.isFinite(number)) fail(`${key}.${channel} must be a finite number.`); skin[key][channel] = number; }
 }
 return skin;
}
async function steamLogin(request, env, url, origin, send) {
 if (url.pathname.endsWith('/login')) {
  await limited(env, 'login:' + (request.headers.get('CF-Connecting-IP') || 'unknown'), 20, 600);
  const state = token();
  await env.COMMUNITY_DB.batch([
   stmt(env, 'DELETE FROM community_logins WHERE expires_at<?', now()),
   stmt(env, 'DELETE FROM community_nonces WHERE expires_at<?', now()),
   stmt(env, 'DELETE FROM community_sessions WHERE expires_at<?', now()),
   stmt(env, 'DELETE FROM community_limits WHERE expires_at<?', now()),
   stmt(env, 'INSERT INTO community_logins(token_hash,expires_at) VALUES(?,?)', await hash(state), now() + 600)
  ]);
  const target = new URL(STEAM);
  const params = { ns:NS, mode:'checkid_setup', return_to:`${origin}/api/community/auth/callback?state=${state}`, realm:origin+'/', identity:NS+'/identifier_select', claimed_id:NS+'/identifier_select' };
  for (const [key,value] of Object.entries(params)) target.searchParams.set('openid.'+key,value);
  return redirect(target.toString(), [cookie(STATE,state,600)]);
 }
 const params = url.searchParams, state = params.get('state');
 if (!state || !/^[a-f0-9]{64}$/.test(state) || state !== readCookie(request,STATE)) fail('Steam sign-in expired. Please sign in again.', 401);
 const consumed = await stmt(env, 'DELETE FROM community_logins WHERE token_hash=? AND expires_at>? RETURNING token_hash', await hash(state), now()).first();
 if (!consumed) fail('Steam sign-in expired or was already used.', 401);
 if (params.get('openid.mode') === 'cancel') return redirect(origin+'/?community=cancelled#community', [cookie(STATE,'',0)]);
 for (const key of new Set(params.keys())) if (params.getAll(key).length !== 1) fail('Invalid Steam response.',401);
 const claimed = params.get('openid.claimed_id') || '';
 const id = claimed.match(/^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/)?.[1];
 const signed = (params.get('openid.signed') || '').split(',');
 if (!id || params.get('openid.identity') !== claimed || params.get('openid.ns') !== NS || params.get('openid.mode') !== 'id_res' || params.get('openid.op_endpoint') !== STEAM || params.get('openid.return_to') !== `${origin}/api/community/auth/callback?state=${state}` || !['op_endpoint','claimed_id','identity','return_to','response_nonce','assoc_handle'].every(key => signed.includes(key))) fail('Invalid Steam identity response.',401);
 const nonce = params.get('openid.response_nonce') || '', timestamp = Date.parse(nonce.slice(0,20));
 if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 600000) fail('Steam sign-in response expired.',401);
 const check = new URLSearchParams(); for (const [key,value] of params) if (key.startsWith('openid.')) check.set(key,value); check.set('openid.mode','check_authentication');
 const controller = new AbortController();
 const timer = setTimeout(() => controller.abort(),20000);
 let verified;
 try { verified = await send(STEAM, { method:'POST', body:check, redirect:'manual', signal:controller.signal }); } finally { clearTimeout(timer); }
 if (!verified.ok || !/^is_valid:true\s*$/m.test(await verified.text())) fail('Steam could not verify your sign-in.',401);
 const used = await stmt(env,'INSERT OR IGNORE INTO community_nonces(nonce_hash,expires_at) VALUES(?,?)',await hash(nonce),now()+1200).run();
 if (!used.meta.changes) fail('Steam sign-in response was already used.',401);
 const sessionToken = token(), csrf = token();
 await env.COMMUNITY_DB.batch([
  stmt(env,'INSERT OR IGNORE INTO community_users(steam_id,created_at) VALUES(?,?)',id,now()),
  stmt(env,'INSERT INTO community_sessions(token_hash,steam_id,csrf,expires_at) VALUES(?,?,?,?)',await hash(sessionToken),id,csrf,now()+604800)
 ]);
 return redirect(origin+'/#community',[cookie(SESSION,sessionToken,604800),cookie(STATE,'',0)]);
}
export async function handleCommunity(request, env, send = (...args) => fetch(...args)) {
 const url = new URL(request.url);
 try {

  const origin = env.COMMUNITY_ORIGIN || url.origin;
  if (url.origin !== origin) fail('Community sign-in is available on the main website.',403);
  const gated=await communityControl(request,env,()=>session(request,env));
  if(gated)return gated;
  if (!env.COMMUNITY_DB) return json({ message:'Community skins are not configured yet.' },503);
  if (url.pathname === '/api/community/auth/login' || url.pathname === '/api/community/auth/callback') {
   if (request.method !== 'GET') fail('Method not allowed.',405);
   return await steamLogin(request,env,url,origin,send);
  }
  const profileId = url.pathname.match(/^\/api\/community\/profile\/(\d{17})$/)?.[1];
  if (request.method === 'GET' && profileId) {
   const exists = await stmt(env,'SELECT steam_id FROM community_users WHERE steam_id=?',profileId).first();
   if (!exists) fail('User not found.',404);
   return await steamProfile(profileId,origin,send);
  }
  const user = await session(request,env);
  if (request.method === 'GET' && url.pathname === '/api/community/me') return json({ user:user ? { steamId:user.steam_id, admin:user.admin, owner:user.owner, banned:!!user.banned, csrf:user.csrf } : null });
  const adminView = url.searchParams.get('admin') === '1';
  if (adminView && !user?.admin) fail('Admin access required.',403);
  if (request.method === 'GET' && url.pathname === '/api/community/skins') {
   const offset = Math.min(100000,Math.max(0,Math.trunc(Number(url.searchParams.get('offset'))) || 0));
   const species = url.searchParams.get('species') || '', search = (url.searchParams.get('q') || '').slice(0,80);
   const glitch = url.searchParams.get('glitch') || '';
   if (!['','yes','no'].includes(glitch)) fail('Invalid glitch filter.');
   const rows = await stmt(env, `SELECT s.*,u.banned,u.hide_skins,${glitchSQL} AS glitched FROM community_skins s JOIN community_users u ON u.steam_id=s.steam_id
    WHERE (?=1 OR (s.hidden=0 AND u.hide_skins=0)) AND (?='' OR s.species=?) AND (?='' OR instr(lower(s.title),lower(?))>0)
    AND (?='' OR ${glitchSQL}=?)
    ORDER BY s.created_at DESC,s.id DESC LIMIT 25 OFFSET ?`,adminView?1:0,species,species,search,search,glitch,glitch==='yes'?1:0,offset).all();
   return json({ skins:rows.results.map(row=>({ id:row.id,title:row.title,species:row.species,steamId:row.steam_id,createdAt:row.created_at,glitched:!!row.glitched,skin:JSON.parse(row.skin_json),...(adminView?{hidden:!!row.hidden,accountHidden:!!row.hide_skins,banned:!!row.banned,reason:row.reason}:{}) })), next:rows.results.length===25?offset+25:null });
  }
  if (request.method === 'GET' && url.pathname === '/api/community/admin') {
   if (!user?.admin) fail('Admin access required.',403);
   const [reports,users,audit] = await env.COMMUNITY_DB.batch([
    stmt(env,'SELECT r.*,s.title,s.steam_id AS author_id FROM community_reports r JOIN community_skins s ON s.id=r.skin_id WHERE r.resolved=0 ORDER BY r.created_at DESC LIMIT 100'),
    stmt(env,'SELECT * FROM community_users WHERE banned=1 OR hide_skins=1 OR is_admin=1 ORDER BY created_at DESC LIMIT 100'),
    stmt(env,'SELECT * FROM community_audit ORDER BY created_at DESC LIMIT 100')
   ]);
   return json({reports:reports.results,users:users.results,audit:audit.results});
  }
  if (request.method !== 'POST') fail('Not found.',404);
  if (request.headers.get('Origin') !== origin) fail('Submit from this website.',403);
  if (!user) fail('Sign in through Steam first.',401);
  if (request.headers.get('X-CSRF-Token') !== user.csrf) fail('Your session changed. Refresh and try again.',403);
  if (url.pathname === '/api/community/logout') {
   await stmt(env,'DELETE FROM community_sessions WHERE token_hash=?',await hash(readCookie(request,SESSION))).run();
   return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':cookie(SESSION,'',0)}});
  }
  if (url.pathname === '/api/community/remove') {
   const input = await data(request), id = String(input.id || '');
   const own = await stmt(env,'SELECT id FROM community_skins WHERE id=? AND steam_id=?',id,user.steam_id).first();
   if (!own) fail('You can only remove your own skins.',403);
   await env.COMMUNITY_DB.batch([
    stmt(env,'UPDATE community_skins SET hidden=1,reason=? WHERE id=? AND steam_id=?','Removed by author',id,user.steam_id),
    stmt(env,'INSERT INTO community_audit(id,admin_id,action,target,reason,created_at) VALUES(?,?,?,?,?,?)',crypto.randomUUID(),user.steam_id,'hide',id,'Removed by author',now())
   ]);
   return json({message:'Your skin has been removed from the community gallery.'});
  }
  if (user.banned && !user.admin) fail('Your account is banned from community submissions.',403);
  const input = await data(request);
  if (url.pathname === '/api/community/skins') {
   const name=title(input.title,env),skin=validateSkin(input.skin);
   if (!catalog.species.some(entry=>entry.id===input.species && entry.model)) fail('Choose an available species.');
   await limited(env,'post:'+user.steam_id,5,3600);
   const id=crypto.randomUUID();
   await stmt(env,'INSERT INTO community_skins(id,steam_id,title,species,skin_json,created_at) VALUES(?,?,?,?,?,?)',id,user.steam_id,name,input.species,JSON.stringify(skin),now()).run();
   return json({id,message:'Skin published.'},201);
  }
  if(url.pathname==='/api/community/report'){
   if(typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500)fail('Provide a report reason up to 500 characters.');
   const target=await stmt(env,'SELECT s.id FROM community_skins s JOIN community_users u ON u.steam_id=s.steam_id WHERE s.id=? AND s.hidden=0 AND u.hide_skins=0',String(input.id)).first();if(!target)fail('Skin not found.',404);
   await limited(env,'report:'+user.steam_id,10,3600);
   await stmt(env,'INSERT INTO community_reports(id,skin_id,steam_id,reason,created_at) VALUES(?,?,?,?,?) ON CONFLICT(skin_id,steam_id) DO UPDATE SET reason=excluded.reason,resolved=0,created_at=excluded.created_at',crypto.randomUUID(),input.id,user.steam_id,input.reason.trim(),now()).run();
   return json({message:'Skin reported to the administrator.'});
  }
  if(url.pathname==='/api/community/moderate'){
   const action=input.action, id=String(input.id||''), reason=String(input.reason||'').trim();
   if(!reason||reason.length>500)fail('Provide a moderation reason up to 500 characters.');
   if(!user.admin) {
    if(action!=='hide')fail('Admin access required.',403);
    const own=await stmt(env,'SELECT id FROM community_skins WHERE id=? AND steam_id=?',id,user.steam_id).first();if(!own)fail('Admin access required.',403);
   }
   let operation;
   if(['hide','restore','rename'].includes(action)){
    const target=await stmt(env,'SELECT id FROM community_skins WHERE id=?',id).first();if(!target)fail('Skin not found.',404);
    operation=action==='rename'?stmt(env,'UPDATE community_skins SET title=? WHERE id=?',title(input.title,env),id):stmt(env,'UPDATE community_skins SET hidden=?,reason=? WHERE id=?',action==='hide'?1:0,reason,id);
   } else if(['ban','ban-all','unban','restore-user'].includes(action)){
    if(!/^\d{17}$/.test(id))fail('Invalid SteamID.');
    if(adminIds(env).includes(id))fail('Administrator accounts cannot be banned.');
    const target=await stmt(env,'SELECT steam_id,is_admin FROM community_users WHERE steam_id=?',id).first();if(!target)fail('User not found.',404);
    if(target.is_admin && (action==='ban'||action==='ban-all'))fail('Remove admin access before banning this user.');
    if(action==='ban'||action==='ban-all')operation=stmt(env,'UPDATE community_users SET banned=1,hide_skins=CASE WHEN ?=1 THEN 1 ELSE hide_skins END,ban_reason=? WHERE steam_id=?',action==='ban-all'?1:0,reason,id);
    if(action==='unban')operation=stmt(env,'UPDATE community_users SET banned=0,ban_reason=? WHERE steam_id=?',reason,id);
    if(action==='restore-user')operation=stmt(env,'UPDATE community_users SET hide_skins=0 WHERE steam_id=?',id);
   } else if(action==='promote'||action==='demote'){
    if(!user.owner)fail('Only the owner can change admin access.',403);
    if(!/^\d{17}$/.test(id))fail('Enter a 17-digit SteamID64.');
    if(adminIds(env).includes(id))fail('Owner access is managed in the site configuration.');
    if(action==='promote')operation=stmt(env,"INSERT INTO community_users(steam_id,created_at,is_admin) VALUES(?,?,1) ON CONFLICT(steam_id) DO UPDATE SET is_admin=1,banned=0,ban_reason=''",id,now());
    else operation=stmt(env,'UPDATE community_users SET is_admin=0 WHERE steam_id=?',id);
   } else if(action==='resolve')operation=stmt(env,'UPDATE community_reports SET resolved=1 WHERE id=?',id);
   else fail('Unknown moderation action.');
   await env.COMMUNITY_DB.batch([operation,stmt(env,'INSERT INTO community_audit(id,admin_id,action,target,reason,created_at) VALUES(?,?,?,?,?,?)',crypto.randomUUID(),user.steam_id,action,id,reason,now())]);
   return json({message:'Moderation action saved.'});
  }
  fail('Not found.',404);
 } catch(error) {
  const message=error.status?error.message:'Community service is temporarily unavailable. Please try again.';
  if(url.pathname.endsWith('/auth/callback'))return new Response(message+' Return to the site and try signing in again.',{status:error.status||503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Set-Cookie':cookie(STATE,'',0)}});
  return json({message},error.status||503);
 }
}
