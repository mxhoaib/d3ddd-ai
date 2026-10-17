(function(){
  var els=document.querySelectorAll('.reveal');
  if(!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches){els.forEach(function(e){e.classList.add('in')});}
  else{var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}})},{threshold:.12,rootMargin:'0px 0px -40px 0px'});els.forEach(function(e){io.observe(e)});}
  var links=document.querySelectorAll('.snav a'),map={};links.forEach(function(a){map[a.getAttribute('href').slice(1)]=a});
  if('IntersectionObserver' in window){var so=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(function(l){l.classList.remove('on')});var l=map[e.target.id];if(l)l.classList.add('on');}})},{rootMargin:'-45% 0px -50% 0px'});
  Object.keys(map).forEach(function(id){var s=document.getElementById(id);if(s)so.observe(s)});}
  document.querySelectorAll('[data-plan]').forEach(function(b){b.addEventListener('click',function(){var s=document.querySelector('#wl select');if(s)s.value=b.dataset.plan;})});
  var f=document.getElementById('wl'),err=document.getElementById('err');
  f.addEventListener('submit',function(ev){ev.preventDefault();var d=new FormData(f),n=(d.get('name')||'').trim(),em=(d.get('email')||'').trim();
    if(!n||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){err.textContent='Please enter your name and a valid email.';return;}
    err.textContent='';
    var body='Name: '+n+'\nEmail: '+em+'\nCompany: '+(d.get('company')||'')+'\nInterested plan: '+d.get('plan')+'\n\n'+(d.get('message')||'');
    location.href='mailto:info@d3ddd.com?subject='+encodeURIComponent('D3DDD AI Draft waitlist: '+n)+'&body='+encodeURIComponent(body);});
  // mobile hero: focus on CAD half for readability
  var hs=document.querySelector('.hero-svg'),mq=matchMedia('(max-width:640px)');
  function hv(){if(hs)hs.setAttribute('viewBox',mq.matches?'700 50 490 430':'0 0 1200 560');}
  hv();mq.addEventListener?mq.addEventListener('change',hv):mq.addListener(hv);
  // demo
  var rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $=function(i){return document.getElementById(i)},drop=$('drop'),file=$('file'),proc=$('proc'),cmp=$('cmp'),empty=$('stEmpty'),reset=$('reset'),timers=[],url=null;
  function clear(){timers.forEach(clearTimeout);timers=[];}
  function run(src){clear();empty.hidden=true;cmp.hidden=true;reset.hidden=true;proc.hidden=false;$('procImg').src=src;$('beforeImg').src=src;
    var li=document.querySelectorAll('#stepsAi li'),d=rm?150:900;li.forEach(function(l){l.className=''});
    li.forEach(function(l,i){timers.push(setTimeout(function(){if(i)li[i-1].className='done';l.className='on';},i*d));});
    timers.push(setTimeout(function(){li[li.length-1].className='done';proc.hidden=true;cmp.hidden=false;cmp.classList.add('reveal-in');reset.hidden=false;set(50);$('slider').value=50;},li.length*d+(rm?0:300)));}
  function set(v){$('before').style.clipPath='inset(0 '+(100-v)+'% 0 0)';$('handle').style.left=v+'%';}
  $('slider').addEventListener('input',function(e){set(e.target.value)});
  function useFile(f){if(!f||!/^image\//.test(f.type))return;if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(f);run(url);}
  file.addEventListener('change',function(){useFile(file.files[0]);file.value='';});
  drop.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();file.click();}});
  ['dragenter','dragover'].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.add('over')})});
  ['dragleave','drop'].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.remove('over')})});
  drop.addEventListener('drop',function(e){useFile(e.dataTransfer.files[0])});
  document.querySelectorAll('.samp').forEach(function(b){b.addEventListener('click',function(){run(b.dataset.src)})});
  reset.addEventListener('click',function(){clear();cmp.hidden=true;proc.hidden=true;reset.hidden=true;empty.hidden=false;drop.focus();});
  var y=document.getElementById('yr');if(y)y.textContent=new Date().getFullYear();
})();
