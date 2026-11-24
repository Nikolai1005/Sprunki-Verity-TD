(() => {
  'use strict';
  const E=window.BossRushEngine;
  const {WIDTH,HEIGHT,BOSSES,WEAPONS}=E;
  const ROOT='bossRush', MAX_PLAYERS=4, LOBBY_AGE=15*60000, DISCONNECT=18000;
  const RESUME_KEY='vtd-boss-rush-room';
  const TIERS=[{wins:1,gems:2},{wins:3,gems:3},{wins:5,gems:5}];
  const keys=new Set();
  const control={x:0,y:0,attack:0,choice:0,weapon:''};
  let view='home', mode=null, game=null, soloId='', room=null, friends=[], invites=[];
  let onlineBusy=false, onlinePoll=false, nextPoll=0, nextInvites=0, ui='', note='', raf=0, last=0, stepNote='';
  let touch=null, held=false, nextHeld=0, stageSound=-1, gesture=0, skip=false;
  let receivedAt=0;
  const visuals=new Map();

  const screen=$('boss-rush'), panel=$('br-panel'), canvas=$('br-canvas'), ctx=canvas.getContext('2d');
  const controls=$('br-controls'), status=$('br-status'), subtitle=$('br-dialogue');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const button=(action,label,off=false)=>'<button type="button" data-br="'+action+'"'+(off?' disabled':'')+'>'+label+'</button>';
  const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
  const uid=()=>mode==='solo'?'solo':ON.uid;
  const me=()=>game?.players.find(p=>p.id===uid());
  const nick=()=>M.fb?.nick||'Хранитель';
  const avatar=()=>M.fb?.fav&&M.own[M.fb.fav]?M.fb.fav:'verity';
  const profile=()=>({id:uid(),name:nick(),avatar:avatar()});
  const token=()=>crypto.getRandomValues(new Uint32Array(3)).join('-');
  const path=(id,child='')=>ROOT+'/rooms/'+id+(child?'/'+child:'');
  const inputId=()=>Date.now()*1000+(++gesture%1000);
  const setNote=text=>{note=text;status.textContent=text};
  const rewards=()=>M.bossRush||{};
  const mastery=key=>Number(rewards().wins?.[key])||0;

  function resetControls(){
    keys.clear();held=false;touch=null;
    Object.assign(control,{x:0,y:0,attack:0,choice:0,weapon:''});
  }

  function storeRoom(id){
    try{
      if(id)localStorage.setItem(RESUME_KEY,id);
      else localStorage.removeItem(RESUME_KEY);
    }catch{}
  }

  function readRoom(){
    try{return localStorage.getItem(RESUME_KEY)}catch{return null}
  }

  function collect(){
    if(!game?.kills?.length||!uid()||!['host','guest','solo'].includes(mode))return;
    const session=mode==='solo'?soloId:room?.id;
    if(!session)return;
    const previous=M.bossRush;
    const progress={...previous,wins:{...previous?.wins},claims:{...previous?.claims}};
    const old=progress.claims[session];
    const mask=Number(old?.mask)||0;
    let newMask=mask, gems=0;
    const prizes=[];
    for(const [index,boss] of BOSSES.entries()){
      if(mask&(1<<index)||!game.kills.some(k=>k.boss===boss.key&&k.players.includes(uid())))continue;
      newMask|=1<<index;
      const wins=progress.wins[boss.key]=(Number(progress.wins[boss.key])||0)+1;
      const tier=TIERS.find(t=>t.wins===wins);
      if(tier){gems+=tier.gems;prizes.push(boss.name+' · мастерство '+wins+'/5')}
    }
    if(mask===newMask)return;
    const priorGem=M.gem, priorUnit=M.own.bossity;
    const unlocked=!priorUnit&&BOSSES.every(b=>progress.wins[b.key]>=5);
    progress.claims[session]={mask:newMask,at:Date.now()};
    for(const [id,claim] of Object.entries(progress.claims)){
      if(Date.now()-claim.at>7*86400000)delete progress.claims[id];
    }
    M.bossRush=progress;
    M.gem=(Number(priorGem)||0)+gems;
    if(unlocked)M.own.bossity=1;
    if(!save()){
      if(previous===undefined)delete M.bossRush;else M.bossRush=previous;
      M.gem=priorGem;
      if(priorUnit===undefined)delete M.own.bossity;else M.own.bossity=priorUnit;
      stepNote='Не удалось сохранить награду. Игра попробует снова.';
      return;
    }
    stepNote=[gems?'Получено +'+gems+' 💎':'Победа записана в мастерство',...prizes,...(unlocked?['🏆 Bossity разблокирован!']:[])].join(' · ');
    tone(740,.18,'triangle',.12,1000);
  }

  function stageText(){
    if(game.phase==='intro')return '';
    if(game.phase==='choose')return 'Волна '+(game.wave+1)+' / '+BOSSES.length+' · '+BOSSES[game.wave].name;
    if(game.phase==='rest')return BOSSES[game.wave].name+' повержен';
    if(game.phase==='overtime')return 'Последний рубеж';
    if(game.phase==='fight')return 'Волна '+(game.wave+1)+' / '+BOSSES.length+' · '+BOSSES[game.wave].name;
    return game.winner===uid()?'Победа!':game.winner?game.players.find(p=>p.id===game.winner)?.name+' побеждает':'Попытка окончена';
  }

  function roomPlayers(){
    return Object.entries(room?.members||{}).filter(([id,row])=>validId(id)&&
      (id===room.host||room.allowed?.[id])&&row&&Date.now()-row.t<DISCONNECT&&Date.now()+60000>=row.t)
      .sort(([a,left],[b,right])=>(a===room.host?-1:b===room.host?1:left.t-right.t)||a.localeCompare(b))
      .slice(0,MAX_PLAYERS);
  }

  function roster(people){
    return '<ul class="br-roster">'+people.map(p=>'<li>'+pic(Object.hasOwn(TY,p.avatar)?p.avatar:'verity',1,30)+
      '<span>'+esc(p.name)+'</span><small>'+esc(p.hint||'')+'</small></li>').join('')+'</ul>';
  }

  function render(){
    let html='';
    const inGame=view==='game';
    const visibleBattle=inGame&&game&&game.phase!=='end';
    $('br-back').textContent=view==='home'?'← Режимы':view==='game'?'Выйти':'← Назад';
    canvas.hidden=!visibleBattle;
    if(!visibleBattle)subtitle.hidden=true;
    controls.hidden=!(visibleBattle&&['fight','overtime'].includes(game.phase)&&me()?.hp>0);
    $('br-stage').hidden=!visibleBattle;
    const heading=visibleBattle?stageText():'';
    if($('br-stage-title').textContent!==heading)$('br-stage-title').textContent=heading;
    $('br-skip').hidden=!(visibleBattle&&game.phase==='intro'&&mode!=='guest');
    if(visibleBattle&&['fight','overtime','choose'].includes(game.phase)){
      const time=game.phase==='overtime'?game.time:(game.phase==='fight'?E.ROUND:E.CHOOSE)-game.time;
      $('br-clock').textContent=Math.max(0,Math.ceil(time))+' с';
      $('br-health').textContent=me()?'♥ '+Math.ceil(me().hp)+'/'+E.maxHP(me())+(me().hp===0?' · Наблюдение':''):'';
      $('br-weapon').textContent=me()?.weapon?WEAPONS[me().weapon].name:'';
      const progress=game.phase==='fight'?game.boss?.hp/game.boss?.max:0;
      $('br-boss-health').hidden=game.phase!=='fight';
      $('br-boss-health').value=progress;
    }else{
      $('br-clock').textContent='';$('br-health').textContent='';$('br-weapon').textContent='';
      $('br-boss-health').hidden=true;
    }
    if(view==='home'){
      html='<div class="br-hero"><img src="'+art+'" alt=""><div><h1>Тюрьма боссов</h1><p>Боссы вырвались в Веритию. Выбери оружие и переживи каждую волну.</p></div></div>'+
        '<div class="br-actions">'+button('solo','Играть одному',onlineBusy)+button('host','Создать комнату',onlineBusy)+
        button('invites','Приглашения'+(invites.length?' ('+invites.length+')':''),onlineBusy)+button('mastery','Мастерство',onlineBusy)+button('movie','Смотреть катсцену',onlineBusy)+'</div>'+
        '<p class="br-help">На компьютере: WASD или стрелки для движения, пробел для атаки. На телефоне: джойстик и кнопка атаки.</p>';
    }
    if(view==='invites'){
      html='<h1>Приглашения</h1>'+(invites.length?'<div class="br-rows">'+invites.map(inv=>
        '<div><b>'+esc(inv.name||'Друг')+'</b>'+button('join:'+inv.id,'Войти',onlineBusy)+button('ignore:'+inv.id,'Убрать',onlineBusy)+'</div>').join('')+'</div>':
        '<p>Здесь появятся приглашения друзей в «БОСС РАШ».</p>')+
        '<div class="br-actions">'+button('reload','Обновить',onlineBusy)+(readRoom()&&mode===null?button('resume','Вернуться в комнату',onlineBusy):'')+'</div>';
    }
    if(view==='mastery'){
      const total=BOSSES.reduce((sum,boss)=>sum+Math.min(5,mastery(boss.key)),0);
      const complete=BOSSES.filter(boss=>mastery(boss.key)>=5).length;
      html='<div class="br-mastery-heading"><div><h1>Мастерство боссов</h1><p>Великая охота · '+complete+' из '+BOSSES.length+' боссов освоено</p></div><strong>'+total+' / 50</strong></div>'+
        '<div class="br-mastery-reward'+(M.own.bossity?' claimed':'')+'"><div class="br-mastery-reward-art">'+pic('bossity',1,100)+pic('bossity',2,75)+'</div><div><span class="br-mastery-eyebrow">MYTHIC · НАГРАДА</span><h2>Bossity</h2><p>'+(M.own.bossity?'✓ Получен в коллекцию':'Победи каждого босса 5 раз и получи Bossity автоматически.')+'</p><progress max="50" value="'+total+'" aria-label="Прогресс награды Bossity"></progress><small>'+total+' из 50 побед</small></div></div>'+
        '<div class="br-mastery">'+BOSSES.map((boss,index)=>{
          const wins=Math.min(5,mastery(boss.key));
          return '<article class="'+(wins===5?'mastered':'')+'" style="--boss-color:'+boss.color+'"><div class="br-mastery-image"><img src="'+masteryArt[index]+'" alt=""><span>'+String(index+1).padStart(2,'0')+'</span>'+(wins===5?'<strong>✓</strong>':'')+'</div><div class="br-mastery-body"><b>'+boss.name+'</b><div class="br-mastery-progress" aria-label="'+wins+' из 5 побед">'+Array.from({length:5},(_,i)=>'<i class="'+(i<wins?'done':'')+'"></i>').join('')+'</div><span>'+wins+' / 5 побед</span><small>'+
          TIERS.map(tier=>'<span class="'+(wins>=tier.wins?'done':'')+'">'+tier.wins+' · '+tier.gems+' 💎</span>').join('')+'</small></div></article>';
        }).join('')+'</div>';
    }
    if(view==='room'){
      const people=roomPlayers();
      const allowed=room.allowed||{};
      const remaining=Math.max(0,MAX_PLAYERS-1-Object.keys(allowed).length);
      html='<h1>Комната ожидания</h1><p>Игроки '+people.length+' / '+MAX_PLAYERS+' · '+(mode==='host'?'Пригласи друзей или начни бой.':'Создатель комнаты запускает бой.')+'</p>'+
        roster(people.map(([id,row])=>({...row,hint:id===room.host?'Создатель':'Готов'})))+
        '<p class="br-help">С каждым игроком у боссов больше здоровья и урона, а атаки идут чаще.</p>'+
        (mode==='host'?'<div class="br-actions">'+button('start','Начать бой',onlineBusy||!people.length)+'</div><h2>Пригласить друзей</h2>'+
        (friends.length?'<div class="br-rows">'+friends.map(f=>'<div><b>'+esc(f.name)+'</b>'+button('invite:'+f.id,allowed[f.id]?'Отправлено':'Пригласить',onlineBusy||!!allowed[f.id]||!remaining)+'</div>').join('')+'</div>':
         '<p>Добавь друзей в игре, чтобы пригласить их сюда.</p>'):'');
    }
    if(inGame&&game){
      if(game.phase==='choose')html=me()?.hp>0?
        '<h2>Выбери оружие</h2><p class="br-help">'+BOSSES[game.wave].hint+'</p><div class="br-weapons">'+E.options(me()).map(k=>{
          const next=E.upgrade(k);
          const hint=next?'<small class="br-upgrade">Дальше → '+WEAPONS[next].name+'</small>':'';
          return '<button type="button" data-br="weapon:'+k+'" aria-pressed="'+((control.weapon||me().selected)===k)+'"><b>'+WEAPONS[k].name+'</b><small>'+WEAPONS[k].desc+'</small>'+hint+'</button>';
        }).join('')+'</div>':
        '<p>Ты выбыл. Наблюдай за боем.</p>';
      if(game.phase==='end'){
        html='<h1>'+esc(stageText())+'</h1><p>'+(game.reason==='clear'?'Все боссы повержены.':game.reason==='last'?'Побеждает последний выживший.':'Попробуй другое оружие и выходи из отмеченных зон.')+'</p>'+
          roster([...game.players].sort((a,b)=>Number(b.id===game.winner)-Number(a.id===game.winner)||b.damage-a.damage).map(p=>({...p,hint:
            (p.id===game.winner?'Победитель · ':'')+Math.round(p.damage)+' урона'})))+
          '<div class="br-actions">'+button('again',mode==='solo'?'Играть ещё':'К режиму')+button('result-mastery','Мастерство')+'</div>';
      }
    }
    if(html!==ui){ui=html;panel.innerHTML=html}
    status.textContent=note||stepNote;
    screen.classList.toggle('br-in-game',visibleBattle);
  }

  async function must(promise){
    const result=await promise;
    if(!result.ok)throw Error(result.st===401||result.st===403?
      'Сервер не разрешил вход в комнату. Если онлайн-арена ещё не подключена, можно играть одному.':'Сервер комнаты недоступен. Попробуй ещё раз.');
    return result.j;
  }

  async function auth(){
    if(!onOk())throw Error('Онлайн сейчас недоступен.');
    if(!M.fb?.nick)throw Error('Выбери ник во вкладке «Друзья», чтобы играть вместе.');
    await onAuth();
    if(ON.ban)throw Error('Доступ к онлайн-режимам закрыт.');
  }

  async function loadFriends(){
    const rows=await must(db('friends/'+ON.uid));
    const people=await Promise.all(Object.keys(rows||{}).filter(validId).map(async id=>{
      try{
        const player=await must(db('players/'+id));
        return {id,name:String(player?.n||'Друг').slice(0,20)};
      }catch{return {id,name:'Друг'}}
    }));
    friends=people.sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  }

  async function loadInvites(){
    await auth();
    const rows=await must(db(ROOT+'/invites/'+ON.uid));
    const now=Date.now();
    invites=Object.entries(rows||{}).filter(([id,row])=>validId(id)&&now-row.at<LOBBY_AGE&&row.at<now+60000)
      .map(([id,row])=>({...row,id})).sort((a,b)=>b.at-a.at);
    for(const [id,row] of Object.entries(rows||{})){
      if(!invites.some(inv=>inv.id===id)&&validId(id))db(ROOT+'/invites/'+ON.uid+'/'+id,{m:'DELETE'}).catch(()=>{});
    }
  }

  async function createRoom(){
    await auth();
    const id=token(), now=Date.now();
    await must(db(path(id),{m:'PUT',b:{host:ON.uid,created:{'.sv':'timestamp'},life:{at:{'.sv':'timestamp'}}}}));
    room={id,host:ON.uid,created:now,life:{at:now},members:{},allowed:{},networkInputs:{},okAt:now};
    mode='host';
    storeRoom(id);
    view='room';
    try{
      await writeMember(room);
      await loadFriends();
    }catch(error){setNote(error.message)}
  }

  async function invite(id){
    if(mode!=='host'||view!=='room'||!friends.some(f=>f.id===id))return;
    if(Object.keys(room.allowed||{}).length>=MAX_PLAYERS-1&&!room.allowed[id])return;
    const currentRoom=room;
    await must(db(path(currentRoom.id,'allowed/'+id),{m:'PUT',b:true}));
    try{
      await must(db(ROOT+'/invites/'+id+'/'+currentRoom.id,{m:'PUT',b:{host:ON.uid,name:nick(),at:{'.sv':'timestamp'}}}));
      currentRoom.allowed={...currentRoom.allowed,[id]:true};
      setNote('Приглашение отправлено.');
    }catch(error){
      await db(path(currentRoom.id,'allowed/'+id),{m:'DELETE'}).catch(()=>{});
      throw error;
    }
  }

  async function writeMember(currentRoom){
    const player=profile();
    await must(db(path(currentRoom.id,'members/'+ON.uid),{m:'PUT',b:{
      name:player.name,avatar:player.avatar,t:{'.sv':'timestamp'}
    }}));
    currentRoom.members={...currentRoom.members,[ON.uid]:{...player,t:Date.now()}};
  }

  async function join(id,recover=false){
    if(!validId(id))return;
    await auth();
    const data=await must(db(path(id)));
    if(!data||data.life?.closed||!data.life||Date.now()-data.life.at>DISCONNECT||
        (!data.game&&Date.now()-data.created>LOBBY_AGE))throw Error('Эта комната уже закрыта.');
    const state=unpack(data.game);
    if(data.game&&(!recover||!state?.players.some(p=>p.id===ON.uid)))throw Error('Бой в этой комнате уже начался.');
    const currentRoom={...data,id,networkInputs:{},okAt:Date.now()};
    if(data.host===ON.uid&&state&&state.phase!=='end')
      throw Error('Создай новую комнату, чтобы провести новый бой.');
    await writeMember(currentRoom);
    room=currentRoom;
    mode=data.host===ON.uid?'host':'guest';
    storeRoom(id);
    if(state)enterGame(state);
    else view='room';
    if(mode==='host')await loadFriends();
    if(!recover){
      const result=await db(ROOT+'/invites/'+ON.uid+'/'+id,{m:'DELETE'}).catch(()=>null);
      if(result?.ok)invites=invites.filter(inv=>inv.id!==id);
    }
  }

  function enterGame(state){
    resetControls();
    game=state;
    view='game';
    last=0;
    stageSound=-1;skip=false;
    stepNote='';receivedAt=performance.now();visuals.clear();
  }

  function startSolo(cinematic=true){
    room=null;mode='solo';soloId=token();
    enterGame(E.create([profile()],cinematic));
  }

  async function startHost(){
    if(mode!=='host'||view!=='room')return;
    const currentRoom=room;
    const rows=await must(db(path(currentRoom.id,'members')));
    currentRoom.members=rows||{};
    const people=roomPlayers().map(([id,row])=>({id,name:String(row.name||'Хранитель').slice(0,20),
      avatar:Object.hasOwn(TY,row.avatar)?row.avatar:'verity'}));
    if(!people.some(p=>p.id===ON.uid))throw Error('Подожди обновления списка игроков.');
    const state=E.create(people);
    currentRoom.seenInputs=Object.fromEntries(people.map(p=>[p.id,Date.now()]));
    await writeGame(currentRoom,state);
    enterGame(state);
  }

  async function writeGame(currentRoom,state){
    const phase=state.phase;
    const body={state:JSON.stringify(state),at:{'.sv':'timestamp'}};
    const pending=(currentRoom.pendingGame||Promise.resolve()).catch(()=>{}).then(()=>must(db(path(currentRoom.id,'game'),{m:'PUT',b:body})));
    currentRoom.pendingGame=pending;
    const saved=await pending;
    currentRoom.game={at:saved?.at||Date.now()};
    currentRoom.lastGame=Date.now();
    if(phase==='end')currentRoom.finalSent=true;
  }

  function unpack(row){
    if(!row||typeof row.state!=='string'||row.state.length>42000)return null;
    try{
      const state=JSON.parse(row.state);
      return Array.isArray(state.players)&&Array.isArray(state.kills)&&['intro','choose','fight','rest','overtime','end'].includes(state.phase)?state:null;
    }catch{return null}
  }

  async function pollRoom(now){
    if(onlinePoll||onlineBusy||!room||now<nextPoll)return;
    onlinePoll=true;
    const currentRoom=room, host=mode==='host';
    const lobby=view==='room';
    nextPoll=now+(lobby?1050:host?200:175);
    try{
      const heartbeat=now-(currentRoom.lastBeat||0)>(lobby?3300:5000);
      if(heartbeat){
        await writeMember(currentRoom);
        if(host)await must(db(path(currentRoom.id,'life'),{m:'PUT',b:{at:{'.sv':'timestamp'}}}));
        currentRoom.lastBeat=now;
      }
      if(currentRoom!==room)return;
      if(lobby){
        const data=await must(db(path(currentRoom.id)));
        if(currentRoom!==room)return;
        if(!data||data.life?.closed||Date.now()-data.life?.at>DISCONNECT||Date.now()-data.created>LOBBY_AGE){
          leaveRoom('Комната закрылась.');
          return;
        }
        Object.assign(currentRoom,{members:data.members||{},allowed:data.allowed||{}});
        if(!host&&data.game){
          const state=unpack(data.game);
          if(!state?.players.some(p=>p.id===ON.uid)){leaveRoom('Бой уже начался.');return}
          enterGame(state);
        }
      }else if(view==='game'&&host){
        const rows=await must(db(path(currentRoom.id,'inputs')));
        if(currentRoom!==room||!game)return;
        currentRoom.networkInputs=rows||{};
        if(!currentRoom.finalSent&&(game.phase!=='end'||now-(currentRoom.lastGame||0)>300))
          await writeGame(currentRoom,game);
      }else if(view==='game'){
        const final=game?.phase==='end';
        if(!final&&me()?.hp>0)await must(db(path(currentRoom.id,'inputs/'+ON.uid),{m:'PUT',
          b:{...control,t:{'.sv':'timestamp'}}}));
        const data=await must(db(path(currentRoom.id,'game')));
        if(currentRoom!==room)return;
        const state=unpack(data);
        if(state&&data.at>(currentRoom.game?.at||0)){
          if(state.phase!==game.phase||state.wave!==game.wave)visuals.clear();
          currentRoom.game=data;
          game=state;
          receivedAt=performance.now();
        }
        if(game?.phase!=='end'&&(!data||now-data.at>DISCONNECT)){leaveRoom('Связь с создателем комнаты потеряна.');return}
      }
      currentRoom.okAt=now;
      if(note==='Связь прервалась. Переподключаемся…')setNote('');
    }catch{
      if(currentRoom!==room)return;
      if(now-currentRoom.okAt>DISCONNECT)leaveRoom('Связь с комнатой потеряна.');
      else setNote('Связь прервалась. Переподключаемся…');
    }finally{onlinePoll=false}
  }

  function leaveRoom(message, next='home'){
    const currentRoom=room, wasHost=mode==='host';
    const player=ON.uid;
    const finalGame=game?.phase==='end'?game:null;
    if(game)collect();
    room=null;game=null;mode=null;view=next;
    storeRoom(null);
    resetControls();
    setNote(message||'');
    if(!currentRoom)return;
    if(wasHost){
      const close=()=>db(path(currentRoom.id,'life'),{m:'PUT',b:{closed:true,at:{'.sv':'timestamp'}}});
      if(finalGame){
        if(!currentRoom.finalSent)writeGame(currentRoom,finalGame).catch(()=>{});
      }else close().catch(()=>{});
    }
    if(player){
      db(path(currentRoom.id,'members/'+player),{m:'DELETE'}).catch(()=>{});
      if(!wasHost)db(path(currentRoom.id,'inputs/'+player),{m:'DELETE'}).catch(()=>{});
    }
  }

  function localInput(time){
    const keyboardX=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
    const keyboardY=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
    control.x=touch?.x??keyboardX;
    control.y=touch?.y??keyboardY;
    if((held||keys.has(' '))&&time>=nextHeld){
      control.attack=inputId();
      nextHeld=time+270;
    }
  }

  function frame(ts){
    raf=0;
    if(cur!=='boss-rush')return;
    const dt=last?Math.min(.085,(ts-last)/1000):0;
    last=ts;
    const now=Date.now();
    pollRoom(now);
    if((view==='home'||view==='invites')&&!onlineBusy&&ON.uid&&M.fb?.nick&&now>=nextInvites){
      nextInvites=now+9000;
      loadInvites().catch(()=>{});
    }
    if(game){
      if(game.phase!=='choose')control.weapon='';
      localInput(ts);
      if(mode==='solo'||mode==='host'||mode==='movie'){
        const inputs={};
        if(mode==='host'){
          const seen=room.seenInputs||={};
          for(const p of game.players){
            if(p.id===ON.uid)continue;
            const row=room.networkInputs[p.id];
            if(row&&Number.isFinite(row.t)){
              seen[p.id]=Math.max(seen[p.id]||0,row.t);
              if(now-row.t<2500)inputs[p.id]=row;
            }
            if(now-(seen[p.id]||now)>DISCONNECT&&['fight','overtime'].includes(game.phase))p.hp=0;
          }
        }
        inputs[uid()]=control;
        if(mode==='movie'&&(skip||game.time+dt>=E.INTRO)){game=null;mode=null;view='home';subtitle.hidden=true}
        else E.step(game,inputs,dt,skip);
        skip=false;
      }
      if(game){
        collect();
        if(game.phase!=='end')draw(ts,dt);
      }
    }
    render();
    raf=requestAnimationFrame(frame);
  }

  async function action(key){
    const [what,id]=key.split(':');
    if(what==='weapon'&&game?.phase==='choose'&&me()?.hp>0&&E.options(me()).includes(id)){
      control.weapon=id;control.choice=inputId();
      tone(550,.09,'triangle',.095,850);
      return;
    }
    if(what==='back'){
      if(onlineBusy)return;
      if(view==='home'){scr('menu');return}
      if((view==='room'||view==='game')&&room){leaveRoom();return}
      view='home';game=null;mode=null;setNote('');stepNote='';resetControls();return;
    }
    if(what==='skip'){if(mode!=='guest')skip=true;return}
    if(onlineBusy)return;
    stepNote='';setNote('');
    if(what==='solo'){au();startSolo();return}
    if(what==='movie'){au();mode='movie';enterGame(E.create([]));return}
    if(what==='mastery'){view='mastery';return}
    if(what==='again'&&mode==='solo'){startSolo(false);return}
    if(what==='again'){leaveRoom();return}
    if(what==='result-mastery'){leaveRoom('', 'mastery');return}
    if(what==='invites')view='invites';
    onlineBusy=true;
    render();
    try{
      if(what==='host')await createRoom();
      if(what==='invites'||what==='reload')await loadInvites();
      if(what==='invite')await invite(id);
      if(what==='join')await join(id);
      if(what==='resume')await join(readRoom(),true);
      if(what==='start'){au();await startHost()}
      if(what==='ignore'&&validId(id)){
        await must(db(ROOT+'/invites/'+ON.uid+'/'+id,{m:'DELETE'}));
        invites=invites.filter(inv=>inv.id!==id);
      }
    }catch(error){setNote(error.message||'Не удалось связаться с комнатой.')}
    finally{onlineBusy=false;nextPoll=0;render()}
  }

  function ellipse(c,x,y,rx,ry,fill,stroke,width=1){
    c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);
    if(fill){c.fillStyle=fill;c.fill()}
    if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke()}
  }

  function bossArt(c,index,x,y,r,t){
    if(index===0){apStone(c,x,y,r,t);return}
    if(index===2){apHacker(c,x,y,r,t,false);return}
    if(index===3){apNeon(c,x,y,r,t);return}
    if(index>=4){prisonerArt(c,BOSSES[index],x,y,r,t);return}
    c.save();c.translate(x,y);c.scale(r/72,r/72);
    thGlow(c,0,-8,100,'#ff36245e');
    for(const s of [-1,1]){
      thPoly(c,[[s*51,-12],[s*80,-33],[s*92,7],[s*70,32],[s*48,21]],'#622c3f','#211728',4);
      thPoly(c,[[s*36,-39],[s*54,-87],[s*16,-56]],'#f39266','#311d29',4);
    }
    thPoly(c,[[-59,-38],[-36,-62],[38,-62],[61,-33],[62,28],[32,61],[-34,61],[-60,34]],
      thGradient(c,-48,-68,41,53,['#b05b5b','#6e344a','#27202f']),'#271724',6);
    thPoly(c,[[-43,-9],[-11,0],[-16,9],[-37,7]],'#ffe6aa','#fc9368',2);
    thPoly(c,[[43,-9],[11,0],[16,9],[37,7]],'#ffe6aa','#fc9368',2);
    thPoly(c,[[-28,27],[-11,35],[0,30],[12,35],[28,27]],null,'#f6a77f',4);
    c.restore();
  }

  function prisonerArt(c,boss,x,y,r,t){
    const color=boss.color;
    c.save();c.translate(x,y);c.scale(r/62,r/62);
    thGlow(c,0,4,92,color+'66');
    ellipse(c,0,53,63,13,'#1b102890');
    if(boss.key==='forge'){
      thPoly(c,[[-69,-19],[-49,-55],[50,-55],[69,-18],[51,42],[-48,42]],
        thGradient(c,0,-55,18,49,['#8f4541','#4e293a','#251928']),color,4);
      thPoly(c,[[-46,-21],[46,-21],[38,17],[-39,17]],'#f87a3f','#25121e',5);
      for(let i=-3;i<=3;i++){c.fillStyle='#562631';c.fillRect(i*11-2,-20,4,36)}
      for(const side of [-1,1]){
        ellipse(c,side*62,23+Math.sin(t*4+side)*4,16,22,'#5a3545',color,3);
      }
    }else if(boss.key==='frost'){
      thPoly(c,[[0,-70],[17,-38],[48,-54],[45,-15],[70,0],[43,24],[36,55],[0,47],[-38,55],[-45,24],[-70,0],[-45,-15],[-47,-54],[-18,-37]],
        thGradient(c,0,-61,8,58,['#cff8ff','#4b82ac','#292550']),color,3);
      for(const side of [-1,1])thPoly(c,[[side*11,-10],[side*41,-24],[side*33,-1],[side*18,4]],'#f6ffff');
      ellipse(c,0,18,7,10,'#253b66');
    }else if(boss.key==='storm'){
      const flap=Math.sin(t*6)*13;
      thPoly(c,[[-87,-12+flap],[-49,-6],[-23,-37],[23,-37],[49,-6],[87,-12+flap],[52,38],[25,24],[0,62],[-25,24],[-52,38]],
        thGradient(c,0,-34,0,49,['#739ee6','#374eaa','#2d295d']),color,4);
      thPoly(c,[[2,-29],[-16,1],[0,1],[-8,30],[19,-9],[5,-9],[14,-29]],'#e6f5ff');
      ellipse(c,-25,0,6,3,'#c9f1ff');ellipse(c,25,0,6,3,'#c9f1ff');
    }else if(boss.key==='mirror'){
      c.save();c.rotate(Math.sin(t*2)*.13);
      thPoly(c,[[0,-66],[48,-35],[58,14],[0,63],[-58,14],[-48,-35]],
        thGradient(c,-40,-33,50,45,['#eecaff','#8164b4','#302541']),color,4);
      thPoly(c,[[-27,15],[3,-52],[20,-41],[-9,31]],'#fcdbff9e');
      ellipse(c,0,5,24,16,'#291d46','#ffe6ff',3);ellipse(c,0,5,6,12,'#f899ff');
      c.restore();
    }else if(boss.key==='ink'){
      const drip=Math.sin(t*5)*6;
      thPoly(c,[[-62,12],[-45,-41],[-11,-58],[36,-49],[62,-21],[58,37],[35,30],[27,58+drip],[7,38],[-15,60-drip],[-35,37],[-58,47]],
        thGradient(c,0,-52,6,53,['#735b9a','#3b2b55','#180f2d']),color,3);
      for(const side of [-1,1])ellipse(c,side*24,-8,13,11,color);
      thPoly(c,[[-20,20],[0,11],[20,20]],null,'#eac7ff',3);
    }else{
      thPoly(c,[[-64,38],[-55,-24],[-45,-59],[-20,-43],[0,-69],[22,-43],[47,-59],[59,-24],[64,38],[0,62]],
        thGradient(c,-24,-53,0,60,['#aa725f','#503952','#261c3a']),color,4);
      ellipse(c,0,4,38,32,'#19172d',color,3);
      ellipse(c,0,3,12,17,'#f8ba6a','#fff0c3',3);
      c.save();c.rotate(t*.5);
      for(let k=0;k<4;k++){ellipse(c,0,-72,5,5,'#fff0bb');c.rotate(Math.PI/2)}
      c.restore();
    }
    c.restore();
  }

  function hall(c,t){
    const forward=t<11;
    const travel=forward?Math.min(1,t/8)*14:Math.max(0,14-(t-11)*1.75);
    const height=HEIGHT, center=WIDTH/2, horizon=216;
    c.fillStyle=thGradient(c,0,0,0,height,['#080a11','#251421','#120d17']);
    c.fillRect(0,0,WIDTH,height);
    thPoly(c,[[0,0],[centreEdge(-1),horizon-34],[centreEdge(-1),horizon+33],[0,height]],'#1f1826','#483042',3);
    thPoly(c,[[WIDTH,0],[centreEdge(1),horizon-34],[centreEdge(1),horizon+33],[WIDTH,height]],'#251a28','#483042',3);
    thPoly(c,[[0,height],[centreEdge(-1),horizon+33],[centreEdge(1),horizon+33],[WIDTH,height]],'#231a26','#573442',3);
    thGlow(c,center,horizon,245,t>=11?'#f53c542e':'#99485636');
    for(let i=15;i>=0;i--){
      const depth=i-travel+1.4;
      if(depth<.92)continue;
      const scale=1/depth, y=horizon+220*scale;
      for(const side of [-1,1]){
        const x=center+side*(43+282*scale), w=144*scale,h=261*scale;
        const shine=t>11+i*.47?Math.min(1,(t-11-i*.47)*2):0;
        c.fillStyle='#0a0810';c.fillRect(x-w/2,y-h,w,h);
        c.strokeStyle=shine?'#ef5a66':'#674350';c.lineWidth=Math.max(1,6*scale);c.strokeRect(x-w/2,y-h,w,h);
        if(scale>.15)bossArt(c,(i*2+(side>0?1:0))%BOSSES.length,x,y-h*.40,43*scale,t);
        if(scale<=.15){
          c.fillStyle=i%2?'#ff8a66':'#ce95ff';
          c.fillRect(x-w*.16,y-h*.45,9*scale,5*scale);
          c.fillRect(x+w*.10,y-h*.45,9*scale,5*scale);
        }
        const lift=h*.86*shine;
        for(let j=1;j<6;j++){
          c.fillStyle=shine?'#83394c':'#60515c';
          c.fillRect(x-w/2+j*w/6,y-h,Math.max(1,4.5*scale),h-lift);
        }
        c.fillStyle='#ab5360';c.fillRect(x-w/2,y-lift,w,Math.max(1.5,4*scale));
        if(shine)thGlow(c,x,y-h*.34,w*.8,'#ff495448');
      }
      c.strokeStyle='#52313a';c.lineWidth=Math.max(1,3*scale);
      c.beginPath();c.moveTo(center-382*scale,y);c.lineTo(center+382*scale,y);c.stroke();
    }
    if(t>=8&&t<11){
      thGlow(c,450,218,134,'#da2c6d4d');
      ellipse(c,429,212,7,2.5,'#ff476d');ellipse(c,471,212,7,2.5,'#ff476d');
    }
    function centreEdge(side){return center+side*62}
  }

  function portal(c,x,y,r,t){
    thGlow(c,x,y,r*1.7,'#ff416c67');
    c.save();c.translate(x,y);c.rotate(-.16);
    ellipse(c,0,0,r*.42,r,'#190f28','#fd7589',Math.max(1,r*.055));
    for(let j=0;j<3;j++){
      c.rotate(Math.sin(t*1.8+j)*.20);
      ellipse(c,0,0,r*(.34-j*.055),r*(.95-j*.13),null,j%2?'#ffd29c90':'#c289ffad',2);
    }
    c.restore();
  }

  const lines=[
    [0,'','Тюрьма боссов'],
    [7.8,'Таинственный голос','Выходите, боссы… Обрушьтесь на Веритию!'],
    [11,'',''],
    [19,'','Верития'],
    [24,'Верити','Разлом! Бегите!'],
    [27,'Админити','Ещё одна угроза? Мои хранители быстро справятся с ней. Вперёд!']
  ];

  function cinematic(t){
    const line=lines.findLast(([at])=>t>=at)||lines[0];
    if(stageSound!==line[0]){
      stageSound=line[0];
      if(line[0]===7.8){tone(66,.9,'sawtooth',.13,39);nz(.62,.16,130)}
      if(line[0]===11){tone(105,.55,'square',.075,37);nz(.55,.2,350)}
      if(line[0]===19){tone(145,1.4,'triangle',.18,45);nz(.8,.11,570)}
      if(line[0]===27){tone(330,.35,'triangle',.11,520);tone(440,.42,'triangle',.10,660,.23)}
      $('br-speaker').textContent=line[1];
      $('br-line').textContent=line[2];
    }
    subtitle.hidden=!line[2];
    const c=ctx;
    if(t<19){hall(c,t);return}
    c.fillStyle=thGradient(c,0,0,0,HEIGHT,['#312040','#893c5c','#e8796d','#39233d']);
    c.fillRect(0,0,WIDTH,HEIGHT);
    c.fillStyle='#302738';
    for(let i=0;i<12;i++){
      const x=i*81-14,h=48+Math.sin(i*2.7)**2*76;
      thPoly(c,[[x,292],[x,292-h],[x+31,274-h],[x+64,292-h],[x+64,292]],'#33243e','#674053',2);
      c.fillStyle='#ffb8707e';c.fillRect(x+21,283-h,12,15);
    }
    thPoly(c,[[0,292],[WIDTH,292],[WIDTH,HEIGHT],[0,HEIGHT]],'#301f31');
    thPoly(c,[[247,HEIGHT],[596,HEIGHT],[508,292],[431,292]],'#564052','#8b5260',3);
    const r=Math.min(120,Math.max(5,(t-19)*77));
    portal(c,455,256,r,reduced.matches?0:t);
    for(let i=0;i<BOSSES.length;i++){
      const since=t-(19.88+i*.66);
      if(since<0)continue;
      const p=Math.min(1,since/1.7), side=i%2?1:-1, row=Math.floor(i/2);
      bossArt(c,i,455+side*p*(75+row*75),256+p*(49+(row%2)*28),18+p*(26-(row%3)*3),reduced.matches?0:t);
    }
    const party=game.players;
    for(let i=0;i<8;i++){
      const player=i<party.length?party[i]:{avatar:i%2?'lovity':'verity',name:null};
      const run=Math.max(0,Math.min(2.95,t-23-i*.11));
      const x=170+i*85+(i<4?-1:1)*run*(77+i*5);
      const y=433+(i%3)*25-Math.abs(i-3)*run*4;
      arAvatar(c,x,y,player.avatar,player.name,'',false,0,0,0,i<4?-1:1,reduced.matches?0:t,false,0,false);
    }
    if(t>26.1){
      const p=Math.min(1,(t-26.1)*1.85);
      thGlow(c,451,414,135,'#ffda7670');
      apAdminity(c,451,542-p*125,57,reduced.matches?0:t,1,0,0);
    }
  }

  function zonePath(c,z){
    c.beginPath();
    if(z.kind==='rect')c.rect(z.x-z.w/2,z.y-z.h/2,z.w,z.h);
    else if(z.kind==='sector'){
      c.moveTo(z.x,z.y);
      c.arc(z.x,z.y,z.r,z.angle-z.half,z.angle+z.half);
      c.closePath();
    }else{
      if(z.kind==='outside'){c.rect(0,0,WIDTH,HEIGHT);c.moveTo(z.x+z.r,z.y)}
      c.arc(z.x,z.y,z.kind==='ring'?z.r+z.w/2:z.r,0,Math.PI*2);
      if(z.kind==='ring'){
        c.moveTo(z.x+z.r-z.w/2,z.y);
        c.arc(z.x,z.y,z.r-z.w/2,0,Math.PI*2);
      }
    }
  }

  function safetyRadius(time){return Math.max(0,231-time*13)}

  function visualPosition(id,obj,dt){
    if(mode!=='guest')return obj;
    let shown=visuals.get(id);
    if(!shown)visuals.set(id,shown={x:obj.x,y:obj.y});
    const speed=1-Math.exp(-dt*26);
    shown.x+=(obj.x-shown.x)*speed;
    shown.y+=(obj.y-shown.y)*speed;
    return shown;
  }

  function lightning(c,x,y,age){
    const sway=Math.sin(age*29)*7;
    const bolt=[[x-18,-20],[x+23,60],[x-14,115],[x+22,y-45],[x-8+sway,y-28],[x,y]];
    thPoly(c,bolt,null,'#79aaff90',12);
    thPoly(c,bolt,null,'#fff8c7',3);
    thGlow(c,x,y,63,'#f4e4848a');
  }

  function drawOrbitingHammer(c,player,x,y,time){
    const hammer=E.hammerOrbit({...player,x,y},time);
    if(!hammer)return;
    const {radius,size,angle}=hammer;
    const color=WEAPONS[player.weapon].color;
    c.save();
    c.beginPath();
    c.arc(x,y,radius,angle-.86,angle);
    c.strokeStyle=color+'6c';c.lineWidth=Math.max(2,size*.18);c.lineCap='round';c.stroke();
    c.translate(hammer.x,hammer.y);c.rotate(angle);
    thPoly(c,[[-size*1.24,-size*.14],[size*.57,-size*.14],[size*.57,size*.14],[-size*1.24,size*.14]],
      '#754b54','#28192c',2);
    thPoly(c,[[-size*.43,-size*.78],[size*.31,-size*.78],[size*.64,-size*.47],[size*.64,size*.47],
      [size*.31,size*.78],[-size*.43,size*.78],[-size*.62,size*.53],[-size*.62,-size*.53]],
      thGradient(c,-size,-size,size,size,['#fff0cb',color,'#634157']),'#371f36',3);
    thPoly(c,[[size*.42,-size*.49],[size*.42,size*.49]],null,'#fff5cf',2);
    c.restore();
  }

  function battlefield(t,dt,phaseTime){
    const c=ctx, color=BOSSES[game.wave].color;
    c.fillStyle='#1e1727';c.fillRect(0,0,WIDTH,HEIGHT);
    for(let row=0;row<9;row++)for(let col=0;col<15;col++){
      c.fillStyle=(row+col)%2?'#2c2234':'#312537';
      c.fillRect(col*60+1,row*60+1,58,58);
    }
    thGlow(c,E.snap.x,E.snap.y,370,color+'31');
    c.strokeStyle='#955761';c.lineWidth=5;c.strokeRect(5,5,WIDTH-10,HEIGHT-10);
    ellipse(c,E.snap.x,E.snap.y,142,91,null,'#84515f70',2);
    for(const [x,y] of [[24,23],[WIDTH-24,23],[24,HEIGHT-23],[WIDTH-24,HEIGHT-23]]){
      thGlow(c,x,y,76,'#ff705c69');
      ellipse(c,x,y,6,9,'#ffd69d');
    }
    for(const z of game.hazards){
      zonePath(c,z);
      const until=z.at-phaseTime;
      const accent=game.wave>=4?color:'#ff8e72';
      c.fillStyle=accent+(z.done?(z.pulse?'71':'a1'):until<.36?'80':'36');
      c.fill('evenodd');c.strokeStyle=z.done&&!z.pulse?'#fff0be':accent;c.lineWidth=z.done?3:2;c.stroke();
      if(z.done&&z.pattern==='storm')lightning(c,z.x,z.y,phaseTime-z.at);
    }
    if(game.phase==='overtime'){
      const r=safetyRadius(phaseTime);
      c.beginPath();c.rect(0,0,WIDTH,HEIGHT);c.arc(E.snap.x,E.snap.y,r,0,Math.PI*2);
      c.fillStyle='#f1223357';c.fill('evenodd');
      if(r>0)ellipse(c,E.snap.x,E.snap.y,r,r,null,'#ff9670',4);
    }
    const b=game.boss;
    if(b?.hp>0){
      const point=visualPosition('boss',b,dt);
      thGlow(c,point.x,point.y,110,color+(b.flash>0?'c0':'60'));
      bossArt(c,game.wave,point.x,point.y,55,t);
    }
    if(game.phase==='rest'){
      const a=Math.max(0,1-game.time*.43);
      thGlow(c,b.x,b.y,65+game.time*75,color+Math.floor(a*150).toString(16).padStart(2,'0'));
    }
    for(const fx of game.effects){
      const w=WEAPONS[fx.w], a=Math.max(0,Math.min(1,fx.ttl*2.5));
      c.save();c.globalAlpha=a;
      if(fx.type==='lightning'){
        lightning(c,fx.x,fx.y,.36-fx.ttl);
      }else if(fx.type==='hammer-hit'){
        const reach=25-fx.ttl*52;
        for(let i=0;i<4;i++){
          const angle=i*Math.PI/2+.35, dx=Math.cos(angle)*reach, dy=Math.sin(angle)*reach;
          thPoly(c,[[fx.x+dx*.4,fx.y+dy*.4],[fx.x+dx,fx.y+dy]],null,'#fff2c0',3);
        }
      }else if(fx.type==='aura'){
        const radius=32+(fx.reach-32)*(1-fx.ttl/.85);
        ellipse(c,fx.x,fx.y,radius,radius,w.color+'2d',w.color,4);
      }else if(fx.type==='thrust'||fx.type==='saw'||fx.type==='bash'||fx.type==='spikes'){
        c.translate(fx.x,fx.y);c.rotate(fx.angle);
        if(fx.type==='thrust'){
          thPoly(c,[[18,-5],[fx.reach-24,-4],[fx.reach,0],[fx.reach-24,9],[18,6]],w.color,'#537559',2);
        }else if(fx.type==='saw'){
          const teeth=[];
          for(let i=0;i<32;i++){
            const angle=i*Math.PI/16, radius=i%2?23:31;
            teeth.push([fx.reach*.57+Math.cos(angle+t*28)*radius,Math.sin(angle+t*28)*radius]);
          }
          thPoly(c,teeth,w.color,'#ffe2aa',2);
        }else if(fx.type==='bash'){
          thPoly(c,[[37,-23],[99,-29],[fx.reach,0],[99,29],[37,23]],w.color+'48',w.color,4);
        }else{
          for(const angle of [-.40,-.20,0,.20,.40]){
            c.save();c.rotate(angle);
            thPoly(c,[[28,-7],[fx.reach*(1-fx.ttl*.7),0],[28,7]],w.color);
            c.restore();
          }
        }
      }else{
        const reach=fx.reach||86, radius=25+(reach-25)*(1-a);
        ellipse(c,fx.x,fx.y,radius,radius*(fx.type==='shield'?.86:1),w.color+'16',w.color,fx.type==='shield'?5:7);
      }
      c.restore();
    }
    for(const shot of game.projectiles){
      if(shot.delay>0)continue;
      const w=WEAPONS[shot.w];
      c.save();c.translate(shot.x,shot.y);c.rotate(shot.angle);
      c.strokeStyle=w.color;c.lineWidth=4;
      c.beginPath();c.moveTo(shot.w==='bow'?-24:-14,0);c.lineTo(7,0);c.stroke();
      if(shot.w==='stone')ellipse(c,0,0,7,6,'#eaa97a','#623b49',2);
      else thPoly(c,[[2,-5],[10,0],[2,5]],w.color);
      c.restore();
    }
    for(const p of [...game.players].sort((a,b)=>a.y-b.y)){
      if(p.hp===0)continue;
      const {x,y}=visualPosition('player:'+p.id,p,dt);
      if(p.buff>0)ellipse(c,x,y+3,38,39,'#ffe48d30','#ffea9d',3);
      if(p.block>0)ellipse(c,x,y,32,33,'#95e8ff24',WEAPONS[p.weapon].color,3);
      if(p.flash)thGlow(c,x,y,53,p.flash>0?'#ff544c90':'#75ffd590');
      arAvatar(c,x,y,Object.hasOwn(TY,p.avatar)?p.avatar:'verity',p.name,'',p.id===uid(),0,0,0,p.facing,t,false,0,false);
      if(game.phase==='fight')drawOrbitingHammer(c,p,x,y,phaseTime);
      c.fillStyle='#1d1523';c.fillRect(x-19,y-35,38,4);
      c.fillStyle=p.hp>30?'#7be1ad':'#ff6b6b';c.fillRect(x-19,y-35,38*p.hp/E.maxHP(p),4);
    }
  }

  function draw(ts,dt){
    const phaseTime=game.time+(mode==='guest'?Math.max(0,Math.min(.25,(ts-receivedAt)/1000)):0);
    if(game.phase==='intro')cinematic(phaseTime);
    else{subtitle.hidden=true;battlefield(reduced.matches?0:ts/1000,dt,phaseTime)}
  }

  const cover=document.createElement('canvas');cover.width=cover.height=176;
  const artContext=cover.getContext('2d');
  artContext.fillStyle=thGradient(artContext,0,0,165,170,['#3a1523','#bd3f41','#1e1323']);
  artContext.fillRect(0,0,176,176);
  for(let i=0;i<9;i++){
    artContext.fillStyle=i%2?'#ffaca243':'#200d1d84';
    artContext.fillRect(4+i*22,0,7,176);
  }
  thGlow(artContext,88,82,115,'#ff554f84');
  bossArt(artContext,0,88,91,55,.6);
  const art=cover.toDataURL();
  const masteryArt=BOSSES.map((boss,index)=>{
    const icon=document.createElement('canvas');icon.width=icon.height=180;
    const c=icon.getContext('2d');
    c.fillStyle=thGradient(c,0,0,180,180,['#160f22',boss.color+'75','#241426']);
    c.fillRect(0,0,180,180);
    c.strokeStyle=boss.color+'45';c.lineWidth=2;
    for(let r=28;r<=90;r+=20){c.beginPath();c.arc(90,90,r,0,Math.PI*2);c.stroke()}
    bossArt(c,index,90,91,51,.6);
    return icon.toDataURL();
  });
  $('br-card-art').src=art;
  $('br-menu').onclick=()=>{setNote('');stepNote='';scr('boss-rush')};
  screen.addEventListener('click',event=>{
    const target=event.target.closest('[data-br]');
    if(target)action(target.dataset.br);
  });
  const stick=$('br-stick'), stickDot=$('br-stick-dot'), attackButton=$('br-attack');
  function steer(event){
    const rect=stick.getBoundingClientRect();
    const x=(event.clientX-rect.left-rect.width/2)/(rect.width*.39);
    const y=(event.clientY-rect.top-rect.height/2)/(rect.height*.39);
    const l=Math.max(1,Math.hypot(x,y));
    touch={id:event.pointerId,x:x/l,y:y/l};
    stickDot.style.transform='translate('+(touch.x*23)+'px,'+(touch.y*23)+'px)';
  }
  stick.addEventListener('pointerdown',event=>{
    if(touch)return;
    stick.setPointerCapture(event.pointerId);
    steer(event);
  });
  stick.addEventListener('pointermove',event=>{if(touch?.id===event.pointerId)steer(event)});
  stick.addEventListener('lostpointercapture',()=>{touch=null;stickDot.style.transform=''});
  attackButton.addEventListener('pointerdown',event=>{
    attackButton.setPointerCapture(event.pointerId);
    control.attack=inputId();held=true;nextHeld=performance.now()+260;
  });
  attackButton.addEventListener('lostpointercapture',()=>{held=false});
  attackButton.addEventListener('click',event=>{if(event.detail===0)control.attack=inputId()});
  const accepted=new Set(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright',' ']);
  addEventListener('keydown',event=>{
    const key=event.key.toLowerCase();
    if(cur!=='boss-rush'||controls.hidden||!accepted.has(key))return;
    event.preventDefault();
    if(key===' '&&!keys.has(key))control.attack=inputId();
    keys.add(key);
  });
  addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
  addEventListener('blur',()=>{keys.clear();held=false;touch=null;stickDot.style.transform=''});
  const originalScreen=scr;
  scr=function(n){
    const result=originalScreen.apply(this,arguments);
    screen.classList.toggle('hide',cur!=='boss-rush');
    if(cur==='boss-rush'){
      if(!raf){last=0;render();raf=requestAnimationFrame(frame)}
      nextInvites=0;
    }else if(raf){
      cancelAnimationFrame(raf);raf=0;
      leaveRoom();
    }
    return result;
  };
})();
