import fs from 'node:fs';
import path from 'node:path';
export function configFromEnv(env=process.env){
 const company=JSON.parse(fs.readFileSync(new URL('../config/company.json',import.meta.url)));
 const cars=JSON.parse(fs.readFileSync(new URL('../config/cars.json',import.meta.url)));
 const c={company,cars,port:Number(env.PORT||3000),host:env.HOST||'127.0.0.1',publicUrl:(env.PUBLIC_URL||'http://localhost:3000').replace(/\/$/,''),adminToken:env.ADMIN_TOKEN||'',key:env.DATA_KEY||'',botToken:env.BOT_TOKEN||'',botUsername:env.BOT_USERNAME||'CarArendaKLNGBot',botEnabled:env.BOT_ENABLED==='true',demo:env.DEMO_MODE!=='false',legalReady:env.LEGAL_READY==='true',dataDir:path.resolve(env.DATA_DIR||'data'),filesDir:path.resolve(env.FILES_DIR||'private'),trustProxy:env.TRUST_PROXY==='1'};
 if(!/^[a-f0-9]{64}$/i.test(c.key)||c.adminToken.length<32)throw Error('Запустите npm run setup: нужны DATA_KEY (64 hex) и ADMIN_TOKEN (минимум 32 символа).');
 if(!c.demo&&(!c.legalReady||!c.publicUrl.startsWith('https://')||!company.inn||company.legalName.includes('ДЕМО')||company.email.endsWith('.invalid')||cars.some(x=>x.demo||!x.vin||!x.plate||!x.sts||!x.insurance)))throw Error('Рабочий режим заблокирован: заполните реквизиты, автопарк, HTTPS и LEGAL_READY. См. docs/LAUNCH.md.');
 return c;
}