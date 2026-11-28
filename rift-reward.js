/* Three combat phases for the Relic awarded at the end of the Rift battle. */
(() => {
  'use strict';

  const key = '1x1xty';
  const focusShots = 3;
  const bladeSeconds = 6;
  const recoverySeconds = 26;
  const bladeRange = 65;
  const beamRange = 125;
  const beamColor = '#b9ffb5';
  const trailRadius = 20;
  const trailAge = 3;
  const trailBeat = .5;
  const slashColor = '#4ff9af';
  const ink = '#0a191a';
  const phaseNames = ['Импульс','Лазер','Меч'];

  TY[key] = {
    n:'1x1xty', cost:680, dmg:43, rate:.94, rng:118, col:'#a8e171', unique:true, limited:true,
    d:'Relic за победу над 1×1×1×1 в финале «Машины прошлого». Фаза 1 — обычный выстрел. Фаза 2 — лазер сквозь до двух дополнительных целей. Три попадания лазером заряжают фазу 3. Она на 6 с заменяет выстрелы ближним мечом и оставляет на поле след, который 3 с наносит постепенный урон. Перезарядка 26 с. Один на команду.'
  };
  RA[key] = 'Relic';
  MKNS[key] = 'награда за финал «Машины прошлого»';
  EXU.push(key);

  function path(ctx, points, fill, outline, width=2.5) {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const p of points.slice(1)) ctx.lineTo(...p);
    ctx.closePath();
    if (fill) {ctx.fillStyle=fill;ctx.fill()}
    if (outline) {ctx.strokeStyle=outline;ctx.lineWidth=width;ctx.stroke()}
  }

  function glow(ctx,x,y,r,color) {
    const fill = ctx.createRadialGradient(x,y,0,x,y,r);
    fill.addColorStop(0,color);
    fill.addColorStop(1,'transparent');
    ctx.fillStyle=fill;
    ctx.fillRect(x-r,y-r,r*2,r*2);
  }

  function bladeArt(ctx, x, y, rotation, hue) {
    ctx.save();
    ctx.translate(x,y);ctx.rotate(rotation);
    path(ctx,[[0,-30],[7,-18],[5,4],[10,9],[9,16],[3,16],[3,26],[-4,26],[-5,16],[-10,16],[-10,9],[-5,5],[-6,-17]],'#163e35',ink);
    path(ctx,[[0,-25],[4,-16],[3,6],[-2,9],[-3,-15]],hue,'#d6ffd5',1.4);
    path(ctx,[[-8,10],[7,10],[8,13],[-8,13]],'#aaf1a9');
    ctx.restore();
  }

  function portrait(phase) {
    const canvas = thCanvas(144,144), c=canvas.getContext('2d');
    const color = phase===1?'#a7e59b':phase===2?'#eff17e':'#5aefbd';
    const aura = phase===1?'#8ac06844':phase===2?'#a3ff6e66':'#6aefa577';
    const y=80;
    c.lineJoin='round';c.lineCap='round';
    glow(c,72,73,66,aura);
    if(phase===2){
      path(c,[[72,72],[130,45],[141,47],[139,63],[73,82]],'#9cff7b44');
      path(c,[[75,75],[138,53],[136,58],[74,81]],'#b9ffaf');
      c.fillStyle='#e9ffd5';c.fillRect(115,48,10,2);c.fillRect(126,63,9,2);
    }
    if(phase===3){
      bladeArt(c,31,95,-.56,'#a5ffb9');
      bladeArt(c,117,87,.64,'#6cf4da');
    }
    const body=c.createLinearGradient(43,40,102,125);
    body.addColorStop(0,color);body.addColorStop(.44,phase===3?'#398568':phase===2?'#8caa32':'#42845b');body.addColorStop(1,'#142b2b');
    c.beginPath();c.ellipse(72,y,43,43,0,0,Math.PI*2);
    c.fillStyle=body;c.fill();c.strokeStyle=ink;c.lineWidth=3.7;c.stroke();
    c.beginPath();c.arc(72,y,40,2.98,5.5);c.strokeStyle='#e0ffb4a8';c.lineWidth=2;c.stroke();
    const crownHeight=phase===1?19:phase===2?15:13;
    path(c,[[36,51],[40,crownHeight+7],[50,crownHeight+6],[53,35],[65,33],[67,crownHeight],[78,crownHeight],[82,33],[93,35],[95,crownHeight+5],[105,crownHeight+7],[109,50],[99,61],[47,61]],'#18392e',ink,3);
    path(c,[[38,48],[48,44],[59,48],[72,42],[85,48],[97,44],[107,49],[99,56],[47,56]],color,ink,2);
    path(c,[[72,46],[78,50],[72,56],[66,50]],phase===3?'#ec82aa':'#e7fac7');
    for(const [a,b] of [[43,73],[81,73]]){
      path(c,[[a,b-4],[a+20,b+1],[a+17,b+9],[a+3,b+7]],'#152020',null);
      path(c,[[a+3,b],[a+16,b+3],[a+13,b+6],[a+5,b+5]],phase===1?'#f3796e':'#ffb888');
    }
    if(phase===2){
      glow(c,93,78,21,'#efff9ecc');
      path(c,[[94,76],[140,59],[140,65],[94,81]],'#d6ff79','#314f2b',1.2);
      path(c,[[94,77],[139,62],[139,64],[96,80]],'#faffca');
    }
    path(c,[[45,98],[54,102],[63,100],[72,104],[81,100],[92,102],[100,97],[96,111],[82,116],[64,116],[50,111]],'#142326');
    for(let i=0;i<5;i++){
      const px=52+i*9;
      path(c,[[px,101],[px+7,102],[px+4,110]],phase===3?'#c9ffd9':'#e0f6ae');
    }
    if(phase>1){
      c.fillStyle=phase===3?'#83efd4':'#c9ff93';
      for(const [px,py,w] of [[18,68,7],[111,35,7],[24,45,7],[122,104,11],[29,117,7],[84,127,6]]) c.fillRect(px,py,w,2);
    }
    return canvas.toDataURL();
  }

  for(const phase of [1,2,3]){
    const image = new Image();
    const id = key + phase;
    IMG[id] = portrait(phase);
    image.src = IMG[id];
    IM[id] = image;
  }

  function phase(tower, phaseTwo) {
    return tower.riftBlade > 0 ? 3 : phaseTwo ? 2 : 1;
  }

  function range(tower, phaseTwo) {
    const mode = phase(tower,phaseTwo);
    return mode===3 ? bladeRange : mode===2 ? beamRange : TY[key].rng;
  }

  const active = enemy => !enemy.dead && !enemy.po && !inv(enemy);
  function beam(tower,target,damage,point) {
    const vx = point[0]-tower.x, vy = point[1]-tower.y;
    const length = Math.hypot(vx,vy) || 1;
    const candidates=[];
    for(const enemy of G.en){
      if(enemy===target||!active(enemy))continue;
      const [ex,ey]=pos(enemy.d);
      const dx=ex-tower.x,dy=ey-tower.y;
      const along=(dx*vx+dy*vy)/length, across=Math.abs(dx*vy-dy*vx)/length;
      if(along>0 && along<=length+76 && across<=19)candidates.push({enemy,along,ex,ey});
    }
    const secondaries=candidates.sort((a,b)=>a.along-b.along).slice(0,2);
    hit(target,damage);
    secondaries.forEach(({enemy},i)=>hit(enemy,damage*(i===0?.42:.26)));
    const far=secondaries.at(-1), to=far?.along>length?[far.ex,far.ey]:point;
    G.shots.push({a:tower.x,b:tower.y,c:to[0],e:to[1],t:.24,col:beamColor});
    (G.riftSwings ||= []).push({from:[tower.x,tower.y],to,t:.24,mode:2});
    if(!tower.riftRecovery) tower.riftFocus=Math.min(focusShots,(tower.riftFocus||0)+1);
  }

  function slash(tower,target,damage,point) {
    hit(target,damage);
    const from=[tower.x,tower.y];
    const [px,py]=point;
    const alternate=G.en.filter(enemy=>{
      if(enemy===target||!active(enemy))return false;
      const [ex,ey]=pos(enemy.d);
      return Math.hypot(ex-px,ey-py)<=34&&Math.hypot(ex-tower.x,ey-tower.y)<=bladeRange;
    }).sort((a,b)=>b.d-a.d)[0];
    if(alternate)hit(alternate,damage*.48);
    const trails=G.riftTrails ||= [];
    trails.push({from,to:point,t:trailAge});
    while(trails.length>4)trails.shift();
    (G.riftSwings ||= []).push({from,to:point,t:.3,mode:3});
  }

  function attack(tower,target,damage,point,phaseTwo) {
    const mode=phase(tower,phaseTwo);
    const normal=damage/(phaseTwo?2.5*(hwPh()==='mid'?1.5:1):1);
    if(mode===3)slash(tower,target,normal*1.88,point);
    else if(mode===2)beam(tower,target,damage*.73,point);
    else hit(target,damage);
  }

  function nearLine(px,py,{from:[ax,ay],to:[bx,by]}) {
    const dx=bx-ax,dy=by-ay;
    const u=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1)));
    return Math.hypot(px-ax-dx*u,py-ay-dy*u)<=trailRadius;
  }

  function decay(value,dt) {
    return value-dt>1e-6?value-dt:0;
  }

  function tick(dt) {
    const tower=G.units.find(u=>u.k===key);
    if(tower){
      if(tower.riftBlade>0)tower.riftBlade=decay(tower.riftBlade,dt);
      if(tower.riftRecovery>0)tower.riftRecovery=decay(tower.riftRecovery,dt);
    }
    if(G.riftSwings){
      for(const shot of G.riftSwings)shot.t-=dt;
      G.riftSwings=G.riftSwings.filter(shot=>shot.t>0);
    }
    if(!G.riftTrails?.length)return;
    G.riftTrailClock=(G.riftTrailClock||0)+dt;
    if(G.riftTrailClock+1e-6>=trailBeat){
      G.riftTrailClock=Math.max(0,G.riftTrailClock-trailBeat);
      const hitThisTick=new Set(), eligible=G.en.filter(active).sort((a,b)=>b.d-a.d);
      for(const trail of G.riftTrails){
        let slots=4;
        for(const enemy of eligible){
          if(hitThisTick.has(enemy)||!nearLine(...pos(enemy.d),trail))continue;
          hitThisTick.add(enemy);
          hit(enemy,enemy.boss?4:8);
          if(!--slots)break;
        }
      }
    }
    for(const trail of G.riftTrails)trail.t-=dt;
    G.riftTrails=G.riftTrails.filter(trail=>trail.t>1e-6);
    if(!G.riftTrails.length)G.riftTrailClock=0;
  }

  const controls=document.createElement('div');
  controls.className='futurity-controls';
  controls.id='rift-reward-controls';
  controls.hidden=true;
  const button=document.createElement('button');
  button.type='button';button.className='go';button.id='rift-reward-phase';
  button.title='Заряди меч тремя попаданиями лазером. Меч работает 6 секунд и оставляет хакерский след.';
  button.setAttribute('aria-keyshortcuts','R');
  controls.append(button);
  $('shop').after(controls);

  function canActivate(tower) {
    return Boolean(tower && !G.over && !G.past?.paused && !G.cool && !tower.pastLock &&
      !tower.curse && !(tower.riftBlade>0) && !(tower.riftRecovery>0) && tower.riftFocus>=focusShots);
  }

  function refreshControls() {
    const tower=G?.units.find(u=>u.k===key);
    controls.hidden=cur!=='game'||!tower||Boolean(G.over);
    if(controls.hidden)return;
    const mine=G.guest?tower.mine:!tower.og;
    const mode=phase(tower,(G.p2&&G.cool<=0)||tower.inf>0);
    const label=mode===3?`1x1xty · Меч · ${Math.ceil(tower.riftBlade)} с`:
      tower.riftRecovery>0?`1x1xty · Перезарядка ${Math.ceil(tower.riftRecovery)} с`:
      tower.riftFocus>=focusShots?mine?'1x1xty · Меч · R':'1x1xty · Меч готов у напарника':
      `1x1xty · ${phaseNames[mode-1]} · ${tower.riftFocus||0}/${focusShots}`;
    if(button.textContent!==label)button.textContent=label;
    button.disabled=!mine||!canActivate(tower);
  }

  function activate(fromGuest) {
    const tower=G?.units.find(u=>u.k===key);
    if(!canActivate(tower)||G.guest||Boolean(tower.og)!==fromGuest)return false;
    tower.riftFocus=0;tower.riftBlade=bladeSeconds;tower.riftRecovery=recoverySeconds;
    (G.waves ||= []).push({x:tower.x,y:tower.y,t:0,c:slashColor,radius:bladeRange});
    say('1x1xty обнажает меч. Каждый взмах оставляет след из кода.');
    refreshControls();
    return true;
  }

  let sending=false;
  async function trigger(){
    if(cur!=='game'||controls.hidden||button.disabled||sending)return;
    if(!G.guest){activate(false);return}
    sending=true;
    const battle=G;
    try{
      const result=await db('rooms/'+CO.host+'/a',{m:'POST',b:{ty:'m',m:8,t:{'.sv':'timestamp'}}});
      if(!result.ok&&G===battle)say('Не удалось включить меч.');
    }catch{
      if(G===battle)say('Не удалось включить меч.');
    }finally{sending=false}
  }

  button.onclick=trigger;
  addEventListener('keydown',event=>{
    if(event.code!=='KeyR'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||
      event.target?.closest?.('input,textarea,select,[contenteditable=true]')||
      !$('modal').classList.contains('hide')||controls.hidden||button.disabled)return;
    event.preventDefault();
    trigger();
  });

  const apply=coApply;
  coApply=function(action){
    if(action?.ty==='m'&&action.m===8){
      if(G?.coop?.g)activate(true);
      return;
    }
    return apply(action);
  };

  const toTenths=value=>Math.ceil((value||0)*10)/10;
  const snapshot=coSnap;
  coSnap=function(){
    const result=snapshot();
    const tower=G.units.find(u=>u.k===key), trails=G.riftTrails;
    if(!tower&&!trails?.length)return result;
    const data=JSON.parse(result);
    if(tower)data.ru=[tower.riftFocus||0,toTenths(tower.riftBlade),toTenths(tower.riftRecovery)];
    if(trails?.length)data.rt=trails.map(t=>[...t.from,...t.to,toTenths(t.t)]);
    return JSON.stringify(data);
  };

  const readSnapshot=coApplySnap;
  coApplySnap=function(data){
    const result=readSnapshot(data);
    const tower=G?.units.find(u=>u.k===key);
    if(tower){
      const row=Array.isArray(data.ru)?data.ru:[];
      tower.riftFocus=Math.min(focusShots,Math.max(0,Number(row[0])||0));
      tower.riftBlade=Math.min(bladeSeconds,Math.max(0,Number(row[1])||0));
      tower.riftRecovery=Math.min(recoverySeconds,Math.max(0,Number(row[2])||0));
    }
    if(G){
      const trails=Array.isArray(data.rt)?data.rt:[];
      G.riftTrails=trails.slice(0,4).filter(row=>Array.isArray(row)&&row.length===5&&row.every(Number.isFinite))
        .map(([a,b,c,d,t])=>({from:[a,b],to:[c,d],t:Math.min(trailAge,Math.max(0,t))}));
    }
    refreshControls();
    return result;
  };

  const guestUpdate=coGuestUpd;
  coGuestUpd=function(dt){
    guestUpdate(dt);
    const tower=G?.units.find(u=>u.k===key);
    if(tower){
      if(tower.riftBlade>0)tower.riftBlade=decay(tower.riftBlade,dt);
      if(tower.riftRecovery>0)tower.riftRecovery=decay(tower.riftRecovery,dt);
    }
    for(const trail of G?.riftTrails||[])trail.t=decay(trail.t,dt);
  };

  const updateHud=hud;
  hud=function(){
    updateHud();
    refreshControls();
  };

  function drawEffects(ctx){
    if(!G.riftTrails?.length&&!G.riftSwings?.length)return;
    ctx.save();ctx.lineCap='round';
    for(const {from,to,t} of G.riftTrails||[]){
      if(t<=0)continue;
      ctx.strokeStyle='#2cf5b2';ctx.lineWidth=12;ctx.globalAlpha=.18*t/trailAge;
      ctx.beginPath();ctx.moveTo(...from);ctx.lineTo(...to);ctx.stroke();
      ctx.setLineDash([2,6,9,4]);ctx.lineWidth=2;ctx.globalAlpha=.78*t/trailAge;
      ctx.stroke();ctx.setLineDash([]);
    }
    for(const {from,to,t,mode} of G.riftSwings||[]){
      ctx.globalAlpha=Math.min(1,t*3);
      if(mode===2){
        ctx.strokeStyle='#6cef93';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(...from);ctx.lineTo(...to);ctx.stroke();
        ctx.strokeStyle='#f5ffd5';ctx.lineWidth=2;ctx.stroke();
      }else{
        const dx=to[0]-from[0],dy=to[1]-from[1];
        const angle=Math.atan2(dy,dx),length=Math.hypot(dx,dy)+12;
        ctx.strokeStyle='#9cffde';ctx.lineWidth=4;
        ctx.beginPath();ctx.arc(from[0],from[1],length,angle-.62,angle+.62);ctx.stroke();
      }
    }
    ctx.restore();
  }

  window.RiftReward={key,phase,range,attack,tick,drawEffects};
})();
