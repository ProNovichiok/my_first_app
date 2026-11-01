import {configuration} from '../server/config.mjs';
import {randomBytes} from 'node:crypto';
const c=configuration(),mode=process.argv[2]||'check',base=process.argv[3];
async function call(method,data={}){const r=await fetch(`https://api.telegram.org/bot${c.botToken}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(20000)});const result=await r.json();if(!r.ok||!result.ok)throw Error('Telegram API не выполнил '+method);return result.result;}
try{
 const me=await call('getMe');if(me.username!==c.botUsername)throw Error('Имя бота не совпадает.');
 if(mode==='set'){if(!base?.startsWith('https://')||c.webhookSecret.length<32)throw Error('Нужны HTTPS URL функции и секрет webhook.');await call('setWebhook',{url:base.replace(/\/$/,'')+'/telegram',secret_token:c.webhookSecret,allowed_updates:['message'],max_connections:2,drop_pending_updates:false});}
 if(mode==='remove')await call('deleteWebhook',{drop_pending_updates:false});
 const info=await call('getWebhookInfo');console.log(JSON.stringify({username:me.username,webhookActive:!!info.url,url:info.url,pending:info.pending_update_count,lastError:info.last_error_message||null}));
}catch{console.error('Проверка или настройка Telegram не выполнена. Секреты не выводятся.');process.exitCode=1;}
