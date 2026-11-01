// Independent journeys: random destinations, speed and pauses; no frame loop.
export function startCarMotion(road){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const states=[...road.querySelectorAll('.music-car-trip')].map((el,i)=>({el,shape:el.querySelector('svg'),i,x:0,y:0,animation:null,timer:null,hover:false,focus:false}));
 const maxX=()=>Math.max(0,road.clientWidth-104);
 let previousMax=maxX();
 const held=s=>document.hidden||reduced.matches||s.hover||s.focus;
 function clearPause(s){if(s.timer!==null){clearTimeout(s.timer);s.timer=null;}}
 function position(s){s.el.style.transform=`translate(${s.x}px,${-s.y}px)`;}
 function capture(s){
  if(s.animation){const matrix=new DOMMatrixReadOnly(getComputedStyle(s.el).transform);s.x=matrix.m41;s.y=-matrix.m42;s.animation.onfinish=null;s.animation.cancel();s.animation=null;}
  clearPause(s);
 }
 function queue(s){if(held(s)||s.timer!==null||s.animation)return;s.timer=setTimeout(()=>{s.timer=null;travel(s);},500+Math.random()*2000);}
 function travel(s){
  if(held(s))return;
  const limit=maxX();let x=Math.random()*limit;
  if(Math.abs(x-s.x)<35)x=s.x<limit/2?limit:0;
  const y=Math.random()*44,distance=Math.hypot(x-s.x,y-s.y),speed=24+Math.random()*54;
  s.shape.style.transform=`scaleX(${x>=s.x?1:-1})`;
  s.el.classList.add('is-driving');
  s.animation=s.el.animate([{transform:`translate(${s.x}px,${-s.y}px)`},{transform:`translate(${x}px,${-y}px)`}],{duration:Math.max(1800,distance/speed*1000),easing:'ease-in-out',fill:'forwards'});
  s.animation.onfinish=()=>{s.x=x;s.y=y;position(s);s.animation.cancel();s.animation=null;s.el.classList.remove('is-driving');queue(s);};
 }
 function pause(s){clearPause(s);s.animation?.pause();s.el.classList.remove('is-driving');}
 function resume(s){if(held(s))return;if(s.animation){s.animation.play();s.el.classList.add('is-driving');}else queue(s);}
 function layout(){
  const limit=maxX();
  states.forEach(s=>{capture(s);s.x=Math.min(limit,Math.max(0,previousMax?s.x*limit/previousMax:0));s.y=Math.min(44,Math.max(0,s.y));if(reduced.matches){s.x=limit*s.i/Math.max(1,states.length-1);s.y=0;}position(s);resume(s);});
  previousMax=limit;
 }
 states.forEach(s=>{
  s.x=maxX()*(s.i+.2)/states.length;s.y=Math.random()*44;position(s);
  s.el.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'){s.hover=true;pause(s);}});
  s.el.addEventListener('pointerleave',()=>{s.hover=false;resume(s);});
  s.el.addEventListener('focusin',()=>{s.focus=true;pause(s);});
  s.el.addEventListener('focusout',e=>{s.focus=s.el.contains(e.relatedTarget);resume(s);});
  queue(s);
 });
 document.addEventListener('visibilitychange',()=>states.forEach(s=>document.hidden?pause(s):resume(s)));
 window.addEventListener('resize',layout);reduced.addEventListener('change',layout);
 window.addEventListener('pagehide',()=>states.forEach(pause));
 window.addEventListener('pageshow',()=>states.forEach(resume));
 if(reduced.matches)layout();
}
