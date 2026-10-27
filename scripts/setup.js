import fs from 'node:fs';
import crypto from 'node:crypto';
if(fs.existsSync('.env')){console.log('.env уже существует; секреты сохранены.');process.exit(0);}
const env=fs.readFileSync('.env.example','utf8').replace('ADMIN_TOKEN=GENERATE_WITH_NPM_RUN_SETUP','ADMIN_TOKEN='+crypto.randomBytes(32).toString('hex')).replace('DATA_KEY=GENERATE_WITH_NPM_RUN_SETUP','DATA_KEY='+crypto.randomBytes(32).toString('hex'));
fs.writeFileSync('.env',env,{mode:0o600});
console.log('Создан локальный .env. Пароль кабинета — ADMIN_TOKEN в этом файле. Не отправляйте .env в GitHub.');