import {readBookings,saveBookings,catalog} from './demo-api.js';
const $=s=>document.querySelector(s),data=await catalog();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('ru-RU').format(n)+' ₽';
const date=s=>{const d=new Date(s);return Number.isFinite(+d)?new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Kaliningrad'}).format(d):'—';};
const labels={pending:'На проверке',confirmed:'Подтверждена',active:'Авто выдано',completed:'Завершена',cancelled:'Отменена'};
const next={pending:['confirmed','Подтвердить'],confirmed:['active','Авто выдано'],active:['completed','Авто возвращено']};
function render(){
 const rows=readBookings();
 $('#stats').innerHTML=[['Демо-заявок',rows.length],['На проверке',rows.filter(b=>b.status==='pending').length],['Авто выдано',rows.filter(b=>b.status==='active').length],['Сумма демо-заявок',money(rows.filter(b=>b.status!=='cancelled').reduce((s,b)=>s+Number(b.total||0),0))]].map(([label,value])=>'<div class="stat">'+esc(label)+'<strong>'+esc(value)+'</strong></div>').join('');
 $('#rows').innerHTML=rows.map(b=>'<tr><td>'+esc(b.id)+'</td><td>'+esc(data.cars.find(c=>c.id===b.car)?.name||b.car)+'</td><td>'+esc(date(b.start))+'<br>→ '+esc(date(b.end))+'</td><td>'+esc(money(b.total))+'<br>Залог: '+esc(money(b.deposit))+'</td><td><span class="badge">'+esc(labels[b.status]||b.status)+'</span>'+(next[b.status]?'<button data-id="'+esc(b.id)+'" data-status="'+next[b.status][0]+'">'+next[b.status][1]+'</button>':'')+(['pending','confirmed'].includes(b.status)?'<button data-id="'+esc(b.id)+'" data-status="cancelled">Отменить</button>':'')+'</td></tr>').join('')||'<tr><td colspan="5">Пока нет демо-заявок. Выберите автомобиль в каталоге.</td></tr>';
}
$('#rows').addEventListener('click',e=>{const button=e.target.closest('[data-status]');if(!button)return;const rows=readBookings(),row=rows.find(b=>b.id===button.dataset.id);if(!row)return;const status=button.dataset.status;if(status!=='cancelled'&&next[row.status]?.[0]!==status)return;row.status=status;try{saveBookings(rows);render();$('#message').textContent='Изменён статус учебной заявки только в этом браузере.';}catch(err){$('#message').textContent=err.message;}});
render();
