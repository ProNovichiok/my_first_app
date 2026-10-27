import {configFromEnv} from './config.js';
import {createApplication} from './app.js';
const config=configFromEnv();const runtime=createApplication(config);
await runtime.docs.purge();
await runtime.docs.report().catch(()=>console.error('Не удалось обновить отчёт. Закройте Excel и повторите экспорт.'));
const server=runtime.app.listen(config.port,config.host,()=>console.log('Балтик Драйв: http://'+config.host+':'+config.port+' · '+(config.demo?'демонстрация':'рабочий режим')));
if(config.botEnabled)runtime.bot.run().catch(()=>console.error('Бот не запущен. Проверьте BOT_TOKEN, PUBLIC_URL, webhook и отдельный процесс бота.'));
const interval=setInterval(()=>{runtime.docs.purge().then(()=>runtime.docs.report()).catch(()=>console.error('Не удалось обновить Excel.'));},3600000);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{clearInterval(interval);runtime.bot.stop();server.close(()=>{runtime.store.db.close();process.exit(0);});});
