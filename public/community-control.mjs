const KEY = '_skinforge/community-control.json';
const COOKIE = '__Host-skinforge-control';
const digest = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const reply = (body,status=200,extra={}) => Response.json(body,{status,headers:{'Cache-Control':'no-store',...extra}});
export async function communityControl(request,env,ownerSession) {
 const url=new URL(request.url),control=url.pathname==='/api/community/control';
 if(String(env.COMMUNITY_DISABLED).toLowerCase()==='true')return reply({message:'Community skins are temporarily paused.',paused:true,user:null,canResume:false},url.pathname.endsWith('/me')?200:503);
 if(!env.SKIN_ASSETS)return reply({message:'Community storage is unavailable.'},503);
 let state;
 try {const object=await env.SKIN_ASSETS.get(KEY);state=object?await object.json():{paused:false};}catch{return reply({message:'Community availability could not be checked. Please try again.'},503);}
 const value=(request.headers.get('Cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
 const canResume=!!(state.paused&&state.expires>Date.now()&&/^[a-f0-9]{64}$/.test(value)&&await digest(value)===state.ownerToken);
 if(control){
  if(request.method!=='POST')return reply({message:'Method not allowed.'},405);
  if(request.headers.get('Origin')!==url.origin||request.headers.get('X-SkinForge-Control')!=='1')return reply({message:'Submit from this website.'},403);
  if(request.headers.get('X-SkinForge-State')!==(state.paused?'resume':'pause'))return reply({message:'Community status changed. Refresh before trying again.'},409);
  if(state.paused){
   if(!canResume)return reply({message:'Resume from the browser used to pause, or use Cloudflare recovery.'},403);
   await env.SKIN_ASSETS.put(KEY,JSON.stringify({paused:false}),{httpMetadata:{contentType:'application/json'}});
   return reply({message:'Community database access resumed.'},200,{'Set-Cookie':`${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`});
  }
  const user=await ownerSession();
  if(!user?.owner||request.headers.get('X-CSRF-Token')!==user.csrf)return reply({message:'Owner access required.'},403);
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  await env.SKIN_ASSETS.put(KEY,JSON.stringify({paused:true,ownerToken:await digest(token),expires:Date.now()+604800000}),{httpMetadata:{contentType:'application/json'}});
  return reply({message:'Community database access paused.'},200,{'Set-Cookie':`${COOKIE}=${token}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Strict`});
 }
 if(state.paused){
  if(url.pathname==='/api/community/me'&&request.method==='GET')return reply({user:null,paused:true,canResume});
  return reply({message:'Community skins are temporarily paused. The skin editor and 3D viewer are still available.',paused:true},503);
 }
 return null;
}
