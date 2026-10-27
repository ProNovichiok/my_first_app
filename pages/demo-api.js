const KEY='baltic-drive-pages-demo-v1';
export function readBookings(){try{const data=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(data)?data.filter(x=>x&&typeof x.id==='string'&&x.demo===true).slice(0,100):[];}catch{return [];}}
export function saveBookings(rows){try{localStorage.setItem(KEY,JSON.stringify(rows.slice(0,100)));}catch{throw Error('Браузер запретил сохранение. Разрешите локальное хранилище для демо-заявки.');}}
export async function catalog(){const response=await fetch(new URL('./catalog.json',import.meta.url));if(!response.ok)throw Error('Не удалось загрузить каталог.');return response.json();}
export async function demoRequest(url,options={}){
 if(url==='/api/catalog')return catalog();
 if(url==='/api/bookings'){
  const input=JSON.parse(options.body||'{}'),data=await catalog(),car=data.cars.find(c=>c.id===input.car);
  const start=Date.parse(input.start+':00+02:00'),end=Date.parse(input.end+':00+02:00');
  if(!car||!Number.isFinite(start)||!Number.isFinite(end)||start<Date.now()+15*60000||end-start<3600000||end-start>90*86400000)throw Error('Проверьте автомобиль, даты и время.');
  const days=Math.ceil((end-start)/86400000),rows=readBookings();
  if(rows.some(b=>b.car===car.id&&!['cancelled','completed'].includes(b.status)&&Date.parse(b.start)<end&&Date.parse(b.end)>start))throw Error('В этом браузере уже есть демо-заявка на эти даты. Выберите другое авто или отмените её в демо-кабинете.');
  const row={demo:true,id:'DEMO-'+crypto.randomUUID().slice(0,8),car:car.id,start:new Date(start).toISOString(),end:new Date(end).toISOString(),days,total:days*car.price,deposit:car.deposit,created:Date.now(),status:'pending',paid:0};
  saveBookings([row,...rows]);return {...row,telegramUrl:'https://t.me/CarArendaKLNGBot'};
 }
 throw Error('На GitHub Pages доступна учебная демонстрация. Для этой операции запустите Java-сервер.');
}