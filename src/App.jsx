import React, { useEffect, useMemo, useRef, useState } from 'react'

/* ===========================
   Color utilities (RGB/HSL)
   =========================== */
function rgbToHsl(r, g, b){
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h,s,l=(max+min)/2;
  if(max===min){h=0; s=0;}
  else{
    const d=max-min;
    s = l>0.5? d/(2-max-min): d/(max+min);
    switch(max){
      case r: h=(g-b)/d + (g<b?6:0); break;
      case g: h=(b-r)/d + 2; break;
      case b: h=(r-g)/d + 4; break;
      default: h=0;
    }
    h/=6;
  }
  return {h:h*360, s:s*100, l:l*100}
}
function hslToRgb(h, s, l){
  h/=360; s/=100; l/=100;
  if(s===0){ const v=Math.round(l*255); return [v,v,v] }
  const hue2rgb=(p,q,t)=>{
    if(t<0)t+=1; if(t>1)t-=1;
    if(t<1/6) return p+(q-p)*6*t;
    if(t<1/2) return q;
    if(t<2/3) return p+(q-p)*(2/3-t)*6;
    return p
  };
  const q=l<0.5? l*(1+s): l+s-l*s; const p=2*l-q;
  const r=hue2rgb(p,q,h+1/3), g=hue2rgb(p,q,h), b=hue2rgb(p,q,h-1/3);
  return [Math.round(r*255),Math.round(g*255),Math.round(b*255)]
}
function rgbToHex(r,g,b){ return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('') }

/* Robust hex parser + normalizer */
function hexToRgb(hex){
  if (!hex || typeof hex !== 'string') return [0,0,0];
  let m = hex.trim();
  if (!m.startsWith('#')) m = '#'+m;
  if (m.length === 4) { m = '#'+[...m.slice(1)].map(ch=>ch+ch).join(''); }
  const r = parseInt(m.slice(1,3),16);
  const g = parseInt(m.slice(3,5),16);
  const b = parseInt(m.slice(5,7),16);
  return [isNaN(r)?0:r, isNaN(g)?0:g, isNaN(b)?0:b];
}
function normalizeHex(hex){ const [r,g,b]=hexToRgb(hex); return rgbToHex(r,g,b); }
function rotateHue(h,deg){ let x=(h+deg)%360; if(x<0) x+=360; return x }
function hexToHsl(hex){ const [r,g,b]=hexToRgb(hex); return rgbToHsl(r,g,b) }
function ensureContrastHex(bg){
  const [r,g,b]=hexToRgb(bg);
  const lum=v=>{ v/=255; return v<=0.03928? v/12.92: Math.pow((v+0.055)/1.055,2.4)};
  const L=0.2126*lum(r)+0.7152*lum(g)+0.0722*lum(b);
  return L>0.5? '#000':'#fff'
}
function dist3(a,b){ const dr=a[0]-b[0], dg=a[1]-b[1], db=a[2]-b[2]; return dr*dr+dg*dg+db*db }
function hueDist(a,b){ const d=Math.abs(a-b)%360; return d>180? 360-d: d }

/* ===========================
   Perceptual Lab + ΔE2000
   =========================== */
function srgbToLinear(c){ c/=255; return c<=0.04045? c/12.92 : Math.pow((c+0.055)/1.055, 2.4) }
function rgbToXyz([r,g,b]){
  r = srgbToLinear(r); g = srgbToLinear(g); b = srgbToLinear(b);
  const x = r*0.4124564 + g*0.3575761 + b*0.1804375;
  const y = r*0.2126729 + g*0.7151522 + b*0.0721750;
  const z = r*0.0193339 + g*0.1191920 + b*0.9503041;
  return [x,y,z];
}
function xyzToLab([x,y,z]){
  const Xn=0.95047, Yn=1.00000, Zn=1.08883; // D65
  x/=Xn; y/=Yn; z/=Zn;
  const f = t => t>0.008856 ? Math.cbrt(t) : (7.787*t + 16/116);
  const fx=f(x), fy=f(y), fz=f(z);
  const L = (y>0.008856) ? (116*fy - 16) : (903.3*y);
  const a = 500*(fx - fy);
  const b = 200*(fy - fz);
  return [L,a,b];
}
function hexToLab(hex){ return xyzToLab(rgbToXyz(hexToRgb(hex))) }
function deltaE2000(lab1, lab2){
  const [L1,a1,b1]=lab1, [L2,a2,b2]=lab2;
  const avgLp = (L1+L2)/2;
  const C1 = Math.hypot(a1,b1), C2 = Math.hypot(a2,b2);
  const avgC = (C1+C2)/2;
  const G = 0.5*(1 - Math.sqrt(Math.pow(avgC,7)/(Math.pow(avgC,7)+Math.pow(25,7))));
  const a1p=(1+G)*a1, a2p=(1+G)*a2;
  const C1p=Math.hypot(a1p,b1), C2p=Math.hypot(a2p,b2);
  const avgCp=(C1p+C2p)/2;
  const h1p = (Math.atan2(b1,a1p)*180/Math.PI + 360) % 360;
  const h2p = (Math.atan2(b2,a2p)*180/Math.PI + 360) % 360;
  let dhp = h2p - h1p;
  if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360;
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  const dHp = 2*Math.sqrt(C1p*C2p)*Math.sin((dhp*Math.PI/180)/2);
  const avgHp = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + 360)/2 : (h1p + h2p)/2;
  const T = 1 - 0.17*Math.cos((avgHp-30)*Math.PI/180) + 0.24*Math.cos((2*avgHp)*Math.PI/180)
            + 0.32*Math.cos((3*avgHp+6)*Math.PI/180) - 0.20*Math.cos((4*avgHp-63)*Math.PI/180);
  const Sl = 1 + (0.015*Math.pow(avgLp-50,2))/Math.sqrt(20 + Math.pow(avgLp-50,2));
  const Sc = 1 + 0.045*avgCp;
  const Sh = 1 + 0.015*avgCp*T;
  const Rc = 2*Math.sqrt(Math.pow(avgCp,7)/(Math.pow(avgCp,7)+Math.pow(25,7)));
  const Rt = -Rc*Math.sin(2*((30+((avgHp-275)/25))*Math.PI/180));
  return Math.sqrt(
    Math.pow(dLp/Sl,2) + Math.pow(dCp/Sc,2) + Math.pow(dHp/Sh,2) + Rt*(dCp/Sc)*(dHp/Sh)
  );
}

/* ===========================
   Extraction (k-means)
   =========================== */
function kmeans(pixels, k=5, maxIter=12){
  if(pixels.length===0) return [];
  const cents=[]; const picked=new Set();
  while(cents.length<k){
    const idx=Math.floor(Math.random()*pixels.length);
    if(!picked.has(idx)){ cents.push([...pixels[idx]]); picked.add(idx) }
  }
  let assigns=new Array(pixels.length).fill(0);
  for(let it=0; it<maxIter; it++){
    for(let i=0;i<pixels.length;i++){
      let best=0, bestD=Infinity;
      for(let c=0;c<k;c++){ const d=dist3(pixels[i],cents[c]); if(d<bestD){bestD=d; best=c} }
      assigns[i]=best;
    }
    const sums=Array.from({length:k},()=>[0,0,0,0]);
    for(let i=0;i<pixels.length;i++){ const c=assigns[i], p=pixels[i]; sums[c][0]+=p[0]; sums[c][1]+=p[1]; sums[c][2]+=p[2]; sums[c][3]++ }
    let changed=false;
    for(let c=0;c<k;c++){
      if(sums[c][3]===0) continue;
      const nr=[Math.round(sums[c][0]/sums[c][3]),Math.round(sums[c][1]/sums[c][3]),Math.round(sums[c][2]/sums[c][3])];
      if(cents[c][0]!==nr[0]||cents[c][1]!==nr[1]||cents[c][2]!==nr[2]) changed=true;
      cents[c]=nr;
    }
    if(!changed) break;
  }
  const sizes=Array(k).fill(0); for(const a of assigns) sizes[a]++;
  return cents.map((c,i)=>({c,size:sizes[i]})).sort((a,b)=>b.size-a.size).map(o=>o.c)
}

/* ===========================
   Harmonies + anti-pastel
   =========================== */
function harmonyBase(hex, type){
  const {h,s,l}=hexToHsl(hex);
  const map={
    complementary:[rotateHue(h,180)],
    triadic:[rotateHue(h,120), rotateHue(h,-120)],
    analogous:[rotateHue(h,-30), rotateHue(h,30)],
    splitComplementary:[rotateHue(h,150), rotateHue(h,-150)],
    monochrome:[h],
    tetradic:[rotateHue(h,90), rotateHue(h,180), rotateHue(h,270)],
  };
  return (map[type]||map.complementary).map(H=>({h:H,s,l}))
}
function tweakWearable({h,s,l}, style){
  let variants=[
    {h, s: Math.min(100, s*0.9),  l: Math.max(0, l*0.78)},  // deep (bottom/shoes)
    {h, s: Math.min(100, s*1.0),  l: Math.min(100, l*1.02)},// mid (top)
    {h, s: Math.min(100, s*1.08), l: Math.min(100, l*1.18)},// bright (accent)
  ];
  if(style==='contrast')  variants = variants.map(v=>({ ...v, s: Math.min(100, v.s*1.15) }));
  if(style==='cinematic') variants = variants.map(v=>({ ...v, s: v.s*0.85, l: v.l*0.95 }));
  if(style==='golden')    variants = variants.map(v=>({ ...v, h: rotateHue(v.h, +8) }));
  return variants.map(v=> rgbToHex(...hslToRgb(v.h,v.s,v.l)) )
}
function isClose(hexA, hexB, hTol=12, lTol=12, sTol=14){
  const A=hexToHsl(hexA), B=hexToHsl(hexB);
  return hueDist(A.h,B.h)<hTol && Math.abs(A.l-B.l)<lTol && Math.abs(A.s-B.s)<sTol
}
function uniqueAgainst(existing, candidates){
  const out=[];
  for(const c of candidates){
    if(existing.some(e=>isClose(e,c))) continue;
    if(out.some(e=>isClose(e,c))) continue;
    out.push(c);
  }
  return out;
}

/* Boost vividezza anti-pastello */
function enhanceColor(hex, strength=60){
  if (!hex) return hex;
  const {h,s,l}=hexToHsl(hex);
  const minS = 55 + (strength*0.2);          // 55..75
  const tgtS = Math.max(s, Math.min(80, minS));
  let tgtL = l;
  if (l > 70) tgtL = 65;
  if (l < 25) tgtL = 30;
  let tgtH = h;
  if (s < 25 && h >= 20 && h <= 60) tgtH = h + 8; // beige->ocra più ricco
  return rgbToHex(...hslToRgb(tgtH, tgtS, tgtL));
}

/* ===========================
   Subject heuristics
   =========================== */
function classifySubjectColors(hexes){
  const hsl = hexes.map(h=>({hex:h, ...hexToHsl(h)}));
  const skin = hsl.filter(c=> ( (c.h>=10&&c.h<=55) || (c.h<=15) || (c.h>=55&&c.h<=70) ) && c.s>=15 && c.s<=65 && c.l>=30 && c.l<=80)
                  .sort((a,b)=> Math.abs(50-a.l)-Math.abs(50-b.l))[0]?.hex;
  const hair = hsl.filter(c=> c.l<25).sort((a,b)=>a.l-b.l)[0]?.hex;
  const eye  = hsl.filter(c=> (c.h>=160&&c.h<=260) && c.s>=15 && c.l>=25 && c.l<=65)
                  .sort((a,b)=>b.s-a.s)[0]?.hex;
  return { skin: skin||hexes[0], hair: hair||'#111111', eye: eye||hexes[0] }
}

/* ===========================
   Naming based on HSL (no mismatch)
   =========================== */
function nameForHex(hex){
  const {h,s,l}=hexToHsl(hex);
  const H=((h%360)+360)%360, S=s, L=l;

  // neutrals
  if (S<8 && L>92) return 'White';
  if (S<8 && L<10) return 'Black';
  if (S<10) return L<35?'Charcoal':L<65?'Gray':'Silver';

  // beiges / browns (solo se S bassa e L medio-alta)
  if (H>=20 && H<=55 && S<=25 && L>=60 && L<=92) return L<70?'Tan':'Beige';
  if (H>=20 && H<=55 && S<=30 && L<60) return 'Brown';

  // chromatic bins (coarse ma coerenti)
  const bins = [
    ['Red',     -10,  15],
    ['Orange',   16,  35],
    ['Amber',    36,  45],
    ['Yellow',   46,  60],
    ['Lime',     61, 100],
    ['Green',   101, 150],
    ['Teal',    151, 170],
    ['Cyan',    171, 195],
    ['Sky',     196, 210],
    ['Blue',    211, 250],
    ['Indigo',  251, 275],
    ['Violet',  276, 290],
    ['Magenta', 291, 320],
    ['Pink',    321, 345],
    ['Red',     346, 370],
  ];
  const HH = (H+360)%360;
  let label='Color';
  for (const [lab, a, b] of bins){
    const low=(a+360)%360, high=(b+360)%360;
    const inRange = low<=high? (HH>=low && HH<=high) : (HH>=low || HH<=high);
    if (inRange){ label=lab; break; }
  }
  if (S<22) label = (L<50)?'Muted '+label:'Soft '+label;
  return label;
}

/* ===========================
   Perceptual ranking
   =========================== */
function scoreCandidate(hex, sceneLabs, skinLab, hairLab, eyeLab, opts){
  const lab = hexToLab(hex);
  const {
    wScene=0.6, wSkin=0.25, wFeatures=0.15,
    targetCroma=30, targetLight=55
  } = opts || {};

  // separazione dallo sfondo
  const sep = sceneLabs.length
    ? sceneLabs.map(s=>deltaE2000(lab,s)).reduce((a,b)=>a+b,0)/sceneLabs.length
    : 0;

  // armonia pelle (evita troppo vicino e troppo lontano)
  let skin = 0;
  if (skinLab){
    const d = deltaE2000(lab, skinLab);
    skin = (d>=12 && d<=55) ? 1 : (d<12 ? d/12 : Math.max(0, 1-(d-55)/25));
  }

  // features (occhi/capelli)
  let feat = 0, count=0;
  for (const f of [hairLab, eyeLab]){
    if(!f) continue;
    const d = deltaE2000(lab, f);
    feat += (d>=20 && d<=70) ? 1 : 0.5*Math.max(0, 1-Math.abs(d-45)/45);
    count++;
  }
  if (count) feat /= count;

  // fotogenicità: croma e luminanza mid
  const chroma = Math.hypot(lab[1], lab[2]);
  const cromaScore = 1 - Math.abs(chroma - targetCroma)/targetCroma;
  const lightScore = 1 - Math.abs(lab[0] - targetLight)/targetLight;

  const total =
    wScene*(sep/100) +
    wSkin*skin +
    wFeatures*feat +
    0.15*Math.max(0, cromaScore) +
    0.1*Math.max(0, lightScore);

  return { score: Math.max(0, Math.min(1, total)), sep };
}

/* === Pipetta: disegna l'immagine con "contain" su un canvas e legge il pixel === */
function drawContain(ctx, img, cw, ch){
  const scale = Math.min(cw / img.width, ch / img.height);
  const w = img.width * scale, h = img.height * scale;
  const dx = (cw - w) / 2, dy = (ch - h) / 2;
  ctx.clearRect(0,0,cw,ch);
  ctx.drawImage(img, dx, dy, w, h);
  return {dx, dy, w, h};
}
function getPixelHexFromImage(src, x, y, cw, ch, pickCanvas){
  return new Promise((resolve)=>{
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = ()=>{
      const canvas = pickCanvas;
      const ctx = canvas.getContext('2d');
      canvas.width = Math.max(1, Math.floor(cw));
      canvas.height = Math.max(1, Math.floor(ch));
      drawContain(ctx, img, canvas.width, canvas.height);
      // clamp click coords
      const px = Math.max(0, Math.min(canvas.width-1, Math.round(x)));
      const py = Math.max(0, Math.min(canvas.height-1, Math.round(y)));
      const data = ctx.getImageData(px, py, 1, 1).data;
      resolve(rgbToHex(data[0], data[1], data[2]));
    };
    img.src = src;
  });
}

/* ===========================
   React component
   =========================== */
export default function App(){
  // --- Selezione manuale soggetto ---
  const [pickTarget, setPickTarget] = useState(null); // 'skin' | 'hair' | 'eye' | null
  const [manualSkin, setManualSkin]   = useState(null);
  const [manualHair, setManualHair]   = useState(null);
  const [manualEye,  setManualEye]    = useState(null);

  // Occhi: auto oppure custom scritto a mano
  const [eyeMode, setEyeMode] = useState('auto'); // 'auto' | 'custom'
  const [customEye, setCustomEye] = useState('#5AA7D9');

  // canvas nascosto per pipetta
  const subjectPickCanvas = useRef(null);

  // images
  const [subjectSrc,setSubjectSrc]=useState(null);
  const [sceneSrc,setSceneSrc]=useState(null);
  // extracted palettes
  const [subjectPalette,setSubjectPalette]=useState([]);
  const [scenePalette,setScenePalette]=useState([]);
  const [kSubject,setKSubject]=useState(5);
  const [kScene,setKScene]=useState(5);
  // style + filters
  const [styleMode,setStyleMode]=useState('neutral'); // neutral | contrast | cinematic | golden
  const [avoidSceneOverlap,setAvoidSceneOverlap]=useState(true);
  const [avoidSubjectOverlap,setAvoidSubjectOverlap]=useState(true);
  const [boost,setBoost]=useState(true);
  const [vivid,setVivid]=useState(70); // 0..100
  // base selection
  const [baseFrom,setBaseFrom]=useState('skin'); // skin | hair | eye | custom
  const [customBase,setCustomBase]=useState('#6aa5ff');
  // output
  const [recommend,setRecommend]=useState({ main:'#777', acc:'#999', shoes:'#222' });
  const [favorites,setFavorites]=useState(()=>{
    try{ return JSON.parse(localStorage.getItem('favPalettes')||'[]') } catch{ return [] }
  });

  const subjectCanvas=useRef(null); const sceneCanvas=useRef(null);

  function onFile(e, which){
    const f=e.target.files?.[0]; if(!f) return;
    const url=URL.createObjectURL(f);
    if(which==='subject') setSubjectSrc(url); else setSceneSrc(url);
  }

  function extract(from){
    const imgSrc= from==='subject'? subjectSrc: sceneSrc; if(!imgSrc) return;
    const canvas= from==='subject'? subjectCanvas.current: sceneCanvas.current;
    const ctx=canvas.getContext('2d');
    const img=new Image(); img.crossOrigin='anonymous';
    img.onload=()=>{
      const maxSide=320;
      const ratio=Math.min(maxSide/img.width,maxSide/img.height,1);
      const w=Math.max(1,Math.floor(img.width*ratio));
      const h=Math.max(1,Math.floor(img.height*ratio));
      canvas.width=w; canvas.height=h; ctx.drawImage(img,0,0,w,h);
      const data=ctx.getImageData(0,0,w,h).data; const pixels=[];
      for(let i=0;i<data.length;i+=4){
        const a=data[i+3]; if(a<200) continue;
        const r=Math.round(data[i]/8)*8, g=Math.round(data[i+1]/8)*8, b=Math.round(data[i+2]/8)*8;
        pixels.push([r,g,b]);
      }
      const k = from==='subject'? kSubject: kScene;
      if(pixels.length<k){ from==='subject'? setSubjectPalette([]): setScenePalette([]); return }
      const cents=kmeans(pixels,k,12);
      let hexes=cents.map(([r,g,b])=>rgbToHex(r,g,b));
      if(boost) hexes = hexes.map(h=>enhanceColor(h, vivid));
      if(from==='subject') setSubjectPalette(hexes); else setScenePalette(hexes);
    };
    img.src=imgSrc;
  }

  // subject tones (skin/hair/eye) stimati
  const subjectTones = useMemo(()=>{
    if(!subjectPalette.length) return {skin:null,hair:null,eye:null};
    return classifySubjectColors(subjectPalette);
  },[subjectPalette]);

  // toni EFFETTIVI = manuali (se presenti) + occhi custom
  const effectiveTones = useMemo(()=>{
    let t = {...subjectTones};
    if (manualSkin) t.skin = manualSkin;
    if (manualHair) t.hair = manualHair;
    if (eyeMode === 'custom' && customEye) t.eye = customEye;
    else if (manualEye) t.eye = manualEye;
    return t;
  }, [subjectTones, manualSkin, manualHair, manualEye, eyeMode, customEye]);

  // base color (usa effectiveTones)
  const baseColor = useMemo(()=>{
    let base;
    if (baseFrom==='skin') base = effectiveTones.skin || subjectPalette[0];
    else if (baseFrom==='hair') base = effectiveTones.hair || subjectPalette[0];
    else if (baseFrom==='eye')  base = effectiveTones.eye  || subjectPalette[0];
    else base = customBase;
    if (!base) base = customBase;
    if (!base) return null;
    return boost ? enhanceColor(base, vivid) : base;
  },[baseFrom, effectiveTones, subjectPalette, customBase, boost, vivid]);

  // suggestions (with perceptual ranking + sep threshold)
  const suggestions = useMemo(()=>{
    if(!baseColor) return [];
    const bases=[...harmonyBase(baseColor,'complementary'), ...harmonyBase(baseColor,'analogous'), ...harmonyBase(baseColor,'splitComplementary')];
    let cands = bases.flatMap(b=> tweakWearable(b, styleMode));
    if(boost) cands = cands.map(h=>enhanceColor(h, vivid));
    if(avoidSceneOverlap && scenePalette.length) cands = uniqueAgainst(scenePalette, cands);
    if(avoidSubjectOverlap && subjectPalette.length) cands = uniqueAgainst(subjectPalette, cands);

    const sceneLabs = (scenePalette||[]).map(hexToLab);
    const skinLab = effectiveTones.skin ? hexToLab(effectiveTones.skin) : null;
    const hairLab = effectiveTones.hair ? hexToLab(effectiveTones.hair) : null;
    const eyeLab  = effectiveTones.eye  ? hexToLab(effectiveTones.eye)  : null;

    // ranking + separazione minima (ΔE medio >= 22); fallback se troppo restrittivo
    const SEP_MIN = 22;
    let ranked = cands
      .map(hex => {
        const {score, sep} = scoreCandidate(hex, sceneLabs, skinLab, hairLab, eyeLab, {
          wScene: 0.6, wSkin: 0.25, wFeatures: 0.15, targetCroma: 30, targetLight: 55
        });
        return {hex, score, sep};
      })
      .sort((a,b)=> b.score - a.score);

    let filtered = ranked.filter(x => x.sep >= SEP_MIN);
    if (filtered.length < 5) filtered = ranked; // fallback se poche opzioni

    const out = filtered.map(x=>x.hex);
    return uniqueAgainst([], out).slice(0,9);
  },[baseColor, styleMode, avoidSceneOverlap, avoidSubjectOverlap, scenePalette, subjectPalette, boost, vivid, effectiveTones]);

  // map to main / accessories / shoes
  useEffect(()=>{
    if(!suggestions.length){ setRecommend({main:'#777',acc:'#999',shoes:'#222'}); return }
    const byL = suggestions.map(h=>({hex:h, l:hexToHsl(h).l})).sort((a,b)=>a.l-b.l);
    const shoes = byL[0]?.hex || suggestions[0];
    const acc   = byL[byL.length-1]?.hex || suggestions[1] || suggestions[0];
    const mid   = byL[Math.floor(byL.length/2)]?.hex || suggestions[0];
    setRecommend({ main: mid, acc: acc, shoes: shoes });
  },[suggestions]);

  function saveFavorite(){
    const next=[{...recommend, base: normalizeHex(baseColor), ts: Date.now()}, ...favorites].slice(0,6);
    setFavorites(next); localStorage.setItem('favPalettes', JSON.stringify(next));
  }
  function clearFavorites(){ setFavorites([]); localStorage.removeItem('favPalettes'); }

  return (
    <div className="min-h-screen w-full bg-neutral-50 text-neutral-900 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Color Advisor — Pianificazione Shooting</h1>
          <div className="flex items-center gap-2 text-sm">
            <select className="border rounded-lg px-2 py-1" value={styleMode} onChange={e=>setStyleMode(e.target.value)}>
              <option value="neutral">Standard</option>
              <option value="contrast">Contrasto alto</option>
              <option value="cinematic">Look cinematografico</option>
              <option value="golden">Golden hour</option>
            </select>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Uploads */}
          <section className="bg-white rounded-2xl shadow p-4 md:p-6 lg:col-span-2">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="font-semibold mb-2">Foto soggetto</div>
                <input type="file" accept="image/*" onChange={e=>onFile(e,'subject')} className="mb-3" />
                {subjectSrc && (
                  <div className="rounded-xl overflow-hidden border mb-3 relative">
                    <img
                      src={subjectSrc}
                      alt="subject"
                      className="w-full max-h-[320px] object-contain bg-neutral-100"
                      style={{ cursor: pickTarget ? 'crosshair' : 'default' }}
                      onClick={async (e)=>{
                        if(!pickTarget) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;
                        const hex = await getPixelHexFromImage(
                          subjectSrc, x, y, rect.width, rect.height, subjectPickCanvas.current
                        );
                        if (pickTarget === 'skin')  setManualSkin(hex);
                        if (pickTarget === 'hair')  setManualHair(hex);
                        if (pickTarget === 'eye')   setManualEye(hex);
                        setPickTarget(null);
                      }}
                      title={pickTarget ? 'Clicca per campionare colore' : 'Attiva pipetta per campionare'}
                    />
                    {pickTarget && (
                      <div className="absolute top-2 left-2 text-xs px-2 py-1 bg-black/70 text-white rounded">
                        Clicca sul punto {pickTarget === 'skin' ? 'pelle' : pickTarget === 'hair' ? 'capelli' : 'occhi'}
                      </div>
                    )}
                  </div>
                )}
                {/* canvas nascosto per pipetta */}
                <canvas ref={subjectPickCanvas} className="hidden" />

                <div className="flex items-center gap-3 text-sm">
                  <label className="flex items-center gap-2">K
                    <input type="range" min={3} max={8} value={kSubject} onChange={e=>setKSubject(Number(e.target.value))} />
                    <span className="w-6 text-center">{kSubject}</span>
                  </label>
                  <button onClick={()=>extract('subject')} disabled={!subjectSrc} className="px-3 py-1.5 rounded-lg bg-black text-white disabled:opacity-40">Estrai palette</button>
                </div>
                <canvas ref={subjectCanvas} className="hidden" />
                {!!subjectPalette.length && (
                  <div className="mt-3">
                    <div className="text-xs opacity-70 mb-1">Palette soggetto</div>
                    <div className="grid grid-cols-5 gap-2">
                      {subjectPalette.map((h,i)=>{
                        const hx = normalizeHex(h);
                        return (
                          <div key={i} className="rounded-lg overflow-hidden border">
                            <div
                              className="h-10 flex items-center justify-center text-[11px]"
                              style={{ backgroundColor: hx, color: ensureContrastHex(hx) }}
                            >
                              {hx.toUpperCase()}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {/* Base chooser */}
                    <div className="flex flex-wrap gap-2 mt-3 text-xs">
                      <label className="flex items-center gap-1"><input type="radio" name="baseFrom" checked={baseFrom==='skin'} onChange={()=>setBaseFrom('skin')} />Base: pelle</label>
                      <label className="flex items-center gap-1"><input type="radio" name="baseFrom" checked={baseFrom==='hair'} onChange={()=>setBaseFrom('hair')} />capelli</label>
                      <label className="flex items-center gap-1"><input type="radio" name="baseFrom" checked={baseFrom==='eye'} onChange={()=>setBaseFrom('eye')} />occhi</label>
                      <label className="flex items-center gap-1"><input type="radio" name="baseFrom" checked={baseFrom==='custom'} onChange={()=>setBaseFrom('custom')} />custom</label>
                      {baseFrom==='custom' && (
                        <input className="border rounded px-2 py-1" value={customBase} onChange={e=>setCustomBase(e.target.value)} />
                      )}
                    </div>

                    {/* Selezione manuale & occhi custom */}
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide opacity-70">Selezione manuale</div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <button
                            className={`px-2 py-1 rounded border ${pickTarget==='skin'?'bg-black text-white':'bg-white'}`}
                            onClick={()=> setPickTarget(pickTarget==='skin'? null : 'skin')}
                          >Pipetta pelle</button>
                          <button
                            className={`px-2 py-1 rounded border ${pickTarget==='hair'?'bg-black text-white':'bg-white'}`}
                            onClick={()=> setPickTarget(pickTarget==='hair'? null : 'hair')}
                          >Pipetta capelli</button>
                          <button
                            className={`px-2 py-1 rounded border ${pickTarget==='eye'?'bg-black text-white':'bg-white'}`}
                            onClick={()=> setPickTarget(pickTarget==='eye'? null : 'eye')}
                          >Pipetta occhi</button>
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="opacity-70 w-10">Pelle</span>
                            <div className="w-6 h-6 rounded border" style={{background: manualSkin||'#fff'}} />
                            <span>{manualSkin ? manualSkin.toUpperCase() : '-'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="opacity-70 w-12">Capelli</span>
                            <div className="w-6 h-6 rounded border" style={{background: manualHair||'#fff'}} />
                            <span>{manualHair ? manualHair.toUpperCase() : '-'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="opacity-70 w-10">Occhi</span>
                            <div className="w-6 h-6 rounded border" style={{background: (eyeMode==='custom'? customEye : manualEye)||'#fff'}} />
                            <span>{(eyeMode==='custom'? customEye : manualEye) ? (eyeMode==='custom'? customEye : manualEye).toUpperCase() : '-'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Occhi: auto/custom */}
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide opacity-70">Occhi</div>
                        <div className="flex items-center gap-3 text-xs">
                          <label className="flex items-center gap-1">
                            <input
                              type="radio"
                              name="eyeMode"
                              checked={eyeMode==='auto'}
                              onChange={()=> setEyeMode('auto')}
                            /> Auto (pipetta o stima)
                          </label>
                          <label className="flex items-center gap-1">
                            <input
                              type="radio"
                              name="eyeMode"
                              checked={eyeMode==='custom'}
                              onChange={()=> setEyeMode('custom')}
                            /> Custom
                          </label>
                          {eyeMode==='custom' && (
                            <>
                              <input
                                className="border rounded px-2 py-1"
                                value={customEye}
                                onChange={e=> setCustomEye(e.target.value)}
                                placeholder="#5AA7D9"
                              />
                              <div className="w-6 h-6 rounded border" style={{background: customEye}} />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="font-semibold mb-2">Foto scenario</div>
                <input type="file" accept="image/*" onChange={e=>onFile(e,'scene')} className="mb-3" />
                {sceneSrc && (
                  <div className="rounded-xl overflow-hidden border mb-3">
                    <img src={sceneSrc} alt="scene" className="w-full max-h-[320px] object-contain bg-neutral-100" />
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <label className="flex items-center gap-2">K
                    <input type="range" min={3} max={8} value={kScene} onChange={e=>setKScene(Number(e.target.value))} />
                    <span className="w-6 text-center">{kScene}</span>
                  </label>
                  <button onClick={()=>extract('scene')} disabled={!sceneSrc} className="px-3 py-1.5 rounded-lg bg-black text-white disabled:opacity-40">Estrai palette</button>
                </div>
                <canvas ref={sceneCanvas} className="hidden" />
                {!!scenePalette.length && (
                  <div className="mt-3">
                    <div className="text-xs opacity-70 mb-1">Palette scenario</div>
                    <div className="grid grid-cols-5 gap-2">
                      {scenePalette.map((h,i)=>{
                        const hx = normalizeHex(h);
                        return (
                          <div key={i} className="rounded-lg overflow-hidden border">
                            <div
                              className="h-10 flex items-center justify-center text-[11px]"
                              style={{ backgroundColor: hx, color: ensureContrastHex(hx) }}
                            >
                              {hx.toUpperCase()}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={avoidSceneOverlap} onChange={e=>setAvoidSceneOverlap(e.target.checked)} /> Evita colori già nello scenario</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={avoidSubjectOverlap} onChange={e=>setAvoidSubjectOverlap(e.target.checked)} /> Evita colori già sul soggetto</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={boost} onChange={e=>setBoost(e.target.checked)} /> Potenzia colori</label>
              {boost && (
                <label className="flex items-center gap-2">Vividezza
                  <input type="range" min={20} max={100} value={vivid} onChange={e=>setVivid(Number(e.target.value))} />
                  <span className="w-8 text-center">{vivid}</span>
                </label>
              )}
            </div>
          </section>

          {/* Suggestions */}
          <section className="bg-white rounded-2xl shadow p-4 md:p-6">
            <div className="mb-3 text-sm opacity-70">Base scelta: <span className="font-semibold">{baseColor ? normalizeHex(baseColor).toUpperCase() : '-'}</span></div>

            <div className="mb-4">
              <div className="text-xs opacity-70 mb-1">Suggerimenti colore (rank percettivo)</div>
              <div className="grid grid-cols-3 gap-2">
                {suggestions.map((h,i)=>{
                  const hx = normalizeHex(h);
                  return (
                    <div key={i} className="rounded-xl overflow-hidden border">
                      <div
                        className="h-10 flex items-center justify-center text-[11px]"
                        style={{ backgroundColor: hx, color: ensureContrastHex(hx) }}
                      >
                        {hx.toUpperCase()}
                      </div>
                    </div>
                  )
                })}

              </div>
            </div>
            <div className="space-y-2">
              {/* 🎯 Vestito principale */}
              <div className="flex items-center gap-3">
                <div className="w-28 text-sm opacity-80">🎯 Vestito principale</div>
                <div className="flex-1 rounded-xl overflow-hidden border">
                  <div className="h-8" style={{ backgroundColor: normalizeHex(recommend.main) }} />
                  <div
                    className="px-3 py-1 text-xs"
                    style={{
                      backgroundColor: normalizeHex(recommend.main),
                      color: ensureContrastHex(normalizeHex(recommend.main)),
                    }}
                  >
                    {nameForHex(recommend.main)} — {normalizeHex(recommend.main).toUpperCase()}
                  </div>
                </div>
              </div>

              {/* 💍 Accessori */}
              <div className="flex items-center gap-3">
                <div className="w-28 text-sm opacity-80">💍 Accessori</div>
                <div className="flex-1 rounded-xl overflow-hidden border">
                  <div className="h-8" style={{ backgroundColor: normalizeHex(recommend.acc) }} />
                  <div
                    className="px-3 py-1 text-xs"
                    style={{
                      backgroundColor: normalizeHex(recommend.acc),
                      color: ensureContrastHex(normalizeHex(recommend.acc)),
                    }}
                  >
                    {nameForHex(recommend.acc)} — {normalizeHex(recommend.acc).toUpperCase()}
                  </div>
                </div>
              </div>

              {/* 👟 Scarpe */}
              <div className="flex items-center gap-3">
                <div className="w-28 text-sm opacity-80">👟 Scarpe</div>
                <div className="flex-1 rounded-xl overflow-hidden border">
                  <div className="h-8" style={{ backgroundColor: normalizeHex(recommend.shoes) }} />
                  <div
                    className="px-3 py-1 text-xs"
                    style={{
                      backgroundColor: normalizeHex(recommend.shoes),
                      color: ensureContrastHex(normalizeHex(recommend.shoes)),
                    }}
                  >
                    {nameForHex(recommend.shoes)} — {normalizeHex(recommend.shoes).toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button onClick={saveFavorite} className="px-3 py-1.5 rounded-lg bg-black text-white">⭐ Salva palette</button>
              {favorites.length > 0 && (
                <button onClick={clearFavorites} className="px-3 py-1.5 rounded-lg border">Svuota preferiti</button>
              )}
            </div>

            {favorites.length > 0 && (
              <div className="mt-4">
                <div className="text-xs opacity-70 mb-1">Preferiti</div>
                <div className="space-y-2">
                  {favorites.map((f, i) => (
                    <div key={i} className="rounded-xl border overflow-hidden">
                      <div className="grid grid-cols-4">
                        <div className="h-8" style={{ backgroundColor: normalizeHex(f.base) }} title="Base" />
                        <div className="h-8" style={{ backgroundColor: normalizeHex(f.main) }} title="Main" />
                        <div className="h-8" style={{ backgroundColor: normalizeHex(f.acc) }} title="Acc" />
                        <div className="h-8" style={{ backgroundColor: normalizeHex(f.shoes) }} title="Shoes" />
                      </div>
                      <div className="px-3 py-1 text-[11px]" style={{ color: '#111' }}>
                        Base {normalizeHex(f.base).toUpperCase()} • Main {normalizeHex(f.main).toUpperCase()} • Acc {normalizeHex(f.acc).toUpperCase()} • Shoes {normalizeHex(f.shoes).toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="mt-8 text-xs opacity-60 leading-relaxed">
          Tip: pipetta pelle/capelli/occhi o inserisci occhi custom. Le raccomandazioni usano sempre i tuoi toni “effettivi”.
        </div>
      </div>
    </div>
  )
}
