import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {database} from '../server/database.mjs';
import {configuration} from '../server/config.mjs';
import {createApp} from '../server/app.mjs';
const config=configuration(),db=database(config.databaseUrl),client=await db.pool.connect();
try{
 await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(482301004)');
 const testdb={query:(...args)=>client.query(...args),tx:fn=>fn(testdb)},sent=[],app=createApp({config,db:testdb,send:async p=>{sent.push(p);return {message_id:1};}});
 const request=(path,method='GET',data,admin=false,extra={})=>app.fetch(new Request('https://qa.invalid'+path,{method,headers:{Origin:config.allowedOrigin,...(admin?{authorization:'Bearer '+config.adminToken}:{}),...extra},...(data!==undefined?{body:JSON.stringify(data)}:{})}));
 const local=days=>new Date(Date.now()+days*86400000+7200000).toISOString().slice(0,16);
 const body={car:'x3',start:local(100),end:local(103)},created=await request('/api/bookings','POST',body);assert.equal(created.status,201);const b=await created.json();
 assert.equal((await request('/api/bookings','POST',body)).status,409);
 const update={update_id:Date.now(),message:{chat:{id:700000001,type:'private'},text:'/start '+new URL(b.telegramUrl).searchParams.get('start')}},headers={'x-telegram-bot-api-secret-token':config.webhookSecret};
 assert.equal((await request('/telegram','POST',update)).status,403);
 assert.equal((await request('/telegram','POST',update,false,headers)).status,200);
 assert.equal((await request('/telegram','POST',update,false,headers)).status,200);assert.equal(sent.length,1);
 const stored=await app.bookings.get(b.id);assert.equal(stored.status,'pending');assert.ok(!stored.pii.includes('passportNumber'));assert.ok(!stored.chat_enc.includes('700000001'));
 const download=await request(`/api/admin/bookings/${b.id}/contract`,'GET',undefined,true);assert.equal(download.status,200);const html=await download.text();assert.ok(html.includes('Экземпляр 1 из 2'));assert.ok(html.includes('Экземпляр 2 из 2'));
 assert.equal((await request(`/api/admin/bookings/${b.id}/payment`,'POST',{amount:1000},true)).status,200);
 for(const status of ['confirmed','active','completed'])assert.equal((await request(`/api/admin/bookings/${b.id}/status`,'POST',{status},true)).status,200);
 const report=await request('/api/admin/report','GET',undefined,true);assert.equal(report.status,200);const zip=unzipSync(new Uint8Array(await report.arrayBuffer()));assert.ok(strFromU8(zip['xl/workbook.xml']).includes('По месяцам'));assert.ok(strFromU8(zip['xl/worksheets/sheet1.xml']).includes(b.id));
 assert.equal((await request('/api/admin/bookings')).status,401);
 console.log('PostgreSQL integration passed: atomic overlap rejection, encrypted demo data, webhook secret and deduplication, statuses, payment, two contracts, three Excel sheets. All test changes rolled back.');
}catch(e){console.error('PostgreSQL integration failed:',e.name,e.code||'',e instanceof assert.AssertionError?e.message:'Details hidden');process.exitCode=1;}
finally{await client.query('ROLLBACK');client.release();await db.close();}
