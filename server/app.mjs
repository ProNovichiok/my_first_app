import {configuration,publicCatalog,statuses,Failure} from './config.mjs';
import {database} from './database.mjs';
import {Bookings,view} from './bookings.mjs';
import {safeEqual,hash} from './security.mjs';
import {contract,report} from './documents.mjs';
import {Telegram} from './telegram.mjs';
async function jsonBody(request){const reader=request.body?.getReader();if(!reader)return {};let size=0,parts=[];try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>20480){await reader.cancel();throw new Failure(413,'Слишком большой запрос.');}parts.push(value);}return JSON.parse(Buffer.concat(parts).toString('utf8')||'{}');}catch(e){if(e instanceof Failure)throw e;throw new Failure(400,'Неверный JSON.');}}
export function createApp({config=configuration(),db=database(config.databaseUrl),send}={}){
 const bookings=new Bookings(config,db),telegram=new Telegram(config,db,bookings,send);
 async function rate(request){const ip=request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()||'anonymous',key=hash('booking:'+ip),now=Date.now();const result=await db.query('INSERT INTO baltic_v4.rate_limits(key,expires,hits) VALUES($1,$2,1) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN baltic_v4.rate_limits.expires<$3 THEN 1 ELSE baltic_v4.rate_limits.hits+1 END,expires=CASE WHEN baltic_v4.rate_limits.expires<$3 THEN $2 ELSE baltic_v4.rate_limits.expires END RETURNING hits',[key,now+1800000,now]);if(result.rows[0].hits>8)throw new Failure(429,'Слишком много заявок. Повторите позже.');}
 async function route(request){const path=new URL(request.url).pathname,method=request.method;
  if(path==='/health'&&method==='GET')return Response.json({ok:true,runtime:'nodejs24',demo:config.demo});
  if(path==='/api/catalog'&&method==='GET')return Response.json(publicCatalog(),{headers:{'cache-control':'public, max-age=300'}});
  if(path==='/telegram'&&method==='POST'){
   if(config.webhookSecret.length<32||!safeEqual(request.headers.get('x-telegram-bot-api-secret-token'),config.webhookSecret))throw new Failure(403,'Доступ запрещён.');
   return Response.json(await telegram.webhook(request,await jsonBody(request)));
  }
  if(!['GET','HEAD'].includes(method)){const origin=request.headers.get('origin');if(origin&&origin!==config.allowedOrigin)throw new Failure(403,'Недопустимый источник запроса.');}
  if(path.startsWith('/api/admin/')){const auth=request.headers.get('authorization')||'';if(!auth.startsWith('Bearer ')||!safeEqual(auth.slice(7),config.adminToken))throw new Failure(401,'Неверный ключ владельца.');}
  if(path==='/api/bookings'&&method==='POST'){await rate(request);return Response.json(await bookings.create(await jsonBody(request)),{status:201});}
  if(path==='/api/form')throw new Failure(403,'Учебная версия: настоящие паспорт и права не принимаются. Продолжите в Telegram.');
  if(path==='/api/admin/bookings'&&method==='GET'){const rows=await bookings.all();return Response.json({demo:config.demo,statuses,bookings:rows.slice(0,1000).map(b=>{const p=bookings.person(b);return {...view(b),created:Number(b.created),paid:b.paid,client:p?.fullName||null,phone:p?.phone||null,hasPerson:!!b.pii};}),filesDir:'Neon PostgreSQL. Договоры и Excel формируются по запросу и скачиваются на ваш компьютер.'});}
  if(path==='/api/admin/report'&&method==='GET'){const rows=await bookings.all();return new Response(report(rows,b=>bookings.person(b)),{headers:{'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':'attachment; filename="clients.xlsx"'}});}
  if(path==='/api/admin/audit'&&method==='GET')return Response.json((await db.query('SELECT id,at,booking,event FROM baltic_v4.audit ORDER BY at DESC LIMIT 500')).rows);
  if(path==='/api/admin/demo'&&method==='POST')return Response.json({ok:true,id:await bookings.seed()});
  const match=path.match(/^\/api\/admin\/bookings\/([a-zA-Z\d-]{1,64})\/(status|payment|contract|person)$/);
  if(match){const [,id,action]=match;
   if(action==='status'&&method==='POST'){const b=await bookings.change(id,(await jsonBody(request)).status);let notified=false;try{await telegram.notify(b);notified=true;}catch{await bookings.audit(db,id,'telegram_notification_failed');}return Response.json({...view(b),filesReady:true,notified});}
   if(action==='payment'&&method==='POST'){await bookings.payment(id,(await jsonBody(request)).amount);return Response.json({ok:true,filesReady:true});}
   if(action==='contract'&&method==='GET'){const b=await bookings.get(id);return new Response(contract(b,bookings.person(b)),{headers:{'content-type':'text/html; charset=utf-8','content-disposition':`attachment; filename="${id}.html"`,'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"}});}
   if(action==='person'&&method==='DELETE'){await bookings.erase(id);return Response.json({ok:true});}
  }
  throw new Failure(404,'Страница не найдена.');
 }
 return {db,bookings,telegram,async fetch(request){const origin=request.headers.get('origin');let response;
  if(request.method==='OPTIONS'){response=origin===config.allowedOrigin?new Response(null,{status:204,headers:{'access-control-allow-methods':'GET,POST,DELETE,OPTIONS','access-control-allow-headers':'authorization,content-type','access-control-max-age':'600'}}):Response.json({error:'Недопустимый источник запроса.'},{status:403});}
  else try{response=await route(request);}catch(e){response=Response.json({error:e instanceof Failure?e.message:'Внутренняя ошибка. Повторите позже.'},{status:e instanceof Failure?e.status:500});}
  response.headers.set('x-content-type-options','nosniff');response.headers.set('referrer-policy','no-referrer');if(!response.headers.has('cache-control'))response.headers.set('cache-control','no-store');
  if(origin===config.allowedOrigin){response.headers.set('access-control-allow-origin',origin);response.headers.set('vary','Origin');}
  return response;
 }};
}
