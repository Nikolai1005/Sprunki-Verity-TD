/* The scheduled 3D arena and its story epilogue use the existing TD save. */
(() => {
  'use strict';
  const channel='vault-abuse-v1';
  const windowHours=Object.freeze({
    id:'vault-time-20261128',
    start:Date.parse('2026-11-28T20:00:00+03:00'),
    end:Date.parse('2026-11-28T20:20:00+03:00')
  });
  const stage=$('vault-abuse-stage'), status=$('vault-abuse-status');
  const retry=$('vault-abuse-retry'), fallback=$('vault-abuse-fallback');
  let frame=null, loadTimer=0, dismissed=false, storyOpened=false;

  function adminWindow(now=Date.now()){
    return now>=windowHours.start&&now<windowHours.end?windowHours:null;
  }

  function checkpoint(){
    return M.past??(M.past={});
  }

  function relevant(state){
    return state?.abuseEvent===windowHours.id;
  }

  function needsStage(){
    if(dismissed)return false;
    const state=M.past;
    if(adminWindow()&&state?.abuseFinished!==windowHours.id)return true;
    if(storyOpened)return false;
    return Boolean(state?.pending>0||['white','defense'].includes(state?.abuseStage)||state?.participated&&canFinish(state));
  }

  function canFinish(state){
    return relevant(state)&&state.abuseStage==='vault'&&state.vaultRun&&Date.now()>=windowHours.end;
  }

  function unload(){
    clearTimeout(loadTimer);
    frame?.remove();
    frame=null;
  }

  function updateFallback(){
    fallback.hidden=retry.hidden||Date.now()<windowHours.end;
  }

  function failed(message){
    unload();
    $('vault-abuse-message').textContent=message;
    retry.hidden=false;
    updateFallback();
    status.hidden=false;
    retry.focus({preventScroll:true});
  }

  function loadVault(){
    const run=M.past?.vaultRun;
    if(cur!=='vault-abuse'||!run)return;
    unload();
    $('vault-abuse-message').textContent='Открываем сейф…';
    retry.hidden=fallback.hidden=true;
    status.hidden=false;
    const url=new URL('vault-stage.html',document.baseURI);
    url.searchParams.set('v','18');
    url.searchParams.set('abuse-run',run);
    url.searchParams.set('abuse-end',String(windowHours.end));
    if(!SND||!M.set?.mus||VOL<=0)url.searchParams.set('music','off');
    frame=document.createElement('iframe');
    frame.title='Арена хранилища 3D';
    frame.allow='autoplay';
    frame.src=url.href;
    stage.prepend(frame);
    loadTimer=setTimeout(()=>failed('Арена загружается слишком долго.'),20000);
  }

  function continueStory(){
    const state=M.past;
    if(!canFinish(state))return;
    const completed={...state,abuseStage:'white',abuseFinished:windowHours.id};
    const previousUnit=M.own.chronosity;
    if(state.participated&&!previousUnit)M.own.chronosity=1;
    delete completed.vaultRun;
    delete completed.participated;
    M.past=completed;
    if(!save()){
      M.past=state;
      if(previousUnit===undefined)delete M.own.chronosity;
      else M.own.chronosity=previousUnit;
      if(!dismissed){
        scr('vault-abuse');
        failed('Не удалось сохранить завершение арены. Попробуй ещё раз.');
      }
      return;
    }
    if(dismissed)return;
    storyOpened=true;
    if(completed.pending>0)PastMachine.open();
    else PastMachine.fromVault();
  }

  function openScheduled(){
    const state=checkpoint();
    if(!adminWindow()){
      if(canFinish(state)){
        if(state.participated)continueStory();
        return;
      }
      storyOpened=true;
      if(state.pending>0)PastMachine.open();
      else if(state.abuseStage==='defense')PastMachine.resumeDefense();
      else if(state.abuseStage==='white')PastMachine.fromVault();
      return;
    }
    if(!relevant(state)||state.abuseStage!=='vault'||!state.vaultRun){
      if(!adminWindow())return;
      state.abuseStage='vault';
      state.abuseEvent=windowHours.id;
      state.participated=false;
      state.vaultRun=globalThis.crypto?.randomUUID?.()??Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
      save();
    }
    scr('vault-abuse');
    loadVault();
  }

  function poll(){
    if(cur==='vault-abuse'){updateFallback();return}
    const state=M.past;
    if(dismissed&&state?.participated&&canFinish(state)){continueStory();return}
    const note=adminWindow()?'Арена хранилища открыта до 20:20 МСК.':
      Date.now()<windowHours.start?'28 ноября в 20:00 МСК начнётся абьюз «Хранилище времени».':'';
    const banner=$('vault-schedule');
    banner.textContent=note;
    banner.hidden=!note;
    const readyScreen=cur==='menu'||cur==='timeline'&&window.VerityTimeline?.canInterrupt();
    if(!readyScreen||document.hidden||!$('modal').classList.contains('hide')||!needsStage())return;
    openScheduled();
  }

  addEventListener('message',event=>{
    const data=event.data;
    if(cur!=='vault-abuse'||!frame||event.source!==frame.contentWindow||event.origin!==location.origin||
      data?.channel!==channel||data.run!==M.past?.vaultRun)return;
    if(data.type==='ready'){
      clearTimeout(loadTimer);
      status.hidden=true;
      frame.focus();
      frame.contentWindow.postMessage({channel,run:data.run,type:'begin'},location.origin);
    }else if(data.type==='participated'){
      if(adminWindow()&&!M.past.participated){M.past.participated=true;save()}
    }else if(data.type==='finished'){
      continueStory();
    }else if(data.type==='unavailable'){
      failed('Не удалось запустить 3D-арену на этом устройстве.');
    }
  });

  const showScreen=scr;
  scr=function(screen){
    if(cur==='vault-abuse'&&screen!=='vault-abuse')unload();
    return showScreen.apply(this,arguments);
  };

  retry.onclick=()=>{if(canFinish(M.past))continueStory();else loadVault()};
  fallback.onclick=continueStory;
  $('vault-abuse-exit').onclick=()=>{
    dismissed=true;menu();scr('menu');
  };
  window.VaultAbuse={adminWindow,needsStage,poll,getFrame:()=>frame};
  setInterval(poll,1000);
  setTimeout(poll,100);
})();
