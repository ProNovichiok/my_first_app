import {randomUUID} from 'node:crypto';
import {Failure,statuses} from './config.mjs';
import {hash,token,encrypt,decrypt} from './security.mjs';
export function dates(start,end,now=Date.now()){
 const read=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s))throw new Failure(400,'Проверьте дату и время.');const n=Date.parse(s+':00+02:00');if(!Number.isFinite(n)||new Date(n+7200000).toISOString().slice(0,16)!==s)throw new Failure(400,'Проверьте дату и время.');return n;};
 const a=read(start),b=read(end);if(a<now+900000||a>now+366*86400000||b-a<3600000||b-a>90*86400000)throw new Failure(400,'Выдача минимум через 15 минут; срок от 1 часа до 90 суток.');
 return {start:new Date(a).toISOString(),end:new Date(b).toISOString(),days:Math.ceil((b-a)/86400000)};
}
export const view=b=>({id:b.id,car:b.car,start:new Date(b.start_at).toISOString(),end:new Date(b.end_at).toISOString(),days:b.days,total:b.total,deposit:b.deposit,status:b.status,expires:Number(b.expires)});
export function decodeDemoLink(raw){
 if(!/^d1-[a-z0-9]{1,24}-[a-z0-9]{1,10}-[a-z0-9]{1,10}$/.test(raw))throw new Failure(400,'Учебная ссылка повреждена. Выберите автомобиль на сайте.');
 const [,car,a,b]=raw.split('-'),local=n=>{const ms=parseInt(n,36)*60000;if(!Number.isSafeInteger(ms)||!Number.isFinite(ms))throw new Failure(400,'Неверные даты.');try{return new Date(ms+7200000).toISOString().slice(0,16);}catch{throw new Failure(400,'Неверные даты.');}};
 const result={car,start:local(a),end:local(b)};dates(result.start,result.end);return result;
}
export function demoPerson(name='ДЕМО — клиент Telegram'){return {fullName:name,birthDate:'1990-01-01',phone:'+70000000000',passportSeries:'0000',passportNumber:'000000',passportIssuedBy:'Вымышленный орган — учебный образец',passportIssuedDate:'2010-01-01',passportCode:'000-000',registrationAddress:'Вымышленный адрес — не предоставлен клиентом',licenseNumber:'0000000000',licenseIssuedDate:'2020-01-01',licenseExpires:'2035-01-01',drivingSince:'2010-01-01'};}
export class Bookings{
 constructor(config,db){this.c=config;this.db=db;}
 car(id){const car=this.c.cars.find(x=>x.id===id);if(!car)throw new Failure(404,'Автомобиль не найден.');return car;}
 async expire(q=this.db){await q.query("UPDATE baltic_v4.bookings SET status='expired',closed=expires,claim_hash=NULL WHERE status IN ('hold','pending') AND expires < $1",[Date.now()]);}
 async purge(){await this.expire();const cutoff=Date.now()-(this.c.company.applicationRetentionDays||30)*86400000;await this.db.query("UPDATE baltic_v4.bookings SET pii=NULL,consent=NULL,chat_hash=NULL,chat_enc=NULL,claim_hash=NULL WHERE status IN ('expired','cancelled') AND COALESCE(closed,created)<$1 AND (pii IS NOT NULL OR chat_enc IS NOT NULL)",[cutoff]);}
 async overlaps(q,car,start,end,except=''){return (await q.query("SELECT id FROM baltic_v4.bookings WHERE car=$1 AND start_at<$2 AND end_at>$3 AND id<>$4 AND status IN ('hold','pending','confirmed','active') LIMIT 1",[car,end,start,except])).rowCount>0;}
 async audit(q,id,event){await q.query('INSERT INTO baltic_v4.audit(at,booking,event) VALUES($1,$2,$3)',[Date.now(),id,event]);}
 async create(input,q){if(!input||Object.keys(input).sort().join(',')!=='car,end,start')throw new Failure(400,'Проверьте автомобиль, даты и время.');const car=this.car(input.car),period=dates(input.start,input.end);if(!q)return this.db.tx(client=>this.create(input,client));await this.expire(q);
  if(await this.overlaps(q,car.id,period.start,period.end))throw new Failure(409,'На эти даты автомобиль занят. Выберите другие даты.');
  const id=randomUUID(),claim=token(),created=Date.now(),terms={price:car.price,mileagePerDay:this.c.company.mileagePerDay,extraKmPrice:this.c.company.extraKmPrice,car,company:this.c.company};
  const r=await q.query("INSERT INTO baltic_v4.bookings(id,car,start_at,end_at,days,total,deposit,status,expires,created,claim_hash,terms) VALUES($1,$2,$3,$4,$5,$6,$7,'hold',$8,$9,$10,$11) RETURNING *",[id,car.id,period.start,period.end,period.days,period.days*car.price,car.deposit,created+1800000,created,hash(claim),terms]);await this.audit(q,id,'created');return {...view(r.rows[0]),telegramUrl:`https://t.me/${this.c.botUsername}?start=${claim}`};
 }
 async claim(raw,chat,q){if(!q)return this.db.tx(client=>this.claim(raw,chat,client));await this.expire(q);let b;
  if(raw.startsWith('d1-')){const input=decodeDemoLink(raw);this.car(input.car);const p=dates(input.start,input.end);const old=await q.query("SELECT * FROM baltic_v4.bookings WHERE chat_hash=$1 AND car=$2 AND start_at=$3 AND end_at=$4 AND status NOT IN ('cancelled','expired') LIMIT 1",[hash(chat),input.car,p.start,p.end]);if(old.rowCount)return view(old.rows[0]);const fresh=await this.create(input,q);b=(await q.query('SELECT * FROM baltic_v4.bookings WHERE id=$1',[fresh.id])).rows[0];}
  else{if(!/^[A-Za-z0-9_-]{32}$/.test(raw))throw new Failure(400,'Выберите автомобиль и даты на сайте.');b=(await q.query('SELECT * FROM baltic_v4.bookings WHERE claim_hash=$1 FOR UPDATE',[hash(raw)])).rows[0];}
  if(!b||b.status!=='hold'||Number(b.expires)<Date.now())throw new Failure(410,'Заявка истекла или уже оформлена. Выберите автомобиль на сайте.');
  if(b.chat_hash&&b.chat_hash!==hash(chat))throw new Failure(403,'Заявка связана с другим аккаунтом.');
  const consent={at:new Date().toISOString(),version:'demo-no-personal-documents',demo:true,text:'Учебная заявка. Документы не запрашивались. Данные вымышлены; это не согласие на обработку реальных документов.'};
  const result=await q.query("UPDATE baltic_v4.bookings SET chat_hash=$1,chat_enc=$2,pii=$3,consent=$4,status='pending',expires=$5,claim_hash=NULL WHERE id=$6 RETURNING *",[hash(chat),encrypt(String(chat),this.c.key),encrypt(demoPerson(),this.c.key),consent,Date.now()+86400000,b.id]);await this.audit(q,b.id,'demo_selection_received');return view(result.rows[0]);
 }
 async all(){await this.purge();return (await this.db.query('SELECT * FROM baltic_v4.bookings ORDER BY created DESC LIMIT 10000')).rows;}
 async get(id,q=this.db){const b=(await q.query('SELECT * FROM baltic_v4.bookings WHERE id=$1',[id])).rows[0];if(!b)throw new Failure(404,'Заявка не найдена.');return b;}
 person(b){return decrypt(b.pii,this.c.key);}
 async change(id,next){return this.db.tx(async q=>{await this.expire(q);const b=await this.get(id,q),transitions={hold:['cancelled'],pending:['confirmed','cancelled'],confirmed:['active','cancelled'],active:['completed']};if(!transitions[b.status]?.includes(next))throw new Failure(409,'Недопустимый переход статуса.');if(next==='confirmed'&&(!b.pii||await this.overlaps(q,b.car,b.start_at,b.end_at,id)))throw new Failure(409,'Нет анкеты или есть пересечение дат.');const r=await q.query('UPDATE baltic_v4.bookings SET status=$1,closed=$2,claim_hash=NULL WHERE id=$3 RETURNING *',[next,['cancelled','completed'].includes(next)?Date.now():null,id]);await this.audit(q,id,'status:'+next);return r.rows[0];});}
 async payment(id,amount){return this.db.tx(async q=>{const b=await this.get(id,q);if(!Number.isSafeInteger(amount)||amount<0||amount>b.total)throw new Failure(400,'Полученная аренда должна быть от 0 до стоимости договора, без залога.');await q.query('UPDATE baltic_v4.bookings SET paid=$1 WHERE id=$2',[amount,id]);await this.audit(q,id,'payment_updated');});}
 async erase(id){return this.db.tx(async q=>{const b=await this.get(id,q);if(!['cancelled','expired'].includes(b.status))throw new Failure(409,'Сначала отмените заявку.');await q.query('UPDATE baltic_v4.bookings SET pii=NULL,consent=NULL,chat_hash=NULL,chat_enc=NULL,claim_hash=NULL WHERE id=$1',[id]);await this.audit(q,id,'personal_data_deleted');});}
 async seed(){return this.db.tx(async q=>{const old=await q.query("SELECT id FROM baltic_v4.bookings WHERE id='demo-example'");if(old.rowCount)return 'demo-example';const start=new Date(Date.now()+10*86400000).toISOString().slice(0,16),end=new Date(Date.now()+13*86400000).toISOString().slice(0,16),b=await this.create({car:this.c.cars[0].id,start,end},q);await q.query("UPDATE baltic_v4.bookings SET id='demo-example',pii=$1,consent=$2,status='pending',expires=$3,claim_hash=NULL WHERE id=$4",[encrypt(demoPerson('ДЕМО — Иван Примеров'),this.c.key),{demo:true,text:'Синтетический учебный образец'},Date.now()+86400000,b.id]);return 'demo-example';});}
}
