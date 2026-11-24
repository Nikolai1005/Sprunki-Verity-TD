/* Shared simulation. In a room the host advances it, while guests send controls. */
(() => {
  'use strict';
  const WIDTH = 900, HEIGHT = 540, INTRO = 32, CHOOSE = 15, ROUND = 70;
  const BOSSES = [
    {key:'stone', name:'Камнелом', color:'#ff9161', hp:360, moves:['rings','fall'], hint:'Отойди от обломков и пропусти волны между кольцами.'},
    {key:'titan', name:'Титан из Клетки', color:'#ff524b', hp:415, moves:['cross','fall'], hint:'После метки сместись по диагонали, чтобы выйти из креста.'},
    {key:'hack', name:'Хакерити', color:'#6dff8b', hp:465, moves:['grid','cross'], hint:'Перебегай между светящимися клетками.'},
    {key:'rift', name:'1×1×1×1', color:'#b99bff', hp:520, moves:['cross','rings','grid'], hint:'Чередует кресты, кольца и клетки.'},
    {key:'forge', name:'Пепельный Кузнец', color:'#ff9b4e', hp:565, moves:['forge'], hint:'Пламя идёт рядами. Перебегай на полосу, которая уже погасла.'},
    {key:'frost', name:'Ледяная Сирена', color:'#94e4ff', hp:600, moves:['frost'], hint:'Ищи просветы между ледяными веерами.'},
    {key:'storm', name:'Грозовой Скат', color:'#71a8ff', hp:630, moves:['storm'], hint:'Молнии идут по зигзагу. Уходи в сторону от всей цепочки.'},
    {key:'mirror', name:'Зеркальный Смотритель', color:'#f89bff', hp:665, moves:['mirror'], hint:'Встань в просвет. Лучи закрывают всё поле, кроме одной полосы.'},
    {key:'ink', name:'Чернильный Архивариус', color:'#d3a0ff', hp:700, moves:['ink'], hint:'Выйди из чернильной лужи. Она наносит урон, пока не высохнет.'},
    {key:'warden', name:'Комендант Пустоты', color:'#ffcb77', hp:770, moves:['warden'], hint:'Переходи из центра наружу, когда меняется безопасная зона.'}
  ];
  const WEAPONS = {
    stone:{name:'Камень', desc:'Бросает камень по прямой.', cd:.78, speed:490, range:510, damage:26, color:'#ffc893'},
    bow:{name:'Лук', desc:'Выпускает быструю стрелу.', cd:.68, speed:700, range:685, damage:38, color:'#a9ff98'},
    pistol:{name:'Пистолет', desc:'Один мощный выстрел.', cd:.52, speed:810, range:650, damage:43, color:'#ffe17b'},
    automatic:{name:'Автомат', desc:'Очередь из трёх выстрелов.', cd:.61, speed:790, range:725, burst:3, damage:23, color:'#ffd0a5'},
    hammer:{name:'Молот', desc:'Вращается и бьёт автоматически. Кнопка атаки делает дополнительный взмах.', cd:1.02, reach:130, damage:38, color:'#ff9f70'},
    spear:{name:'Копьё', desc:'Длинный выпад и увеличенная орбита молота.', cd:.86, reach:204, damage:55, color:'#d4ffc8'},
    saw:{name:'Бензопила', desc:'Четыре быстрых удара вблизи и ещё более широкая орбита.', cd:1.03, reach:145, ticks:4, damage:19, color:'#ff8f87'},
    fate:{name:'Молот судьбы', desc:'Самый большой молот на орбите. Кнопка атаки вызывает молнию.', cd:1.12, reach:180, damage:66, lightning:31, color:'#ffe184'},
    shield:{name:'Щит', desc:'Блокирует удар и бьёт волной вблизи.', cd:1.14, reach:125, damage:36, block:.60, color:'#96e3ff'},
    spikes:{name:'Игольчатый щит', desc:'Блокирует удар и выпускает веер шипов.', cd:1.10, reach:172, damage:48, block:.65, color:'#f9d3a0'},
    swat:{name:'Щит SWAT', desc:'Блокирует удар, отталкивает босса и наносит урон.', cd:1.18, reach:158, damage:60, block:.74, push:94, color:'#9ed7ff'},
    lord:{name:'Щит лорда Верити', desc:'На 5 с даёт союзникам рядом +28% урона, +22% к дальности атак и +25 HP. В соло усиливает владельца.', cd:1.3, reach:160, damage:64, block:.76, aura:200, color:'#ffe78c'}
  };
  const BRANCHES = [
    ['stone','bow','pistol','automatic'],
    ['hammer','spear','saw','fate'],
    ['shield','spikes','swat','lord']
  ];
  const AURA={seconds:5,hp:25,damage:1.28,reach:1.22};
  const BOSS_BALANCE={hp:1.07,damage:1.05};
  const HAMMER_ORBITS={
    hammer:{radius:74,size:16,damage:23},
    spear:{radius:99,size:20,damage:29},
    saw:{radius:123,size:24,damage:35},
    fate:{radius:148,size:29,damage:44}
  };
  const HAMMER_SPIN=3.7, HAMMER_CONTACT_DELAY=.64, BOSS_HIT_RADIUS=43;
  const clamp = (x, min, max) => Math.min(max, Math.max(min, x));
  const alive = state => state.players.filter(player => player.hp > 0);
  const options = player => BRANCHES.map((branch,index)=>branch[player.levels[index]]);
  const upgrade = key => {
    const branch=BRANCHES.find(row=>row.includes(key));
    return branch[branch.indexOf(key)+1];
  };
  const maxHP = player => 100+(player.buff>0?AURA.hp:0);
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  function hammerOrbit(player,time){
    const stats=HAMMER_ORBITS[player.weapon];
    if(!stats)return null;
    const angle=time*HAMMER_SPIN+(player.hammerPhase||0)-Math.PI/2;
    const radius=stats.radius*(player.buff>0?AURA.reach:1);
    return {...stats,radius,angle,
      x:player.x+Math.cos(angle)*radius,y:player.y+Math.sin(angle)*radius};
  }
  const snap = Object.freeze({x:WIDTH/2,y:HEIGHT/2-46});
  const uidPlayer = (person,i) => ({
    id:person.id, name:person.name, avatar:person.avatar, x:300+i*100, y:405, hp:100,
    levels:[0,0,0], hammerPhase:i*Math.PI/2, nextHammerHit:0, buff:0, sawTime:0, sawTicks:0, weapon:'', selected:'', cd:0, block:0, inv:0, flash:0, facing:1, choice:0, attack:0, damage:0
  });
  function create(people, cinematic = true) {
    return {party:people.length>1, players:people.map(uidPlayer), phase:cinematic?'intro':'choose',
      time:0, wave:0, kills:[], projectiles:[], effects:[], hazards:[], attack:0, next:0, winner:'', reason:''};
  }

  function nextWave(state) {
    state.phase='fight';
    state.time=0;
    state.hazards=[];
    state.attack=0;
    state.next=2.4;
    const team=alive(state);
    const extra=team.length-1;
    const hp=Math.round(BOSSES[state.wave].hp*BOSS_BALANCE.hp*(1+extra*.67));
    state.boss={...snap,hp,max:hp,flash:0,damageScale:BOSS_BALANCE.damage*(1+extra*.14),tempo:1+extra*.09,
      pushX:0,pushY:0,lightning:[]};
    team.forEach((p,i)=>{
      p.weapon=p.selected||options(p)[0];
      const index=BRANCHES.findIndex(line=>line.includes(p.weapon));
      p.levels[index]=Math.min(BRANCHES[index].length-1,p.levels[index]+1);
      Object.assign(p,{selected:'',x:WIDTH/2+(i-(team.length-1)/2)*81,y:405,
        cd:0,block:0,inv:0,buff:0,sawTime:0,sawTicks:0,nextHammerHit:0});
    });
  }

  function choose(state) {
    state.phase='choose';
    state.time=0;
    state.boss=null;
    for(const p of alive(state)){
      p.hp=Math.min(100,p.hp+26);
      p.buff=0;
    }
  }

  function end(state, winner, reason) {
    state.phase='end';
    state.time=0;
    state.winner=winner?.id||'';
    state.reason=reason;
    state.hazards=[];
    state.projectiles=[];
    state.effects=[];
  }

  function schedule(state) {
    const boss=state.boss, info=BOSSES[state.wave], id=state.attack++;
    const kind=info.moves[id%info.moves.length];
    const danger=boss.hp<boss.max*.5;
    const lead=kind==='mirror'?2.45:(danger?1.10:1.43)/boss.tempo;
    const add=(zone,delay=0)=>state.hazards.push({...zone,pattern:kind,at:state.time+lead+delay,done:false});
    const team=alive(state), target=team[id%team.length];
    if(kind==='rings'){
      for(let i=0;i<3;i++)add({kind:'ring',x:boss.x,y:boss.y,r:95+i*94,w:48},i*.38);
    }
    if(kind==='fall'){
      for(const p of team)add({kind:'circle',x:p.x,y:p.y,r:danger?70:58});
      add({kind:'circle',x:boss.x,y:boss.y,r:102});
    }
    if(kind==='cross'){
      add({kind:'rect',x:target.x,y:HEIGHT/2,w:84,h:HEIGHT});
      add({kind:'rect',x:WIDTH/2,y:target.y,w:WIDTH,h:68});
    }
    if(kind==='grid'){
      for(let y=0;y<4;y++)for(let x=0;x<6;x++){
        if((x+y+id)%2===0)add({kind:'rect',x:75+x*150,y:67.5+y*135,w:126,h:109});
      }
    }
    if(kind==='forge'){
      for(let i=0;i<6;i++)add({kind:'rect',x:WIDTH/2,y:45+(id%2?5-i:i)*90,w:WIDTH,h:80},i*.24);
    }
    if(kind==='frost'){
      const angle=Math.atan2(target.y-boss.y,target.x-boss.x);
      for(let wave=0;wave<2;wave++)for(let i=0;i<3;i++){
        add({kind:'sector',x:boss.x,y:boss.y,r:690,angle:angle+i*Math.PI*2/3+wave*Math.PI/3,half:.43},wave*.72);
      }
    }
    if(kind==='storm'){
      for(let i=0;i<7;i++)add({
        kind:'circle',x:clamp(target.x+(i-3)*91,40,WIDTH-40),
        y:clamp(target.y+(i%2?76:-54),40,HEIGHT-40),r:danger?73:61
      },i*.17);
    }
    if(kind==='mirror'){
      const vertical=id%2===0, count=vertical?6:5, width=(vertical?WIDTH:HEIGHT)/count;
      const safe=Math.floor(count/2)-Number(id%4<2);
      for(let i=0;i<count;i++){
        if(i===safe)continue;
        add(vertical?{kind:'rect',x:width*(i+.5),y:HEIGHT/2,w:width,h:HEIGHT}:
          {kind:'rect',x:WIDTH/2,y:width*(i+.5),w:WIDTH,h:width},.35);
      }
    }
    if(kind==='ink'){
      for(const p of team)add({kind:'circle',x:p.x,y:p.y,r:danger?78:67,duration:2.55,pulse:.64,power:.53});
      for(const side of [-1,1])add({kind:'circle',x:clamp(target.x+side*133,48,WIDTH-48),
        y:clamp(target.y+side*70,40,HEIGHT-40),r:56,duration:2.55,pulse:.64,power:.53},.36);
    }
    if(kind==='warden'){
      for(let i=0;i<2;i++){
        const outer=(i+id)%2===0;
        add({kind:outer?'outside':'circle',x:snap.x,y:snap.y,r:outer?153:181},i*1.42);
      }
    }
    const interval=kind==='ink'||kind==='warden'||kind==='mirror'?4.7:4.15;
    state.next=state.time+(interval-(danger?.68:0))/boss.tempo;
  }

  function contains(zone,p){
    if(zone.kind==='rect')return Math.abs(p.x-zone.x)<zone.w/2+9&&Math.abs(p.y-zone.y)<zone.h/2+9;
    const d=distance(zone,p);
    if(zone.kind==='ring')return Math.abs(d-zone.r)<zone.w/2+9;
    if(zone.kind==='outside')return d>zone.r-9;
    if(zone.kind==='sector'){
      const delta=Math.atan2(p.y-zone.y,p.x-zone.x)-zone.angle;
      return d<zone.r&&Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)))<zone.half;
    }
    return d<zone.r+9;
  }

  function hurt(p, damage) {
    if(p.inv>0)return;
    if(p.block>0){
      p.block=0;
      p.inv=.47;
      p.flash=-.4;
      return;
    }
    p.hp=Math.max(0,p.hp-damage);
    p.inv=.58;
    p.flash=.48;
  }

  function hitBoss(state,p,base) {
    const b=state.boss;
    if(!b||b.hp<=0)return;
    const amount=base*(p.buff>0?AURA.damage:1);
    p.damage+=Math.min(b.hp,amount);
    b.hp=Math.max(0,b.hp-amount);
    b.flash=.15;
  }

  function attack(state,p) {
    const weapon=WEAPONS[p.weapon];
    if(!weapon||p.cd>0)return;
    p.cd=weapon.cd;
    const target=state.boss, angle=target?Math.atan2(target.y-p.y,target.x-p.x):0;
    const reach=(weapon.reach||0)*(p.buff>0?AURA.reach:1);
    const effect=(type,ttl,extra={})=>state.effects.push({id:p.id,x:p.x,y:p.y,type,w:p.weapon,ttl,...extra});
    if(weapon.speed&&target){
      for(let i=0;i<(weapon.burst||1);i++){
        const heading=angle+(weapon.burst?(i-1)*.075:0);
        state.projectiles.push({id:p.id,x:p.x,y:p.y,vx:Math.cos(heading)*weapon.speed,
          vy:Math.sin(heading)*weapon.speed,ttl:weapon.range/weapon.speed*(p.buff>0?AURA.reach:1),
          w:p.weapon,angle:heading,delay:i*.071});
      }
      return;
    }
    if(weapon.block){
      p.block=weapon.block;
      effect(weapon.push?'bash':p.weapon==='spikes'?'spikes':'shield',.55,{angle,reach});
    }else if(p.weapon==='spear'){
      effect('thrust',.32,{angle,reach});
    }else if(weapon.ticks){
      p.sawTicks=weapon.ticks;
      p.sawTime=0;
      effect('saw',.69,{angle,reach});
      return;
    }else{
      effect('swing',.37,{reach});
    }
    if(weapon.aura){
      const team=alive(state), recipients=team.length===1?[p]:team.filter(a=>a!==p&&distance(p,a)<=weapon.aura);
      for(const ally of recipients){
        if(ally.buff<=0)ally.hp+=AURA.hp;
        ally.buff=AURA.seconds;
      }
      effect('aura',.85,{reach:weapon.aura});
    }
    if(!target||distance(p,target)>reach)return;
    hitBoss(state,p,weapon.damage);
    if(weapon.push){
      target.pushX+=Math.cos(angle)*weapon.push;
      target.pushY+=Math.sin(angle)*weapon.push;
    }
    if(weapon.lightning)target.lightning.push({id:p.id,at:state.time+.20,key:p.weapon});
  }

  function movement(state, inputs, dt) {
    for(const p of alive(state)){
      const input=inputs[p.id]||{};
      const ax=clamp(Number(input.x)||0,-1,1), ay=clamp(Number(input.y)||0,-1,1);
      const length=Math.max(1,Math.hypot(ax,ay));
      p.x=clamp(p.x+ax/length*224*dt,22,WIDTH-22);
      p.y=clamp(p.y+ay/length*224*dt,25,HEIGHT-22);
      if(Math.abs(ax)>.08)p.facing=Math.sign(ax);
      p.cd=Math.max(0,p.cd-dt);p.block=Math.max(0,p.block-dt);p.inv=Math.max(0,p.inv-dt);
      p.buff=Math.max(0,p.buff-dt);
      p.hp=Math.min(maxHP(p),p.hp);
      if(p.sawTicks&&state.boss){
        p.sawTime-=dt;
        if(p.sawTime<=0){
          p.sawTicks--;p.sawTime+=.16;
          const weapon=WEAPONS.saw;
          if(distance(p,state.boss)<weapon.reach*(p.buff>0?AURA.reach:1))hitBoss(state,p,weapon.damage);
        }
      }
      if(p.flash)p.flash=Math.sign(p.flash)*Math.max(0,Math.abs(p.flash)-dt);
      if(input.attack&&input.attack!==p.attack){
        p.attack=input.attack;
        attack(state,p);
      }
    }
  }

  function strikeWithHammers(state){
    const boss=state.boss;
    for(const player of alive(state)){
      if(boss.hp<=0||state.time<player.nextHammerHit)continue;
      const hammer=hammerOrbit(player,state.time);
      if(!hammer||distance(boss,hammer)>BOSS_HIT_RADIUS+hammer.size)continue;
      player.nextHammerHit=state.time+HAMMER_CONTACT_DELAY;
      hitBoss(state,player,hammer.damage);
      state.effects.push({type:'hammer-hit',x:hammer.x,y:hammer.y,w:player.weapon,ttl:.23});
    }
  }

  function resolveFight(state,dt) {
    const boss=state.boss, info=BOSSES[state.wave], t=state.time;
    const range=48+Math.min(state.wave,6)*23;
    boss.x=clamp(snap.x+Math.sin(t*(.76+state.wave*.10))*range+boss.pushX,54,WIDTH-54);
    boss.y=clamp(snap.y+Math.sin(t*1.3)*(29+state.wave*3)+boss.pushY,54,HEIGHT-54);
    boss.pushX*=Math.exp(-dt*2.4);
    boss.pushY*=Math.exp(-dt*2.4);
    boss.flash=Math.max(0,boss.flash-dt);
    strikeWithHammers(state);
    for(const bolt of boss.lightning){
      if(t<bolt.at)continue;
      const owner=state.players.find(player=>player.id===bolt.id);
      hitBoss(state,owner,WEAPONS[bolt.key].lightning);
      state.effects.push({type:'lightning',x:boss.x,y:boss.y,w:bolt.key,ttl:.36});
    }
    boss.lightning=boss.lightning.filter(bolt=>t<bolt.at);
    for(const shot of state.projectiles){
      if(shot.delay>0){shot.delay-=dt;continue}
      const sx=shot.x, sy=shot.y;
      shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.ttl-=dt;
      const dx=shot.x-sx, dy=shot.y-sy;
      const fraction=clamp(((boss.x-sx)*dx+(boss.y-sy)*dy)/(dx*dx+dy*dy||1),0,1);
      if(Math.hypot(sx+dx*fraction-boss.x,sy+dy*fraction-boss.y)<BOSS_HIT_RADIUS){
        const owner=state.players.find(player=>player.id===shot.id);
        hitBoss(state,owner,WEAPONS[shot.w].damage);
        shot.ttl=0;
      }
    }
    state.projectiles=state.projectiles.filter(shot=>shot.ttl>0&&shot.x>=-16&&shot.x<=WIDTH+16&&shot.y>=-16&&shot.y<=HEIGHT+16);
    if(boss.hp<=0){
      state.kills.push({boss:info.key,players:alive(state).map(p=>p.id)});
      state.phase='rest';state.time=0;state.hazards=[];state.projectiles=[];
      return;
    }
    if(t>=state.next&&alive(state).length)schedule(state);
    for(const zone of state.hazards){
      if(t>=zone.at&&(!zone.done||zone.pulse&&t>=zone.nextPulse&&t<zone.at+zone.duration)){
        zone.done=true;
        if(zone.pulse)zone.nextPulse=t+zone.pulse;
        const damage=Math.round((15+state.wave*1.35)*boss.damageScale*(zone.power||1));
        for(const p of alive(state))if(contains(zone,p))hurt(p,damage);
      }
    }
    state.hazards=state.hazards.filter(zone=>t<zone.at+(zone.duration||.42));
    for(const p of alive(state))if(distance(p,boss)<47)hurt(p,Math.round((11+state.wave)*boss.damageScale));
    if(t>=ROUND) {
      state.phase='overtime';state.time=0;
      state.hazards=[];state.projectiles=[];state.boss=null;state.next=0;
    }
  }

  function overtime(state) {
    if(state.time<state.next)return;
    state.next=state.time+.7;
    const radius=Math.max(0,231-state.time*13);
    const ordered=alive(state).sort((a,b)=>a.hp-b.hp||a.damage-b.damage||
      distance(b,snap)-distance(a,snap)||a.id.localeCompare(b.id));
    for(const p of ordered){
      if(state.party&&alive(state).length===1)break;
      if(distance(p,snap)>radius||radius===0)hurt(p,14+Math.floor(state.time/4)*3);
    }
  }

  function step(state, inputs, dt, skip = false) {
    if(state.phase==='end')return;
    state.time+=dt;
    if(state.phase==='intro'){
      if(skip||state.time>=INTRO)choose(state);
      return;
    }
    if(state.phase==='choose'){
      const players=alive(state);
      if(!players.length){end(state,null,'defeat');return}
      for(const p of players){
        const input=inputs[p.id];
        if(input?.choice&&input.choice!==p.choice){
          p.choice=input.choice;
          if(options(p).includes(input.weapon))p.selected=input.weapon;
        }
      }
      if(state.time>=CHOOSE||players.every(p=>p.selected))nextWave(state);
      return;
    }
    if(state.phase==='rest'){
      if(state.time<3.2)return;
      if(state.wave+1<BOSSES.length){state.wave++;choose(state);return}
      if(!state.party){end(state,alive(state)[0],'clear');return}
      state.phase='overtime';state.time=0;state.boss=null;state.next=0;
      return;
    }
    state.effects=state.effects.filter(effect=>(effect.ttl-=dt)>0);
    movement(state,inputs,dt);
    if(state.phase==='fight')resolveFight(state,dt);
    else overtime(state);
    const remaining=alive(state);
    if(!remaining.length)end(state,null,'defeat');
    else if(state.party&&remaining.length===1)end(state,remaining[0],'last');
  }

  window.BossRushEngine={WIDTH,HEIGHT,INTRO,CHOOSE,ROUND,BOSSES,WEAPONS,options,upgrade,maxHP,hammerOrbit,alive,create,step,snap};
})();
