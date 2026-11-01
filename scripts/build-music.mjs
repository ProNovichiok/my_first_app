// Render our three original melodies once; the browser only plays the WAV files.
import {tracks} from '../public/music-tracks.js';
import {mkdir,writeFile} from 'node:fs/promises';
const rate=22050,folder=new URL('../public/assets/audio/',import.meta.url);
await mkdir(folder,{recursive:true});
for(const track of tracks){
 const samples=new Float64Array(Math.ceil(track.tempo*32*rate));
 const frequency=midi=>440*2**((midi-69)/12);
 function note(midi,time,length,volume,wave='sine'){
  const start=Math.round(time*rate),count=Math.round(length*rate),f=frequency(midi);
  for(let i=0;i<count;i++){
   const t=i/rate,phase=2*Math.PI*f*t;
   const value=wave==='triangle'?2/Math.PI*Math.asin(Math.sin(phase)):Math.sin(phase);
   const envelope=Math.min(1,t/.015)*Math.exp(-5*t/length);
   samples[(start+i)%samples.length]+=value*envelope*volume;
  }
 }
 let time=0;
 for(let step=0;step<32;step++){
  const root=track.roots[Math.floor(step/8)],tone=track.melody[step];
  if(tone)note(tone,time,track.tempo*.9,track.volume,track.wave);
  if(step%2===0)note(root+(track.id==='retro'&&step%4===2?7:0),time,track.tempo*1.3,.24);
  if(step%8===0)for(const offset of track.chord)note(root+offset,time,track.tempo*4,.045);
  time+=track.tempo*(track.id==='retro'?(step%2===0?1.3:.7):1);
 }
 const peak=Math.max(...Array.from({length:64},(_,block)=>{
  let max=0;for(let i=block;i<samples.length;i+=64)max=Math.max(max,Math.abs(samples[i]));return max;
 }));
 if(!peak)throw Error('Empty melody');
 const wav=Buffer.alloc(44+samples.length*2);
 wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
 wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
 wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
 wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);
 for(let i=0;i<samples.length;i++)wav.writeInt16LE(Math.round(samples[i]/peak*.8*32767),44+i*2);
 await writeFile(new URL(track.id+'.wav',folder),wav);
 console.log(track.id+': '+wav.length+' bytes');
}
