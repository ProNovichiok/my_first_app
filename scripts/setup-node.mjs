import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
try{await readFile('.env.node');console.log('.env.node уже существует.');}catch{let text=await readFile('.env.node.example','utf8');for(const key of ['ADMIN_TOKEN','DATA_KEY','TELEGRAM_WEBHOOK_SECRET'])text=text.replace(key+'=',key+'='+randomBytes(32).toString('hex'));await writeFile('.env.node',text,{flag:'wx',mode:0o600});console.log('Создан .env.node. Заполните DATABASE_URL и BOT_TOKEN; файл не попадает в GitHub.');}
