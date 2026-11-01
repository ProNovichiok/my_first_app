const settings=fetch(new URL('./site-config.json',import.meta.url),{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Не удалось загрузить настройки сайта.');return r.json();});
export const runtime=await settings;
const KEY='baltic-drive-pages-demo-v1';
export const statuses={hold:'Ожидает Telegram',pending:'На проверке',confirmed:'Подтверждена',active:'Авто выдано',completed:'Завершена',cancelled:'Отменена',expired:'Истекла'};
export function demoRows(){try{const rows=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(rows)?rows.filter(b=>b&&b.demo===true&&typeof b.id==='string').slice(0,100):[];}catch{return [];}}
function save(rows){try{localStorage.setItem(KEY,JSON.stringify(rows.slice(0,100)));}catch{throw Error('Браузер запретил локальное сохранение. Разрешите хранилище для учебной заявки.');}}
let catalogCache;
export async function catalog(){if(catalogCache)return catalogCache;const url=runtime.mode==='demo'?new URL('./catalog.json',import.meta.url):new URL('api/catalog',new URL('./',import.meta.url));const r=await fetch(url);if(!r.ok)throw Error('Не удалось загрузить каталог. Обновите страницу.');catalogCache=await r.json();return catalogCache;}
export async function api(path,{method='GET',data,token}={}){
 if(runtime.mode!=='demo'){
  const response=await fetch(new URL(path.replace(/^\//,''),new URL('./',import.meta.url)),{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
  if(!response.ok){let message='Не удалось выполнить запрос.';try{message=(await response.json()).error||message;}catch{}throw Error(message);}
  const type=response.headers.get('Content-Type')||'';return type.includes('json')?response.json():response.blob();
 }
 if(path==='/api/catalog')return catalog();
 if(path==='/api/bookings'){
  const c=await catalog(),car=c.cars.find(x=>x.id===data.car),a=Date.parse(data.start+':00+02:00'),b=Date.parse(data.end+':00+02:00');
  if(!car||!Number.isFinite(a)||!Number.isFinite(b)||a<Date.now()+15*60000||b-a<3600000||b-a>90*86400000||a>Date.now()+366*86400000)throw Error('Проверьте даты: от 1 часа до 90 суток, выдача минимум через 15 минут.');
  const rows=demoRows();if(rows.some(x=>x.car===car.id&&!['cancelled','completed','expired'].includes(x.status)&&Date.parse(x.start)<b&&Date.parse(x.end)>a))throw Error('В этом браузере уже есть учебная заявка на эти даты. Измените даты или автомобиль.');
  const days=Math.ceil((b-a)/86400000),payload='d1-'+car.id+'-'+Math.floor(a/60000).toString(36)+'-'+Math.floor(b/60000).toString(36);
  const row={demo:true,id:'DEMO-'+crypto.randomUUID().slice(0,8),car:car.id,start:new Date(a).toISOString(),end:new Date(b).toISOString(),created:Date.now(),days,total:days*car.price,deposit:car.deposit,status:'pending',paid:0,client:'Учебная заявка',phone:null,hasPerson:false};
  save([row,...rows]);return {...row,telegramUrl:'https://t.me/CarArendaKLNGBot?start='+payload};
 }
 if(path==='/api/admin/bookings')return {demo:true,bookings:demoRows(),statuses,filesDir:'Учебные заявки хранятся в этом браузере. Заявки Telegram хранятся на запущенном Java-сервере.'};
 const match=path.match(/^\/api\/admin\/bookings\/([^/]+)\/(status|payment|contract|person)$/);
 if(match){const rows=demoRows(),row=rows.find(b=>b.id===match[1]);if(!row)throw Error('Заявка не найдена.');
  if(match[2]==='status'){const transitions={pending:['confirmed','cancelled'],confirmed:['active','cancelled'],active:['completed']};if(!transitions[row.status]?.includes(data.status))throw Error('Этот переход статуса недоступен.');row.status=data.status;}
  if(match[2]==='payment'){if(!Number.isSafeInteger(data.amount)||data.amount<0||data.amount>row.total)throw Error('Проверьте полученную сумму.');row.paid=data.amount;}
  if(match[2]==='person'){if(!['cancelled','expired'].includes(row.status))throw Error('Сначала отмените заявку.');row.client=null;row.phone=null;}
  if(match[2]==='contract')throw Error('Для демо-заявок доступен фиксированный образец договора.');
  save(rows);return {ok:true,filesReady:true};
 }
 throw Error('Эта операция требует запущенного Java-сервера.');
}
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money=n=>new Intl.NumberFormat('ru-RU').format(Number(n)||0)+' ₽';
export const fmt=s=>new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Kaliningrad'}).format(new Date(s));
export async function download(path,name,token){const result=await api(path,{token});const url=URL.createObjectURL(result);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
