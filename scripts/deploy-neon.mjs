import {readFile} from 'node:fs/promises';
import {configuration} from '../server/config.mjs';
const ids=JSON.parse(await readFile(new URL('../config/neon-project.json',import.meta.url),'utf8'));
if(!process.env.NEON_API_KEY)throw Error('Для CLI-публикации нужен NEON_API_KEY в окружении. Не записывайте его в код.');
configuration();
const environment=Object.fromEntries(['ADMIN_TOKEN','DATA_KEY','BOT_TOKEN','BOT_USERNAME','PUBLIC_URL','DEMO_MODE','TELEGRAM_WEBHOOK_SECRET'].filter(k=>process.env[k]!==undefined).map(k=>[k,process.env[k]]));
const form=new FormData();form.append('zip',new Blob([await readFile('dist/function.zip')],{type:'application/zip'}),'function.zip');form.append('runtime','nodejs24');form.append('environment',JSON.stringify(environment));
const root=`https://console.neon.tech/api/v2/projects/${ids.projectId}/branches/${ids.branchId}/functions/${ids.slug}`;
const r=await fetch(root+'/deployments',{method:'POST',headers:{Authorization:'Bearer '+process.env.NEON_API_KEY},body:form});if(!r.ok)throw Error('Публикация не выполнена, HTTP '+r.status);console.log('Публикация отправлена. Проверьте состояние Functions в Neon.');
