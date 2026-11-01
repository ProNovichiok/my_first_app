import pg from 'pg';
import {schema} from './schema.mjs';
const {Pool}=pg;
export function database(url){
 if(!url)throw new Error('DATABASE_URL не настроен.');
 const parsed=new URL(url);if(parsed.hostname.endsWith('.neon.tech'))parsed.searchParams.set('sslmode','verify-full');
 const pool=new Pool({connectionString:parsed.toString(),enableChannelBinding:true,max:2,idleTimeoutMillis:1000,connectionTimeoutMillis:15000,allowExitOnIdle:true});
 pool.on('error',()=>{});
 return {pool,query:(sql,args)=>pool.query(sql,args),async migrate(){const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(482301004)');await c.query(schema);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}},async tx(fn){const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(482301004)');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}},close:()=>pool.end()};
}
