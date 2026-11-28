/* Battle rules for the Time Machine. Uses the normal TD board, ownership and upgrades. */
(() => {
  'use strict';

  const art=window.PastMachineArt;
  const path=[[-1,2],[3,2],[3,6],[7,6],[7,2],[11,2],[11,6],[16,6]];
  const rules={n:'Оборона портала',co:540,lv:18,hp:1,sp:1,cn:1,off:0,bm:1,
    boss:{n:'Архонт перемотки',hp:2820,v:20,col:'#c1acff',sk:0}};
  const freezeTime=5, freezeCooldown=26;
  const defenseTime=600;
  const roundTime=900;
  const attackTimes=[12,105,198,291,384,477];
  const attackLength=72;
  const unitKey='chronosity';
  const enemyTypes={
    time_shift: {label:'Сдвиг',hp:47,growth:11,v:42,r:13,c:'#99d6fc',art:0},
    time_skip:  {label:'Скачок',hp:31,growth:8,v:66,r:11,c:'#a4f0bd',art:1},
    time_guard: {label:'Затвор',hp:104,growth:16,v:31,r:17,c:'#ffceac',art:2},
    time_lock:  {label:'Стопор',hp:65,growth:13,v:39,r:14,c:'#dab3ff',art:3},
    time_mend:  {label:'Латчик',hp:51,growth:12,v:39,r:13,c:'#99e8d4',art:4},
    time_split: {label:'Парадокс',hp:67,growth:13,v:42,r:14,c:'#ffadd3',art:5},
    time_archon:{label:rules.boss.n,hp:rules.boss.hp,growth:0,v:rules.boss.v,r:43,c:rules.boss.col}
  };
  const shift='time_shift', skip='time_skip', guard='time_guard', lock='time_lock';
  const mend='time_mend', split='time_split', archon='time_archon';
  const waves=[
    {label:'Разведка',gap:1.05,enemies:[shift,shift,shift,skip,shift,shift,skip,shift,shift,skip]},
    {label:'Временной заслон',gap:.97,enemies:[shift,skip,shift,guard,shift,skip,lock,shift,shift,guard,skip,shift]},
    {label:'Шов истории',gap:.88,enemies:[shift,shift,guard,lock,skip,mend,shift,shift,lock,skip,guard,mend,skip,shift]},
    {label:'Парадокс',gap:.86,enemies:[skip,shift,split,lock,guard,shift,mend,skip,split,shift,guard,lock,shift,skip,split]},
    {label:'Осада портала',gap:.78,enemies:[guard,lock,skip,split,shift,mend,skip,guard,lock,split,skip,shift,guard,mend,lock,shift,split,skip]},
    {label:'Последние минуты',gap:1,enemies:[skip,shift,split,lock,guard,mend,skip,shift,lock,guard,split,guard,shift,lock]}
  ];
  // Existing effects expect entries in the shared enemy catalogue.
  Object.entries(enemyTypes).forEach(([id,data])=>{ET[id]=data});

  function prepare(battle) {
    battle.spd=1;
    battle.next=attackTimes[0];
    battle.past={wave:null,index:0,fragments:0,sparks:[],frozen:0,cooldown:0,elapsed:0,paused:false};
    setMap('meadow',path);
  }

  function startWave() {
    const battle=G, state=battle.past;
    if(battle.over||battle.run||state.paused||state.rift||state.elapsed+0.1<attackTimes[battle.wave])return;
    const plan=waves[battle.wave];
    if(!plan)return;
    battle.wave++;
    battle.run=true; battle.q=plan.enemies.length; battle.sp=0;
    state.wave=plan; state.index=0;
    battle.boss=plan.enemies.includes(archon);
    say(plan.label+' · Волна '+battle.wave+'/'+waves.length);
    hud();
  }

  function makeEnemy(type,progress=0,mini=false) {
    const data=enemyTypes[type];
    const boss=type===archon;
    const hp=mini?24:data.hp+data.growth*G.wave;
    return {...mk(type,progress),hp,max:hp,v:mini?56:data.v,boss,radius:mini?9:data.r,
      chrono:true,mini,skill:type===lock?3.8:type===archon?7:0};
  }

  function spawn(dt) {
    const state=G.past;
    if(state.rift||!G.run||!G.q||state.frozen>0)return;
    G.sp-=dt;
    if(G.sp>0)return;
    G.q--;
    const type=state.wave.enemies[state.index++];
    const interval=attackLength/Math.max(1,state.wave.enemies.length-1);
    G.sp=state.index%3===0?interval*2.55:interval*.225;
    const enemy=makeEnemy(type);
    G.en.push(enemy);
    if(enemy.boss){say('Архонт перемотки вошёл в разлом!');cue(84,.4,45)}
  }

  function enemyKilled(enemy) {
    if(!enemy.chrono)return;
    const state=G.past;
    state.fragments++;
    const [px,py]=pos(enemy.d);
    if(!thReducedMotion())state.sparks.push({x:px,y:py,age:0});
    if(enemy.ty===split){
      G.en.push(makeEnemy(shift,Math.max(0,enemy.d-9),true),makeEnemy(shift,Math.max(0,enemy.d-21),true));
    }
    if(state.fragments%6===0||enemy.boss){
      (G.waves=G.waves||[]).push({x:px,y:py,t:0,c:'#baf1ff',radius:23});
    }
  }

  function tickTowers(dt) {
    for(const tower of G.units){
      tower.pastLock=Math.max(0,(tower.pastLock||0)-dt);
      tower.pastWard=Math.max(0,(tower.pastWard||0)-dt);
    }
  }

  function enemyTick(enemy,dt) {
    if(!enemy.chrono||enemy.stun>0||enemy.po)return;
    if(enemy.ty===skip&&!enemy.jumped&&enemy.d>=144){
      enemy.jumped=true;
      enemy.d=Math.min(tot-30,enemy.d+31);
      enemy.orbitRevision=(enemy.orbitRevision||0)+1;
    }
    if(enemy.ty===mend&&!(enemy.nul>0)){
      for(const other of G.en){
        if(other!==enemy&&!other.dead&&!other.po&&!other.boss&&!(other.nul>0)&&Math.abs(other.d-enemy.d)<62){
          other.hp=Math.min(other.max,other.hp+dt*7);
        }
      }
    }
    if(enemy.ty!==lock&&enemy.ty!==archon)return;
    const boss=enemy.ty===archon, [px,py]=pos(enemy.d);
    const inRange=tower=>Math.hypot(tower.x-px,tower.y-py)<=(boss?123:91);
    if(enemy.warning){
      enemy.warning.left-=dt;
      if(enemy.warning.left>0)return;
      let locked=false;
      for(const tower of enemy.warning.targets){
        if(!G.units.includes(tower)||!inRange(tower)||tower.pastWard>0)continue;
        tower.pastLock=boss?2.75:2.15;
        tower.pastWard=boss?8:7;
        locked=true;
        G.shots.push({a:px,b:py+4,c:tower.x,e:tower.y-3,t:.28,col:boss?'#ffa8d7':'#c7b5ff'});
      }
      if(locked)cue(boss?116:210,.18,81);
      enemy.warning=null;
      return;
    }
    enemy.skill-=dt;
    if(enemy.skill>0)return;
    const candidates=G.units.filter(tower=>!tower.pastLock&&!tower.pastWard&&inRange(tower));
    if(!candidates.length){enemy.skill=.3;return}
    candidates.sort((a,b)=>Math.hypot(a.x-px,a.y-py)-Math.hypot(b.x-px,b.y-py));
    enemy.warning={targets:candidates.slice(0,boss&&enemy.hp<enemy.max*.66?2:1),left:boss?1.1:.88};
    enemy.skill=boss?8.5:10.4;
    if(boss)say('Архонт готовит удар по башням!');
  }

  function freeze(battle) {
    const state=battle?.past;
    if(!state||battle.over||battle.guest||state.paused||state.cooldown>0||
       !battle.en.some(enemy=>!enemy.dead&&!enemy.po))return false;
    state.frozen=freezeTime;
    state.cooldown=freezeCooldown;
    cue(560,.32,96);
    say('Время остановлено на 5 секунд. Верити продолжают стрелять.');
    hud();
    return true;
  }

  function update(dt) {
    const battle=G, state=battle.past;
    state.elapsed=Math.min(roundTime,state.elapsed+dt);
    if(state.sparks.length){
      for(const spark of state.sparks)spark.age+=dt;
      state.sparks=state.sparks.filter(spark=>spark.age<.72);
    }
    state.frozen=Math.max(0,state.frozen-dt);
    state.cooldown=Math.max(0,state.cooldown-dt);
    if(state.frozen<1e-7)state.frozen=0;
    if(state.cooldown<1e-7)state.cooldown=0;
    if(battle.lives<=0){battle.lives=0;window.PastMachine.endBattle(false);return}
    if(state.rift){
      const result=RiftFinale.update(battle,dt,Math.max(0,state.elapsed-defenseTime));
      if(result)window.PastMachine.endBattle(result==='won');
      return;
    }
    if(state.elapsed+1e-6>=defenseTime){window.PastMachine.beginRift(battle);return}
    if(!battle.run||battle.q||battle.en.length||battle.adminSpawns?.length)return;
    battle.run=false; battle.next=Math.max(.1,(attackTimes[battle.wave]??defenseTime)-state.elapsed); battle.coins+=89;
    say('Волна сдержана. +89 монет на оборону.');
  }

  function phase(enemy) {
    return enemy.hp<=enemy.max/3?2:enemy.hp<=enemy.max*2/3?1:0;
  }

  function drawBoard(c) {
    if(G.past.rift){RiftFinale.drawBoard(c,G);return}
    c.drawImage(art.board(PT),0,0);
    const clock=thReducedMotion()?0:performance.now()/1000;
    art.portal(c,618,265,39,clock,G.past.frozen?1:0,true);
    c.save();
    c.font='900 10px system-ui';
    c.textAlign='right'; c.fillStyle='#e0ebff';c.fillText('ПОРТАЛ',632,303);
    c.restore();
  }

  function drawTowerBase(c,tower) {
    const lock=tower.pastLock>0||tower.pastGuestLock;
    thShape(c,p=>p.roundRect(tower.x-17,tower.y+1,34,16,5),
      lock?'#675e93':'#3a456a',lock?'#c6a9ff':'#728cae',1.5);
    thShape(c,p=>p.roundRect(tower.x-13,tower.y+7,26,4,2),lock?'#ead7ff':'#90bfdf');
  }

  function drawEnemy(c,enemy,[x,y]) {
    if(enemy.ty===RiftFinale.key)return RiftFinale.drawEnemy(c,enemy,G);
    const data=enemyTypes[enemy.ty];
    if(!data)return false;
    c.save();
    const time=thReducedMotion()?0:enemy.t||0;
    if(enemy.ty===archon)art.archon(c,x,y-7,45,time,phase(enemy));
    else art.invader(c,x,y,enemy.radius||data.r,data.art,time);
    const width=enemy.boss?64:32;
    const bottom=y+(enemy.boss?34:14);
    c.fillStyle='#0c152a';c.fillRect(x-width/2,bottom,width,4);
    c.fillStyle=enemy.boss?'#ff9dca':data.c;
    c.fillRect(x-width/2,bottom,width*Math.max(0,enemy.hp/enemy.max),4);
    if(G.past.frozen>0){
      c.strokeStyle='#bffaefb5';c.lineWidth=1.8;c.beginPath();
      c.ellipse(x,y,enemy.boss?48:19,enemy.boss?33:14,-.27,0,Math.PI*2);c.stroke();
    }
    c.restore();
    return true;
  }

  function drawEffects(c) {
    if(G.past.rift)RiftFinale.drawEffects(c,G);
    c.save();
    for(const spark of G.past.sparks){
      c.globalAlpha=1-spark.age/.72;
      art.crystal(c,spark.x+spark.age*11,spark.y-spark.age*44,5,'#8ae6ff',spark.age*2);
    }
    c.globalAlpha=1;
    for(const tower of G.units){
      if(!(tower.pastLock>0||tower.pastGuestLock))continue;
      c.fillStyle='#b4a6ff45';c.strokeStyle='#c9b5ff';c.lineWidth=1.4;
      c.beginPath();c.roundRect(tower.x-17,tower.y-23,34,39,5);c.fill();c.stroke();
      c.font='900 10px system-ui';c.textAlign='center';c.fillStyle='#e4d7ff';
      c.fillText('Ⅱ',tower.x,tower.y-24);
    }
    for(const enemy of G.en){
      if(!enemy.warning)continue;
      const [x,y]=pos(enemy.d);
      c.setLineDash([5,4]);c.strokeStyle='#e6b7ff';c.lineWidth=1.6;
      for(const tower of enemy.warning.targets){
        c.beginPath();c.moveTo(x,y);c.lineTo(tower.x,tower.y);c.stroke();
      }
    }
    c.setLineDash([]);
    if(G.past.frozen>0){
      c.fillStyle='#86e6ff17';c.fillRect(0,0,640,400);
      c.strokeStyle='#9feeff91';c.lineWidth=3;c.strokeRect(2,2,636,396);
    }
    c.restore();
  }

  function cue(hz,length,end) {
    if(!document.hidden&&SND)tone(hz,length,'triangle',.095,end);
  }

  function attack(unit,target,damage,[x,y],phaseTwo) {
    hit(target,damage);
    if(target.dead||unit.n%(phaseTwo?4:5)!==0)return;
    hit(target,damage*.45);
    if(!target.dead){
      const slow=target.boss?.14:.35;
      if(!(target.sl>0)||target.slp<=slow){
        target.slp=slow;
        target.sl=Math.max(target.sl||0,target.boss?.8:1.4);
      }
    }
    (G.waves=G.waves||[]).push({x,y,t:0,c:'#b8efff',radius:31});
  }

  function registerReward() {
    TY[unitKey]={n:'Chronosity',cost:560,dmg:44,rate:1.1,rng:112,col:'#a7edff',limited:true,
      d:'Награда за участие в Хранилище времени. Каждый 5-й выстрел наносит ещё 45% урона и замедляет цель на 35% на 1,4 с. Боссы замедляются на 14% на 0,8 с. Во второй фазе срабатывает каждый 4-й выстрел. Один Chronosity на поле.'};
    RA[unitKey]='Relic';
    RC.Relic='#a7ecff';
    MKNS[unitKey]='награда за Хранилище времени';
    EXU.push(unitKey);
    for(const phase of [1,2]){
      const canvas=thCanvas(144,144),sprite=new Image();
      art.unit(canvas.getContext('2d'),72,73,62,phase===2);
      IMG[unitKey+phase]=canvas.toDataURL();
      sprite.src=IMG[unitKey+phase];
      IM[unitKey+phase]=sprite;
    }
  }

  registerReward();
  window.PastMachineBattle={rules,waves,defenseTime,roundTime,phase,prepare,startWave,spawn,update,enemyKilled,enemyTick,tickTowers,freeze,
    drawBoard,drawEnemy,drawTowerBase,drawEffects,attack,cue,unitKey};
})();
