import {Failure,statuses} from './config.mjs';
import {safeEqual,hash,encrypt,decrypt} from './security.mjs';
import {fmt} from './documents.mjs';
export class Telegram{
 constructor(c,db,bookings,send){this.c=c;this.db=db;this.bookings=bookings;this.send=send||((payload)=>this.call('sendMessage',payload));}
 async call(method,payload){if(!this.c.botToken)throw new Failure(503,'Бот ещё не настроен.');const r=await fetch(`https://api.telegram.org/bot${this.c.botToken}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});const data=await r.json();if(!r.ok||!data.ok)throw new Failure(503,'Telegram временно недоступен. Повторите позже.');return data.result;}
 keyboard(){return {inline_keyboard:[[{text:'Открыть каталог',url:this.c.publicUrl+'/'}]]};}
 async response(message,q){const chat=String(message.chat.id),text=message.text.trim();let reply;
  if(text==='/status'){await this.bookings.expire(q);const rows=(await q.query('SELECT * FROM baltic_v4.bookings WHERE chat_hash=$1 ORDER BY created DESC LIMIT 5',[hash(chat)])).rows;reply=rows.length?'УЧЕБНЫЕ ЗАЯВКИ\n'+rows.map(b=>b.id.slice(0,8)+': '+statuses[b.status]).join('\n'):'Связанных заявок нет. Выберите автомобиль на сайте.';}
  else if(/^\/start(?:@\w+)?\s+/.test(text)){const raw=text.split(/\s+/)[1];try{const b=await this.bookings.claim(raw,chat,q),car=this.bookings.car(b.car);reply=`УЧЕБНАЯ ЗАЯВКА ${b.id.slice(0,8)}\n${car.name}\nВыдача: ${fmt(b.start)}\nВозврат: ${fmt(b.end)}\nАренда: ${b.total} ₽ · залог отдельно: ${b.deposit} ₽\nВыбор сохранён на сервере. Создана вымышленная анкета для образца договора. Паспорт и права в чат не отправляйте. Это демонстрация, выдача автомобиля не подтверждена.`;}catch(e){if(!(e instanceof Failure))throw e;reply=e.message;}}
  else reply='Балтик Драйв · учебный прокат в Калининграде. Выберите автомобиль и даты на сайте, затем вернитесь по кнопке Telegram. /status — состояние заявок. Настоящие паспорт и права не присылайте.';
  return {chat_id:chat,text:reply,reply_markup:this.keyboard()};
 }
 async webhook(request,update){
  if(this.c.webhookSecret.length<32||!safeEqual(request.headers.get('x-telegram-bot-api-secret-token'),this.c.webhookSecret))throw new Failure(403,'Доступ запрещён.');
  if(!Number.isSafeInteger(update?.update_id))throw new Failure(400,'Неверное обновление.');
  const message=update.message;if(!message||message.chat?.type!=='private'||!Number.isSafeInteger(message.chat.id)||typeof message.text!=='string'||message.text.length>4096)return {ok:true};
  await this.db.tx(async q=>{const inserted=await q.query('INSERT INTO baltic_v4.telegram_updates(update_id,created) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING update_id',[update.update_id,Date.now()]);if(!inserted.rowCount)return;const payload=await this.response(message,q);await q.query('INSERT INTO baltic_v4.outbox(update_id,payload,created) VALUES($1,$2,$3)',[update.update_id,encrypt(payload,this.c.key),Date.now()]);});
  const lease=await this.db.query('UPDATE baltic_v4.outbox SET locked_until=$1 WHERE update_id=$2 AND sent=false AND locked_until<$3 RETURNING id,payload',[Date.now()+20000,update.update_id,Date.now()]);
  if(!lease.rowCount){const row=(await this.db.query('SELECT sent FROM baltic_v4.outbox WHERE update_id=$1',[update.update_id])).rows[0];if(row?.sent)return {ok:true};throw new Failure(503,'Повторите запрос позже.');}
  const row=lease.rows[0];try{await this.send(decrypt(row.payload,this.c.key));await this.db.query("UPDATE baltic_v4.outbox SET sent=true,payload='',locked_until=0 WHERE id=$1",[row.id]);}catch(e){await this.db.query('UPDATE baltic_v4.outbox SET locked_until=0 WHERE id=$1',[row.id]);throw e;}
  return {ok:true};
 }
 async notify(b){if(!b.chat_enc)return;await this.send({chat_id:decrypt(b.chat_enc,this.c.key),text:`Учебная заявка ${b.id.slice(0,8)}: ${statuses[b.status]}. Это демонстрация.`,reply_markup:this.keyboard()});}
}
