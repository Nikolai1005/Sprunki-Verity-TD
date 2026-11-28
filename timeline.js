/* The route is saved at mission boundaries in the normal Verity TD profile. */
(() => {
  'use strict';
  const root=$('timeline'), canvas=$('timeline-canvas'), ctx=canvas.getContext('2d');
  const buttons=$('timeline-actions'), towers=$('timeline-towers'), slots=$('timeline-slots');
  const track={data:'timeline-score.mp3',volume:.36};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const width=960,height=540, assistPrice=100;
  const figureTrophy={id:'timefigure',n:'Фигурка времени',t:'d',h:'Пройти все 40 миссий Ивента прошлого',ev:1};
  const art=window.TimelineArt, missions=window.TimelineMissions;
  let model=null, scene='intro', intro=0, age=0, playing=false, playback=0, previous=null, frame=0;
  let rewardPending=null, renderedActions='', renderedTowers='', renderedSlots='', figure='', autoShown=false, suspended=false;

  function checkpoint(){
    const value=M.timeline;
    if(value&&Number.isInteger(value.next)&&value.next>=0&&value.next<=missions.catalog.length)
      return value;
    return M.timeline={next:0,coins:0,elapsed:0,crown:false,demonity:false,intro:false};
  }

  function text(id,value){
    const element=$(id);
    const content=String(value??'');
    if(element.textContent!==content)element.textContent=content;
  }

  function setStage(next){
    scene=next;
    previous=null;
    $('timeline-story').hidden=next!=='intro';
    $('timeline-play').hidden=next!=='mission';
    $('timeline-result').hidden=next==='intro'||next==='mission';
    root.dataset.scene=next;
    renderedActions=renderedTowers=renderedSlots='';
    $('timeline-rewards').hidden=true;
  }

  function startMission(){
    const savepoint=checkpoint();
    if(savepoint.next>=missions.catalog.length){showFinish();return}
    rewardPending=null;
    const mission=missions.catalog[savepoint.next];
    setStage('mission');
    text('timeline-number','Миссия '+mission.number+' из '+missions.catalog.length);
    text('timeline-epoch','v'+mission.version);
    text('timeline-title',mission.title);
    text('timeline-objective',mission.description);
    text('timeline-lore',mission.lore);
    model=missions.create(savepoint.next,{
      crown:savepoint.crown===true, demonity:savepoint.demonity===true,
      reinforce:savepoint.assistAt===savepoint.next, futurity:Boolean(M.own.futurity),
      onComplete:result=>{rewardPending=result;recordWin()}, onDefeat:showLoss,
      onCue:kind=>{
        const sounds={success:[620,.19,'triangle',.11,930],defeat:[210,.28,'triangle',.11,88],
          freeze:[370,.29,'sine',.14,110],boss:[120,.36,'triangle',.16,52],phase:[366,.21,'triangle',.12,715]};
        if(sounds[kind])tone(...sounds[kind]);
      }
    });
    render();
  }

  function introLine(){
    const beat=art.intro[intro];
    text('timeline-number','Начало Веритии');
    text('timeline-epoch','До первой версии');
    text('timeline-title','Ивент прошлого');
    text('timeline-speaker',beat.speaker);
    text('timeline-line',beat.text);
    render();
    const btn=$('timeline-next');
    btn.textContent=intro===art.intro.length-1?'К первой миссии':'Дальше';
    btn.focus({preventScroll:true});
  }

  function nextBeat(){
    if(scene!=='intro')return;
    age=0;
    if(intro===art.intro.length-1){finishIntro();return}
    intro++;
    introLine();
  }

  function finishIntro(){
    checkpoint().intro=true;
    save();
    startMission();
  }

  function drawCover(){
    art.drawBackdrop(ctx,'rift',playback);
    art.drawFigurine(ctx,480,270,90,reduced.matches?0:playback);
  }

  function start(){
    if(cur==='timeline'||!window.VaultAbuse.pastEventOpens())return;
    if(!$('modal').classList.contains('hide'))mClose();
    scr('timeline');
    window.scrollTo(0,0);
    if(suspended){suspended=false;render()}
    else if(checkpoint().intro)startMission();
    else{
      model=null;intro=0;age=0;playing=true;
      $('timeline-pause').textContent='Пауза';
      setStage('intro');
      introLine();
    }
    cancelAnimationFrame(frame);
    previous=null;
    frame=requestAnimationFrame(loop);
    lmTick();
  }

  function showResult(title,body,action,handler){
    setStage('result');
    text('timeline-result-title',title);
    text('timeline-result-text',body);
    const button=$('timeline-result-next');
    button.textContent=action;button.onclick=handler;
    button.focus({preventScroll:true});
  }

  function showLoss(){
    showResult('Этап не пройден','Продолжишь с этой миссии. Ранее собранные монеты и находки сохранены.',
      'Повторить миссию',startMission);
  }

  function recordWin(){
    if(!model||!rewardPending)return;
    const old=checkpoint();
    if(old.next!==model.mission.number-1)return;
    const result=rewardPending, coins=Number(result.coins)||0;
    const elapsed=Math.max(0,Math.round(Number(result.elapsed)||0));
    const next={...old,next:old.next+1,coins:(Number(old.coins)||0)+coins,elapsed:(Number(old.elapsed)||0)+elapsed,
      crown:old.crown||result.crown===true,demonity:old.demonity||result.demonity===true};
    delete next.assistAt;
    const finale=next.next===missions.catalog.length;
    const previousFuturity=M.own.futurity;
    const previousTrophies=M.tro;
    if(finale){
      next.figure=true;
      M.own.futurity=1;
      M.tro={...previousTrophies,[figureTrophy.id]:previousTrophies?.[figureTrophy.id]??{t:Date.now(),n:1}};
    }
    M.timeline=next;
    if(!save()){
      M.timeline=old;
      if(previousFuturity===undefined)delete M.own.futurity;
      else M.own.futurity=previousFuturity;
      if(previousTrophies===undefined)delete M.tro;
      else M.tro=previousTrophies;
      showResult('Нужно сохранить прогресс','Миссия пройдена. Попробуй сохранить результат ещё раз.',
        'Сохранить',recordWin);
      return;
    }
    rewardPending=null;
    refreshEntry();
    if(finale){showFinish();return}
    const unlock=result.crown?' Корона прошлого теперь с тобой.':result.demonity?' Demonity открыт для следующих миссий.':
      model.mission.kind==='hunt'?' Лорд Верити: «Спасибо, хранители!»':'';
    showResult('Миссия '+model.mission.number+' пройдена',
      (coins?'Временные монеты +'+coins+'.':'Портал ведёт дальше.')+unlock,'Следующая версия',startMission);
  }

  function showFinish(){
    showResult('История Веритии восстановлена','Награды за 40 миссий — Фигурка времени и Futurity редкости Relic.',
      'В меню',()=>{menu();scr('menu')});
    root.dataset.scene='complete';
    text('timeline-number','40 из 40 миссий');
    text('timeline-epoch','Верития спасена');
    text('timeline-title','Ивент прошлого');
    render();
    const holder=$('timeline-rewards');
    holder.hidden=false;
    holder.replaceChildren();
    for(const [id,name] of [[figure,'Фигурка времени'],[IMG.futurity1,'Futurity · Relic']]){
      const div=document.createElement('div'),img=new Image(), label=document.createElement('span');
      img.src=id;img.alt='';img.width=54;img.height=54;
      label.textContent=name;div.append(img,label);holder.append(div);
    }
  }

  function drawCommands(container,commands,choose){
    const next=JSON.stringify(commands);
    if(next===(container===buttons?renderedActions:container===towers?renderedTowers:renderedSlots))return;
    if(container===buttons)renderedActions=next;
    else if(container===towers)renderedTowers=next;
    else renderedSlots=next;
    const focused=container.contains(document.activeElement)?document.activeElement.dataset.command:null;
    container.replaceChildren();
    for(const item of commands){
      const button=document.createElement('button');
      button.type='button';button.disabled=Boolean(item.disabled);
      button.dataset.command=item.id??item.key;
      button.textContent=item.label+(Number.isFinite(item.cost)?' · '+item.cost+' 🪙':'');
      if('selected' in item)button.setAttribute('aria-pressed',String(Boolean(item.selected)));
      button.onclick=()=>{choose(item);render()};
      container.append(button);
      if(focused===button.dataset.command&&!button.disabled)button.focus({preventScroll:true});
    }
  }

  function render(){
    const state=checkpoint();
    text('timeline-total',(state.coins||0)+' 🕰');
    const crown=$('timeline-crown');
    crown.hidden=!state.crown;
    if(scene!=='mission'||!model)return;
    const info=model.getUI();
    text('timeline-status',info.status===model.mission.description?'':info.status);
    text('timeline-detail',info.details);
    $('timeline-round').hidden=info.coins==null;
    text('timeline-battle-coins',info.coins==null?'':info.coins+' 🪙');
    text('timeline-health',info.health==null?'':info.health+' / '+info.maxHealth+' ❤');
    text('timeline-wave',info.waveCount?'Волна '+info.wave+' / '+info.waveCount:'');
    const bar=$('timeline-boss');
    bar.hidden=!(info.bossMax>0);
    if(!bar.hidden){
      bar.querySelector('progress').max=info.bossMax;
      bar.querySelector('progress').value=Math.max(0,info.bossHP);
      text('timeline-boss-label',Math.ceil(info.bossHP)+' HP'+(info.bossPhase?' · Фаза '+info.bossPhase:''));
    }
    drawCommands(towers,info.towers??[],choice=>model.select(choice.key));
    drawCommands(buttons,info.actions??[],choice=>model.action(choice.id));
    drawCommands(slots,info.slots??[],choice=>model.action(choice.id));
    $('timeline-placement').hidden=!info.slots?.length;
    $('timeline-assist').hidden=model.mission.kind!=='battle'||model.state.phase!=='ready'||state.assistAt===state.next;
    $('timeline-assist').disabled=(state.coins||0)<assistPrice;
    const freeze=$('timeline-freeze');
    freeze.hidden=!info.freeze;
    freeze.disabled=!info.freeze?.ready;
    freeze.textContent=info.freeze?.ready?'Остановить время · F':'Зарядка '+Math.ceil(info.freeze?.left||0)+' с';
  }

  function loop(stamp){
    if(cur!=='timeline')return;
    const dt=previous===null||document.hidden?0:Math.min(.10,Math.max(0,(stamp-previous)/1000));
    previous=stamp;playback+=dt;
    const time=reduced.matches?0:playback;
    if(scene==='intro'){
      if(playing)age+=dt;
      if(age>=art.intro[intro].seconds)nextBeat();
      if(scene==='intro')art.drawIntro(ctx,intro,reduced.matches?art.intro[intro].seconds*.5:age);
    }else if(scene==='mission'){
      model.update(dt);
      model.draw(ctx,width,height,time);
      render();
    }else drawCover();
    if(cur==='timeline')frame=requestAnimationFrame(loop);
  }

  function freeze(){
    if(scene==='mission'&&model){model.useFreeze();render()}
  }

  function refreshEntry(){
    const unlocked=window.VaultAbuse.pastEventOpens();
    $('past-entry').hidden=!unlocked;
    const archiveButton=$('past-timeline');
    if(archiveButton){
      archiveButton.hidden=!unlocked;
      text('past-timeline-message',unlocked?'Странник открыл портал к первой версии Веритии.':
        'Странник откроет портал после окончания абьюза.');
    }
    if(!unlocked)return false;
    const state=checkpoint();
    text('past-entry-note',state.next===missions.catalog.length?'40 из 40 · Награды и архив':
      state.next>0?'Продолжить миссию '+(state.next+1)+' из 40':'40 миссий по истории Sprunki Verity TD');
    return true;
  }

  function autoStart(){
    if(!refreshEntry()||autoShown||document.hidden||cur!=='menu'||!$('modal').classList.contains('hide'))return;
    if(window.VaultAbuse.needsStage())return;
    autoShown=true;
    if(!checkpoint().intro)start();
  }

  const baseScreen=scr;
  scr=function(screen){
    if(cur==='timeline'&&screen!=='timeline'){
      cancelAnimationFrame(frame);
      frame=0;previous=null;
      suspended=screen==='vault-abuse';
      if(!suspended)model=null;
    }
    const result=baseScreen.apply(this,arguments);
    if(screen==='menu')refreshEntry();
    return result;
  };

  canvas.addEventListener('click',event=>{
    if(scene!=='mission'||!model)return;
    const rect=canvas.getBoundingClientRect();
    model.point((event.clientX-rect.left)*width/rect.width,(event.clientY-rect.top)*height/rect.height);
    render();
  });
  $('timeline-exit').onclick=()=>{menu();scr('menu')};
  $('timeline-next').onclick=nextBeat;
  $('timeline-skip').onclick=finishIntro;
  $('timeline-pause').onclick=()=>{
    playing=!playing;
    $('timeline-pause').textContent=playing?'Пауза':'Продолжить';
  };
  $('timeline-freeze').onclick=freeze;
  $('timeline-assist').onclick=()=>{
    const state=checkpoint();
    if(scene!=='mission'||!model||state.assistAt===state.next||state.coins<assistPrice)return;
    const multiple=$('timeline-assist');
    if(multiple.hidden||model.state.phase!=='ready')return;
    state.coins-=assistPrice;state.assistAt=state.next;
    if(!save()){state.coins+=assistPrice;delete state.assistAt;return}
    startMission();
  };
  addEventListener('keydown',event=>{
    if(cur!=='timeline'||event.repeat||event.target.closest?.('input,textarea,[contenteditable]'))return;
    if(event.code==='KeyF'){event.preventDefault();freeze()}
  });
  $('past-entry').onclick=start;
  const rewardCanvas=document.createElement('canvas');
  rewardCanvas.width=rewardCanvas.height=144;
  art.drawFigurine(rewardCanvas.getContext('2d'),72,72,54,0);
  figure=rewardCanvas.toDataURL();
  TRO.push(figureTrophy);
  TROM[figureTrophy.id]=figureTrophy;
  TRC[figureTrophy.id]=rewardCanvas;
  TRI[figureTrophy.id]=figure;
  window.VerityTimeline={open:start,refreshEntry,music:()=>track,canInterrupt:()=>true};
  refreshEntry();
  setInterval(autoStart,1000);
})();
