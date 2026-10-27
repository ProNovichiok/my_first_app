import crypto from 'node:crypto';
import {hash,token} from './store.js';
import {period,bookingSchema,personSchema,validatePerson} from './validation.js';
import {consentText} from './legal.js';
export class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
export function bookingService(config,store){
 const {db}=store;
 const publicBooking=b=>({id:b.id,car:b.car,start:b.start,end:b.end,days:b.days,total:b.total,deposit:b.deposit,status:b.status,expires:b.expires});
 function create(input){
  const parsed=bookingSchema.safeParse(input);if(!parsed.success)throw new HttpError(400,'Проверьте автомобиль, даты и время.');
  const car=config.cars.find(c=>c.id===input.car);if(!car)throw new HttpError(404,'Автомобиль не найден.');
  let dates;try{dates=period(input.start,input.end);}catch(e){throw new HttpError(400,e.message);}
  return store.transaction(()=>{
   if(store.overlaps(car.id,dates.start,dates.end))throw new HttpError(409,'На эти даты автомобиль занят. Выберите другие даты или автомобиль.');
   const id=crypto.randomUUID();const claim=token();const created=Date.now();
   const terms=JSON.stringify({price:car.price,mileagePerDay:config.company.mileagePerDay,extraKmPrice:config.company.extraKmPrice,car:{...car},company:{...config.company}});
   db.prepare("INSERT INTO bookings(id,car,start,end,days,total,deposit,status,expires,created,claim_hash,terms) VALUES(?,?,?,?,?,?,?,'hold',?,?,?,?)").run(id,car.id,dates.start,dates.end,dates.days,dates.days*car.price,car.deposit,created+30*60000,created,hash(claim),terms);
   store.audit(id,'created');
   return {...publicBooking(store.get(id)),telegramUrl:'https://t.me/'+config.botUsername+'?start='+claim};
  });
 }
 function claim(raw,chat){
  store.expire();const b=db.prepare('SELECT * FROM bookings WHERE claim_hash=?').get(hash(raw));
  if(!b||b.status!=='hold'||b.expires<Date.now())throw new HttpError(410,'Заявка истекла или уже оформлена. Выберите автомобиль на сайте.');
  if(b.chat_hash&&b.chat_hash!==hash(chat))throw new HttpError(403,'Эта заявка уже связана с другим аккаунтом.');
  const form=token();
  db.prepare('UPDATE bookings SET chat_hash=?,chat_enc=?,form_hash=?,form_expires=? WHERE id=?').run(hash(chat),store.encrypt(String(chat)),hash(form),Math.min(Date.now()+30*60000,b.expires),b.id);
  store.audit(b.id,'telegram_linked');
  return {...publicBooking(b),formUrl:config.publicUrl+'/#apply='+form};
 }
 function form(raw){
  store.expire();const b=db.prepare('SELECT * FROM bookings WHERE form_hash=?').get(hash(raw));
  if(!b||b.status!=='hold'||b.form_expires<Date.now()||b.expires<Date.now())throw new HttpError(410,'Ссылка недействительна или истекла. Начните бронирование заново.');
  return b;
 }
 function submit(raw,input){
  if(config.demo)throw new HttpError(403,'Демонстрационный режим: настоящие документы не принимаются. Посмотрите пример в кабинете владельца.');
  const b=form(raw);const parsed=personSchema.safeParse(input);
  if(!parsed.success)throw new HttpError(400,'Проверьте поля анкеты и отдельное согласие.');
  let person;try{person=validatePerson(parsed.data,config.company,b);}catch(e){throw new HttpError(400,e.message);}
  return store.transaction(()=>{
   const fresh=form(raw);
   if(store.overlaps(b.car,b.start,b.end,b.id))throw new HttpError(409,'Автомобиль уже занят.');
   const consent={at:new Date().toISOString(),version:config.company.consentVersion,privacyVersion:config.company.privacyVersion,text:consentText(config.company),method:'Отдельный непредустановленный checkbox и отправка формы по одноразовой ссылке',scope:'Заявка; не подпись договора'};
   db.prepare("UPDATE bookings SET pii=?,consent=?,status='pending',expires=?,form_hash=NULL,claim_hash=NULL WHERE id=?").run(store.encrypt(person),JSON.stringify(consent),Date.now()+24*3600000,fresh.id);
   store.audit(b.id,'application_submitted');return publicBooking(store.get(b.id));
  });
 }
 const transitions={hold:['cancelled'],pending:['confirmed','cancelled'],confirmed:['active','cancelled'],active:['completed'],completed:[],cancelled:[],expired:[]};
 function status(id,next){
  return store.transaction(()=>{
   store.expire();const b=store.get(id);if(!b)throw new HttpError(404,'Заявка не найдена.');
   if(!transitions[b.status]?.includes(next))throw new HttpError(409,'Недопустимый переход статуса.');
   if(next==='confirmed'&&(!b.pii||store.overlaps(b.car,b.start,b.end,id)))throw new HttpError(409,'Нет анкеты или есть пересечение дат.');
   db.prepare('UPDATE bookings SET status=?,closed=?,claim_hash=NULL,form_hash=NULL WHERE id=?').run(next,['completed','cancelled'].includes(next)?Date.now():null,id);store.audit(id,'status:'+next);return publicBooking(store.get(id));
  });
 }
 return {create,claim,form,submit,status,publicBooking};
}