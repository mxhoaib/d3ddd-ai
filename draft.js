/* D3DDD AI Draft — beta browser vectorizer. Plain JS, no dependencies. */
(function(){
'use strict';
var $=function(i){return document.getElementById(i)};
var rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
var MAXD=1200, state=null, url=null, busy=false;
var drop=$('drop'),file=$('file'),proc=$('proc'),cmp=$('cmp'),empty=$('stEmpty'),err=$('stErr'),tools=$('tools'),reset=$('reset');
var steps=document.querySelectorAll('#stepsAi li');
function wait(ms){return new Promise(function(r){setTimeout(r,rm?0:ms)})}
function frame(){return new Promise(function(r){requestAnimationFrame(function(){setTimeout(r,0)})})}
function show(which){[empty,err,proc,cmp,tools,reset].forEach(function(e){e.hidden=true});which.forEach(function(e){e.hidden=false})}
function step(i){steps.forEach(function(l,j){l.className=j<i?'done':(j===i?'on':'')})}

function loadImage(src){return new Promise(function(res,rej){var im=new Image();im.onload=function(){res(im)};im.onerror=function(){rej(new Error('Could not read that image.'))};im.src=src;})}

/* ---- image processing ---- */
function toCanvas(im){
  var w=im.naturalWidth||im.width||1200,h=im.naturalHeight||im.height||840;
  if(/\.svg/i.test(im.src)&&w<MAXD){h=h*MAXD/w;w=MAXD;}           // rasterize vector samples at full size
  var k=Math.min(1,MAXD/Math.max(w,h));w=Math.round(w*k);h=Math.round(h*k);
  var c=document.createElement('canvas');c.width=w;c.height=h;var x=c.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(im,0,0,w,h);return c;
}
function binarize(c){
  var w=c.width,h=c.height,d=c.getContext('2d').getImageData(0,0,w,h).data,g=new Float32Array(w*h),i;
  for(i=0;i<w*h;i++)g[i]=0.299*d[i*4]+0.587*d[i*4+1]+0.114*d[i*4+2];
  var I=new Float64Array((w+1)*(h+1));                                 // integral image
  for(var y=0;y<h;y++){var rs=0;for(var x=0;x<w;x++){rs+=g[y*w+x];I[(y+1)*(w+1)+x+1]=I[y*(w+1)+x+1]+rs;}}
  var r=Math.max(8,Math.round(Math.max(w,h)/40)),b=new Uint8Array(w*h);
  for(y=0;y<h;y++){var y0=Math.max(0,y-r),y1=Math.min(h,y+r+1);for(x=0;x<w;x++){var x0=Math.max(0,x-r),x1=Math.min(w,x+r+1);
    var m=(I[y1*(w+1)+x1]-I[y0*(w+1)+x1]-I[y1*(w+1)+x0]+I[y0*(w+1)+x0])/((y1-y0)*(x1-x0));var v=g[y*w+x];
    b[y*w+x]=(v<m*0.82&&v<215)?1:0;}}
  var n=new Uint8Array(w*h);                                           // denoise: drop specks
  for(y=1;y<h-1;y++)for(x=1;x<w-1;x++){i=y*w+x;if(!b[i])continue;var s=b[i-1]+b[i+1]+b[i-w]+b[i+w]+b[i-w-1]+b[i-w+1]+b[i+w-1]+b[i+w+1];if(s>=2)n[i]=1;}
  var o=new Uint8Array(w*h);                                           // dilate 3x3 to bridge wobble
  for(y=1;y<h-1;y++)for(x=1;x<w-1;x++){i=y*w+x;if(n[i]||n[i-1]||n[i+1]||n[i-w]||n[i+w]||n[i-w-1]||n[i-w+1]||n[i+w-1]||n[i+w+1])o[i]=1;}
  stripText(o,w,h);
  return {w:w,h:h,b:o};
}
/* remove connected components that look like text, symbols or noise (small, or compact and dense) */
function stripText(b,w,h){
  var D=Math.max(w,h),lab=new Int32Array(w*h),st=new Int32Array(w*h),id=0;
  for(var p=0;p<w*h;p++){if(!b[p]||lab[p])continue;id++;var sp=0,n=0,x0=w,x1=0,y0=h,y1=0,pix=[];st[sp++]=p;lab[p]=id;
    while(sp){var q=st[--sp];pix.push(q);n++;var x=q%w,y=(q-x)/w;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
      if(x>0&&b[q-1]&&!lab[q-1]){lab[q-1]=id;st[sp++]=q-1;}if(x<w-1&&b[q+1]&&!lab[q+1]){lab[q+1]=id;st[sp++]=q+1;}
      if(y>0&&b[q-w]&&!lab[q-w]){lab[q-w]=id;st[sp++]=q-w;}if(y<h-1&&b[q+w]&&!lab[q+w]){lab[q+w]=id;st[sp++]=q+w;}}
    var bw=x1-x0+1,bh=y1-y0+1,mx=Math.max(bw,bh),mn=Math.min(bw,bh),dens=n/(bw*bh);
    if(mx<D*0.1||(mn>=D*0.025&&mx<D*0.3&&dens>0.12))for(var k=0;k<pix.length;k++)b[pix[k]]=0;}
}
function preview(B){var c=document.createElement('canvas');c.width=B.w;c.height=B.h;var x=c.getContext('2d'),id=x.createImageData(B.w,B.h);
  for(var i=0;i<B.w*B.h;i++){var v=B.b[i]?20:255;id.data[i*4]=id.data[i*4+1]=id.data[i*4+2]=v;id.data[i*4+3]=255;}x.putImageData(id,0,0);return c.toDataURL('image/png');}

/* scan runs along one axis and cluster them into near-axis-aligned segments (handles hand wobble) */
function detect(B,vertical){
  var W=vertical?B.h:B.w,H=vertical?B.w:B.h,at=vertical?function(u,v){return B.b[u*B.w+v]}:function(u,v){return B.b[v*B.w+u]};
  var minRun=Math.max(18,Math.round(Math.max(B.w,B.h)*0.02)),gap=3,active=[],done=[];
  for(var v=0;v<H;v++){
    var runs=[],s=-1,last=-10;
    for(var u=0;u<W;u++){if(at(u,v)){if(s<0||u-last>gap+1){if(s>=0&&last-s+1>=minRun)runs.push([s,last]);s=u;}last=u;}}
    if(s>=0&&last-s+1>=minRun)runs.push([s,last]);
    var still=[];
    for(var k=0;k<active.length;k++)(active[k].lv>=v-2?still:done).push(active[k]);active=still;
    for(k=0;k<runs.length;k++){var r=runs[k],L=r[1]-r[0]+1,hit=null;
      for(var j=0;j<active.length;j++){var c=active[j];if(c.lv<v&&r[0]<=c.b+gap&&r[1]>=c.a-gap){hit=c;break;}}
      if(hit){hit.a=Math.min(hit.a,r[0]);hit.b=Math.max(hit.b,r[1]);hit.sv+=v*L;hit.sl+=L;hit.v1=v;hit.lv=v;}
      else active.push({a:r[0],b:r[1],sv:v*L,sl:L,v0:v,v1:v,lv:v});}
  }
  done=done.concat(active);
  var minLen=Math.max(36,Math.round(Math.min(B.w,B.h)*0.06)),out=[];
  done.forEach(function(c){var len=c.b-c.a,th=c.v1-c.v0+1,cov=c.sl/(len+1);
    if(len<minLen||cov<2.2)return;                                 // too short, or thin text strokes
    if(th>Math.max(24,len*0.25))return;                            // blobs / hatching / diagonals
    out.push({v:c.sv/c.sl,a:c.a,b:c.b,cov:cov});});
  return out;
}
function groupCoords(segs,tol){                                    // align near-equal coordinates
  var s=segs.slice().sort(function(p,q){return p.v-q.v}),g=[];
  s.forEach(function(x){var G=g[g.length-1];if(G&&x.v-G.last<=tol){G.items.push(x);G.last=x.v;}else g.push({items:[x],last:x.v});});
  g.forEach(function(G){var sw=0,sv=0;G.items.forEach(function(x){var wt=x.b-x.a;sw+=wt;sv+=x.v*wt});var m=sv/sw;G.items.forEach(function(x){x.v=m})});
}
function mergeCollinear(segs,gap){
  segs.sort(function(p,q){return p.v-q.v||p.a-q.a});var out=[];
  segs.forEach(function(x){var o=out[out.length-1];if(o&&Math.abs(o.v-x.v)<0.5&&x.a<=o.b+gap)o.b=Math.max(o.b,x.b);else out.push({v:x.v,a:x.a,b:x.b});});
  return out;
}
function snapEnds(A,Bs,d){                                         // close corners: extend/trim ends onto perpendicular walls
  A.forEach(function(s){['a','b'].forEach(function(e){var best=null,bd=d+1;
    Bs.forEach(function(t){var dd=Math.abs(t.v-s[e]);if(dd<bd&&s.v>=t.a-d&&s.v<=t.b+d){bd=dd;best=t;}});
    if(best)s[e]=best.v;});});
}
function vectorize(B){
  var H=detect(B,false),V=detect(B,true),D=Math.max(B.w,B.h);
  var tol=D*0.012,snap=D*0.03;
  groupCoords(H,tol);groupCoords(V,tol);
  H=mergeCollinear(H,D*0.012);V=mergeCollinear(V,D*0.012);
  snapEnds(H,V,snap);snapEnds(V,H,snap);
  H=mergeCollinear(H,1);V=mergeCollinear(V,1);
  var segs=[];
  H.forEach(function(s){if(s.b-s.a>2)segs.push([s.a,s.v,s.b,s.v])});
  V.forEach(function(s){if(s.b-s.a>2)segs.push([s.v,s.a,s.v,s.b])});
  return segs;
}

/* ---- CAD output ---- */
var SCALES=[20,25,50,75,100,125,150,200,250,300,400,500,750,1000,1250,1500,2000,2500,5000];
function nice(x){var p=Math.pow(10,Math.floor(Math.log10(x))),f=x/p;return (f<1.5?1:f<3.5?2:f<7.5?5:10)*p}
function fmt(m){return (Math.round(m*100)/100).toFixed(2)}
function geometry(widthM){
  var S=state.segs,x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  S.forEach(function(s){x0=Math.min(x0,s[0],s[2]);x1=Math.max(x1,s[0],s[2]);y0=Math.min(y0,s[1],s[3]);y1=Math.max(y1,s[1],s[3]);});
  var k=widthM/Math.max(1,x1-x0);                                  // metres per px
  return {k:k,W:(x1-x0)*k,H:(y1-y0)*k,lines:S.map(function(s){return [(s[0]-x0)*k,(s[1]-y0)*k,(s[2]-x0)*k,(s[3]-y0)*k]})};
}
function buildSVG(widthM){
  var G=geometry(widthM),VW=1000,VH=707,mmU=420/VW;               // A3 landscape: 1 unit = 0.42 mm
  var ax=90,ay=90,aw=760,ah=470;                                    // drawing area (units)
  var N=SCALES[SCALES.length-1];for(var i=0;i<SCALES.length;i++){var u=1000/SCALES[i]/mmU;if(G.W*u<=aw&&G.H*u<=ah){N=SCALES[i];break;}}
  var u=1000/N/mmU,ox=ax+(aw-G.W*u)/2,oy=ay+(ah-G.H*u)/2,X=function(m){return (ox+m*u).toFixed(2)},Y=function(m){return (oy+m*u).toFixed(2)};
  var wall=Math.max(2.5,0.15*u),o=[];
  o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+VW+' '+VH+'" font-family="Helvetica,Arial,sans-serif">');
  o.push('<rect width="'+VW+'" height="'+VH+'" fill="#fff"/>');
  var gs=nice(Math.max(0.5,40/u)),gx='';for(var m=0;ox+m*u<=VW-20;m+=gs)gx+='M'+X(m)+' 20V'+(VH-20);for(m=-gs;ox+m*u>=20;m-=gs)gx+='M'+X(m)+' 20V'+(VH-20);
  for(m=0;oy+m*u<=VH-20;m+=gs)gx+='M20 '+Y(m)+'H'+(VW-20);for(m=-gs;oy+m*u>=20;m-=gs)gx+='M20 '+Y(m)+'H'+(VW-20);
  o.push('<path d="'+gx+'" stroke="#e9edf2" stroke-width="0.6" fill="none"/>');
  o.push('<rect x="20" y="20" width="'+(VW-40)+'" height="'+(VH-40)+'" fill="none" stroke="#111" stroke-width="1.5"/>');
  o.push('<g stroke="#111" stroke-width="'+wall.toFixed(2)+'" stroke-linecap="square" fill="none">');
  G.lines.forEach(function(l){o.push('<line x1="'+X(l[0])+'" y1="'+Y(l[1])+'" x2="'+X(l[2])+'" y2="'+Y(l[3])+'"/>')});o.push('</g>');
  var ty=oy-28,rx=ox+G.W*u+28;                                     // dimension lines
  o.push('<g stroke="#0057b8" stroke-width="0.9" fill="none"><path d="M'+X(0)+' '+(ty)+'H'+X(G.W)+'M'+X(0)+' '+(oy-8)+'V'+(ty-6)+'M'+X(G.W)+' '+(oy-8)+'V'+(ty-6)+
    'M'+(+X(0)-4)+' '+(ty+4)+'l8 -8M'+(+X(G.W)-4)+' '+(ty+4)+'l8 -8'+
    'M'+rx+' '+Y(0)+'V'+Y(G.H)+'M'+(rx-20)+' '+Y(0)+'H'+(rx+6)+'M'+(rx-20)+' '+Y(G.H)+'H'+(rx+6)+'M'+(rx-4)+' '+(+Y(0)+4)+'l8 -8M'+(rx-4)+' '+(+Y(G.H)+4)+'l8 -8"/></g>');
  o.push('<g fill="#0057b8" font-size="12" text-anchor="middle"><text x="'+(ox+G.W*u/2).toFixed(1)+'" y="'+(ty-6)+'">'+fmt(G.W)+' m</text>'+
    '<text transform="translate('+(rx+14)+' '+(oy+G.H*u/2).toFixed(1)+') rotate(90)">'+fmt(G.H)+' m</text></g>');
  // north arrow
  o.push('<g transform="translate(925 75)"><circle r="20" fill="none" stroke="#111" stroke-width="1"/><path d="M0 -16L7 10L0 5L-7 10Z" fill="#111"/><text y="-25" text-anchor="middle" font-size="11" font-weight="700">N</text></g>');
  // scale bar
  var sb=nice(150/u),sx=40,sy=VH-52;o.push('<g font-size="9" fill="#111"><rect x="'+sx+'" y="'+sy+'" width="'+(sb*u/2)+'" height="5" fill="#111"/><rect x="'+(sx+sb*u/2)+'" y="'+sy+'" width="'+(sb*u/2)+'" height="5" fill="none" stroke="#111" stroke-width=".8"/><text x="'+sx+'" y="'+(sy-4)+'">0</text><text x="'+(sx+sb*u)+'" y="'+(sy-4)+'" text-anchor="middle">'+sb+' m</text></g>');
  // title block
  var d=new Date().toISOString().slice(0,10),bx=VW-330,by=VH-90;
  o.push('<g><rect x="'+bx+'" y="'+by+'" width="310" height="70" fill="#fff" stroke="#111" stroke-width="1.2"/><path d="M'+bx+' '+(by+34)+'h310M'+(bx+190)+' '+(by+34)+'v36" stroke="#111" stroke-width=".8"/>'+
    '<text x="'+(bx+12)+'" y="'+(by+22)+'" font-size="14" font-weight="700">D3DDD AI Draft</text><text x="'+(bx+298)+'" y="'+(by+22)+'" font-size="9" text-anchor="end" fill="#555">BETA VECTORIZATION</text>'+
    '<text x="'+(bx+12)+'" y="'+(by+50)+'" font-size="8" fill="#666">DATE</text><text x="'+(bx+12)+'" y="'+(by+63)+'" font-size="11">'+d+'</text>'+
    '<text x="'+(bx+100)+'" y="'+(by+50)+'" font-size="8" fill="#666">SIZE</text><text x="'+(bx+100)+'" y="'+(by+63)+'" font-size="11">'+fmt(G.W)+' × '+fmt(G.H)+' m</text>'+
    '<text x="'+(bx+202)+'" y="'+(by+50)+'" font-size="8" fill="#666">SCALE</text><text x="'+(bx+202)+'" y="'+(by+63)+'" font-size="11">1:'+N+' @ A3</text></g>');
  o.push('</svg>');
  return {svg:o.join(''),G:G,N:N};
}
function buildDXF(G){
  var o=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1009','9','$INSBASE','10','0.0','20','0.0','30','0.0','9','$EXTMIN','10','0.0','20','0.0','30','0.0','9','$EXTMAX','10',G.W.toFixed(4),'20',G.H.toFixed(4),'30','0.0','0','ENDSEC',
    '0','SECTION','2','TABLES','0','TABLE','2','LAYER','70','2',
    '0','LAYER','2','WALLS','70','0','62','7','6','CONTINUOUS','0','LAYER','2','DIMS','70','0','62','5','6','CONTINUOUS','0','ENDTAB','0','ENDSEC',
    '0','SECTION','2','ENTITIES'];
  function line(l,layer){o.push('0','LINE','8',layer,'10',l[0].toFixed(4),'20',(G.H-l[1]).toFixed(4),'30','0.0','11',l[2].toFixed(4),'21',(G.H-l[3]).toFixed(4),'31','0.0');}
  function text(x,y,h,s,rot){o.push('0','TEXT','8','DIMS','10',x.toFixed(4),'20',y.toFixed(4),'30','0.0','40',h.toFixed(4),'1',s);if(rot)o.push('50',String(rot));}
  G.lines.forEach(function(l){line(l,'WALLS')});
  var off=Math.max(0.5,G.W*0.04),th=Math.max(0.15,G.W*0.015);
  line([0,-off,G.W,-off],'DIMS');line([0,0,0,-off*1.2],'DIMS');line([G.W,0,G.W,-off*1.2],'DIMS');
  line([G.W+off,0,G.W+off,G.H],'DIMS');line([G.W,0,G.W+off*1.2,0],'DIMS');line([G.W,G.H,G.W+off*1.2,G.H],'DIMS');
  text(G.W/2-th*2,G.H+off+th*0.4,th,fmt(G.W)+' m');text(G.W+off+th*1.2,G.H/2-th*2,th,fmt(G.H)+' m',90);
  o.push('0','ENDSEC','0','EOF');return o.join('\r\n')+'\r\n';
}
function download(name,blob){var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1000);}

function render(){
  var w=parseFloat($('widthM').value);if(!(w>0&&w<=500)){w=12;}
  state.out=buildSVG(w);$('after').innerHTML=state.out.svg;
  $('stat').textContent=state.segs.length+' wall segments vectorized · '+fmt(state.out.G.W)+' × '+fmt(state.out.G.H)+' m · 1:'+state.out.N;
}

async function run(src){
  if(busy)return;busy=true;state=null;
  show([proc]);$('procImg').src=src;$('beforeImg').src=src;step(0);
  try{
    await frame();var im=await loadImage(src);var c=toCanvas(im);await wait(350);
    step(1);await frame();var B=binarize(c);$('procImg').src=preview(B);await wait(450);
    step(2);await frame();var segs=vectorize(B);await wait(450);
    step(3);await frame();await wait(300);
    if(segs.length<2)throw new Error('No clear straight lines were found. Try a sharper photo with dark lines on plain, evenly lit paper.');
    step(4);state={segs:segs};render();await wait(300);step(5);
    show([cmp,tools,reset]);set(50);$('slider').value=50;
  }catch(e){$('errMsg').textContent=e.message||'Something went wrong processing that image.';show([err,reset]);}
  busy=false;
}
function set(v){$('before').style.clipPath='inset(0 '+(100-v)+'% 0 0)';$('handle').style.left=v+'%';}
$('slider').addEventListener('input',function(e){set(e.target.value)});
$('widthM').addEventListener('input',function(){if(state)render()});
$('dlSvg').addEventListener('click',function(){download('d3ddd-ai-draft.svg',new Blob([state.out.svg],{type:'image/svg+xml'}))});
$('dlDxf').addEventListener('click',function(){download('d3ddd-ai-draft.dxf',new Blob([buildDXF(state.out.G)],{type:'application/dxf'}))});
$('dlPng').addEventListener('click',function(){var im=new Image(),u=URL.createObjectURL(new Blob([state.out.svg],{type:'image/svg+xml'}));
  im.onload=function(){var c=document.createElement('canvas');c.width=2000;c.height=1414;var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);c.toBlob(function(b){download('d3ddd-ai-draft.png',b)},'image/png');};im.src=u;});
function useFile(f){if(!f)return;if(!/^image\//.test(f.type)){$('errMsg').textContent='Please choose an image file (JPG or PNG).';show([err,reset]);return;}
  if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(f);run(url);}
file.addEventListener('change',function(){useFile(file.files[0]);file.value='';});
drop.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();file.click();}});
['dragenter','dragover'].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.add('over')})});
['dragleave','drop'].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.remove('over')})});
drop.addEventListener('drop',function(e){useFile(e.dataTransfer.files[0])});
document.querySelectorAll('.samp').forEach(function(b){b.addEventListener('click',function(){run(b.dataset.src)})});
reset.addEventListener('click',function(){if(busy)return;show([empty]);drop.focus();});
window.__d3dddDraft={buildDXF:function(){return state&&buildDXF(state.out.G)},segs:function(){return state&&state.segs.length}};
})();
