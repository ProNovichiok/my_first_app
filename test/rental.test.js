import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import ExcelJS from 'exceljs';
import {configFromEnv} from '../src/config.js';
import {createApplication} from '../src/app.js';
import {period} from '../src/validation.js';
const stamp=n=>new Date(Date.now()+n*86400000+7200000).toISOString().slice(0,16);
async function fixture(demo=true){
 const root=path.resolve('../test-runs');await fs.mkdir(root,{recursive:true});const dir=await fs.mkdtemp(path.join(root,'baltic-test-'));
 const config=configFromEnv({DEMO_MODE:'true',ADMIN_TOKEN:'a'.repeat(64),DATA_KEY:crypto.randomBytes(32).toString('hex'),DATA_DIR:path.join(dir,'db'),FILES_DIR:path.join(dir,'files')});
 config.demo=demo;
 const r=createApplication(config);
 return {...r,config,dir,async close(){r.store.db.close();await fs.rm(dir,{recursive:true,force:true});}};
}
const person={fullName:'Тестовый Клиент',birthDate:'1990-01-01',phone:'+79991234567',passportSeries:'0000',passportNumber:'000000',passportIssuedBy:'Тестовый орган выдачи',passportIssuedDate:'2010-01-01',passportCode:'000-000',registrationAddress:'Тестовый адрес',licenseNumber:'0000000000',licenseIssuedDate:'2020-01-01',licenseExpires:'2035-01-01',drivingSince:'2010-01-01',categoryB:true,consent:true,consentVersion:'2026-10-27-v1'};
test('Калининград UTC+2, начатые сутки, неверные даты',()=>{
 const now=Date.parse('2026-01-01T00:00:00Z');assert.equal(period('2026-01-02T10:00','2026-01-03T10:01',now).days,2);
 assert.equal(period('2026-01-02T10:00','2026-01-03T10:00',now).start,'2026-01-02T08:00:00.000Z');
 assert.throws(()=>period('2026-02-30T10:00','2026-03-03T10:00',now));
 assert.throws(()=>period('2025-01-01T10:00','2025-01-02T10:00',now));
});
test('пересечения, повторная привязка и истечение заявки',async()=>{
 const f=await fixture();try{
  const b=f.service.create({car:'solaris',start:stamp(2),end:stamp(4)});
  assert.throws(()=>f.service.create({car:'solaris',start:stamp(3),end:stamp(5)}),e=>e.status===409);
  const claim=new URL(b.telegramUrl).searchParams.get('start');const form=f.service.claim(claim,'101');
  assert.throws(()=>f.service.claim(claim,'202'),e=>e.status===403);
  assert.equal(f.service.form(form.formUrl.split('=')[1]).id,b.id);
  assert.throws(()=>f.service.submit(form.formUrl.split('=')[1],person),e=>e.status===403);
  f.store.db.prepare('UPDATE bookings SET expires=? WHERE id=?').run(Date.now()-1,b.id);
  assert.throws(()=>f.service.claim(claim,'101'),e=>e.status===410);
  assert.ok(f.service.create({car:'solaris',start:stamp(3),end:stamp(5)}));
 }finally{await f.close();}
});
test('анкета шифруется, ссылка одноразовая, статусы и документы',async()=>{
 const f=await fixture(false);try{
  const b=f.service.create({car:'rio',start:stamp(10),end:stamp(12)});
  const linked=f.service.claim(new URL(b.telegramUrl).searchParams.get('start'),'101');const secret=linked.formUrl.split('=')[1];
  assert.throws(()=>f.service.submit(secret,{...person,consent:false}),e=>e.status===400);
  assert.throws(()=>f.service.submit(secret,{...person,licenseExpires:'2020-01-01'}),e=>e.status===400);
  assert.equal(f.service.submit(secret,person).status,'pending');
  assert.throws(()=>f.service.submit(secret,person),e=>e.status===410);
  const record=f.store.get(b.id);assert.ok(!record.pii.includes(person.fullName));assert.ok(!record.pii.includes(person.passportNumber));assert.equal(f.store.decrypt(record.pii).phone,person.phone);
  assert.throws(()=>f.service.status(b.id,'completed'),e=>e.status===409);
  f.service.status(b.id,'confirmed');f.service.status(b.id,'active');f.service.status(b.id,'completed');
  await f.docs.refresh(b.id);
  const html=await fs.readFile(path.join(f.config.filesDir,'contracts',b.id+'.html'),'utf8');assert.ok(html.includes('Экземпляр 1 из 2'));assert.ok(html.includes('Экземпляр 2 из 2'));assert.ok(html.includes(person.fullName));assert.equal((html.match(/Акт приёма-передачи и возврата к договору/g)||[]).length,2);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(path.join(f.config.filesDir,'reports','clients.xlsx'));assert.equal(workbook.worksheets.length,3);assert.equal(workbook.getWorksheet('Заявки').getCell('C2').value,person.fullName);assert.ok(!JSON.stringify(workbook.model).includes('passportNumber'));
 }finally{await f.close();}
});
test('удаление по сроку очищает базу, файлы и Excel',async()=>{
 const f=await fixture(false);try{
  const b=f.service.create({car:'polo',start:stamp(10),end:stamp(12)});const raw=f.service.claim(new URL(b.telegramUrl).searchParams.get('start'),'555').formUrl.split('=')[1];f.service.submit(raw,person);await f.docs.refresh(b.id);f.service.status(b.id,'cancelled');
  f.store.db.prepare('UPDATE bookings SET closed=? WHERE id=?').run(Date.now()-40*86400000,b.id);await f.docs.purge();assert.equal(f.store.get(b.id).pii,null);await assert.rejects(fs.access(path.join(f.config.filesDir,'contracts',b.id+'.html')));
 }finally{await f.close();}
});
test('API: доступ, CSRF Origin, демо, отчёт, закрытая база',async()=>{
 const f=await fixture();const server=f.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 const auth={Authorization:'Bearer '+f.config.adminToken,'Content-Type':'application/json'};
 try{
  assert.equal((await fetch(base+'/api/admin/bookings')).status,401);
  assert.equal((await fetch(base+'/api/bookings',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.invalid'},body:'{}'})).status,403);
  assert.equal((await fetch(base+'/.env')).status,404);assert.equal((await fetch(base+'/data/rental.sqlite')).status,404);
  assert.equal((await fetch(base+'/api/catalog')).status,200);
  const seed=await fetch(base+'/api/admin/demo',{method:'POST',headers:auth,body:'{}'});assert.equal(seed.status,200,await seed.text());
  const report=await fetch(base+'/api/admin/report',{headers:auth});assert.equal(report.status,200);assert.match(report.headers.get('content-disposition'),/clients.xlsx/);
  const contract=await fetch(base+'/api/admin/bookings/demo-example/contract',{headers:auth});assert.equal(contract.status,200);
  const pay=await fetch(base+'/api/admin/bookings/demo-example/payment',{method:'POST',headers:auth,body:JSON.stringify({amount:1000})});assert.equal(pay.status,200);
  assert.equal((await fetch(base+'/api/admin/bookings/demo-example/payment',{method:'POST',headers:auth,body:'{"amount":-1}'})).status,400);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));await f.close();}
});
test('рабочий запуск блокируется с вымышленными реквизитами',()=>assert.throws(()=>configFromEnv({DEMO_MODE:'false',ADMIN_TOKEN:'a'.repeat(64),DATA_KEY:'b'.repeat(64)}),/заблокирован/));

test('бот: приватные чаты, защищённая ссылка, статус без документов',async()=>{
 const f=await fixture();const original=globalThis.fetch;const sent=[];
 globalThis.fetch=async(url,opts)=>{sent.push(JSON.parse(opts.body));return {ok:true,json:async()=>({ok:true,result:{message_id:1}})};};
 try{
  const b=f.service.create({car:'creta',start:stamp(20),end:stamp(22)});const claim=new URL(b.telegramUrl).searchParams.get('start');
  await f.bot.handle({message:{chat:{id:101,type:'group'},text:'/start '+claim}});assert.equal(sent.length,0);
  await f.bot.handle({message:{chat:{id:101,type:'private'},from:{is_bot:false},text:'/start '+claim}});
  assert.equal(sent.length,1);assert.ok(sent[0].reply_markup.inline_keyboard[0][0].url.includes('/#apply='));
  assert.ok(sent[0].text.includes('Не присылайте паспорт'));assert.ok(!sent[0].text.includes(person.passportNumber));
  await f.bot.handle({message:{chat:{id:101,type:'private'},text:'/status'}});assert.ok(sent[1].text.includes('Ожидает Telegram'));
 }finally{globalThis.fetch=original;await f.close();}
});
