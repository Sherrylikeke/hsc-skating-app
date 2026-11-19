// Explicitly local-only, synthetic review account and isolated D1/R2 state.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync,spawn} from 'node:child_process';
import {hashPassword} from 'better-auth/crypto';
const root=process.cwd(),work=path.resolve('work/portal-v1'),state=path.join(work,'runtime'),configFile=path.join(work,'wrangler.json');
fs.mkdirSync(work,{recursive:true});
if(!fs.existsSync('dist/server/index.js'))throw new Error('Build the application first.');
const config={name:'hsc-portal-local-review',main:path.resolve('dist/server/index.js'),compatibility_date:'2026-05-15',compatibility_flags:['nodejs_compat'],assets:{directory:path.resolve('dist/client'),binding:'ASSETS'},d1_databases:[{binding:'DB',database_name:'hsc-portal-local-review',database_id:'00000000-0000-4000-8000-000000000000'}],r2_buckets:[{binding:'BUCKET',bucket_name:'hsc-portal-local-review'}]};
fs.writeFileSync(configFile,JSON.stringify(config,null,2));
const variables=path.join(work,'.dev.vars');
if(!fs.existsSync(variables))fs.writeFileSync(variables,'BETTER_AUTH_SECRET='+crypto.randomBytes(32).toString('hex')+'\nHSC_EMAIL_VERIFICATION_ENABLED=false\nRESEND_API_KEY=\nHSC_EMAIL_FROM=\nHSC_PILOT_REGISTRATIONS=\n');
const marker=path.join(work,'initialized.json');
if(!fs.existsSync(marker)){
 const files=fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort();
 const hashed=await hashPassword('HSC-Preview-Only-2026!');const sql=v=>"'"+String(v).replaceAll("'","''")+"'";const now=new Date().toISOString(),time=Date.now();
 const fixture=`
 INSERT INTO hsc_members (id,email,name,role,requested_role,status,created_at) VALUES ('portal-preview-admin','preview@example.test','Local Preview Board','admin','admin','active',${sql(now)});
 INSERT INTO hsc_auth_user (id,name,email,email_verified,created_at,updated_at,username,display_username) VALUES ('portal-preview-auth','Local Preview Board','preview@example.test',1,${time},${time},'portal_preview','portal_preview');
 INSERT INTO hsc_auth_account (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES ('portal-preview-credential','portal-preview-auth','credential','portal-preview-auth',${sql(hashed)},${time},${time});
 INSERT INTO hsc_auth_links (auth_user_id,member_id,created_at) VALUES ('portal-preview-auth','portal-preview-admin',${sql(now)});
 INSERT INTO hsc_admissions (skater_id,admitted,payload,updated_by,updated_at) VALUES ('PORTAL-PREVIEW-SKATER',1,'{"name":"Preview Skater","training":true,"identityPending":false,"representedClubs":"Hamilton SC"}','portal-preview-admin',${sql(now)});
 INSERT INTO app_meta (key,value) VALUES ('hsc-admin-bootstrap','local-preview-only');
 `;
 const initFile=path.join(work,'initialize-local.sql');fs.writeFileSync(initFile,files.map(f=>fs.readFileSync('drizzle/'+f,'utf8')).join('\n')+'\n'+fixture);
 const result=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config',configFile,'--persist-to',state,'--file',initFile],{cwd:root,stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);fs.writeFileSync(marker,JSON.stringify({createdAt:now,migrations:files,fixtureOnly:true}));fs.unlinkSync(initFile);
}
if(process.argv.includes('--prepare')){console.log('Local review database ready. No cloud data was accessed.');process.exit(0);}
const child=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--local','--config',configFile,'--persist-to',state,'--ip','127.0.0.1','--port','5173','--inspector-port','0'],{cwd:root,stdio:'inherit'});
child.on('exit',code=>process.exit(code||0));process.on('SIGINT',()=>child.kill('SIGINT'));
