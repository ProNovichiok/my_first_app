const $=s=>document.querySelector(s);let key='',bookings=[],statuses={},cars=[];
const money=n=>new Intl.NumberFormat('ru-RU').format(n)+' ₽';
const date=s=>new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Kaliningrad'}).format(new Date(s));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url,options={}){const r=await fetch(url,{...options,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'}});if(!r.ok){const d=await r.json();throw Error(d.error);}return r;}
function message(s,error=false){$('#message').textContent=s;$('#message').classList.toggle('error',error);}
function render(){
 const filter=$('#filter').value;const rows=bookings.filter(b=>!filter||b.status===filter);
 const clients=new Set(bookings.filter(b=>b.phone).map(b=>b.phone)).size;
 $('#stats').innerHTML=[['Заявок на экране',bookings.length],['Уникальных клиентов',clients],['Автомобилей выдано',bookings.filter(b=>b.status==='active').length],['Получено аренды',money(bookings.reduce((n,b)=>n+b.paid,0))]].map(([label,v])=>`<div class="stat">${label}<strong>${v}</strong></div>`).join('');
 $('#rows').innerHTML=rows.map(b=>`<tr><td><b>${esc(b.id.slice(0,8))}</b><br>${esc(b.client||'Анкета не заполнена')}<br>${esc(b.phone||'')}<br><small>${date(b.created)}</small></td><td>${esc(cars.find(c=>c.id===b.car)?.name||b.car)}<br>${date(b.start)}<br>→ ${date(b.end)}<br>${b.days} сут.</td><td>${money(b.total)}<br>Залог: ${money(b.deposit)}<br><label>Получено аренды<br><input class="admin-paid" aria-label="Получено аренды по заявке ${esc(b.id)}" type="number" min="0" max="${b.total}" step="1" value="${b.paid}" data-paid="${esc(b.id)}"></label><button data-pay="${esc(b.id)}">Сохранить оплату</button></td><td><span class="badge">${esc(statuses[b.status])}</span></td><td>${b.hasPerson?`<button data-contract="${esc(b.id)}">Договор × 2 + акты</button>`:''}${({pending:[['confirmed','Подтвердить'],['cancelled','Отменить']],hold:[['cancelled','Отменить']],confirmed:[['active','Авто выдано'],['cancelled','Отменить']],active:[['completed','Авто возвращено']]}[b.status]||[]).map(([s,label])=>`<button data-id="${esc(b.id)}" data-status="${s}">${label}</button>`).join('')}${['cancelled','expired'].includes(b.status)?`<button data-delete="${esc(b.id)}">Удалить личные данные</button>`:''}</td></tr>`).join('')||'<tr><td colspan="5">Заявок пока нет. Начните с каталога или создайте демонстрационный пример.</td></tr>';
}
async function load(){const data=await (await api('/api/admin/bookings')).json();bookings=data.bookings;statuses=data.statuses;$('#dashboard').hidden=false;$('#login').hidden=true;$('#demo-notice').hidden=!data.demo;$('#seed').hidden=!data.demo;$('#files').textContent='Файлы на компьютере: '+data.filesDir+' · contracts/ — договоры; consents/ — согласия; reports/clients.xlsx — отчёт.';if($('#filter').options.length===1)Object.entries(statuses).forEach(([s,label])=>$('#filter').add(new Option(label,s)));render();}
async function download(url,name){const r=await api(url);const blob=await r.blob();const href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(href),3000);}
$('#login').addEventListener('submit',async e=>{e.preventDefault();key=$('#key').value;try{cars=(await(await fetch('/api/catalog')).json()).cars;await load();$('#key').value='';message('Доступ открыт.');}catch(err){key='';message(err.message,true);}});
$('#logout').addEventListener('click',()=>{key='';bookings=[];$('#rows').replaceChildren();$('#dashboard').hidden=true;$('#login').hidden=false;message('Вы вышли.');});
$('#reload').addEventListener('click',()=>load().catch(e=>message(e.message,true)));
$('#filter').addEventListener('change',render);
$('#report').addEventListener('click',()=>download('/api/admin/report','clients.xlsx').catch(e=>message(e.message,true)));
$('#seed').addEventListener('click',async()=>{try{await api('/api/admin/demo',{method:'POST',body:'{}'});await load();message('Вымышленная заявка создана. Договор и Excel сохранены локально.');}catch(e){message(e.message,true);}});
$('#rows').addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;b.disabled=true;
 try{
  if(b.dataset.contract)await download('/api/admin/bookings/'+b.dataset.contract+'/contract','contract-'+b.dataset.contract+'.html');
  if(b.dataset.status){await api('/api/admin/bookings/'+b.dataset.id+'/status',{method:'POST',body:JSON.stringify({status:b.dataset.status})});await load();message('Статус обновлён.');}
  if(b.dataset.pay){const input=document.querySelector('[data-paid="'+CSS.escape(b.dataset.pay)+'"]');await api('/api/admin/bookings/'+b.dataset.pay+'/payment',{method:'POST',body:JSON.stringify({amount:Number(input.value)})});await load();message('Сумма полученной аренды сохранена.');}
  if(b.dataset.delete&&confirm('Удалить личные данные, локальный договор и согласие по этой незаключённой заявке? Копии, уже скачанные вручную, удаляются отдельно.')){await api('/api/admin/bookings/'+b.dataset.delete+'/person',{method:'DELETE'});await load();message('Личные данные удалены. Проверьте отдельно скачанные копии и резервные копии.');}
 }catch(err){message(err.message,true);}finally{b.disabled=false;}
});
window.addEventListener('pagehide',()=>{key='';});
