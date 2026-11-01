import {database} from '../server/database.mjs';
const db=database(process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL);
try{await db.migrate();console.log('Схема baltic_v4 создана. Существующие схемы не изменены.');}catch(e){console.error('Миграция не выполнена. Код:',e.code||'unknown');process.exitCode=1;}finally{await db.close();}
