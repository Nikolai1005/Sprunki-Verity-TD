/* Vault administration shares the party admin key and the arena's online transport. */
(() => {
  'use strict';

  const channel='vault-abuse-v1';
  const title='🛠 Админ-панель';
  const idPattern=/^[A-Za-z0-9_-]{1,80}$/;
  const uidPattern=/^[A-Za-z0-9_-]{1,128}$/;
  const encodedPattern=/^[A-Za-z0-9_-]+$/;
  const heartbeatInterval=4000;
  const attendanceAge=14000;
  const announcementAge=60000;
  const endGrace=15000;
  const events={
    gold:'Золотой дождь', drops:'Дождь подарков', double:'Двойная ценность', disco:'Диско',
    low:'Низкая гравитация', divine:'Божественные находки', rainbow:'Радужное небо', confetti:'Конфетти'
  };
  const rewardLimit={tickets:5000,coins:300};
  const artifactRarities=['Обычный','Необычный','Редкий','Эпический','Легендарный','Мифический','Божественный'];
  const verified=new Map();
  const frames=new WeakMap();
  let context=null, publicKey=null, reading=null, writingPresence=null;
  let lastRead=0, lastPresence=0, lastPresenceFrame=null, lastPresenceEvent='';
  let busy=false, pending=null, status='';

  function activeWindow(){return window.VaultAbuse?.adminWindow()||null}
  function activeFrame(){return cur==='vault-abuse'?window.VaultAbuse?.getFrame()||null:null}
  function configPath(session){return 'arena/cfg/'+session.id}

  function sessionFor(frame){
    const now=Date.now();
    const open=activeWindow();
    if(open&&context?.id!==open.id){
      context={...open,commands:new Map(),settings:new Map()};
      lastRead=0;
      pending=null;
      status='';
    }
    return open||frame&&context&&now<context.end+endGrace?context:null;
  }

  function frameState(frame){
    if(!frames.has(frame))frames.set(frame,{done:new Set(),sent:new Map()});
    return frames.get(frame);
  }

  function validCommand(row,id,session){
    if(!row||row.id!==id||!idPattern.test(id)||row.session!==session.id||
      !Number.isSafeInteger(row.at)||row.at<session.start||row.at>=session.end)return false;
    switch(row.kind){
      case 'event': return Object.hasOwn(events,row.event)&&typeof row.enabled==='boolean';
      case 'announce': return typeof row.text==='string'&&row.text.trim().length>0&&row.text.length<=140;
      case 'grant':
        return Array.isArray(row.uids)&&row.uids.length>0&&row.uids.every(uid=>typeof uid==='string'&&uidPattern.test(uid))&&
          (row.reward==='artifact'?Number.isInteger(row.rarity)&&row.rarity>=0&&row.rarity<artifactRarities.length:
            Object.hasOwn(rewardLimit,row.reward)&&Number.isInteger(row.amount)&&row.amount>=1&&row.amount<=rewardLimit[row.reward]);
      default: return false;
    }
  }

  async function verify(proof){
    if(!crypto?.subtle||!proof||typeof proof.p!=='string'||typeof proof.s!=='string'||
      proof.p.length>1000000||proof.s.length!==86||!encodedPattern.test(proof.p)||!encodedPattern.test(proof.s))return null;
    const signature=proof.p+'.'+proof.s;
    if(verified.has(signature))return verified.get(signature);
    const result=(async()=>{
      try{
        publicKey??=aPub();
        if(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},await publicKey,ub64(proof.s),u8(proof.p)))
          return JSON.parse(new TextDecoder().decode(ub64(proof.p)));
      }catch(error){
        return null;
      }
      return null;
    })();
    if(verified.size>=256)verified.delete(verified.keys().next().value);
    verified.set(signature,result);
    return result;
  }

  function compare(a,b){return a.at-b.at||a.id.localeCompare(b.id)}

  function rememberCommand(session,command){
    if(session.commands.has(command.id))return;
    session.commands.set(command.id,command);
    if(command.kind==='event'){
      const previous=session.settings.get(command.event);
      if(!previous||compare(previous,command)<0)session.settings.set(command.event,command);
    }
  }

  function dispatch(session,frame){
    if(!frame||frame!==activeFrame()||session!==sessionFor(frame)||!M.past?.vaultRun)return;
    const now=Date.now(), state=frameState(frame);
    for(const row of [...session.commands.values()].sort(compare)){
      if(state.done.has(row.id)||now-(state.sent.get(row.id)||0)<heartbeatInterval)continue;
      let command;
      if(row.kind==='event'&&session.settings.get(row.event)===row){
        command={id:row.id,kind:row.kind,event:row.event,enabled:row.enabled};
      }else if(row.kind==='announce'&&now-row.at<announcementAge){
        command={id:row.id,kind:row.kind,text:row.text};
      }else if(row.kind==='grant'&&row.uids.includes(ON.uid)){
        command={id:row.id,kind:row.kind,reward:row.reward,amount:row.amount,rarity:row.rarity};
      }
      if(!command)continue;
      frame.contentWindow.postMessage({channel,run:M.past.vaultRun,type:'admin-command',command},location.origin);
      state.sent.set(row.id,now);
    }
  }

  async function readCommands(session){
    const response=await db(configPath(session));
    if(!response.ok)throw Error('Сервер арены ответил '+response.st+'.');
    await Promise.all(Object.entries(response.j||{}).map(async([id,proof])=>{
      if(session.commands.has(id))return;
      const row=await verify(proof);
      if(validCommand(row,id,session))rememberCommand(session,row);
    }));
  }

  function panelOpen(){return Boolean(ADM&&AP.tab==='vault'&&$('vault-admin-status')&&!$('modal').classList.contains('hide'))}

  function poll(force=false){
    const frame=activeFrame(), session=sessionFor(frame);
    if(!session||!onOk()||ON.ban||(!frame&&!panelOpen()))return;
    dispatch(session,frame);
    const now=Date.now();
    if(reading||(!force&&now-lastRead<heartbeatInterval))return;
    lastRead=now;
    reading=readCommands(session).then(()=>{
      dispatch(session,activeFrame());
      refreshControls();
    }).catch(()=>{
      if(panelOpen()&&!busy&&!status)setStatus('Пока не удалось загрузить настройки арены.');
    }).finally(()=>{reading=null});
  }

  function attendance(frame){
    const session=activeWindow(), now=Date.now();
    if(!session||!onOk()||ON.ban||writingPresence||AR.putTask)return;
    if(frame===lastPresenceFrame&&session.id===lastPresenceEvent&&now-lastPresence<heartbeatInterval-200)return;
    lastPresence=now;
    lastPresenceFrame=frame;
    lastPresenceEvent=session.id;
    writingPresence=(async()=>{
      await onAuth();
      if(activeFrame()!==frame||activeWindow()?.id!==session.id||!uidPattern.test(ON.uid||'')||AR.putTask||ON.ban)return;
      const presence={x:1000,y:760,a:M.fb?.fav||'verity',n:M.fb?.nick||'Хранитель',
        cs:typeof csStr==='function'?csStr():'',c:0,s:0,st:0,f:1,t:{'.sv':'timestamp'},pa:session.id};
      const request=db('arena/p/'+ON.uid,{m:'PUT',b:presence});
      AR.putTask=request;
      try{await request}
      finally{if(AR.putTask===request)AR.putTask=null}
    })().catch(()=>{}).finally(()=>{writingPresence=null});
  }

  addEventListener('message',event=>{
    const frame=activeFrame(), data=event.data;
    if(!frame||!M.past?.vaultRun||event.source!==frame.contentWindow||event.origin!==location.origin||
      data?.channel!==channel||data.run!==M.past.vaultRun)return;
    if(data.type==='ready'){
      frameState(frame).sent.clear();
      poll(true);
    }else if(data.type==='playing'){
      if(!window.VaultPvp?.isPublishing(frame))attendance(frame);
      poll();
    }else if(data.type==='admin-applied'){
      const state=frameState(frame);
      if(state.sent.delete(data.commandId))state.done.add(data.commandId);
    }
  });

  async function recipients(session){
    if(writingPresence)await writingPresence;
    const response=await db('arena/p');
    if(!response.ok)throw Error('Не удалось загрузить участников ('+response.st+').');
    const now=Date.now();
    const uids=Object.entries(response.j||{}).filter(([uid,row])=>uidPattern.test(uid)&&row?.pa===session.id&&
      Number.isFinite(row.t)&&row.t>=session.start&&row.t<=now+5000&&now-row.t<attendanceAge).map(([uid])=>uid);
    if(!uids.length)throw Error('Сейчас на арене нет активных участников.');
    return uids;
  }

  function setStatus(message){
    status=message;
    if($('vault-admin-status'))$('vault-admin-status').textContent=message;
  }

  function rewardType(){
    const reward=$('vault-admin-reward')?.value||'tickets';
    const artifact=reward==='artifact';
    $('vault-admin-amount-label').hidden=artifact;
    $('vault-admin-rarity-label').hidden=!artifact;
    if(artifact)return;
    const amount=$('vault-admin-amount');
    amount.max=rewardLimit[reward];
    if(amount.valueAsNumber>rewardLimit[reward])amount.value=rewardLimit[reward];
  }

  function refreshControls(){
    if(!panelOpen())return;
    const open=activeWindow();
    const enabled=Boolean(open&&onOk()&&!ON.ban&&!busy);
    $('vault-admin-availability').textContent=open?'Арена открыта.':'Команды доступны во время работы арены.';
    $('mc').querySelectorAll('[data-vault-admin]').forEach(button=>{
      const action=button.dataset.vaultAdmin;
      button.hidden=action==='retry'&&!pending;
      button.disabled=!enabled||(action==='retry'?!pending:Boolean(pending));
      if(action==='event')button.setAttribute('aria-pressed',String(context?.settings.get(button.dataset.event)?.enabled===true));
    });
  }

  function showPanel(){
    if(!ADM)return;
    AP.tab='vault';
    sessionFor(activeFrame());
    const settings=Object.entries(events).map(([event,name])=>
      '<button type="button" data-vault-admin="event" data-event="'+event+'" aria-pressed="false">'+name+'</button>').join('');
    const rarities=artifactRarities.map((rarity,index)=>'<option value="'+index+'">'+rarity+'</option>').join('');
    mOpen(title,apTabs()+
      '<div class="vault-admin-panel"><div class="ap-card"><h3>Арена хранилища</h3><p id="vault-admin-availability"></p></div>'+
      '<div class="ap-card"><h3>Золотое сообщение</h3><label for="vault-admin-chat">Текст для чата арены</label>'+
      '<div class="vault-admin-fields"><input id="vault-admin-chat" type="text" maxlength="140" autocomplete="off">'+
      '<button type="button" class="vault-admin-gold" data-vault-admin="announce">Отправить</button></div></div>'+
      '<div class="ap-card"><h3>Раздача наград</h3><p>Каждый активный участник арены получит выбранную награду.</p>'+
      '<div class="vault-admin-fields"><label>Награда<select id="vault-admin-reward"><option value="tickets">Билеты хранилища</option>'+
      '<option value="coins">Монеты хранилища</option><option value="artifact">Артефакт</option></select></label>'+
      '<label id="vault-admin-amount-label">Количество<input id="vault-admin-amount" type="number" min="1" max="5000" step="1" value="100"></label>'+
      '<label id="vault-admin-rarity-label" hidden>Редкость<select id="vault-admin-rarity">'+rarities+'</select></label>'+
      '<button type="button" data-vault-admin="grant">Раздать</button></div></div>'+
      '<div class="ap-card"><h3>События арены</h3><div class="vault-admin-events">'+settings+'</div></div>'+
      '<p id="vault-admin-status" role="status">'+esc(status)+'</p>'+
      '<button type="button" data-vault-admin="retry" hidden>Повторить отправку</button></div>',[['Закрыть',mClose]]);
    rewardType();
    refreshControls();
    poll(true);
  }

  async function publish(command,proof,session,key){
    if(ADM!==key||activeWindow()?.id!==session.id||ON.ban)throw Error('Арена закрылась или сеанс админа завершился.');
    const path=configPath(session)+'/'+command.id;
    pending={command,proof,session,key};
    const response=await db(path,{m:'PUT',b:proof,ifMatch:'null_etag'});
    if(response.st===412){
      const existing=await db(path);
      if(!existing.ok)throw Error('Сервер пока не подтвердил доставку.');
      if(existing.j?.p!==proof.p||existing.j?.s!==proof.s){
        pending=null;
        throw Error('Сервер отклонил эту команду. Отправь её заново.');
      }
    }else if(!response.ok){
      if(response.st>=500)throw Error('Сервер пока не подтвердил доставку.');
      pending=null;
      throw Error('Сервер отклонил команду ('+response.st+').');
    }
    pending=null;
    rememberCommand(session,command);
    dispatch(session,activeFrame());
    if(command.kind==='grant')return 'Раздача отправлена. Получателей: '+command.uids.length+'.';
    if(command.kind==='event')return events[command.event]+(command.enabled?' · включено':' · выключено');
    return 'Золотое сообщение отправлено.';
  }

  async function act(action,event){
    const key=ADM, session=sessionFor(activeFrame());
    if(!key||!session||activeWindow()?.id!==session.id||!onOk()||ON.ban||busy||pending&&action!=='retry')return;
    const text=$('vault-admin-chat').value.trim();
    const reward=$('vault-admin-reward').value;
    const amount=$('vault-admin-amount').valueAsNumber;
    const rarity=Number($('vault-admin-rarity').value);
    const desired=event?!session.settings.get(event)?.enabled:false;
    busy=true;
    setStatus('Отправляю…');
    refreshControls();
    try{
      if(action==='retry'){
        if(pending?.key===key)setStatus(await publish(pending.command,pending.proof,session,key));
        return;
      }
      const command={id:crypto.randomUUID(),session:session.id,at:Date.now(),kind:action};
      if(action==='announce'){
        if(!text||text.length>140)throw Error('Введи сообщение длиной от 1 до 140 символов.');
        command.text=text;
      }else if(action==='grant'){
        command.reward=reward;
        if(reward==='artifact')command.rarity=rarity;
        else command.amount=amount;
        command.uids=await recipients(session);
      }else if(action==='event'&&Object.hasOwn(events,event)){
        await readCommands(session);
        command.event=event;
        command.enabled=desired;
        const previous=session.settings.get(event);
        command.at=Math.max(Date.now(),(previous?.at??0)+1);
      }
      if(!validCommand(command,command.id,session))throw Error('Проверь параметры награды или события.');
      if(key!==ADM)throw Error('Сеанс админа завершился.');
      const proof=await apSign(command);
      setStatus(await publish(command,proof,session,key));
      if(action==='announce'&&$('vault-admin-chat')?.value.trim()===text)$('vault-admin-chat').value='';
    }catch(error){
      setStatus(pending?'Отправка не подтверждена. Повтори ту же команду.':error.message||'Нет связи с сервером.');
    }finally{
      busy=false;
      refreshControls();
    }
  }

  const tabs=apTabs;
  apTabs=function(){
    return tabs.apply(this,arguments).replace('</div>',
      '<button type="button" data-ap-tab="vault" aria-pressed="'+(AP.tab==='vault')+'">Хранилище</button></div>');
  };
  const panel=admPanel;
  admPanel=function(tab){
    if((tab==='vault'||!tab&&AP.tab==='vault')&&ADM)showPanel();
    else return panel.apply(this,arguments);
  };
  $('mc').addEventListener('click',event=>{
    const button=event.target.closest('button[data-vault-admin]');
    if(button&&!button.disabled&&panelOpen())act(button.dataset.vaultAdmin,button.dataset.event);
  });
  $('mc').addEventListener('change',event=>{
    if(event.target.id==='vault-admin-reward')rewardType();
  });
  $('mc').addEventListener('keydown',event=>{
    if(event.target.id==='vault-admin-chat'&&event.key==='Enter'&&!event.isComposing){
      event.preventDefault();
      $('mc').querySelector('[data-vault-admin="announce"]')?.click();
    }
  });

  const style=document.createElement('style');
  style.textContent=`
    body.vault-admin-arena #modal {z-index:520}
    .vault-admin-header {display:flex;gap:6px;align-items:center}
    #vault-abuse .vault-admin-open {border-color:#e8ad5c;color:#ffe3ae;background:#49334b}
    .vault-admin-fields {display:flex;align-items:end;flex-wrap:wrap;gap:8px;margin-top:6px}
    .vault-admin-fields label {display:grid;gap:4px;font-size:13px;color:#f3dbc0}
    .vault-admin-fields [hidden],.vault-admin-panel [hidden] {display:none!important}
    .vault-admin-fields input,.vault-admin-fields select {min-height:40px;padding:7px 9px;background:#1a162d;color:#fff3df;border:1px solid #9b83b1;border-radius:8px}
    #vault-admin-chat {flex:1 1 170px;min-width:0}
    #vault-admin-amount {width:84px}
    .vault-admin-panel button {min-height:40px;margin:0}
    .vault-admin-events {display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:7px}
    .vault-admin-panel button.vault-admin-gold,.vault-admin-events button[aria-pressed="true"] {border-color:#ffca6a;background:#59384c;color:#fff0c2}
    @media(max-width:400px) {.vault-admin-header button {font-size:12px;padding:5px 7px}}
  `;
  document.head.append(style);
  const exit=$('vault-abuse-exit');
  const header=document.createElement('div');
  const open=document.createElement('button');
  header.className='vault-admin-header';
  open.type='button';
  open.className='vault-admin-open';
  open.textContent='Админ';
  open.setAttribute('aria-label','Открыть админ-панель хранилища');
  open.onclick=showPanel;
  exit.before(header);
  header.append(open,exit);

  function navigation(){
    document.body.classList.toggle('vault-admin-arena',cur==='vault-abuse');
    open.hidden=!ADM;
  }
  const setSession=admSetSession;
  admSetSession=function(key){
    const result=setSession.apply(this,arguments);
    if(pending?.key!==key)pending=null;
    navigation();
    return result;
  };
  const screen=scr;
  scr=function(){
    const result=screen.apply(this,arguments);
    navigation();
    return result;
  };
  navigation();
  setInterval(()=>{poll();refreshControls()},1000);
})();
