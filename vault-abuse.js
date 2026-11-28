/* The 3D vault runs in an isolated frame. The event checkpoint belongs to the TD save. */
(() => {
  'use strict';

  const channel='vault-abuse-v1';
  const stage=$('vault-abuse-stage'), status=$('vault-abuse-status');
  const retry=$('vault-abuse-retry'), fallback=$('vault-abuse-fallback');
  let frame=null, loadTimer=0;

  function eventNote(state){
    if(state?.pending>0)return 'Продолжить у портала';
    if(state?.abuseStage==='defense')return 'Продолжить оборону портала';
    if(state?.abuseStage==='white')return 'Продолжить на белом поле';
    if(state?.vaultRun)return 'Продолжить на арене хранилища';
    if(state?.complete)return 'Архив и повторное прохождение';
    return 'Арена хранилища · Машина прошлого';
  }

  function unload(){
    clearTimeout(loadTimer);
    frame?.remove();
    frame=null;
  }

  function failed(message){
    unload();
    $('vault-abuse-message').textContent=message;
    retry.hidden=fallback.hidden=false;
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

    const src=new URL('vault-stage.html',document.baseURI);
    src.searchParams.set('v','17');
    src.searchParams.set('abuse-run',run);
    if(!SND||!M.set?.mus||VOL<=0)src.searchParams.set('music','off');
    frame=document.createElement('iframe');
    frame.title='Арена хранилища 3D';
    frame.allow='autoplay';
    frame.src=src.href;
    stage.prepend(frame);
    loadTimer=setTimeout(()=>failed('Арена загружается слишком долго.'),20000);
  }

  function continueStory(){
    if(cur!=='vault-abuse'||M.past?.abuseStage!=='vault')return;
    M.past.abuseStage='white';
    delete M.past.vaultRun;
    save();
    PastMachine.fromVault();
  }

  function open(replay=false){
    const state=M.past??(M.past={});
    if(!replay){
      if(state.pending>0){PastMachine.open();return;}
      if(state.abuseStage==='defense'){PastMachine.resumeDefense();return;}
      if(state.abuseStage==='white'){PastMachine.fromVault();return;}
      if(state.complete&&state.abuseStage!=='vault'){PastMachine.open();return;}
    }
    if(replay||state.abuseStage!=='vault'||!state.vaultRun){
      state.abuseStage='vault';
      state.vaultRun=globalThis.crypto?.randomUUID?.()??Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
      save();
    }
    scr('vault-abuse');
    loadVault();
  }

  addEventListener('message',event=>{
    const data=event.data;
    if(cur!=='vault-abuse'||!frame||event.source!==frame.contentWindow||event.origin!==location.origin||
      data?.channel!==channel||data.run!==M.past?.vaultRun)return;
    if(data.type==='ready'){
      clearTimeout(loadTimer);
      status.hidden=true;
      frame.focus();
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

  retry.onclick=loadVault;
  fallback.onclick=continueStory;
  $('vault-abuse-exit').onclick=()=>{menu();scr('menu')};
  $('past-entry').onclick=()=>open();
  $('past-entry-note').textContent=eventNote(M.past);
  window.VaultAbuse={open,eventNote};
})();
