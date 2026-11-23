(() => {
  'use strict';

  const ROOT='tester', MAX_WAVES=30, SESSION=8*60*60*1000;
  const waveWords={one:'волна',few:'волны',many:'волн'};
  const wavePlural=new Intl.PluralRules('ru');
  const preview=window.VerityTesterPreview;
  const battleBar=$('tester-battle'), mailPanel=$('tester-admin-mail');
  const form=$('tester-lock'), builder=$('tester-builder'), status=$('tester-status');
  const roster=new Set(), played=new Map(), localReports=new Map();
  const modeNames={...Object.fromEntries(Object.entries(DF).map(([id,mode])=>[id,mode.n])),
    hw:'Хэллоуинская ночь',hk:'Взлом системы',inf:'Жерло вулкана'};
  let grant=null, sandbox=null, inSimulation=false, mailRequest=0, chosen='', busy=false;

  function message(text){status.textContent=text}
  function unlocked(){
    return grant&&Date.now()<grant.until&&(preview||grant.uid===ON.uid);
  }
  function allowed(){return Boolean(unlocked())}
  function options(choices){
    return Object.entries(choices).map(([id,name])=>'<option value="'+esc(id)+'">'+esc(name)+'</option>').join('');
  }
  function safeLink(value){
    try{
      const url=new URL(value);
      if(url.protocol==='https:'&&!url.username&&!url.password)return url.href;
    }catch{}
    return '';
  }
  function timestamp(){return {'.sv':'timestamp'}}
  async function digest(value){
    if(!crypto.subtle)throw new Error('Открой игру по HTTPS, чтобы войти с паролем.');
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('verity-tester-v1:'+value));
    return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
  }
  async function unlock(event){
    event.preventDefault();
    if(busy)return;
    const password=$('tester-password').value.trim();
    if(!password)return;
    busy=true;
    const submit=$('tester-unlock');
    submit.disabled=true;
    message('Проверяю пароль…');
    try{
      const proof=await digest(password);
      if(preview){
        if(proof!==preview.proof)throw new Error('Неверный пароль.');
      }else{
        if(!onOk())throw new Error('Для входа нужен сервер игры.');
        await onAuth();
        const result=await db(ROOT+'/access/'+ON.uid,{m:'PUT',b:{proof,at:timestamp()}});
        if(!result.ok)throw new Error('Пароль неверный или админ ещё не настроил вход.');
      }
      grant={uid:ON.uid,until:Date.now()+SESSION};
      $('tester-password').value='';
      open();
      if(!preview)loadLinks();
    }catch(error){message(error.message||'Сервер недоступен. Попробуй ещё раз.')}
    finally{busy=false;submit.disabled=false}
  }
  function open(){
    scr('tester');
    form.hidden=allowed();
    builder.hidden=!allowed();
    message('');
    if(allowed())render();
    else $('tester-password').focus();
  }

  function teamView(){
    $('tester-team').innerHTML=roster.size?[...roster].map(id=>
      '<button type="button" data-remove="'+esc(id)+'" aria-label="Убрать '+esc(TY[id].n)+'">'+pic(id,1,23)+esc(TY[id].n)+' ×</button>'
    ).join(''):'<span>Добавь хотя бы одного Верити.</span>';
    $('tester-count').textContent=roster.size+' в команде';
    $('tester-start').disabled=!roster.size;
  }
  function selectUnit(){
    chosen=$('tester-unit').value;
    const unit=TY[chosen];
    $('tester-unit-info').innerHTML=unit?pic(chosen,1,42)+'<span><b>'+esc(unit.n)+'</b><small>'+esc(unit.d||'')+'</small></span>':'';
  }
  function feedbackView(){
    const select=$('tester-report-unit'), last=select.value;
    select.innerHTML=options(Object.fromEntries([...played].filter(([id])=>TY[id]).map(([id])=>[id,TY[id].n])));
    if(played.has(last))select.value=last;
    $('tester-report').hidden=!played.size;
    $('tester-report-empty').hidden=!!played.size;
  }
  function render(){
    if(!$('tester-mode').options.length){
      $('tester-mode').innerHTML=options(modeNames);
      $('tester-map').innerHTML=options(Object.fromEntries(Object.entries(MP).map(([id,map])=>[id,map.n])));
    }
    const unitKeys=Object.keys(TY).sort((a,b)=>TY[a].n.localeCompare(TY[b].n,'ru'));
    $('tester-unit').innerHTML=options(Object.fromEntries(unitKeys.map(id=>[id,TY[id].n])));
    $('tester-unit').value=chosen&&Object.hasOwn(TY,chosen)?chosen:'verity';
    selectUnit();
    teamView();
    feedbackView();
  }
  async function loadLinks(){
    try{
      const result=await db(ROOT+'/links');
      if(!result.ok||!allowed())return;
      for(const key of ['abuse','boss']){
        const anchor=$('tester-link-'+key), url=safeLink(result.j?.[key]);
        anchor.hidden=!url;
        if(url)anchor.href=url;
        else anchor.removeAttribute('href');
      }
    }catch{}
  }

  function withTestSave(fn){
    if(inSimulation||!sandbox)return fn();
    const real=M;
    M=sandbox.save;
    inSimulation=true;
    try{return fn()}
    finally{M=real;inSimulation=false}
  }
  function cloneBattleState(){
    return {game:G,paths:PT.slice(),segments:segs.slice(),length:tot,road:{...road},decoration:MDEC,mapNext:MAPNEXT};
  }
  function restoreBattleState(){
    const {before}=sandbox;
    sandbox=null;
    G=before.game;
    PT.splice(0,PT.length,...before.paths);
    segs.splice(0,segs.length,...before.segments);
    tot=before.length;
    for(const key of Object.keys(road))delete road[key];
    Object.assign(road,before.road);
    MDEC=before.decoration;
    MAPNEXT=before.mapNext;
    battleBar.hidden=true;
    document.body.classList.remove('testing-battle');
  }
  function launch(){
    if(!allowed()){open();return}
    const mode=$('tester-mode').value, map=$('tester-map').value;
    const waves=Number($('tester-waves').value);
    const team=[...roster].filter(id=>Object.hasOwn(TY,id));
    if(!Object.hasOwn(modeNames,mode)||!Object.hasOwn(MP,map)||!Number.isInteger(waves)||waves<1||waves>MAX_WAVES||!team.length){
      message('Выбери карту, режим, команду и от 1 до '+MAX_WAVES+' волн.');
      return;
    }
    const saveCopy=JSON.parse(JSON.stringify(M));
    Object.assign(saveCopy,{own:Object.fromEntries(team.map(id=>[id,1])),lo:team,lp:[],coop:false});
    sandbox={save:saveCopy,before:cloneBattleState()};
    try{
      withTestSave(()=>{
        MAPNEXT=map;
        startNow(mode);
        const active=G;
        active.tester={mode,map,waves};
        active.lo=team;
        active.sel=team.includes(chosen)?chosen:team[0];
        active.coins=Math.max(active.coins,15000,...team.map(id=>TY[id].cost));
        active.next=18;
        setMap(map);
        active.map=map;
        shop();hud();
        say('Расставь Верити и запусти волну, чтобы проверить его в бою.');
      });
      document.body.classList.add('testing-battle');
      battleBar.hidden=false;
      $('tester-battle-title').textContent=modeNames[mode]+' · '+MP[map].n+' · '+waves+' '+waveWords[wavePlural.select(waves)];
    }catch(error){
      restoreBattleState();
      open();
      message('Тестовый бой не запустился.');
      console.error(error);
    }
  }
  function finish(won){
    G.over=won===2?2:1;
    $('et').textContent=won===2?'Тест пройден':'База пала';
    $('end').className='';
    $('e1').textContent='К настройкам теста';
    $('e2').textContent='К отзывам';
    say('Выйди из боя, чтобы отправить отзыв об испытанном Верити.');
  }

  function rememberTest(battle){
    if(!battle.wave||!battle.run||!battle.en.some(enemy=>!enemy.dead))return;
    for(const unit of battle.units){
      played.set(unit.k,{mode:battle.tester.mode,map:battle.tester.map,wave:battle.wave});
    }
  }
  async function report(verdict){
    if(!allowed()){open();return}
    const unit=$('tester-report-unit').value;
    const details=played.get(unit);
    if(!details||busy)return;
    busy=true;
    const note=$('tester-report-status');
    note.textContent='Отправляю…';
    try{
      const row={unit,verdict,...details};
      if(preview){
        localReports.set(unit,{...row,t:Date.now()});
        note.textContent='Отзыв записан в почту этой демоверсии.';
        return;
      }
      if(!M.fb?.nick)throw new Error('Сначала выбери ник во вкладке «Друзья».');
      const result=await db(ROOT+'/reports/'+ON.uid+'/'+unit,{m:'PUT',b:{...row,t:timestamp()}});
      if(!result.ok)throw new Error('Не удалось отправить. Если недавно отправлял отзыв по этому Верити, подожди 30 секунд.');
      note.textContent='Письмо в почте админа.';
    }catch(error){note.textContent=error.message||'Не удалось отправить письмо.'}
    finally{busy=false}
  }
  function emailRows(rows){
    if(!rows.length)return '<p>Отзывов пока нет.</p>';
    return '<div class="tester-reports">'+rows.map(({row,nick})=>
      '<article><strong>'+esc(row.verdict==='buff'?'Бафф!':'Дебафф!')+' · '+esc(TY[row.unit]?.n||row.unit)+'</strong><small>'+
      esc(nick||'Тестер')+' · '+esc(modeNames[row.mode]||'')+' · '+esc(MP[row.map]?.n||'')+' · волна '+Number(row.wave)+
      '</small></article>').join('')+'</div>';
  }
  async function adminMail(){
    const id=++mailRequest;
    mailPanel.hidden=true;
    if(preview&&cur==='mail'){
      mailPanel.hidden=false;
      mailPanel.innerHTML='<h3>Письма тестеров · демо</h3>'+emailRows([...localReports.values()].map(row=>({row,nick:'Тестер'})));
      return;
    }
    if(!onOk())return;
    try{
      await onAuth();
      const role=await db('admins/'+ON.uid);
      if(id!==mailRequest||cur!=='mail'||role.j!==true)return;
      mailPanel.hidden=false;
      mailPanel.innerHTML='<h3>Письма тестеров</h3><div class="tester-actions"><button type="button" id="tester-admin-refresh">Обновить письма</button>'+
        '<button type="button" id="tester-admin-setup">Пароль и ссылки</button></div><div id="tester-admin-reports">Загружаю…</div>';
      $('tester-admin-refresh').onclick=adminMail;
      $('tester-admin-setup').onclick=configure;
      const reports=await db(ROOT+'/reports',{q:qs('orderBy','$key')+'&'+qs('limitToLast',100)});
      const rows=Object.entries(reports.j||{}).flatMap(([uid,units])=>Object.values(units).map(row=>({row,uid})))
        .sort((a,b)=>b.row.t-a.row.t).slice(0,50);
      const names=Object.fromEntries(await Promise.all([...new Set(rows.map(item=>item.uid))].map(async uid=>{
        try{return [uid,(await db('players/'+uid)).j?.n||onCode(uid)]}
        catch{return [uid,onCode(uid)]}
      })));
      if(id===mailRequest&&cur==='mail')$('tester-admin-reports').innerHTML=
        reports.ok?emailRows(rows.map(item=>({...item,nick:names[item.uid]}))):'<p>Сервер не разрешил прочитать отзывы.</p>';
    }catch{
      if(id===mailRequest&&cur==='mail'&&$('tester-admin-reports'))$('tester-admin-reports').textContent='Не удалось загрузить письма.';
    }
  }
  async function configure(){
    mOpen('Настройки Тестерки','<form id="tester-settings"><label>Новый пароль <input id="tester-new-password" type="password" minlength="12" maxlength="100" autocomplete="new-password" placeholder="Минимум 12 символов"></label>'+
      '<p>Оставь пароль пустым, чтобы обновить только ссылки.</p><label>Тестовый абьюз <input type="url" id="tester-new-abuse" placeholder="https://…"></label>'+
      '<label>Тестовый боссфайт <input type="url" id="tester-new-boss" placeholder="https://…"></label>'+
      '<button type="submit" id="tester-settings-save">Сохранить</button><p role="status" id="tester-settings-status"></p></form>');
    const saveButton=$('tester-settings-save'), note=$('tester-settings-status');
    saveButton.disabled=true;
    try{
      const links=await db(ROOT+'/links');
      if(!links.ok){note.textContent='Не удалось загрузить настройки.';return}
      if(!$('tester-settings'))return;
      for(const key of ['abuse','boss'])$('tester-new-'+key).value=safeLink(links.j?.[key]);
    }catch{note.textContent='Нет связи с сервером.';return}
    saveButton.disabled=false;
    $('tester-settings').onsubmit=async event=>{
      event.preventDefault();
      const password=$('tester-new-password').value.trim();
      const links={};
      for(const key of ['abuse','boss']){
        const raw=$('tester-new-'+key).value.trim();
        const val=safeLink(raw);
        if(raw&&!val){note.textContent='Для тестовой ссылки нужен адрес HTTPS.';return}
        links[key]=val;
      }
      if(password&&password.length<12){note.textContent='Нужно не меньше 12 символов.';return}
      saveButton.disabled=true;
      try{
        const patch={links};
        if(password)patch.gate=await digest(password);
        const result=await db(ROOT,{m:'PATCH',b:patch});
        if(!result.ok)throw new Error('Сервер не сохранил настройки. Проверь правила Firebase.');
        $('tester-new-password').value='';
        note.textContent='Сохранено.';
      }catch(error){note.textContent=error.message||'Не удалось сохранить.'}
      finally{saveButton.disabled=false}
    };
  }

  window.VerityTester={isSimulating:()=>inSimulation,canPreviewRaid:allowed};
  const promo=$('pb').onclick;
  $('pb').onclick=function(event){
    if($('pi').value.replace(/\s+/g,'').toLowerCase()!=='test')return promo.call(this,event);
    $('pi').value='';
    pmm('');
    open();
    if(allowed()&&!preview)loadLinks();
  };
  form.onsubmit=unlock;
  $('tester-back').onclick=()=>scr('promo');
  $('tester-unit').onchange=selectUnit;
  $('tester-add').onclick=()=>{if(chosen)roster.add(chosen);teamView()};
  $('tester-team').onclick=event=>{
    const button=event.target.closest('[data-remove]');
    if(button){roster.delete(button.dataset.remove);teamView()}
  };
  $('tester-launch').onsubmit=event=>{event.preventDefault();launch()};
  $('tester-leave-battle').onclick=open;
  $('tester-buff').onclick=()=>report('buff');
  $('tester-debuff').onclick=()=>report('debuff');
  $('tester-abuse').onclick=()=>{if(allowed())arEnter({raidTest:true,tester:true,stage:'warmup'})};
  $('tester-boss').onclick=()=>{if(allowed())arEnter({raidTest:true,tester:true,stage:'phase1'})};
  if(preview)$('tester-demo-mail').hidden=false;
  $('tester-demo-mail').onclick=()=>scr('mail');

  const originalUpdate=upd, originalDraw=draw, originalShop=shop, originalEnd=endGame;
  const originalHUD=hud, originalClick=cv.onclick, originalScreen=scr;
  upd=function(dt){
    if(!G?.tester)return originalUpdate(dt);
    const battle=G;
    rememberTest(battle);
    return withTestSave(()=>{originalUpdate(dt);rememberTest(battle)});
  };
  draw=function(){return G?.tester?withTestSave(originalDraw):originalDraw()};
  shop=function(){return G?.tester?withTestSave(originalShop):originalShop()};
  cv.onclick=function(event){
    return G?.tester?withTestSave(()=>originalClick.call(this,event)):originalClick.call(this,event);
  };
  endGame=function(won,text){if(G?.tester)finish(won);else originalEnd(won,text)};
  hud=function(){
    originalHUD();
    if(G?.tester){
      $('wmx').textContent='/'+G.tester.waves;
      if(G.over)$('e1').textContent='К настройкам теста';
    }
  };
  for(const id of ['e1','e2']){
    const original=$(id).onclick;
    $(id).onclick=function(event){if(G?.tester)open();else original.call(this,event)};
  }
  scr=function(screen){
    if(sandbox&&cur==='game'&&screen!=='game')restoreBattleState();
    if(screen==='tester'&&!allowed()){form.hidden=false;builder.hidden=true}
    const result=originalScreen(screen);
    if(cur==='mail')adminMail();
    else{mailRequest++;mailPanel.hidden=true}
    return result;
  };
})();
