import express from 'express';
import helmet from 'helmet';
import {rateLimit} from 'express-rate-limit';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openStore} from './store.js';
import {bookingService,HttpError} from './booking.js';
import {makeDocumentService,statuses} from './documents.js';
import {consentText,privacyText,legalPage} from './legal.js';
import {createBot} from './bot.js';
export function createApplication(config){
 const app=express();const store=openStore(config);const service=bookingService(config,store);const docs=makeDocumentService(config,store);const bot=createBot(config,store,service);
 if(config.trustProxy)app.set('trust proxy',1);
 app.disable('x-powered-by');
 app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],imgSrc:["'self'","data:"],connectSrc:["'self'"],formAction:["'self'"],frameAncestors:["'none'"],upgradeInsecureRequests:config.publicUrl.startsWith('https://')?[]:null}},strictTransportSecurity:config.publicUrl.startsWith('https://')?undefined:false}));
 app.use((req,res,next)=>{res.set('Referrer-Policy','no-referrer');if(req.path.startsWith('/api'))res.set('Cache-Control','no-store');next();});
 app.use('/api',rateLimit({windowMs:60000,limit:100,standardHeaders:'draft-8',legacyHeaders:false}));
 app.use(express.json({limit:'20kb'}));
 app.use('/api',(req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin&&req.headers.origin!==config.publicUrl)return res.status(403).json({error:'Недопустимый источник запроса.'});next();});
 const bookingLimit=rateLimit({windowMs:30*60000,limit:8,message:{error:'Слишком много заявок. Попробуйте позже.'}});
 const authLimit=rateLimit({windowMs:15*60000,limit:20,skipSuccessfulRequests:true,message:{error:'Слишком много попыток входа.'}});
 function admin(req,res,next){const raw=(req.get('Authorization')||'').replace(/^Bearer /,'');const a=Buffer.from(raw),b=Buffer.from(config.adminToken);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(401).json({error:'Неверный ключ владельца.'});next();}
 const formToken=req=>(req.get('Authorization')||'').replace(/^Bearer /,'');
 app.get('/api/catalog',(req,res)=>res.json({demo:config.demo,brand:config.company.brand,cars:config.cars.map(({vin,plate,sts,insurance,...c})=>c),company:{minAge:config.company.minAge,minExperienceYears:config.company.minExperienceYears,mileagePerDay:config.company.mileagePerDay,extraKmPrice:config.company.extraKmPrice,pickupAddress:config.company.pickupAddress,phone:config.company.phone,email:config.company.email},consentVersion:config.company.consentVersion}));
 app.post('/api/bookings',bookingLimit,(req,res)=>res.status(201).json(service.create(req.body)));
 app.get('/api/form',(req,res)=>{const b=service.form(formToken(req));res.json({...service.publicBooking(b),demo:config.demo,consent:consentText(config.company),consentVersion:config.company.consentVersion});});
 app.post('/api/form',bookingLimit,async(req,res)=>{const b=service.submit(formToken(req),req.body);let filesReady=true;try{await docs.refresh(b.id);}catch(e){filesReady=false;store.audit(b.id,'file_generation_failed');}res.status(201).json({...b,filesReady});});
 app.get('/privacy',(req,res)=>res.type('html').send(legalPage('Политика обработки данных',privacyText(config.company),config.demo)));
 app.get('/consent',(req,res)=>res.type('html').send(legalPage('Отдельное согласие',consentText(config.company),config.demo)));
 app.use('/api/admin',authLimit,admin);
 app.get('/api/admin/bookings',(req,res)=>{store.expire();const rows=store.db.prepare('SELECT * FROM bookings ORDER BY created DESC LIMIT 1000').all();res.json({demo:config.demo,statuses,bookings:rows.map(b=>({...service.publicBooking(b),created:b.created,paid:b.paid,client:store.decrypt(b.pii)?.fullName||null,phone:store.decrypt(b.pii)?.phone||null,hasPerson:!!b.pii})),filesDir:config.filesDir});});
 app.post('/api/admin/bookings/:id/status',async(req,res)=>{const b=service.status(req.params.id,req.body.status);let filesReady=true;try{await docs.refresh(b.id);}catch{filesReady=false;store.audit(b.id,'file_generation_failed');}if(config.botEnabled)bot.notify(store.get(b.id)).catch(()=>store.audit(b.id,'telegram_notification_failed'));res.json({...b,filesReady});});
 app.post('/api/admin/bookings/:id/payment',async(req,res)=>{const b=store.get(req.params.id);if(!b)throw new HttpError(404,'Заявка не найдена.');const amount=req.body.amount;if(!Number.isSafeInteger(amount)||amount<0||amount>b.total)throw new HttpError(400,'Укажите полученную сумму аренды от 0 до стоимости договора, без залога.');store.db.prepare('UPDATE bookings SET paid=? WHERE id=?').run(amount,b.id);store.audit(b.id,'payment_updated');await docs.report();res.json({ok:true});});
 app.get('/api/admin/bookings/:id/contract',async(req,res)=>{const file=await docs.contract(req.params.id);res.set('Cache-Control','no-store').download(file);});
 app.get('/api/admin/report',async(req,res)=>{const file=await docs.report();res.download(file,'clients.xlsx');});
 app.get('/api/admin/audit',(req,res)=>res.json(store.db.prepare('SELECT * FROM audit ORDER BY at DESC LIMIT 500').all()));
 app.delete('/api/admin/bookings/:id/person',async(req,res)=>{
  const b=store.get(req.params.id);if(!b)throw new HttpError(404,'Заявка не найдена.');
  if(!['cancelled','expired'].includes(b.status))throw new HttpError(409,'Удаление анкеты доступно для отменённой или истёкшей заявки. По договору требуется оценить основание и сроки хранения.');
  await docs.erase(b.id);res.json({ok:true});
 });
 app.post('/api/admin/demo',async(req,res)=>{
  if(!config.demo)throw new HttpError(403,'Только в демо-режиме.');
  const existing=store.db.prepare("SELECT id FROM bookings WHERE id='demo-example'").get();
  if(!existing){
   const car=config.cars[0];const start=new Date(Date.now()+3*86400000).toISOString(),end=new Date(Date.now()+6*86400000).toISOString();
   const person={fullName:'ДЕМО — Иван Примеров',birthDate:'1990-01-01',phone:'+70000000000',passportSeries:'0000',passportNumber:'000000',passportIssuedBy:'Вымышленный орган — образец',passportIssuedDate:'2010-01-01',passportCode:'000-000',registrationAddress:'Демонстрационный адрес',licenseNumber:'0000000000',licenseIssuedDate:'2020-01-01',licenseExpires:'2030-01-01',drivingSince:'2010-01-01'};
   store.db.prepare("INSERT INTO bookings(id,car,start,end,days,total,deposit,status,expires,created,pii,consent,terms) VALUES('demo-example',?,?,?,?,?,?,'pending',?,?,?,?,?)").run(car.id,start,end,3,car.price*3,car.deposit,Date.now()+86400000,Date.now(),store.encrypt(person),JSON.stringify({at:new Date().toISOString(),version:config.company.consentVersion,text:consentText(config.company),demo:true}),JSON.stringify({price:car.price,mileagePerDay:config.company.mileagePerDay,extraKmPrice:config.company.extraKmPrice,car,company:config.company}));
   store.audit('demo-example','demo_created');
  }
  await docs.refresh('demo-example');res.json({ok:true,id:'demo-example'});
 });
 app.use(express.static(fileURLToPath(new URL('../public',import.meta.url)),{index:'index.html',dotfiles:'deny'}));
 app.use((req,res)=>res.status(404).json({error:'Страница не найдена.'}));
 app.use((err,req,res,next)=>{const status=err.status||(err.type==='entity.parse.failed'?400:500);if(status>=500)console.error('Ошибка сервера; подробности скрыты для защиты данных.');res.status(status).json({error:status>=500?'Внутренняя ошибка. Повторите позже.':err.status?err.message:'Проверьте запрос.'});});
 return {app,store,service,docs,bot};
}