/* Additive editorial layer; leave Framer's rendering and navigation in charge. */
(()=>{
function enhance(){
 const main=document.querySelector('main');if(main){main.id='roomly-main';main.tabIndex=-1;}
 const hero=document.querySelector('section[data-framer-name="Hero"]');
 if(hero&&!document.querySelector('.roomly-life')){
 const section=document.createElement('section');section.className='roomly-life';section.setAttribute('aria-label','Shared living');
 section.innerHTML='<img src="/images/shared-home.jpg" alt="Housemates sharing a relaxed meal in a bright kitchen" width="1200" height="960" loading="lazy"><div><span class="eyebrow">Spaces for people. Clarity for you.</span><h2>Behind every room,<br>there’s a life.</h2><p>Shared kitchens. New beginnings. A place to call home. Keep the details of running a property together, so there’s more time for the people who make it one.</p><a href="/#feature">Explore Roomly →</a></div>';
 hero.after(section);
 }
 document.querySelectorAll('.ticker-item').forEach(e=>e.parentElement.setAttribute('role','list'));
 document.querySelectorAll('[data-highlight="true"][tabindex]:not(a):not(button)').forEach(el=>{
  el.setAttribute('role','button');
  if(el.matches('.framer-deahm2'))el.setAttribute('aria-label','Toggle navigation');
 });
 // The template includes separate desktop/mobile variants. Enhance each visible control.
 document.querySelectorAll('a').forEach(a=>{if(a.textContent.trim()==='Log in')a.href='https://roomly-kappa.vercel.app/en/login';});
 if(location.hash==='#features')document.getElementById('feature')?.scrollIntoView();
}
let queued=false;new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;enhance()})}}).observe(document.documentElement,{childList:true,subtree:true});
enhance();
})();
