// A small CSS car and an original, locally synthesised driving melody.
const road=document.createElement('aside');
road.className='music-road';
road.setAttribute('aria-label','Музыкальная машинка');
road.innerHTML=`<div class="music-road-line" aria-hidden="true"></div><div class="music-car-trip"><button class="music-car" type="button" aria-label="Включить музыку — нажмите на машинку" aria-pressed="false"><svg class="music-car-shape" viewBox="0 0 120 55" aria-hidden="true"><ellipse cx="62" cy="47" rx="48" ry="4" fill="#0006"/><path d="M9 33L16 23L34 21L48 8H77L94 23L108 27L114 39L108 44H12L6 39Z" fill="#224d50" stroke="#93c8bc" stroke-width="1.5"/><path d="M41 21L51 12H73L85 22Z" fill="#0c1a24" stroke="#6aada2"/><path d="M63 12V22M17 28H31M90 30H108" stroke="#dfad69" stroke-width="2"/><path d="M105 30L114 32" stroke="#ffe6a5" stroke-width="4"/><path d="M9 33H15" stroke="#e27a62" stroke-width="3"/><g class="music-wheel"><circle cx="29" cy="41" r="10" fill="#10191e" stroke="#788f91" stroke-width="2"/><path d="M29 35V47M23 41H35" stroke="#dfad69" stroke-width="2"/></g><g class="music-wheel"><circle cx="92" cy="41" r="10" fill="#10191e" stroke="#788f91" stroke-width="2"/><path d="M92 35V47M86 41H98" stroke="#dfad69" stroke-width="2"/></g></svg><span class="music-car-note" aria-hidden="true">♫</span><span class="music-car-hint">Нажми · музыка</span></button></div><button class="music-stop" type="button" hidden>♫ Выключить музыку</button><span class="sr-only" role="status" aria-live="polite"></span>`;
document.body.append(road);
const car=road.querySelector('.music-car'),stop=road.querySelector('.music-stop'),status=road.querySelector('[role=status]');
let context,master,timer=null,playing=false,busy=false,next=0,step=0;
const voices=new Set();
const melody=[64,67,71,74,71,67,69,71,62,66,69,74,69,66,67,69,60,64,67,72,71,67,64,67,62,66,69,71,69,66,62,59];
const roots=[40,38,36,38];
const frequency=n=>440*2**((n-69)/12);
function note(midi,when,length,volume,type='triangle'){
 const oscillator=context.createOscillator(),gain=context.createGain();
 oscillator.type=type;oscillator.frequency.value=frequency(midi);
 gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(volume,when+.015);gain.gain.exponentialRampToValueAtTime(.0001,when+length);
 oscillator.connect(gain);gain.connect(master);voices.add(oscillator);oscillator.start(when);oscillator.stop(when+length+.03);
 oscillator.onended=()=>{voices.delete(oscillator);oscillator.disconnect();gain.disconnect();};
}
function schedule(){
 if(!playing||document.hidden||context.state!=='running')return;
 while(next<context.currentTime+.22){
  const beat=step%32,root=roots[Math.floor(beat/8)];
  note(melody[beat],next,.23,.22);
  if(step%2===0)note(root,next,.32,.26,'sine');
  if(step%8===0)for(const offset of [12,19,24])note(root+offset,next,1.15,.045,'sine');
  next+=.25;step++;
 }
}
function stopTimer(){if(timer!==null){clearInterval(timer);timer=null;}}
function silence(){stopTimer();for(const voice of voices){try{voice.stop();}catch{}}voices.clear();}
function run(){stopTimer();next=context.currentTime+.05;schedule();timer=setInterval(schedule,100);}
function showState(){
 car.setAttribute('aria-pressed',String(playing));car.setAttribute('aria-label',playing?'Выключить музыку — нажмите на машинку':'Включить музыку — нажмите на машинку');
 stop.hidden=!playing;road.classList.toggle('music-playing',playing);status.textContent=playing?'Музыка включена. Повторное нажатие выключит её.':'Музыка выключена.';
}
async function toggleMusic(){
 if(busy)return;busy=true;
 try{
  if(playing){playing=false;silence();await context.suspend();}
  else{
   if(!context){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('Ваш браузер не поддерживает музыку.');context=new Audio();master=context.createGain();master.gain.value=.18;master.connect(context.destination);}
   await context.resume();if(context.state!=='running')throw Error('Не удалось включить звук. Нажмите ещё раз.');playing=true;step=0;run();
  }
  showState();
 }catch(error){playing=false;silence();showState();status.textContent=error.message;}
 finally{busy=false;}
}
car.addEventListener('click',toggleMusic);stop.addEventListener('click',toggleMusic);
document.addEventListener('visibilitychange',async()=>{
 if(!context||!playing)return;
 if(document.hidden){silence();await context.suspend().catch(()=>{});}
 else{try{await context.resume();if(playing)run();}catch{playing=false;showState();}}
});
window.addEventListener('pagehide',()=>{playing=false;silence();context?.suspend().catch(()=>{});showState();});
