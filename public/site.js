const toggle=document.querySelector('.menu-toggle'),nav=document.querySelector('.header nav');
toggle?.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));nav?.classList.toggle('open',open);toggle.textContent=open?'×':'☰';});
nav?.addEventListener('click',e=>{if(e.target.closest('a')){nav.classList.remove('open');toggle?.setAttribute('aria-expanded','false');if(toggle)toggle.textContent='☰';}});
document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
document.addEventListener('visibilitychange',()=>document.documentElement.classList.toggle('page-paused',document.hidden));
document.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',()=>el.closest('dialog')?.close()));
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
if(document.querySelector('.ambient'))import('./driving-car.js?v=3').catch(()=>{});
