import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import service from '../config/service.json' with {type:'json'};
const headers={authorization:'Bearer '+process.env.ADMIN_TOKEN};
async function get(path){const r=await fetch(service.apiBase+path,{headers});if(!r.ok)throw Error('Не удалось скачать файл, HTTP '+r.status);return r;}
try{
 const root=resolve(process.env.FILES_DIR||'private');await mkdir(root+'/reports',{recursive:true});await mkdir(root+'/contracts/node',{recursive:true});
 await writeFile(root+'/reports/clients-node.xlsx',Buffer.from(await (await get('/api/admin/report')).arrayBuffer()));
 const data=await (await get('/api/admin/bookings')).json();let count=0;
 for(const b of data.bookings.filter(x=>x.hasPerson)){if(!/^[a-zA-Z\d-]{1,64}$/.test(b.id))continue;await writeFile(root+'/contracts/node/'+b.id+'.html',await (await get('/api/admin/bookings/'+b.id+'/contract')).text());count++;}
 console.log('Excel и договоры скачаны в '+root+'; договоров: '+count);
}catch{console.error('Экспорт не выполнен. Проверьте ADMIN_TOKEN и доступность API.');process.exitCode=1;}
