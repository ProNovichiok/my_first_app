import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const hash=s=>crypto.createHash('sha256').update(String(s)).digest('hex');
export const token=()=>crypto.randomBytes(24).toString('base64url');
export function openStore(config){
 fs.mkdirSync(config.dataDir,{recursive:true,mode:0o700});
 const db=new DatabaseSync(path.join(config.dataDir,'rental.sqlite'));
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY,car TEXT NOT NULL,start TEXT NOT NULL,end TEXT NOT NULL,days INTEGER NOT NULL,total INTEGER NOT NULL,deposit INTEGER NOT NULL,status TEXT NOT NULL,expires INTEGER NOT NULL,created INTEGER NOT NULL,claim_hash TEXT UNIQUE,chat_hash TEXT,chat_enc TEXT,form_hash TEXT UNIQUE,form_expires INTEGER,pii TEXT,consent TEXT,terms TEXT NOT NULL,closed INTEGER,paid INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,at INTEGER NOT NULL,booking TEXT,event TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
 if(!db.prepare('PRAGMA table_info(bookings)').all().some(c=>c.name==='closed'))db.exec('ALTER TABLE bookings ADD COLUMN closed INTEGER');
 const key=Buffer.from(config.key,'hex');
 function encrypt(value){const iv=crypto.randomBytes(12);const c=crypto.createCipheriv('aes-256-gcm',key,iv);const data=Buffer.concat([c.update(JSON.stringify(value),'utf8'),c.final()]);return [iv,c.getAuthTag(),data].map(b=>b.toString('base64')).join('.');}
 function decrypt(value){if(!value)return null;const [iv,tag,data]=value.split('.').map(x=>Buffer.from(x,'base64'));const d=crypto.createDecipheriv('aes-256-gcm',key,iv);d.setAuthTag(tag);return JSON.parse(Buffer.concat([d.update(data),d.final()]).toString());}
 function audit(id,event){db.prepare('INSERT INTO audit(at,booking,event) VALUES(?,?,?)').run(Date.now(),id,event);}
 function expire(){db.prepare("UPDATE bookings SET status='expired',closed=expires,claim_hash=NULL,form_hash=NULL WHERE status IN ('hold','pending') AND expires < ?").run(Date.now());}
 function overlaps(car,start,end,except=''){expire();return !!db.prepare("SELECT id FROM bookings WHERE car=? AND start < ? AND end > ? AND id != ? AND status IN ('hold','pending','confirmed','active') LIMIT 1").get(car,end,start,except);}
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const v=fn();db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}}
 function purge(){expire();const cutoff=Date.now()-config.company.applicationRetentionDays*86400000;return db.prepare("SELECT id FROM bookings WHERE status IN ('expired','cancelled') AND COALESCE(closed,created) < ? AND (pii IS NOT NULL OR chat_enc IS NOT NULL)").all(cutoff).map(r=>r.id);}
 return {db,encrypt,decrypt,audit,expire,overlaps,transaction,purge,get:id=>db.prepare('SELECT * FROM bookings WHERE id=?').get(id)};
}