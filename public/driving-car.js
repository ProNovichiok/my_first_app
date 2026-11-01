import {startCarMotion} from './car-motion.js?v=1';
// Three cars and three original, locally rendered melodies.
import {tracks} from './music-tracks.js?v=4.3';
function carSvg(t){return `<svg class="music-car-shape" viewBox="0 0 120 55" aria-hidden="true"><ellipse cx="62" cy="49" rx="48" ry="3" fill="#0006"/><path d="${t.body}" fill="${t.color}" stroke="${t.edge}" stroke-width="1.5"/><path d="${t.windows}" fill="#0c1a24" stroke="${t.edge}"/><path d="M63 12V24M16 31H30M94 31H109" stroke="${t.edge}" stroke-width="1.5"/><path d="M106 32L113 34" stroke="#ffe6a5" stroke-width="4"/><path d="M8 34H14" stroke="#e27a62" stroke-width="3"/>${[29,92].map(x=>`<g class="music-wheel"><circle cx="${x}" cy="41" r="10" fill="#10191e" stroke="#788f91" stroke-width="2"/><path d="M${x} 35V47M${x-6} 41H${x+6}" stroke="${t.edge}" stroke-width="2"/></g>`).join('')}</svg>`;}
const road=document.createElement('aside');road.className='music-road';road.setAttribute('aria-label','Музыкальные машинки — выберите свою мелодию');
road.innerHTML=`<div class="music-road-line" aria-hidden="true"></div>${tracks.map(t=>`<div class="music-car-trip"><button class="music-car" type="button" data-music="${t.id}" aria-label="${t.name} — включить ${t.style}" aria-pressed="false">${carSvg(t)}<span class="music-car-note" aria-hidden="true">♫</span><span class="music-car-hint">${t.name} · ${t.style}</span></button></div>`).join('')}<button class="music-stop" type="button" hidden>♫ Выключить музыку</button><span class="sr-only" role="status" aria-live="polite"></span>`;
document.body.append(road);

const cars=[...road.querySelectorAll('.music-car')],stop=road.querySelector('.music-stop'),status=road.querySelector('[role=status]');
const player=document.createElement('section');player.className='music-player';player.setAttribute('aria-label','Управление мелодиями');
player.innerHTML=`<button class="music-player-toggle" type="button" aria-label="Музыка — выбор мелодии" aria-expanded="false" aria-controls="music-player-body">♫ Музыка</button><div id="music-player-body" class="music-player-body" hidden><p class="eyebrow">МУЗЫКА В ДОРОГУ</p><p class="music-now">Выберите настроение поездки</p><div class="music-track-list">${tracks.map(t=>`<button class="music-track" type="button" data-track="${t.id}" aria-label="Мелодия: ${t.style}" aria-pressed="false">▶ ${t.name} · ${t.style}</button>`).join('')}</div><label class="music-volume-label">Громкость <output>45%</output><input class="music-volume" type="range" min="0" max="100" value="45" aria-label="Громкость музыки"></label><p class="music-player-tip">Звук включается только по нажатию.</p></div>`;
road.append(player);const playerToggle=player.querySelector('.music-player-toggle'),playerBody=player.querySelector('.music-player-body'),trackButtons=[...player.querySelectorAll('[data-track]')],volume=player.querySelector('.music-volume');playerBody.append(stop);
function openPlayer(open){playerBody.hidden=!open;playerToggle.setAttribute('aria-expanded',String(open));}
playerToggle.addEventListener('click',()=>openPlayer(playerBody.hidden));
player.addEventListener('keydown',e=>{if(e.key==='Escape'){openPlayer(false);playerToggle.focus();}});
// A native media element works without Web Audio or a permanently running timer.
const audio=document.createElement('audio');audio.preload='none';audio.loop=true;
audio.setAttribute('aria-hidden','true');audio.dataset.musicPlayer='true';road.append(audio);
audio.volume=Number(volume.value)/100;
let active=null,pending=false,request=0;
function stopAudio(){audio.pause();active=null;pending=false;request++;}
function showError(error){
 stopAudio();showState();openPlayer(true);
 const message=error?.name==='NotAllowedError'
  ?'Браузер заблокировал звук. Разрешите звук для сайта и нажмите мелодию ещё раз.'
  :'Не удалось загрузить мелодию. Проверьте соединение и нажмите ещё раз.';
 status.textContent=message;player.querySelector('.music-now').textContent=message;
}
function showState(){
 cars.forEach((car,i)=>{const t=tracks[i],on=active===t;car.setAttribute('aria-pressed',String(on));car.setAttribute('aria-label',`${t.name} — ${on?'выключить':'включить'} ${t.style}`);car.classList.toggle('is-playing',on);});
 stop.hidden=!active;stop.textContent=active?`♫ ${active.name}: ${active.style} · выключить`:'♫ Выключить музыку';
 status.textContent=active?`Играет ${active.name}: ${active.style}. Нажмите другую машинку для смены музыки.`:'Музыка выключена.';
 trackButtons.forEach((button,i)=>{const t=tracks[i],on=active===t;button.setAttribute('aria-pressed',String(on));button.classList.toggle('selected',on);button.textContent=`${on?'Ⅱ':'▶'} ${t.name} · ${t.style}`;});
 player.querySelector('.music-now').textContent=active?`${pending?'Загрузка мелодии':'Сейчас играет'}: ${active.style}`:'Выберите настроение поездки';playerToggle.textContent=active?`♫ Музыка · ${active.style}`:'♫ Музыка';
}
function selectTrack(track){
 const same=active===track;stopAudio();
 if(same||!track){showState();return;}
 active=track;pending=true;const ticket=request;
 audio.src=new URL(`./assets/audio/${track.id}.wav?v=4.3`,import.meta.url).href;
 audio.volume=Number(volume.value)/100;audio.muted=false;showState();
 // Call play synchronously in the click handler, while user activation is valid.
 try{const playing=audio.play();playing?.then(()=>{
  if(ticket!==request)return;pending=false;showState();
 }).catch(error=>{if(ticket===request&&error.name!=='AbortError')showError(error);});}
 catch(error){showError(error);}
}
audio.addEventListener('error',()=>{if(active)showError(audio.error);});
audio.addEventListener('waiting',()=>{if(active){pending=true;showState();}});
audio.addEventListener('playing',()=>{if(active){pending=false;showState();}});
cars.forEach((car,i)=>car.addEventListener('click',()=>{openPlayer(true);selectTrack(tracks[i]);}));
stop.addEventListener('click',()=>selectTrack(null));
trackButtons.forEach((button,i)=>button.addEventListener('click',()=>selectTrack(tracks[i])));
volume.addEventListener('input',()=>{player.querySelector('output').textContent=volume.value+'%';audio.volume=Number(volume.value)/100;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopAudio();showState();}});
window.addEventListener('pagehide',()=>{stopAudio();showState();});
// Motion is decorative: a failure must never prevent music event handlers being installed.
try{startCarMotion(road);}catch(error){console.warn('Анимация машинок недоступна',error);}
