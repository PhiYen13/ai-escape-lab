/* Touch controls for Rooms 01–03; keyboard remains unchanged. */
(()=>{'use strict';
const root=document.createElement('div');root.id='touch-controls';root.setAttribute('aria-label','Bộ điều khiển cảm ứng');
root.innerHTML='<div class="touch-dpad"><button data-key="ArrowUp" class="tc-up" aria-label="Đi lên">▲</button><button data-key="ArrowLeft" class="tc-left" aria-label="Sang trái">◀</button><button data-key="ArrowDown" class="tc-down" aria-label="Đi xuống">▼</button><button data-key="ArrowRight" class="tc-right" aria-label="Sang phải">▶</button></div><button class="touch-action" data-key="e" aria-label="Tương tác với đồ vật"><span>✋</span><b>TƯƠNG TÁC</b></button>';
document.body.appendChild(root);
const held=new Map();const dispatch=(type,key)=>window.dispatchEvent(new KeyboardEvent(type,{key,bubbles:true,cancelable:true}));
function release(pointer){const key=held.get(pointer);if(!key)return;held.delete(pointer);if(![...held.values()].includes(key))dispatch('keyup',key)}
function releaseAll(){for(const pointer of [...held.keys()])release(pointer)}
root.querySelectorAll('[data-key]').forEach(button=>{
 button.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();const key=button.dataset.key;if(key==='e'){dispatch('keydown','e');dispatch('keyup','e');return}held.set(e.pointerId,key);button.setPointerCapture(e.pointerId);dispatch('keydown',key);button.classList.add('pressed')});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,e=>{release(e.pointerId);button.classList.remove('pressed')});
 button.addEventListener('contextmenu',e=>e.preventDefault());
});
function update(){const active=['room','room2','room3'].some(id=>{const el=document.getElementById(id);return el&&!el.classList.contains('hidden')});const modal=!!document.querySelector('#modal:not(.hidden),#r2-dialog:not(.hidden),#r3-dialog:not(.hidden),#r2-intro:not(.hidden),#avatar-picker:not(.hidden)');const touch=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;const visible=touch&&active&&!modal;root.classList.toggle('tc-visible',visible);if(!visible)releaseAll()}
new MutationObserver(update).observe(document.body,{attributes:true,attributeFilter:['class'],subtree:true});window.addEventListener('blur',releaseAll);window.addEventListener('pagehide',releaseAll);window.addEventListener('resize',update);update();
})();
