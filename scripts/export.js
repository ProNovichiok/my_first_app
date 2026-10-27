import {configFromEnv} from '../src/config.js';
import {openStore} from '../src/store.js';
import {makeDocumentService} from '../src/documents.js';
const c=configFromEnv(),s=openStore(c),d=makeDocumentService(c,s);
try{for(const b of s.db.prepare('SELECT id FROM bookings WHERE pii IS NOT NULL').all())await d.contract(b.id);await d.report();console.log('Документы и Excel сохранены в '+c.filesDir);}finally{s.db.close();}
