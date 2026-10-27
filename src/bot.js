import {hash} from './store.js';
import {statuses,fmt} from './documents.js';
export function createBot(config,store,service){
 let stopped=false;let controller=null;
 async function api(method,payload){
  const r=await fetch('https://api.telegram.org/bot'+config.botToken+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(40000)});
  const data=await r.json();if(!r.ok||!data.ok)throw Error('Telegram API request failed ('+r.status+')');return data.result;
 }
 async function send(chat,text,reply_markup){return api('sendMessage',{chat_id:chat,text,...(reply_markup?{reply_markup}:{}),protect_content:true,link_preview_options:{is_disabled:true}});}
 async function handle(update){
  const m=update.message;if(!m||m.chat.type!=='private'||m.from?.is_bot)return;
  const chat=String(m.chat.id);const text=m.text||'';
  if(text.startsWith('/start ')){
   try{const b=service.claim(text.split(/\s+/)[1],chat);const car=config.cars.find(c=>c.id===b.car);await send(chat,(config.demo?'ДЕМО. Реальные документы не принимаются.\n\n':'')+'Заявка '+b.id.slice(0,8)+'\n'+car.name+'\n'+fmt(b.start)+' → '+fmt(b.end)+' (Калининград)\nАренда: '+b.total+' ₽, залог отдельно: '+b.deposit+' ₽.\n\nНе присылайте паспорт и права в чат. Заполните анкету на защищённом сайте. Ссылка действует до 30 минут. Бронь подтверждает владелец после проверки.',{inline_keyboard:[[{text:config.demo?'Открыть демонстрационную форму':'Заполнить анкету',url:b.formUrl}]]});}
   catch(e){await send(chat,e.status?e.message:'Не удалось открыть заявку. Повторите позже.');}return;
  }
  if(text==='/status'){
   store.expire();const rows=store.db.prepare('SELECT * FROM bookings WHERE chat_hash=? ORDER BY created DESC LIMIT 5').all(hash(chat));
   await send(chat,rows.length?rows.map(b=>b.id.slice(0,8)+': '+statuses[b.status]).join('\n'):'Связанных заявок нет. Начните с каталога.');return;
  }
  await send(chat,'Аренда авто в Калининграде. Выберите автомобиль и даты на сайте.\n/status — статус заявки.\nПаспорт, права и фотографии документов в этот чат не отправляйте. Вопросы по данным: '+config.company.email,{inline_keyboard:[[{text:'Выбрать автомобиль',url:config.publicUrl}]]});
 }
 async function run(){
  if(!config.botToken)throw Error('BOT_TOKEN не указан.');
  if(!config.publicUrl.startsWith('https://'))throw Error('Для бота нужен публичный PUBLIC_URL с HTTPS.');
  const me=await api('getMe',{});if(me.username.toLowerCase()!==config.botUsername.toLowerCase())throw Error('BOT_TOKEN принадлежит другому боту.');
  const webhook=await api('getWebhookInfo',{});if(webhook.url)throw Error('У бота уже настроен webhook. Отключите старый процесс/webhook самостоятельно перед polling.');
  console.log('Telegram-бот запущен: @'+me.username);
  while(!stopped){
   try{
    const offset=Number(store.db.prepare("SELECT value FROM meta WHERE key='telegram_offset'").get()?.value||0);
    controller=new AbortController();
    const response=await fetch('https://api.telegram.org/bot'+config.botToken+'/getUpdates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({offset,timeout:25,allowed_updates:['message']}),signal:controller.signal});
    const result=await response.json();if(!result.ok)throw Error('Polling failed');
    for(const u of result.result){if(stopped)break;await handle(u);store.db.prepare("INSERT INTO meta(key,value) VALUES('telegram_offset',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(u.update_id+1));}
   }catch(e){if(stopped)break;console.error('Telegram временно недоступен; повтор через 5 секунд.');await new Promise(r=>setTimeout(r,5000));}
  }
 }
 return {run,handle,notify:async b=>{if(b.chat_enc)await send(store.decrypt(b.chat_enc),'Заявка '+b.id.slice(0,8)+': '+statuses[b.status]+'. Подписание договора и выдача — после проверки оригиналов.');},stop(){stopped=true;controller?.abort();}};
}