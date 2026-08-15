/* 発音と書き出し — 4方式共通
   Audio.render(events, {inst, tail}) -> Promise<AudioBuffer>
     events : [{midi, t, d}]  t と d は秒
*/
(function (root) {
"use strict";

const INSTRUMENTS = [
  ["piano","ピアノ"], ["chip","電子ビット音"], ["box","オルゴール"],
  ["glock","鉄琴"], ["koto","箏"], ["organ","電子オルガン"]
];
const DURLEN = [6,9,12,16,18,24,32,36,48,72,96,144];   // 4分音符 = 24

const freq = m => 440*Math.pow(2,(m-69)/12);

/* 音価番号つきの音符列 -> 事象列。quarter は4分音符の秒数 */
function timed(notes, quarter, gap=0.94) {
  const ev=[]; let t=0.05;
  for (const n of notes) {
    const len = DURLEN[n.dur ?? 5]/24*quarter;
    ev.push({midi:n.midi, t, d:len*gap});
    t += len;
  }
  return ev;
}
/* 等間隔の音高列 -> 事象列 */
function sequence(midis, nps) {
  const dt = 1/nps;
  return midis.map((m,i)=>({midi:m, t:0.05+i*dt, d:dt*0.95}));
}

function noiseBuf(ctx) {
  const b=ctx.createBuffer(1,2048,ctx.sampleRate), d=b.getChannelData(0);
  for (let i=0;i<2048;i++) d[i]=(Math.random()*2-1)*(1-i/2048);
  return b;
}

function schedule(ctx, out, midi, t, gate, inst, nz) {
  const F = freq(midi);
  const add=(type,mul,amp,dec,det)=>{
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type; o.frequency.value=F*mul; if(det) o.detune.value=det;
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(amp,t+0.006);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dec);
    o.connect(g).connect(out); o.start(t); o.stop(t+dec+0.05);
  };
  const sustain=(mul,amp,attack)=>{
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type="sine"; o.frequency.value=F*mul;
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(amp,t+attack);
    g.gain.setValueAtTime(amp,t+Math.max(gate*0.85,attack+0.02));
    g.gain.linearRampToValueAtTime(0,t+gate*0.95+0.06);
    o.connect(g).connect(out); o.start(t); o.stop(t+gate+0.25);
  };
  const D = Math.max(gate, 0.25);
  if (inst==="piano") {
    add("sine",1,0.34,Math.min(D*1.6,2.6)); add("sine",2,0.11,Math.min(D,1.4));
    add("triangle",3,0.045,Math.min(D*0.6,0.8)); add("sine",1,0.12,Math.min(D*1.4,2.2),7);
  } else if (inst==="chip") {
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type="square"; o.frequency.value=F;
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(0.16,t+0.004);
    g.gain.setValueAtTime(0.16,t+gate*0.82);
    g.gain.linearRampToValueAtTime(0,t+gate*0.92);
    o.connect(g).connect(out); o.start(t); o.stop(t+gate+0.06);
  } else if (inst==="box") {
    add("sine",1,0.30,Math.min(D*1.4,2.0)); add("sine",4.2,0.09,Math.min(D*0.5,0.7));
    add("sine",6.9,0.035,0.3);
  } else if (inst==="glock") {
    add("sine",1,0.26,Math.min(D*1.8,3.0)); add("sine",2.76,0.13,Math.min(D,1.6));
    add("sine",5.4,0.05,0.7);
  } else if (inst==="koto") {
    const o=ctx.createOscillator(), g=ctx.createGain(), lp=ctx.createBiquadFilter();
    const dec = Math.min(D*1.3,1.6);
    o.type="sawtooth"; o.frequency.value=F;
    lp.type="lowpass";
    lp.frequency.setValueAtTime(3600,t); lp.frequency.exponentialRampToValueAtTime(700,t+dec*0.5);
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(0.24,t+0.005);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dec);
    o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t+dec+0.1);
    const s=ctx.createBufferSource(), ng=ctx.createGain();
    s.buffer=nz; ng.gain.setValueAtTime(0.1,t); ng.gain.exponentialRampToValueAtTime(0.0001,t+0.09);
    s.connect(ng).connect(out); s.start(t);
  } else {
    sustain(1,0.20,0.07); sustain(2,0.10,0.07); sustain(3,0.055,0.09); sustain(5,0.022,0.11);
  }
}

async function render(events, opts={}) {
  const inst = opts.inst || "piano", sr = 44100;
  const end = events.reduce((m,e)=>Math.max(m, e.t+e.d), 0) + (opts.tail ?? 2.6);
  const OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
  const ctx = new OAC(1, Math.ceil(end*sr), sr);
  const g = ctx.createGain();
  g.gain.value = Math.min(0.85, 1.1/Math.sqrt(opts.voices || 1));
  g.connect(ctx.destination);
  const nz = noiseBuf(ctx);
  for (const e of events) schedule(ctx, g, e.midi, e.t, e.d, inst, nz);
  return ctx.startRendering();
}

function wav(buf) {
  const d=buf.getChannelData(0), n=d.length;
  const ab=new ArrayBuffer(44+n*2), v=new DataView(ab);
  const str=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
  str(0,"RIFF"); v.setUint32(4,36+n*2,true); str(8,"WAVEfmt ");
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,buf.sampleRate,true); v.setUint32(28,buf.sampleRate*2,true);
  v.setUint16(32,2,true); v.setUint16(34,16,true); str(36,"data"); v.setUint32(40,n*2,true);
  for(let i=0;i<n;i++){const s=Math.max(-1,Math.min(1,d[i]));
    v.setInt16(44+i*2, s<0?s*0x8000:s*0x7FFF, true);}
  return new Blob([ab],{type:"audio/wav"});
}
function mp3(buf) {
  if (root.__noLame || typeof root.lamejs==="undefined") return null;
  try {
    const enc=new root.lamejs.Mp3Encoder(1,buf.sampleRate,160);
    const d=buf.getChannelData(0), pcm=new Int16Array(d.length);
    for(let i=0;i<d.length;i++){const s=Math.max(-1,Math.min(1,d[i]));
      pcm[i]=s<0?s*0x8000:s*0x7FFF;}
    const parts=[];
    for(let i=0;i<pcm.length;i+=1152){
      const c=enc.encodeBuffer(pcm.subarray(i,i+1152));
      if(c.length) parts.push(new Uint8Array(c));
    }
    const e=enc.flush(); if(e.length) parts.push(new Uint8Array(e));
    return new Blob(parts,{type:"audio/mpeg"});
  } catch(_) { return null; }
}

root.Audio2 = {INSTRUMENTS, DURLEN, freq, timed, sequence, render, wav, mp3};
})(typeof window !== "undefined" ? window : globalThis);
