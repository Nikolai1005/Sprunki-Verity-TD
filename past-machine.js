/* Story, arena handoff and chapter progression. Combat is handled by the TD engine. */
(() => {
  'use strict';

  const art=window.PastMachineArt, battle=window.PastMachineBattle;
  const canvas=$('past-canvas'), ctx=canvas.getContext('2d');
  const sceneRoot=$('past'), joystick=$('past-joystick'), knob=joystick.querySelector('i');
  const keys=new Set(), mover={x:1000,y:811,face:1,mv:false};
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const soundtrack={
    story:{data:'past-machine-memory.mp3',volume:.43},
    war:{data:'timeline-score.mp3',volume:.43}
  };
  const dialogues={
    meeting:[
      ['Админити','Ребята, мне нужно вам всё рассказать.','white'],
      ['Админити','Когда-то давно, когда Верития только зарождалась, ко мне пришёл странник из портала времени.','flashback'],
      ['Странник','Я вижу, какой у тебя проект. В скором времени в нём будут свои игроки, хранители и много ивентов.','flashback'],
      ['Странник','Но главное — уследи за Веритией. Во всём пространстве и времени есть захватчики. Они охотятся на миры и отматывают их историю назад.','flashback'],
      ['Странник','Будь аккуратен. И не заходи слишком далеко!','flashback'],
      ['', '', 'departure', 3.2],
      ['Админити','Этот странник вернулся. Он сказал, что на наш мир нападают временные захватчики!','white'],
      ['Админити','Ребята, простите, что впутал вас в это. На кону вся Верития. Борьба начинается. ВПЕРЁД!','white']
    ],
    arrival:[
      ['Странник','Здравствуйте, хранители. Думаю, Админити уже рассказал вам обо мне.','ruins'],
      ['Странник','Держите оборону, пока мы с Админити чиним портал, ведущий в измерение захватчиков.','ruins'],
      ['Странник','Возьмите устройство остановки времени. Оно задержит врагов на пять секунд. Собирайте частицы, которые они оставляют.','device'],
      ['Админити','Вы справитесь. Я в вас верю, хранители!','ruins']
    ],
    archon:[
      ['Админити','Держитесь! К порталу идёт кто-то огромный.','archon',4.1],
      ['Архонт перемотки','Ваше время вышло.','archon',3.5]
    ],
    closing:[
      ['', '', 'shards', 4.3],
      ['Захватчики','Это ещё не всё! Сейчас мы сотрём ваш мир!','threat',4.3],
      ['', '', 'beam', 4.6],
      ['Захватчики','Не-е-е-е-ет!','seal',3.0],
      ['Странник','Вы достойные хранители этого мира. Я могу остаться с вами и помогать вам.','goodbye'],
      ['Странник','Я удержал луч. Теперь он может открыть проход к первым версиям Веритии. Встретимся по ту сторону портала.','echoes'],
      ['Странник','Найдите Фигурку времени и Futurity, пройдя всю историю Веритии. До встречи, хранители!','goodbye']
    ]
  };
  let view=null, cut=null, joy=null, raf=0, formerStamp=0, flash=null, presenceTag=null, partyAtEnd=[];
  let loadoutBattle=false;

  function progress() {
    if(!M.past||typeof M.past!=='object')M.past={};
    return M.past;
  }

  function pending() {
    const count=progress().pending;
    return Number.isInteger(count)&&count>0?count:0;
  }

  function refreshEntry() {
    window.VerityTimeline?.refreshEntry();
  }

  function sound(hz,duration,end) {
    battle.cue(hz,duration,end);
  }

  function displayText(id,value) {
    if($(id).textContent!==value)$(id).textContent=value;
  }

  function playerData() {
    const preferred=M.fb?.fav;
    const style=M.own[preferred]&&TY[preferred]?preferred:(M.lo||[]).find(key=>M.own[key]&&TY[key])||'verity';
    return {style,nick:M.fb?.nick||'Хранитель',css:csStr()};
  }

  function drawPlayer(c,x,y,player,time,own=false) {
    arAvatar(c,x,y,player.style,player.nick,player.css,own,0,0,false,1,time,false,undefined,false);
  }

  function visiblePeers() {
    return Object.values(AR.oth).map(peer=>({x:peer.x,y:peer.y,style:TY[peer.a]?peer.a:'verity',nick:peer.n,css:peer.cs}));
  }

  function disconnect() {
    if(!presenceTag)return;
    const uid=ON.uid, entry=++AR.entry;
    presenceTag=null;
    arClosePlayers();
    const queued=AR.putTask;
    Promise.resolve(queued).then(()=>{
      if(uid&&entry===AR.entry&&!arPresence()&&ON.uid===uid&&onOk())return db('arena/p/'+uid,{m:'DELETE'});
    }).catch(()=>{});
  }

  function stagePresence(stage,online) {
    if(!online)return;
    AR.entry=(AR.entry||0)+1;
    arClosePlayers();AR.streamRetry=0;
    AR.oth=Object.create(null);
    presenceTag='past-machine-'+stage;
    AR.me={x:mover.x,y:mover.y,mv:false,face:1,carry:[],stun:0,sw:0};
    arPut(1);
    arPollPlayers();
  }

  function presence() {
    return cur==='past'?presenceTag:null;
  }

  function fieldPosition(x,y) {
    Object.assign(mover,{x,y,mv:false,face:1});
  }

  function detachView() {
    cancelAnimationFrame(raf);raf=0;formerStamp=0;
    disconnect();
    view=null;cut=null;flash=null;
    stopJoystick();keys.clear();
    $('past-flash').hidden=true;
    document.body.classList.remove('past-open');
    sceneRoot.classList.add('hide');
  }

  function startFrame() {
    if(!raf)raf=requestAnimationFrame(frame);
  }

  function setView(kind,title,detail) {
    const oldOnline=view?.online??false;
    view={kind,age:0,online:oldOnline};
    sceneRoot.classList.remove('hide');
    document.body.classList.add('past-open');
    displayText('past-title',title);
    displayText('past-place',progress().abuseStage?'Этап 2 из 2 · '+detail:detail);
    joystick.hidden=true;
    $('past-caption').hidden=true;
    $('past-prompt').hidden=true;
    $('past-archive').hidden=true;
    $('past-exit').textContent=cur==='game'?'Вернуться к бою':'В меню';
    startFrame();
    lmTick();
  }

  function prompt(line,label,action,disabled=false) {
    displayText('past-instruction',line);
    const button=$('past-action');
    button.hidden=!label;button.textContent=label;button.onclick=action;button.disabled=disabled;
    $('past-prompt').hidden=false;
  }

  function teleport(color) {
    flash={left:.56,color};
    $('past-flash').dataset.color=color;
    if(!motion.matches){
      $('past-flash').style.opacity='.82';
      $('past-flash').hidden=false;
    }
    sound(color==='white'?440:660,.33,165);
  }

  function open(fromArena=false) {
    const online=Boolean(fromArena&&ON.uid&&M.fb?.nick&&onOk());
    if(fromArena){
      const origin=AR.me||{x:1000,y:810};
      partyAtEnd=visiblePeers().filter(peer=>Math.hypot(origin.x-peer.x,origin.y-peer.y)<560).slice(0,6);
    }else partyAtEnd=[];
    if(cur!=='past')scr('past');
    if(pending()){enterDeposit(pending());return}
    if(progress().complete&&!fromArena){archive();return}
    aftermath(online);
  }

  function aftermath(online=false) {
    setView('aftermath','Арена абьюза','Последняя песня');
    view.online=online;
    prompt('Музыка стихает. Над танцполом раскрывается разлом.','Войти в разлом',whiteField);
  }

  function fromVault() {
    partyAtEnd=[];
    if(cur!=='past')scr('past');
    const profile=M.fb, connected=Boolean(profile?.nick&&onOk());
    enterWhiteField(connected&&Boolean(ON.uid));
    if(connected&&!ON.uid){
      const field=view;
      onAuth().then(()=>{
        if(cur==='past'&&view===field&&M.fb===profile&&ON.uid){
          view.online=true;
          stagePresence('white',true);
        }
      }).catch(()=>{});
    }
  }

  function whiteField() {
    if(view?.kind==='aftermath')enterWhiteField(view.online);
  }

  function enterWhiteField(online) {
    const offset=online?[...ON.uid].reduce((sum,char)=>sum+char.charCodeAt(0),0)%149-74:0;
    fieldPosition(1000+offset,810+Math.abs(offset)/4);
    setView('white','Белое поле','За границей времени');
    stagePresence('white',online);
    joystick.hidden=false;
    prompt('Осмотрись с помощью джойстика или клавиш WASD.','',null);
    teleport('white');
  }

  function meetAdmin() {
    if(view?.kind!=='white')return;
    showScene('meeting','Машина прошлого','Рассказ Админити',arrival);
  }

  function arrival() {
    const online=view.online;
    fieldPosition(mover.x,829);
    stagePresence('ruins',online);
    showScene('arrival','Разрушенное измерение','У портала',openLoadout);
    teleport('blue');
  }

  function openLoadout() {
    if(progress().abuseStage==='white'){
      progress().abuseStage='defense';
      save();
    }
    loadoutBattle=true;
    detachView();
    loOpen('past-defense');
  }

  function showScene(chapter,title,detail,onDone) {
    setView(chapter,title,detail);
    cut={chapter,lines:dialogues[chapter],index:0,age:0,paused:false,onDone};
    $('past-caption').hidden=false;
    updateCaption();
    $('past-next').focus({preventScroll:true});
  }

  function updateCaption() {
    const [who,line]=cut.lines[cut.index];
    displayText('past-speaker',who);
    displayText('past-line',line);
    $('past-pause').textContent=cut.paused?'Продолжить':'Пауза';
    $('past-pause').setAttribute('aria-pressed',String(cut.paused));
    $('past-next').textContent=cut.index===cut.lines.length-1?'Продолжить':'Дальше';
  }

  function nextLine() {
    if(!cut)return;
    if(cut.index===cut.lines.length-1){completeScene();return}
    cut.index++;cut.age=0;
    updateCaption();
    const stage=cut.lines[cut.index][2];
    if(stage==='threat')teleport('white');
    if(stage==='beam'||stage==='seal')sound(stage==='seal'?98:294,.4,52);
  }

  function completeScene() {
    if(!cut)return;
    const next=cut.onDone;
    cut=null;
    $('past-caption').hidden=true;
    next();
  }

  function showBoss(activeRound) {
    showScene('archon','Архонт перемотки','Последняя волна',()=>{
      detachView();
      if(G!==activeRound||cur!=='game'||G.over)return;
      G.past.paused=false;
      if(!G.guest)battle.startWave();
    });
  }

  function endBattle(won) {
    if(G.over)return;
    G.over=won?2:1;
    G.run=false;
    G.past.resultAt=performance.now();
    if(won){
      progress().pending=G.past.fragments;
      save();
      $('et').textContent='Архонт повержен. '+pl(G.past.fragments,'частица','частицы','частиц')+' для портала.';
      setEndButtons('К порталу');
    }else{
      $('et').textContent='Портал не выдержал оборону';
      setEndButtons('Повторить оборону');
    }
    $('end').className='';
    sound(won?588:145,.55,won?882:75);
    lmTick();
  }

  function lostConnection() {
    endBattle(false);
    $('et').textContent='Связь с комнатой потеряна';
  }

  function setEndButtons(first='Выбрать сложность') {
    $('e1').textContent=first;
    $('e2').textContent=first==='Выбрать сложность'?'В лобби':'В меню';
  }

  async function proceedBattle() {
    const game=G;
    if(!game?.past)return;
    if(game.over===1){openLoadout();return}
    if(game.over!==2)return;
    const resultInTransit=()=>{
      const now=performance.now(), sentAt=game.past.finalSentAt;
      return game.coop?.g&&now-game.past.resultAt<4500&&(!sentAt||now-sentAt<1000);
    };
    if(resultInTransit()){
      const button=$('e1');
      button.disabled=true;
      coHostTick();
      try{
        while(cur==='game'&&G===game&&resultInTransit()){
          await new Promise(resolve=>setTimeout(resolve,160));
        }
      }finally{button.disabled=false}
    }
    if(cur==='game'&&G===game)enterDeposit(game.past.fragments);
  }

  function enterDeposit(shards) {
    if(cur!=='past')scr('past');
    setView('deposit','Портал восстановлен','Разрушенное измерение');
    view.fragments=shards;
    prompt('Админити и Странник развернули портал к вам. «Кидайте частицы сюда! Мы отправим захватчиков обратно».',
      'Вставить частицы · '+shards,()=>{
        if(view?.kind!=='deposit'||shards<1)return;
        showScene('closing','Закрытие разлома','Разрушенное измерение',finishStory);
        view.fragments=shards;
        sound(220,.6,520);
      });
  }

  function finishStory() {
    const oldState=M.past;
    const shards=pending()||view?.fragments||0;
    if(shards<1){archive();return}
    M.past={...oldState,complete:true,pending:0};
    delete M.past.abuseStage;
    delete M.past.vaultRun;
    if(!save()){
      M.past=oldState;
      prompt('Сохранение награды прервалось. Попробуй ещё раз.','Сохранить награду',finishStory);
      return;
    }
    archive(true);
    refreshEntry();
  }

  function archive(justWon=false) {
    disconnect();
    setView('archive','Машина прошлого','Портал времени');
    const root=$('past-archive');
    root.innerHTML='<div class="past-archive-panel"><h2>'+(justWon?'Вы спасли Веритию':'История завершена')+'</h2>'+
      '<p>Странник открыл портал к первой версии Веритии.</p>'+
      (M.own[battle.unitKey]?'<div class="past-rewards"><div>'+pic(battle.unitKey,1,45)+'<b>Chronosity · Relic</b></div></div>':'')+
      '<div class="past-archive-actions"><button type="button" class="past-primary" id="past-timeline">В Ивент прошлого</button></div></div>';
    root.hidden=false;
    $('past-timeline').onclick=()=>window.VerityTimeline?.open();
  }

  function exitView() {
    if(cut?.chapter==='archon'){completeScene();return}
    if(cur==='game'&&G?.past&&!G.over){
      mOpen('Выйти из обороны?','<p>Текущая оборона начнётся заново при следующем входе.</p>',[
        ['Выйти',()=>{mClose();menu();scr('menu')}],['Продолжить',mClose]
      ]);
      return;
    }
    menu();scr('menu');
  }

  function move(dt,now) {
    let dx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
    let dy=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
    if(joy){dx=joy.dx;dy=joy.dy}
    const norm=Math.max(1,Math.hypot(dx,dy)), speed=255*dt/norm;
    mover.x=Math.max(55,Math.min(1945,mover.x+dx*speed));
    mover.y=Math.max(75,Math.min(1345,mover.y+dy*speed));
    mover.mv=Boolean(dx||dy);
    if(dx)mover.face=dx>0?1:-1;
    if(presenceTag&&AR.me){
      Object.assign(AR.me,mover);
      arMovePeers(now,Date.now(),dt);
      arPut(0);
    }
  }

  function stopJoystick() {
    joy=null;
    knob.style.transform='';
  }

  function updateJoystick(event) {
    if(event.pointerId!==joy?.pointer)return;
    const box=joystick.getBoundingClientRect(), r=box.width*.3;
    const dx=(event.clientX-box.left-box.width/2)/r,dy=(event.clientY-box.top-box.height/2)/r;
    const scale=Math.max(1,Math.hypot(dx,dy));
    joy.dx=dx/scale;joy.dy=dy/scale;
    knob.style.transform='translate('+joy.dx*r+'px,'+joy.dy*r+'px)';
  }

  function fieldCamera(c,kind,w,h,time) {
    const zoom=Math.max(.65,Math.min(1.15,w/820));
    const cx=Math.max(w/zoom/2,Math.min(2000-w/zoom/2,mover.x));
    const cy=Math.max(h/zoom/2,Math.min(1400-h/zoom/2,mover.y));
    c.save();c.translate(w/2,h*.45);c.scale(zoom,zoom);c.translate(-cx,-cy);
    art.field(c,kind);
    if(kind==='white'&&view.age>1.6){
      const entrance=Math.min(1,(view.age-1.6)*2);
      c.save();c.globalAlpha=entrance;
      drawAdmin(c,1000,659,52,time,true);c.restore();
      if(entrance<1){
        c.save();c.globalAlpha=1-entrance;
        thShape(c,p=>p.ellipse(1000,695,20+entrance*78,6+entrance*21,0,0,Math.PI*2),null,'#81c6f4',3);
        c.restore();
      }
    }
    const players=[...visiblePeers().filter(()=>Boolean(presenceTag)),{...mover,...playerData(),own:true}];
    players.sort((a,b)=>a.y-b.y).forEach(p=>drawPlayer(c,p.x,p.y,p,time,p.own));
    c.restore();
  }

  function drawAdmin(c,x,y,r,time,outOfBreath=false) {
    apAdminity(c,x,y,r,time,0,outOfBreath,false);
    if(!outOfBreath)return;
    thEllipse(c,x+r*.12,y+r*.32,r*.105,r*.13,'#512841');
    thEllipse(c,x+r*.67,y-r*.36+Math.sin(time*2)*3,r*.065,r*.12,'#a3e9ff',.43);
    thEllipse(c,x+r*.82,y-r*.13+Math.sin(time*2.4)*3,r*.045,r*.084,'#adf5ff',.35);
  }

  function poster(c,kind,w,h) {
    c.save();
    const colors=kind==='white'?['#daeaf8','#f7fcff','#e8f3fc']:
      kind==='retrodisco'?['#111027','#2a1c3c','#191327']:['#111a36','#313959','#141d36'];
    c.fillStyle=thGradient(c,0,0,0,h,colors);c.fillRect(0,0,w,h);
    const scale=Math.min(h/540,Math.max(w/960,Math.min(w/620,h/900)));
    c.translate((w-960*scale)/2,(h-540*scale)*.44);c.scale(scale,scale);
    return ()=>c.restore();
  }

  function posterStage(c,kind,scale=1,shiftX=0,shiftY=0) {
    c.save();c.translate(shiftX,shiftY);c.scale(.48*scale,.386*scale);
    art.field(c,kind);
    c.restore();
  }

  function flashbackArt(c,stage,t) {
    art.flashback(c,t);
    art.portal(c,699,263,126,t,stage==='departure'&&t>2.4?0:1);
    drawAdmin(c,309,345,82,t,stage==='departure');
    c.save();c.globalAlpha=stage==='departure'?Math.max(0,1-t/1.8):1;
    art.traveler(c,610+(stage==='departure'?Math.min(88,t*42):0),338,76,t);
    c.restore();
  }

  function drawCrew(c,t) {
    const crew=(presenceTag?visiblePeers():partyAtEnd).slice(0,5);
    crew.forEach((peer,i)=>drawPlayer(c,206+i*112,402-(i%2)*25,peer,t));
    drawPlayer(c,crew.length?751:291,414,playerData(),t,true);
  }

  function drawEnding(c,stage,t) {
    posterStage(c,'ruins');
    const charge=stage==='shards'&&t>2.4||stage==='threat'||stage==='beam'||stage==='seal'&&t<1.55;
    const closing=stage==='seal'?Math.max(.68,1-(t-1.45)*.18):1;
    art.portal(c,506,244,123*Math.min(1,closing),t,charge?1:0,true);
    drawAdmin(c,685,361,51,t);
    art.traveler(c,332,356,51,t);
    drawCrew(c,t);
    if(stage==='shards'){
      const arrival=Math.min(1,t/2.45), suction=Math.max(0,Math.min(1,(t-2.45)/1.25));
      const count=Math.min(42,view.fragments??1);
      for(let i=0;i<count;i++){
        const a=i*2.39996+t*.86, r=(1-arrival)*(65+i%7*12)+12*(1-suction);
        const startX=191+i*41%560;
        const x=startX+(506-startX)*arrival+Math.cos(a)*r;
        const y=421-176*arrival-Math.sin(Math.PI*arrival)*135+Math.sin(a)*r*.38;
        if(suction<1)art.crystal(c,x,y,(2+i%5)*(1-suction),i%2?'#85ebff':'#cf96ff',a);
      }
      if(t>1.85){
        c.save();c.globalAlpha=Math.max(0,1-(t-1.85)/2.5);
        for(let i=0;i<11;i++){
          const k=Math.max(0,Math.min(1,(t-1.65-i*.09)/1.4));
          art.invader(c,90+i*67+(506-90-i*67)*k,370+(244-370)*k,Math.max(.4,17*(1-k)),i%6,t);
        }
        c.restore();
      }
    }else if(stage==='beam'){
      const frozen=t>1.35, distance=Math.min(333,Math.max(0,t-.24)*296);
      const absorbed=Math.max(0,Math.min(1,(t-1.85)/1.27));
      c.save();c.globalAlpha=1-absorbed;
      thGlow(c,515+distance*.5,241-distance*.29,118,'#dc91ff65');
      c.strokeStyle='#b693ff';c.lineWidth=22;c.lineCap='round';
      c.beginPath();c.moveTo(513,233);c.lineTo(513+distance,233-distance*.55);c.stroke();
      c.strokeStyle='#ffe5fa';c.lineWidth=5;c.stroke();
      c.restore();
      if(frozen){
        if(absorbed>0&&absorbed<1){
          for(let i=0;i<12;i++){
            const radius=(1-absorbed)*(47+i*6), angle=i*2.39+t*1.42;
            art.crystal(c,744+Math.cos(angle)*radius,92+Math.sin(angle)*radius*.7,4*(1-absorbed),'#debaff',angle);
          }
        }
        const figureScale=Math.max(0,1-(t-3)*2.1);
        if(figureScale>0)art.figure(c,744,92,43*Math.min(1,figureScale),0);
        c.fillStyle='#c1f1ff24';c.fillRect(0,0,960,540);
      }else{
        art.figure(c,336+(t/1.35)*408,358-(t/1.35)*266,35,t);
      }
    }else if(stage==='echoes'){
      art.portal(c,160,198,64,t,1);
      art.portal(c,812,211,64,-t,1);
      art.figure(c,493,292,29,t);
    }else if(stage==='goodbye'){
      art.figure(c,506,367,31,t);
    }
  }

  function render(c,w,h,time) {
    c.fillStyle=view.kind==='white'?'#eef8ff':'#1c2540';c.fillRect(0,0,w,h);
    const stage=cut?.lines[cut.index][2];
    if(view.kind==='white'){fieldCamera(c,view.kind,w,h,time);return}
    const theme=stage==='white'?'white':view.kind==='aftermath'?'retrodisco':'ruins';
    const restore=poster(c,theme,w,h);
    if(view.kind==='aftermath'){
      posterStage(c,'retrodisco');
      c.save();c.scale(.48,.48);apDJ(c,time);c.restore();
      art.portal(c,480,195,67+Math.min(34,view.age*12),time,view.age>1.2?1:0,true);
      partyAtEnd.forEach((p,i)=>drawPlayer(c,197+i*104,391+(i%2)*29,p,time));
      drawPlayer(c,480,440,playerData(),time,true);
      c.fillStyle='rgba(14,10,28,'+Math.min(.6,time*.11)+')';c.fillRect(0,0,960,540);
    }else if(stage==='flashback'||stage==='departure'){
      flashbackArt(c,stage,motion.matches?(stage==='departure'?2.8:.65):cut.age);
    }else if(stage==='white'){
      posterStage(c,'white');
      drawAdmin(c,474,282,83,time,true);
      drawCrew(c,time);
    }else if(view.kind==='archon'){
      posterStage(c,'ruins');
      art.portal(c,465,243,127,time,0,true);
      art.archon(c,477,310,131,time,1);
    }else if(view.kind==='arrival'){
      posterStage(c,'ruins');
      art.portal(c,563,231,116,time,0,true);
      art.traveler(c,321,307,72,time);
      drawAdmin(c,662,329,51,time,true);
      if(stage==='device')art.figure(c,390,236,31,time);
      drawCrew(c,time);
    }else if(view.kind==='deposit'||view.kind==='closing'){
      drawEnding(c,stage||'deposit',motion.matches&&stage==='beam'?2.25:cut?.age??time);
    }else{
      posterStage(c,'ruins');art.portal(c,479,212,113,time,1);
      art.figure(c,480,358,44,time);
    }
    restore();
  }

  function frame(now) {
    raf=0;
    if(!view)return;
    const dt=formerStamp&&!document.hidden?Math.max(0,Math.min(.05,(now-formerStamp)/1000)):0;
    formerStamp=now;
    if(!cut?.paused)view.age+=dt;
    if(view.kind==='aftermath'&&view.age>=4.5)whiteField();
    if(view.kind==='white'){
      move(dt,now);
      if(view.kind==='white'&&view.age>=1.8&&!view.appeared){
        view.appeared=true;
        sound(196,.29,360);
        prompt('Админити появился на белом поле. Он запыхался и зовёт хранителей.','Выслушать Админити · E',meetAdmin);
      }
      if(view.kind==='white'&&view.age>=9.5)meetAdmin();
    }else if(presenceTag&&AR.me){arMovePeers(now,Date.now(),dt);arPut(0)}
    if(cut&&!cut.paused){
      cut.age+=dt;
      const [,text,,duration]=cut.lines[cut.index];
      if(cut.age>=(duration??Math.max(3.0,Math.min(9.2,1.05+text.length*.048))))nextLine();
    }
    if(flash){
      flash.left-=dt;
      if(flash.left<=0){$('past-flash').hidden=true;flash=null}
      else $('past-flash').style.opacity=String(Math.min(.82,flash.left/.56*.82));
    }
    if(!view)return;
    const dpr=Math.min(2,devicePixelRatio||1);
    const w=Math.max(1,innerWidth), h=Math.max(1,innerHeight);
    const cw=Math.round(w*dpr), ch=Math.round(h*dpr);
    if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch}
    ctx.setTransform(dpr,0,0,dpr,0,0);
    render(ctx,w,h,motion.matches?0:view.age);
    startFrame();
  }

  function renderBattleHud() {
    const state=cur==='game'?G?.past:null;
    const panel=$('past-battle');
    panel.hidden=!state;
    document.body.classList.toggle('past-defense',Boolean(state));
    if(!state)return;
    const wave=battle.waves[G.wave>0?G.wave-1:0], max=battle.waves.length;
    displayText('wmx','/'+max);
    displayText('past-battle-wave',G.wave?'Волна '+G.wave+'/'+max+' · '+wave.label:'Подготовка · '+max+' волн');
    displayText('past-shards',pl(state.fragments,'частица','частицы','частиц'));
    const button=$('past-freeze');
    button.disabled=Boolean(G.over||state.paused||state.cooldown>0||!G.en.some(enemy=>!enemy.dead&&!enemy.po));
    button.classList.toggle('on',state.frozen>0);
    const caption=state.frozen>0?'Время стоит · '+Math.ceil(state.frozen)+' с':state.cooldown>0?'Зарядка · '+Math.ceil(state.cooldown)+' с':'5 секунд · F';
    if(button.lastElementChild.textContent!==caption)button.lastElementChild.textContent=caption;
    const boss=G.en.find(enemy=>enemy.ty==='time_archon'&&!enemy.dead);
    const bossHud=$('past-boss-health');
    bossHud.hidden=!boss;
    if(boss){
      bossHud.querySelector('progress').value=Math.max(0,boss.hp/boss.max*100);
      bossHud.lastElementChild.textContent='Фаза '+(battle.phase(boss)+1)+' · '+Math.ceil(boss.hp)+' HP';
    }
  }

  function handleFreeze() {
    if(cur!=='game'||$('past-freeze').disabled||loadingModal())return;
    if(G.guest&&CO.host){
      const time=performance.now();
      if(G.past.requestAt&&time-G.past.requestAt<1600)return;
      G.past.requestAt=time;
      db('rooms/'+CO.host+'/a',{m:'POST',b:{ty:'m',m:6,t:{'.sv':'timestamp'}}})
        .then(result=>{if(!result.ok)say('Устройство не ответило. Попробуй снова.')})
        .catch(()=>say('Связь прервалась. Попробуй снова.'));
      return;
    }
    battle.freeze(G);
  }

  function loadingModal() {
    return !$('modal').classList.contains('hide');
  }

  function snapshot() {
    const state=G.past;
    return {fragments:state.fragments,frozen:state.frozen,cooldown:state.cooldown,paused:state.paused,
      locked:G.units.flatMap((unit,index)=>unit.pastLock>0?[index]:[])};
  }

  function receive(packet) {
    const state=G.past, remote=packet.past;
    if(!remote)return;
    state.frozen=remote.frozen||0;state.cooldown=remote.cooldown||0;
    state.fragments=Math.max(0,Math.floor(remote.fragments||0));
    state.paused=Boolean(remote.paused);
    const locks=new Set(remote.locked||[]);
    G.units.forEach((unit,i)=>{unit.pastGuestLock=locks.has(i)});
    if(remote.paused&&!state.seenArchon){state.seenArchon=true;showBoss(G)}
    if(packet.ov&&!G.over){if(cut?.chapter==='archon')completeScene();endBattle(packet.ov===2)}
    renderBattleHud();
  }

  function preferredMusic() {
    if(cur==='game'&&G?.past&&!G.over)return soundtrack.war;
    if(cur==='past')return soundtrack.story;
    return null;
  }

  window.PastMachine={...battle,open,fromVault,resumeDefense:openLoadout,presence,showBoss,endBattle,lostConnection,snapshot,receive,music:preferredMusic};

  const startScreen=scr;
  scr=function(screen){
    if(cur==='past'&&screen!=='past'||cur==='game'&&G?.past&&screen!=='game'){
      detachView();
      setEndButtons();
      $('past-battle').hidden=true;
    }
    const result=startScreen.apply(this,arguments);
    if(screen==='menu')refreshEntry();
    renderBattleHud();
    return result;
  };

  const startRound=startNow;
  startNow=function(mode){
    if(mode!=='past-defense'||G?.past)setEndButtons();
    const round=startRound.apply(this,arguments);
    if(mode==='past-defense'){
      loadoutBattle=false;
      G.spd=1;
      say('Поставь Верити рядом с дорожкой. Заморозку лучше сохранить до подхода Стопоров.');
      renderBattleHud();
      window.scrollTo(0,0);
    }
    return round;
  };

  const updateHud=hud;
  hud=function(){updateHud.apply(this,arguments);renderBattleHud()};

  const simulate=upd;
  upd=function(dt){
    if(!G?.past||G.guest||G.past.frozen<=0)return simulate(dt);
    // Tower knockback and legacy attacks can change progress outside the enemy loop.
    const held=G.en.map(enemy=>[enemy,enemy.d]);
    try{return simulate(dt)}
    finally{for(const [enemy,position] of held)enemy.d=position}
  };

  $('e1').addEventListener('click',event=>{
    if(cur!=='game'||!G?.past)return;
    event.stopImmediatePropagation();proceedBattle();
  },true);
  $('e2').addEventListener('click',event=>{
    if(cur!=='game'||!G?.past)return;
    event.stopImmediatePropagation();menu();scr('menu');
  },true);
  $('loback').addEventListener('click',event=>{
    if(!loadoutBattle||LOK!=='past-defense')return;
    loadoutBattle=false;
    event.stopImmediatePropagation();menu();scr('menu');
  },true);

  $('past-exit').onclick=exitView;
  $('past-battle-exit').onclick=exitView;
  $('past-freeze').onclick=handleFreeze;
  $('past-next').onclick=nextLine;
  $('past-skip').onclick=completeScene;
  $('past-pause').onclick=()=>{if(cut){cut.paused=!cut.paused;updateCaption()}};

  joystick.addEventListener('pointerdown',event=>{
    if(joystick.hidden||joy)return;
    event.preventDefault();joystick.setPointerCapture(event.pointerId);
    joy={pointer:event.pointerId,dx:0,dy:0};updateJoystick(event);
  });
  joystick.addEventListener('pointermove',updateJoystick);
  for(const name of ['pointerup','pointercancel','lostpointercapture']){
    joystick.addEventListener(name,event=>{if(event.pointerId===joy?.pointer)stopJoystick()});
  }

  addEventListener('keydown',event=>{
    if(event.target?.closest?.('input,textarea,select,[contenteditable]')&&event.key!=='Escape')return;
    const key=event.key.toLowerCase();
    if(cur==='game'&&G?.past&&!view&&!event.repeat&&key==='f'){handleFreeze();return}
    if(!view||loadingModal())return;
    if(key==='escape'){event.preventDefault();exitView();return}
    if(!joystick.hidden&&['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(key)){
      event.preventDefault();keys.add(key);
    }
    if(key==='e'&&!event.repeat&&!$('past-prompt').hidden)$('past-action').click();
  });
  addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
  addEventListener('blur',()=>{keys.clear();stopJoystick()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();stopJoystick()}});

  art.cover($('past-cover').getContext('2d'));
  refreshEntry();
})();
