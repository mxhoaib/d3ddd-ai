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
  var y=document.getElementById('yr');if(y)y.textContent=new Date().getFullYear();
})();
