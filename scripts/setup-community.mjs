import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cli=path.join(root,'node_modules/wrangler/bin/wrangler.js');
const configPath=path.join(root,'wrangler.jsonc');
const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
function run(args,capture=false){
 const result=spawnSync(process.execPath,[cli,...args],{cwd:root,stdio:capture?['inherit','pipe','pipe']:'inherit',encoding:'utf8',windowsHide:true});
 if(capture){if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);}
 if(result.error||result.status!==0)throw Error('Cloudflare command failed. Log in using Cloudflare.bat and try again.');
 return result.stdout||'';
}
try{
 let binding=config.d1_databases?.find(item=>item.binding==='COMMUNITY_DB');
 if(!binding){
  const raw=run(['d1','list','--json'],true);
  const start=raw.indexOf('['),end=raw.lastIndexOf(']');
  const list=JSON.parse(raw.slice(start,end+1));
  let database=list.find(item=>item.name==='skinforge-community');
  if(!database){
   const created=run(['d1','create','skinforge-community'],true);
   const uuid=created.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i)?.[0];
   if(!uuid)throw Error('Database created, but its ID could not be read. Run this setup again to find it.');
   database={uuid};
  }
  binding={binding:'COMMUNITY_DB',database_name:'skinforge-community',database_id:database.uuid||database.id,migrations_dir:'migrations'};
  if(!binding.database_id)throw Error('Could not find the database ID.');
  config.d1_databases=[...(config.d1_databases||[]),binding];
  fs.writeFileSync(configPath,JSON.stringify(config,null,2)+'\n');
 }
 run(['d1','migrations','apply','COMMUNITY_DB','--remote']);
 if(fs.existsSync(path.join(root,'GitHubSource/wrangler.jsonc')))fs.copyFileSync(configPath,path.join(root,'GitHubSource/wrangler.jsonc'));
 console.log('Community database is ready. Deploy the updated site with Update Site.bat or commit and push GitHubSource.');
 console.log('Sign in with the owner Steam account on the deployed site to manage community skins and other admins.');
}catch(error){console.error(error.message);process.exitCode=1;}
