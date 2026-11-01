import {startCarMotion} from './car-motion.js?v=1';
// Three tiny cars, three original melodies, one shared audio engine.
const tracks=[
 {id:'sport',name:'Спорт',style:'электро',color:'#8e3948',edge:'#f29b9f',tempo:.19,wave:'triangle',volume:.19,melody:[69,76,81,76,72,76,79,76,67,74,79,74,71,74,77,74,65,72,77,72,69,72,76,72,67,74,79,74,71,74,76,74],roots:[45,43,41,43],chord:[12,19,24],body:'M6 35L18 28L38 26L55 14H75L92 27L109 31L115 40L108 45H12L5 40Z',windows:'M44 26L57 17H73L85 27Z'},
 {id:'retro',name:'Ретро',style:'свинг',color:'#876431',edge:'#f0cd91',tempo:.28,wave:'sine',volume:.24,melody:[72,0,76,79,81,79,76,0,74,0,77,81,83,81,77,0,71,0,74,77,79,77,74,0,72,76,79,76,74,72,67,0],roots:[48,50,43,48],chord:[12,16,19],body:'M6 34Q9 25 25 25L34 12Q38 7 48 7H70Q79 8 85 24L103 26Q113 29 115 40L109 45H11L5 40Z',windows:'M39 23L43 12H66Q73 12 77 24Z'},
 {id:'suv',name:'Внедорожник',style:'чилл',color:'#285a54',edge:'#91ccba',tempo:.38,wave:'sine',volume:.20,melody:[64,0,67,71,0,74,71,0,62,0,66,69,0,73,69,0,60,0,64,67,0,71,67,0,62,0,66,69,0,67,64,0],roots:[40,38,36,38],chord:[12,19,23],body:'M7 32L17 24L31 23L39 6H83L97 24L109 27L114 40L108 45H11L6 40Z',windows:'M38 23L44 10H79L89 24Z'}
];
function carSvg(t){return `<svg class="music-car-shape" viewBox="0 0 120 55" aria-hidden="true"><ellipse cx="62" cy="49" rx="48" ry="3" fill="#0006"/><path d="${t.body}" fill="${t.color}" stroke="${t.edge}" stroke-width="1.5"/><path d="${t.windows}" fill="#0c1a24" stroke="${t.edge}"/><path d="M63 12V24M16 31H30M94 31H109" stroke="${t.edge}" stroke-width="1.5"/><path d="M106 32L113 34" stroke="#ffe6a5" stroke-width="4"/><path d="M8 34H14" stroke="#e27a62" stroke-width="3"/>${[29,92].map(x=>`<g class="music-wheel"><circle cx="${x}" cy="41" r="10" fill="#10191e" stroke="#788f91" stroke-width="2"/><path d="M${x} 35V47M${x-6} 41H${x+6}" stroke="${t.edge}" stroke-width="2"/></g>`).join('')}</svg>`;}
const road=document.createElement('aside');road.className='music-road';road.setAttribute('aria-label','Музыкальные машинки — выберите свою мелодию');
road.innerHTML=`<div class="music-road-line" aria-hidden="true"></div>${tracks.map(t=>`<div class="music-car-trip"><button class="music-car" type="button" data-music="${t.id}" aria-label="${t.name} — включить ${t.style}" aria-pressed="false">${carSvg(t)}<span class="music-car-note" aria-hidden="true">♫</span><span class="music-car-hint">${t.name} · ${t.style}</span></button></div>`).join('')}<button class="music-stop" type="button" hidden>♫ Выключить музыку</button><span class="sr-only" role="status" aria-live="polite"></span>`;
document.body.append(road);
startCarMotion(road);
const cars=[...road.querySelectorAll('.music-car')],stop=road.querySelector('.music-stop'),status=road.querySelector('[role=status]');
const player=document.createElement('section');player.className='music-player';player.setAttribute('aria-label','Управление мелодиями');
player.innerHTML=`<button class="music-player-toggle" type="button" aria-label="Музыка — выбор мелодии" aria-expanded="false" aria-controls="music-player-body">♫ Музыка</button><div id="music-player-body" class="music-player-body" hidden><p class="eyebrow">МУЗЫКА В ДОРОГУ</p><p class="music-now">Выберите настроение поездки</p><div class="music-track-list">${tracks.map(t=>`<button class="music-track" type="button" data-track="${t.id}" aria-label="Мелодия: ${t.style}" aria-pressed="false">▶ ${t.name} · ${t.style}</button>`).join('')}</div><label class="music-volume-label">Громкость <output>45%</output><input class="music-volume" type="range" min="0" max="100" value="45" aria-label="Громкость музыки"></label><p class="music-player-tip">Звук включается только по нажатию.</p></div>`;
road.append(player);const playerToggle=player.querySelector('.music-player-toggle'),playerBody=player.querySelector('.music-player-body'),trackButtons=[...player.querySelectorAll('[data-track]')],volume=player.querySelector('.music-volume');playerBody.append(stop);
function openPlayer(open){playerBody.hidden=!open;playerToggle.setAttribute('aria-expanded',String(open));}
playerToggle.addEventListener('click',()=>openPlayer(playerBody.hidden));
player.addEventListener('keydown',e=>{if(e.key==='Escape'){openPlayer(false);playerToggle.focus();}});
let context,master,timer=null,active=null,busy=false,next=0,step=0;
const voices=new Set(),frequency=n=>440*2**((n-69)/12);
function note(midi,when,length,volume,type='triangle'){
 const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type=type;oscillator.frequency.value=frequency(midi);
 gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(volume,when+.015);gain.gain.exponentialRampToValueAtTime(.0001,when+length);
 oscillator.connect(gain);gain.connect(master);voices.add(oscillator);oscillator.start(when);oscillator.stop(when+length+.03);
 oscillator.onended=()=>{voices.delete(oscillator);oscillator.disconnect();gain.disconnect();};
}
function schedule(){
 if(!active||document.hidden||context.state!=='running')return;
 while(next<context.currentTime+.22){
  const beat=step%32,root=active.roots[Math.floor(beat/8)],tone=active.melody[beat];
  if(tone)note(tone,next,active.tempo*.9,active.volume,active.wave);
  if(step%2===0)note(root+(active.id==='retro'&&step%4===2?7:0),next,active.tempo*1.3,.24,'sine');
  if(step%8===0)for(const offset of active.chord)note(root+offset,next,active.tempo*4,.045,'sine');
  // Alternating eighth notes give the retro melody a swing rhythm.
  next+=active.tempo*(active.id==='retro'?(step%2===0?1.3:.7):1);step++;
 }
}
function stopTimer(){if(timer!==null){clearInterval(timer);timer=null;}}
function silence(){stopTimer();for(const voice of voices){try{voice.stop();}catch{}}voices.clear();}
function run(){stopTimer();next=context.currentTime+.05;schedule();timer=setInterval(schedule,100);}
function showState(){
 cars.forEach((car,i)=>{const t=tracks[i],on=active===t;car.setAttribute('aria-pressed',String(on));car.setAttribute('aria-label',`${t.name} — ${on?'выключить':'включить'} ${t.style}`);car.classList.toggle('is-playing',on);});
 stop.hidden=!active;stop.textContent=active?`♫ ${active.name}: ${active.style} · выключить`:'♫ Выключить музыку';
 status.textContent=active?`Играет ${active.name}: ${active.style}. Нажмите другую машинку для смены музыки.`:'Музыка выключена.';
 trackButtons.forEach((button,i)=>{const t=tracks[i],on=active===t;button.setAttribute('aria-pressed',String(on));button.classList.toggle('selected',on);button.textContent=`${on?'Ⅱ':'▶'} ${t.name} · ${t.style}`;});
 player.querySelector('.music-now').textContent=active?`Сейчас играет: ${active.style}`:'Выберите настроение поездки';playerToggle.textContent=active?`♫ Музыка · ${active.style}`:'♫ Музыка';
}
async function selectTrack(track){
 if(busy)return;busy=true;
 try{
  const same=active===track;silence();
  if(same||!track){active=null;if(context)await context.suspend();}
  else{
   if(!context){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('Ваш браузер не поддерживает музыку.');context=new Audio();master=context.createGain();master.gain.value=Number(volume.value)/100*.65;master.connect(context.destination);}
   await context.resume();if(context.state!=='running')throw Error('Не удалось включить звук. Нажмите ещё раз.');active=track;step=0;run();
  }
  showState();
 }catch(error){active=null;silence();showState();status.textContent=error.message;player.querySelector('.music-now').textContent=error.message;openPlayer(true);}
 finally{busy=false;}
}
cars.forEach((car,i)=>car.addEventListener('click',()=>{openPlayer(true);selectTrack(tracks[i]);}));stop.addEventListener('click',()=>selectTrack(null));
trackButtons.forEach((button,i)=>button.addEventListener('click',()=>selectTrack(tracks[i])));
volume.addEventListener('input',()=>{player.querySelector('output').textContent=volume.value+'%';if(master)master.gain.setTargetAtTime(Number(volume.value)/100*.65,context.currentTime,.03);});
document.addEventListener('visibilitychange',async()=>{
 if(!context||!active)return;
 if(document.hidden){silence();await context.suspend().catch(()=>{});}
 else{try{await context.resume();if(active)run();}catch{active=null;showState();}}
});
window.addEventListener('pagehide',()=>{active=null;silence();context?.suspend().catch(()=>{});showState();});
