/* The shared arena supplies player presence, touch controls and account storage. */
(() => {
  'use strict';
  const EVENT = 'raid-20261122';
  const ROOT = 'arena/cfg/' + EVENT;
  const TIMED_ID = EVENT+'-timed-';
  const INTRO = 13000, WARMUP = 300000, INVASION = 25000, TRANSFORM = 5200;
  const SETTLE = 1600, SLOT = 800, LEGACY_SESSION = 3600000, ENDING = 20000, EPILOGUE = 12500;
  const FIGHT_MINUTES = 10;
  const RESULT_GRACE = 5000, LOSS_SCREEN = 20000;
  const BOSS = '1x1x1x1', UNIT = '1x1x1x1xty', UNIT_KEY = 'raidverity';
  const EDGE = 1020;
  const motionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const battleMusic = {data:'verity-raid.mp3',volume:.51};
  const runs = new Map(), proofs = new Map();
  const completed = new Map();
  let active, adminTab = false, busy = false, sound = true, rewardBusy = false;
  const moves = {
    hand:{name:'Удар рукой',warn:1.85,hit:.43},
    beam:{name:'Лазерный луч',warn:1.95,hit:.50},
    sword:{name:'Удар мечом',warn:1.70,hit:.42,trail:2},
    domino:{name:'Домино',warn:.72,hit:.22,repeat:6,gap:1.08},
    surge:{name:'Усиленный луч',warn:2.15,hit:.65},
    down:{name:'Босс упал',warn:0,hit:6.8}
  };

  const dialogues = {
    intro:[
      [0,'Админити','Привет, ребята! Сегодня я решил провести повторный админ-абьюз!'],
      [4,'Админити','На нём будут награды и новые Верити!'],
      [8,'Админити','Запускаю арену!']
    ],
    invasion:[
      [0,'Админити','Ребята, я чувствую какую-то хакерскую силу. Неужели это Хакерити?'],
      [4,'Админити','Тогда кого я превратил в индейку на вчерашнем абьюзе?'],
      [8,'1x1x1x1','Узрите настоящего 1x1x1x1, а не то недоразумение, которое заспавнил вчера Хакерити!'],
      [13,'Админити','Хранители! Победите его!!'],
      [15,'1x1x1x1','Я прибыл из мира Роблокса. Я уже покорил его своим хакерским мечом!'],
      [20,'1x1x1x1','И теперь пришло время для вашего мира. Сейчас будет настоящий боссфайт, Верития!']
    ],
    transform:[
      [0,'1x1x1x1','Ха… Ха-ха-ха!'],
      [2.8,'1x1x1x1','Смотрите, как выглядит моя настоящая сила!']
    ],
    ending:[
      [0,'1x1x1x1','Чёрт! Как меня смогли победить обычные круглишки?!'],
      [3.4,'1x1x1x1','Я не мог так проиграть… не мог…'],
      [7,'Хранитель','Фух, мы его победили. А что это за корона?'],
      [11,'Админити','Хранители! Я так рад, что вы смогли победить 1x1x1x1! Что это за корона?'],
      [15,'Админити','Я понял! Я могу дать вам приз за то, что вы победили его. Готовы?']
    ],
    prison:[[3.5,'1x1x1','Скоро эти боссы выйдут и отомстят Веритии…']]
  };
  const elapsed = (now, at) => (now-at)/1000;
  const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
  const ease = v => {v=clamp(v,0,1);return v*v*(3-2*v)};
  const current = () => AR.raid;
  const invasionAt = config => config.at+INTRO+WARMUP;
  const bsAt = config => invasionAt(config)+INVASION;
  const tag = (id,kind,slot) => id+'-'+kind+'-'+slot;
  const fightDeadline = config => config.fightMinutes?bsAt(config)+config.fightMinutes*60000:config.at+LEGACY_SESSION;
  const finishesAt = (config,wonAt) => wonAt?wonAt+ENDING+EPILOGUE+60000:
    fightDeadline(config)+(config.fightMinutes?RESULT_GRACE+LOSS_SCREEN:0);
  const isOpen = (now=Date.now()) => !!active && !active.stop && now<finishesAt(active,completed.get(active.id));
  const title = () => $('mt').textContent==='🛠 Админ-панель' && !$('modal').classList.contains('hide');
  const button = (key,label,disabled=false) => '<button type="button" data-vr="'+key+'"'+(disabled?' disabled':'')+'>'+label+'</button>';

  function validate(proof,kind,id) {
    if(typeof proof?.p!=='string'||typeof proof?.s!=='string'||proof.p.length>500||proof.s.length>100)
      return null;
    const cache = kind+':'+id+':'+proof.p+'.'+proof.s;
    if(!proofs.has(cache)) {
      if(proofs.size>100)proofs.clear();
      proofs.set(cache,(async () => {
        try {
          if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},await aPub(),ub64(proof.s),u8(proof.p)))return null;
          const row = JSON.parse(new TextDecoder().decode(ub64(proof.p)));
          if(row.event!==EVENT||row.kind!==kind||row.id!==id||!Number.isSafeInteger(row.at))return null;
          if(kind==='start'){
            const timed=id===TIMED_ID+row.at&&row.fightMinutes===FIGHT_MINUTES;
            const legacy=id===EVENT+'-'+row.at&&row.fightMinutes===undefined;
            if((!timed&&!legacy)||!Number.isInteger(row.hp)||row.hp<200||row.hp>6000||
              typeof row.contest!=='boolean'||!Number.isInteger(row.seed)||row.seed<0||row.seed>0xffffffff)return null;
          }
          return row;
        } catch {return null}
      })());
    }
    return proofs.get(cache);
  }

  async function readConfig(cfg) {
    const list = Object.entries(cfg?.[EVENT]||{}).filter(([id]) => /^raid-20261122-(?:timed-)?\d{13}$/.test(id))
      .sort(([a],[b]) => b.slice(-13).localeCompare(a.slice(-13))).slice(0,8);
    for(const [id,data] of list) {
      const start = await validate(data?.start,'start',id);
      if(!start)continue;
      const stop = await validate(data.stop,'stop',id);
      const stopAt=stop?.at>=start.at?stop.at:0;
      runs.set(id,{event:EVENT,id,at:start.at,hp:start.hp,contest:start.contest,seed:start.seed,fightMinutes:start.fightMinutes,
        stop:Math.max(runs.get(id)?.stop||0,stopAt)});
    }
    const latest = [...runs.values()].sort((a,b) => b.at-a.at)[0];
    if(latest)active=latest;
    if(cur!=='arn')pollRewards();
    refresh();
  }

  function join(test) {
    if(test?.raidTest)return makeTrial(test.stage);
    return isOpen()?session(active):null;
  }

  function session(config) {
    return {config,hp:3,downUntil:0,seen:new Set(),clock:0,score:{},rows:[],p1:[],p2:[],hud:'',
      writes:new Set(),shake:0,phaseAt:0,wonAt:0,lastStage:'',rosterMarkup:null,portraits:new Map()};
  }

  function makeTrial(stage) {
    const now=Date.now();
    const match=session({id:'trial',at:now,hp:224,contest:true,seed:17,fightMinutes:FIGHT_MINUTES});
    match.test=true;
    const battle=now-INTRO-WARMUP-INVASION;
    match.config.at=({hand:battle,beam:battle,down:battle,sword:battle-20000,domino:battle-20000,surge:battle-20000,warmup:now-INTRO,invasion:now-INTRO-WARMUP,phase1:battle,phase2:battle-20000,
      transform:battle-20000,ending:battle-50000,prison:battle-80000})[stage]??now;
    if(['phase2','transform','ending','prison','sword','domino','surge'].includes(stage)) {
      match.phaseAt=stage==='transform'?now:now-TRANSFORM;
      match.p1=[{uid:'me',t:match.phaseAt-SETTLE,v:112}];
    }
    if(stage==='ending'||stage==='prison') {
      match.wonAt=stage==='prison'?now-ENDING:now;
      match.p2=[{uid:'me',t:match.wonAt-SETTLE,v:112}];
    }
    if(moves[stage])match.override={kind:stage,at:now};
    return match;
  }

  function spawn() {
    const match=current(), state=stateAt(match,Date.now());
    AR.hudHtml=null;
    AR.hseen={};
    $('vr-roster').open=false;
    Object.assign(AR.me,{x:state.split?1470:1320,y:820});
  }

  function stateAt(match,now) {
    if(now<match.config.at)return {stage:'waiting',at:match.config.at,split:false};
    const config=match.config, warm=config.at+INTRO, invasion=invasionAt(config), battle=bsAt(config);
    const split=now>=invasion+12500;
    if(match.override&&elapsed(now,match.override.at)<13)
      return {stage:'fight',split:true,phase:match.phaseAt?2:1,at:match.override.at,until:fightDeadline(config)};
    if(now<warm)return {stage:'intro',at:config.at,split:false};
    if(now<invasion)return {stage:'warmup',at:warm,until:invasion,split:false};
    if(now<battle)return {stage:'invasion',at:invasion,split};
    if(match.wonAt) {
      if(now<match.wonAt+ENDING)return {stage:'ending',at:match.wonAt,split:true};
      if(now<match.wonAt+ENDING+EPILOGUE)return {stage:'prison',at:match.wonAt+ENDING,split:true};
      return {stage:'done',at:match.wonAt+ENDING+EPILOGUE,split:true};
    }
    const until=fightDeadline(config);
    if(now>=until){
      const checking=now<until+RESULT_GRACE;
      return {stage:checking?'checking':'expired',at:checking?until:until+RESULT_GRACE,split:true};
    }
    if(match.phaseAt&&now>=match.phaseAt&&now<match.phaseAt+TRANSFORM)
      return {stage:'transform',at:match.phaseAt,until,split:true,phase:2};
    const second=match.phaseAt&&now>=match.phaseAt+TRANSFORM;
    return {stage:'fight',at:second?match.phaseAt+TRANSFORM:battle,until,phase:second?2:1,split:true};
  }

  function records(board,config,kind,from,to,now) {
    const prefix=config.id+'-'+kind+'-';
    const hits=[];
    for(const [key,players] of Object.entries(board||{})) {
      if(!key.startsWith(prefix))continue;
      const slot=Number(key.slice(prefix.length));
      if(!Number.isSafeInteger(slot)||slot<0)continue;
      const at=config.at+slot*SLOT;
      for(const [uid,hit] of Object.entries(players||{})) {
        if(hit?.v!==(kind==='pvp'?1:28)||!Number.isFinite(hit.t)||hit.t<from||hit.t>=to||
          hit.t>now-SETTLE||hit.t<at-500||hit.t>=at+SLOT+1100)continue;
        hits.push({uid,t:hit.t,v:hit.v,n:String(hit.n||'Хранитель').slice(0,20)});
      }
    }
    return hits.sort((a,b)=>a.t-b.t||a.uid.localeCompare(b.uid));
  }

  function threshold(rows,hp) {
    let hits=0;
    for(const row of rows) {
      hits+=row.v;
      if(hits>=hp)return row.t;
    }
    return 0;
  }

  function resolve(match,board,now) {
    const config=match.config, warm=config.at+INTRO, invasion=invasionAt(config),
      end=Math.min(config.stop||Infinity,fightDeadline(config));
    if(config.contest&&now>=warm) {
      match.score={};
      for(const hit of records(board,config,'pvp',warm,Math.min(invasion,end),now)) {
        match.score[hit.uid] ||= {uid:hit.uid,n:hit.n,v:0,t:0};
        match.score[hit.uid].v++;
        match.score[hit.uid].t=hit.t;
      }
    }
    if(now<bsAt(config)||match.wonAt)return;
    const phase1={stage:'fight',phase:1,at:bsAt(config)};
    match.p1=records(board,config,'one',phase1.at,end,now)
      .filter(hit=>attackAt(match,phase1,hit.t-1100)?.down||attackAt(match,phase1,hit.t)?.down);
    const half=threshold(match.p1,Math.ceil(config.hp/2));
    if(!half)return;
    match.p1=match.p1.filter(hit=>hit.t<=half);
    match.phaseAt=half+SETTLE;
    const phase2={stage:'fight',phase:2,at:match.phaseAt+TRANSFORM};
    match.p2=records(board,config,'two',phase2.at,end,now)
      .filter(hit=>attackAt(match,phase2,hit.t-1100)?.down||attackAt(match,phase2,hit.t)?.down);
    const zero=threshold(match.p2,Math.floor(config.hp/2));
    if(zero) {
      match.p2=match.p2.filter(hit=>hit.t<=zero);
      match.wonAt=zero+SETTLE;
      completed.set(config.id,match.wonAt);
    }
  }

  function leaders(match) {
    return Object.values(match.score).sort((a,b)=>b.v-a.v||a.t-b.t||a.uid.localeCompare(b.uid));
  }

  function fighters(match) {
    const people = new Map();
    for(const hit of [...match.p1,...match.p2])people.set(hit.uid,hit.n||'Хранитель');
    return [...people.entries()].sort(([a],[b])=>a.localeCompare(b));
  }

  function pay(match,now) {
    if(match.test||!ON.uid)return;
    const config=match.config, contestOver=invasionAt(config)+SETTLE;
    const prize=match.wonAt&&now>=match.wonAt+ENDING&&fighters(match).some(([uid])=>uid===ON.uid);
    const champ=config.contest&&now>=contestOver&&(!config.stop||config.stop>=contestOver-SETTLE)&&leaders(match)[0]?.uid===ON.uid;
    arFix();
    const got=M.arn.raidRewards ||= {};
    const key=config.id+'-'+ON.uid, before=got[key]||{};
    if((!prize||before.unit)&&(!champ||before.contest))return;
    const snapshot={unit:M.own[UNIT_KEY],bank:M.bank,gem:M.gem};
    got[key]={...before};
    if(prize&&!before.unit){got[key].unit=true;M.own[UNIT_KEY]=1}
    if(champ&&!before.contest){got[key].contest=true;M.bank+=500;M.gem=(M.gem||0)+10}
    if(!save()) {
      got[key]=before;M.bank=snapshot.bank;M.gem=snapshot.gem;
      if(snapshot.unit===undefined)delete M.own[UNIT_KEY];else M.own[UNIT_KEY]=snapshot.unit;
      return;
    }
    if(champ&&!before.contest)anShow('🏆 Победитель дубинок! +500 монет и +10 гемов');
    if(prize&&!before.unit)anShow('🏆 Вы победили босса! ВЫ ПОЛУЧИЛИ '+UNIT+', поздравляем!');
  }

  async function pollRewards() {
    if(rewardBusy||!ON.uid||!runs.size)return;
    const now=Date.now(), uid=ON.uid;
    const eligible=[...runs.values()].filter(config=>now>=invasionAt(config)&&
      (!M.arn?.raidRewards?.[config.id+'-'+uid]?.unit||config.contest&&!M.arn?.raidRewards?.[config.id+'-'+uid]?.contest));
    if(!eligible.length)return;
    rewardBusy=true;
    try {
      const response=await db('arena/bd');
      if(!response.ok||uid!==ON.uid)return;
      for(const config of eligible) {
        const match=session(config);
        resolve(match,response.j,now);
        pay(match,now);
      }
    } catch {} finally {rewardBusy=false}
  }

  function sync(arena,now) {
    const match=current();
    match.config=runs.get(match.config.id)||match.config;
    if(!AR.playersLive&&performance.now()-AR.lastPlayerSnapshot>410)arReadPlayers(arena.p);
    resolve(match,arena.bd,now);
    presentPlayers(match);
    const state=stateAt(match,now);
    for(const [id,hit] of Object.entries(arena.hits?.[ON.uid]||{})) {
      if(hit?.pa!==match.config.id||AR.hseen[id])continue;
      AR.hseen[id]=true;
      if(state.stage==='warmup'&&now-hit.t<4500&&hit.t>=match.config.at+INTRO)
        arStun(.66,'БОНК! '+(arena.p?.[hit.f]?.n||'Игрок')+' попал дубинкой');
      db('arena/hits/'+ON.uid+'/'+id,{m:'DELETE'}).catch(()=>{});
    }
    pay(match,now);
  }

  function writeStrike(match,kind,now) {
    if(match.test)return;
    const path=tag(match.config.id,kind,Math.floor((now-match.config.at)/SLOT));
    if(match.writes.has(path))return;
    match.writes.add(path);
    const uid=ON.uid;
    const send=async () => {
      for(let attempt=0;attempt<2;attempt++) {
        if(ON.uid!==uid||Date.now()-now>1400)return;
        try {
          const r=await db('arena/bd/'+path+'/'+uid,{m:'PUT',b:{v:kind==='pvp'?1:28,n:M.fb.nick,t:{'.sv':'timestamp'}},ifMatch:'null_etag'});
          if(r.ok||r.st===412)return;
          if(r.st===401||r.st===403){if(current()===match)arToast('Сервер не принял удар · '+r.st);return}
        } catch {}
      }
    };
    send();
  }

  function attackAt(match,state,now) {
    if(state.stage!=='fight')return null;
    const phase=state.phase, seconds=Math.max(0,elapsed(now,state.at));
    const timeline = phase===1?[[1,'hand'],[5,'beam'],[9,'down']]:
      [[.8,'sword'],[5.2,'domino'],[12.2,'surge'],[17,'down']];
    const span=phase===1?17:25;
    const cycle=Math.floor(seconds/span), step=seconds%span;
    const start=match.override&&elapsed(now,match.override.at)<13?[0,match.override.kind]:
      [...timeline].reverse().find(([at])=>step>=at);
    if(!start)return null;
    const [at,kind]=start, move=moves[kind], age=step-at;
    const wave=Math.floor(age/(move.gap||99));
    if(wave>=(move.repeat||1)||age<0)return null;
    const tick=age-wave*(move.gap||99), finish=move.warn+move.hit;
    const mode=tick<move.warn?'warn':tick<finish?'hit':tick<finish+(move.trail||0)?'trail':'rest';
    const seed=cycle*7+(match.config.seed||0);
    const columns=[1045,1350,1610,1190,1510,1730];
    const x=columns[(seed+wave)%columns.length];
    const rect={
      hand:[seed%2?1420:1040,260,540,1000],
      beam:[1040,300+(seed%3)*235,925,155],
      sword:[seed%2?1505:1040,35,465,1320],
      domino:[x,40,214,1320],
      surge:seed%2?[1040,575,930,420]:[1235,35,490,1325]
    }[kind];
    return {kind,move,mode,tick,age,rect,key:state.at+'-'+cycle+'-'+kind+'-'+wave,
      down:kind==='down'&&mode==='hit'};
  }

  const hitbox={x:1515,y:375,r:165};
  const inZone=(p,r)=>r&&p.x>=r[0]-19&&p.x<=r[0]+r[2]+19&&p.y>=r[1]-19&&p.y<=r[1]+r[3]+19;
  function blocked() {
    const match=current();
    if(!match)return false;
    return !['warmup','fight','done'].includes(stateAt(match,Date.now()).stage)||Date.now()<match.downUntil;
  }

  function swing() {
    const match=current(), m=AR.me, now=Date.now(), state=stateAt(match,now);
    if(!m||m.cd>0||m.stun>0||apArenaBlocked())return;
    const attack=attackAt(match,state,now);
    let target;
    if(state.stage==='warmup') {
      target=Object.entries(AR.oth).filter(([,p])=>!p.st&&Math.hypot(p.x-m.x,p.y-m.y)<AR_CLUB_REACH)
        .sort(([,a],[,b])=>Math.hypot(a.x-m.x,a.y-m.y)-Math.hypot(b.x-m.x,b.y-m.y))[0];
    }
    const boss=attack?.down&&Math.hypot(hitbox.x-m.x,hitbox.y-m.y)<hitbox.r+AR_CLUB_REACH;
    const aim=boss?hitbox:target?.[1];
    m.aim=aim?Math.atan2(aim.y-m.y,aim.x-m.x):m.face>0?0:Math.PI;
    m.face=Math.cos(m.aim)<0?-1:1;
    m.sw=AR_SWING_TIME;m.cd=.74;
    tone(240,.08,'square',.05,140);
    arPut(1);
    if(target) {
      const [uid,p]=target;
      if(match.test) {
        if(match.config.contest)match.score.me={uid:'me',n:'Ты',v:(match.score.me?.v||0)+1,t:now};
      } else {
        db('arena/hits/'+uid+'/'+ON.uid.slice(0,8)+now.toString(36),{m:'PUT',
          b:{f:ON.uid,pa:match.config.id,t:{'.sv':'timestamp'}}}).then(r=>{
          if(r.ok&&match.config.contest)writeStrike(match,'pvp',now);
        }).catch(()=>{});
      }
      AR.fx.push({x:p.x,y:p.y-25,t:0,label:'БОНК!'});
    }
    if(!boss)return;
    if(match.test) {
      const rows=state.phase===1?match.p1:match.p2;
      rows.push({uid:'me',v:28,t:now,n:M.fb?.nick||'Ты'});
      if(state.phase===1&&threshold(rows,Math.ceil(match.config.hp/2))) {
        match.phaseAt=now; match.override=null;
      }
      if(state.phase===2&&threshold(rows,Math.floor(match.config.hp/2))) {
        match.wonAt=now; match.override=null;
      }
    } else writeStrike(match,state.phase===1?'one':'two',now);
    AR.fx.push({x:hitbox.x,y:hitbox.y+30,t:0,label:'−28'});
    tone(130,.12,'square',.11,68);
  }

  function frame(canvas,t,dt,now) {
    const match=current(), m=AR.me, state=stateAt(match,now);
    if(!match.test&&(match.config.stop||now>=finishesAt(match.config,match.wonAt)))return arExit('Арена боссфайта закрылась.');
    const attack=attackAt(match,state,now);
    if(state.stage!==match.lastStage) {
      match.lastStage=state.stage;
      if(state.stage==='checking'&&!match.test)arPoll();
      if(state.stage==='warmup'&&match.test)
        AR.oth.practice={x:1378,y:820,n:'Тренировочный Верити',a:'verity',f:-1};
      if(state.stage==='invasion'||state.stage==='fight') {
        delete AR.oth.practice;
        m.x=Math.max(m.x,1140);m.stun=0;
      }
      if(state.stage==='fight'&&m.y>550&&match.test){m.x=hitbox.x;m.y=525}
      lmTick();
      if(['intro','invasion','transform','ending'].includes(state.stage))tone(98,.5,'triangle',.12,46);
      if(state.stage==='prison'&&match.test)anShow('Тест финала · '+UNIT+' показан на экране');
    }
    if(attack&&attack.mode==='hit'&&match.impact!==attack.key) {
      match.impact=attack.key;
      if(!motionPreference?.matches)match.shake=attack.kind==='domino'?.14:.32;
      tone(attack.kind==='down'?67:112,.22,'triangle',.09,46);
    }
    if(attack&&['hit','trail'].includes(attack.mode)&&inZone(m,attack.rect)&&!match.seen.has(attack.key)&&now>=match.downUntil) {
      match.seen.add(attack.key);
      match.hp--;
      arStun(.55,'Ты попал под атаку!');
      if(!match.hp)match.downUntil=now+3300;
    }
    if(!match.hp&&now>=match.downUntil){match.hp=3;m.x=1850;m.y=1160;m.stun=0;match.downUntil=0}
    let vx=+(!!(AR.keys.d||AR.keys.arrowright))-+(!!(AR.keys.a||AR.keys.arrowleft));
    let vy=+(!!(AR.keys.s||AR.keys.arrowdown))-+(!!(AR.keys.w||AR.keys.arrowup));
    if(AR.joy?.on){vx=AR.joy.dx;vy=AR.joy.dy}
    const length=Math.max(1,Math.hypot(vx,vy));
    if(m.stun>0)m.stun=Math.max(0,m.stun-dt);
    if(blocked()||m.stun>0||!$('modal').classList.contains('hide'))vx=vy=0;
    const prevX=m.x, prevY=m.y;
    const speed=320;
    m.x=clamp(m.x+vx/length*speed*dt,state.split?EDGE+32:32,AW-33);
    m.y=clamp(m.y+vy/length*speed*dt,33,AH-33);
    if(Math.abs(vx)>.1)m.face=vx>0?1:-1;
    m.mv=Math.abs(m.x-prevX)+Math.abs(m.y-prevY)>.03;
    m.sw=Math.max(0,m.sw-dt);m.cd=Math.max(0,m.cd-dt);
    match.shake=Math.max(0,match.shake-dt);
    if(!match.test){arMovePeers(t,now,dt);arPut(0)}
    AR.fx=AR.fx.filter(fx=>(fx.t+=dt)<.85);
    AR.toasts=AR.toasts.filter(toast=>(toast.t-=dt)>0);
    draw(canvas,t/1000,now,match,state,attack);
    hud(match,state,attack,now);
  }

  function text(c,value,x,y,size,color,face='system-ui') {
    c.font='900 '+size+'px '+face;
    c.textAlign='center';c.fillStyle=color;c.fillText(value,x,y);
  }

  function model(c,x,y,scale,t,options={}) {
    const {phase=1,pose='',glow=0}=options, monster=phase===2;
    const green=monster?'#66ff1f':'#54d51c', rim=monster?'#b8ff81':'#82e544';
    const shadow='#040c07';
    c.save();c.translate(x,y);c.scale(scale,scale);
    c.translate(0,Math.sin(t*2.1)*3);
    if(pose==='down')c.rotate(-1.14);
    if(pose==='fall')c.rotate(.68);
    if(monster) {
      thGlow(c,0,-35,139,'#3efa3e54');
      thPoly(c,[[-60,-22],[-136,10],[-178,25],[-137,-5],[-80,-48],[0,-30]],'#861b20');
      thPoly(c,[[62,-20],[131,12],[160,36],[105,21],[74,54]],'#f43c32','#4a0f13',3);
      thPoly(c,[[-11,-28],[-65,-44],[-97,-28],[-63,4],[-32,10],[-45,38],[24,17],[72,-10],[42,-42]],'#c92326','#4c1110',4);
      thPoly(c,[[-13,-25],[-56,-23],[-30,4],[20,-2],[49,-27],[23,-14]],'#ff6141');
    }
    thPoly(c,[[-45,63],[-4,68],[-4,129],[-46,119],[-53,105]],'#101b13',shadow,5);
    thPoly(c,[[5,67],[47,61],[53,109],[18,130],[4,119]],'#14231a',shadow,5);
    thPoly(c,[[-54,-29],[31,-36],[59,-12],[45,65],[13,82],[-47,66]],thGradient(c,-50,-30,48,72,['#7aff4e','#38aa24','#163c1b']),shadow,5);
    thPoly(c,[[31,-36],[59,-12],[45,65],[20,74],[34,16]],'#406f20');
    for(let i=0;i<5;i++){
      const yy=-17+i*16, width=30-i*2;
      thShape(c,p=>{p.moveTo(-width,yy);p.quadraticCurveTo(0,yy+21,width,yy-2)},null,'#13371c',monster?7:5);
      if(monster)thPoly(c,[[-width,yy],[0,yy+7],[width,yy-2]],null,'#a1ff4f',1.8);
    }
    for(const side of [-1,1]){
      let palm=pose==='rise'?-76:58, spread=Math.abs(palm===58?111:79);
      if(pose==='hand'&&side===1){palm=-104+Math.sin(t*5)*8;spread=117}
      if(pose==='impact'&&side===1){palm=91;spread=120}
      if(pose==='down'){palm=26;spread=107}
      if(pose==='domino'){palm=8;spread=117}
      thPoly(c,[[side*40,-23],[side*68,-35],[side*spread,palm-29],[side*(spread+16),palm-4],
        [side*(spread-8),palm+15],[side*(spread-37),palm+5],[side*39,21]],
        thGradient(c,side*42,-30,side*115,90,[monster?'#63d52d':'#427927','#0f2115','#08110b']),shadow,5);
      thPoly(c,[[side*68,-33],[side*(spread+3),palm-28],[side*(spread-1),palm-16],[side*68,-19]],monster?green:'#758c30');
      if(monster) for(let j=0;j<3;j++) {
        thPoly(c,[[side*(spread-32+j*6),palm-8+j*4],[side*(spread+6+j*2),palm-22+j*6]],null,'#80ee38',2.5);
      }
    }
    const swordOut=monster||pose==='sword'||pose==='draw';
    if(pose!=='down'){
      c.save();c.translate(swordOut?104:53,swordOut?28:-2);
      c.rotate(swordOut?(pose==='sword'?-1.23:.55):-1.22);
      thPoly(c,[[-6,10],[-6,-14],[-16,-18],[-15,-24],[-6,-25],[-13,-94],[0,-124],[14,-93],[7,-27],[18,-24],[17,-18],[7,-14],[6,10]],
        '#132e12',shadow,5);
      thPoly(c,[[0,-119],[9,-91],[5,-32],[-7,-89]],green);
      thPoly(c,[[0,-109],[1,-37],[-6,-28]],null,'#c2ff76',2);
      c.restore();
    }
    thPoly(c,[[-38,-101],[26,-104],[40,-81],[39,-42],[18,-32],[-29,-38],[-42,-55]],'#07100b',shadow,4);
    thPoly(c,[[26,-103],[41,-81],[39,-42],[22,-33],[28,-63]],'#1b3d15');
    thPoly(c,[[-39,-100],[-47,-133],[-34,-139],[-28,-111],[-13,-107],[-11,-144],[8,-147],[16,-110],[27,-109],[32,-137],[44,-139],[42,-102],[28,-94],[-24,-94]],
      thGradient(c,-40,-139,40,-96,[rim,green,'#1e591b']),shadow,4);
    [-6,2,10].forEach((xx,i)=>thEllipse(c,xx,-121+(i%2)*10,2.6,2.6,'#184b17'));
    const hot=glow||monster;
    if(hot) {
      thGlow(c,16,-78,38+glow*25,'#ff2d19aa');
      const r=monster?13:5+glow*14;
      thPoly(c,[[16-r*1.9,-78],[14,-82],[16,-78-r*1.9],[20,-82],[16+r*1.9,-78],[20,-74],[16,-78+r*1.9],[13,-74]],'#fff3b1');
    } else thPoly(c,[[4,-75],[28,-84],[24,-75],[8,-71]],'#ff452c');
    thPoly(c,[[-34,-84],[-13,-76],[-10,-71],[-28,-74]],'#ff452c');
    thShape(c,p=>{p.moveTo(-27,-62);p.quadraticCurveTo(0,-39,28,-61);p.quadraticCurveTo(4,-38,-27,-62)},'#150a0b','#481f1c',2);
    for(let i=0;i<6;i++){
      const xx=-23+i*8, yy=-57+Math.sin(i*Math.PI/5)*7;
      thPoly(c,[[xx,yy],[xx+6,yy+1],[xx+3,yy+7]],'#e5f3ca');
    }
    c.restore();
  }

  function platform(c,x,y,w,h,red,t) {
    const tile=100;
    c.save();c.translate(x,y);
    thPoly(c,[[0,h],[w,h],[w-18,h+25],[w-70,h+61],[93,h+56],[31,h+29]],red?'#370a12':'#140a2c');
    c.beginPath();c.rect(0,0,w,h);c.clip();
    for(let i=0;i<w;i+=tile)for(let j=0;j<h;j+=tile) {
      const check=((i+j)/tile)%2;
      c.fillStyle=red?(check?'#2f121c':'#281018'):(check?'#231744':'#17142c');
      if(!red&&i>=600&&i<1400&&j>=400&&j<900){
        const hue=(i*.17+j*.13+Math.floor(t*1.7)*24)%360;
        c.fillStyle='hsl('+hue+' 62% '+(check?31:23)+'%)';
      }
      c.fillRect(i,j,tile-1,tile-1);
    }
    if(red) {
      c.strokeStyle='#ff593d44';c.lineWidth=2;
      for(let i=0;i<8;i++){
        const xx=(i*249+115)%w, yy=(i*166+85)%h;
        thPoly(c,[[xx,yy],[xx-26,yy+47],[xx+26,yy+68],[xx-16,yy+109]],null,'#ff513768',2.6);
      }
    }
    c.restore();
    c.save();
    c.strokeStyle=red?'#ff675c':'#8261ed';c.lineWidth=8;
    c.strokeRect(x+2,y+2,w-4,h-4);
    c.restore();
  }

  function backdrop(c,w,h,t,war) {
    const bg=c.createRadialGradient(w*.55,h*.27,20,w*.5,h*.48,Math.max(w,h)*.75);
    bg.addColorStop(0,war?'#122526':'#231343');bg.addColorStop(.54,war?'#0b111a':'#111223');bg.addColorStop(1,'#04060b');
    c.fillStyle=bg;c.fillRect(0,0,w,h);
    for(let i=0;i<72;i++) {
      const xx=((i*137.7+t*(i%2?-6:11))%w+w)%w, yy=(i*91.7+t*(7+i%5*14))%h;
      c.globalAlpha=.17+.2*((i%4)/3);
      text(c,war?(i%2?'1':'0'):'•',xx,yy,i%8+8,war?'#74f29a':'#bfadff','monospace');
    }
    c.globalAlpha=1;
  }

  function sparks(c,x,y,age,reach,color,angle=0,spread=Math.PI*2) {
    if(motionPreference?.matches||age<=0||age>=1)return;
    c.save();
    c.translate(x,y);c.rotate(angle);
    c.strokeStyle=color;c.lineCap='round';
    for(let i=0;i<22;i++){
      const direction=(i/22-.5)*spread;
      const distance=reach*age*(.48+(i*11%19)/19);
      const length=(15+i%5*7)*(1-age);
      const px=Math.cos(direction), py=Math.sin(direction);
      c.globalAlpha=(1-age)*(.45+(i%4)*.15);
      c.lineWidth=2+i%3;
      c.beginPath();c.moveTo(px*distance,py*distance);
      c.lineTo(px*(distance+length),py*(distance+length));c.stroke();
    }
    c.restore();
  }

  function impactRing(c,x,y,age,r,color) {
    if(motionPreference?.matches||age<=0||age>=1)return;
    c.save();c.globalAlpha=(1-age)*.75;c.lineWidth=9*(1-age)+1;
    c.strokeStyle=color;c.beginPath();c.ellipse(x,y,12+r*age,6+r*age*.45,0,0,Math.PI*2);c.stroke();
    c.restore();
  }

  function renderAttack(c,attack,t) {
    if(!attack?.rect||attack.mode==='rest')return;
    const {rect:[x,y,w,h],mode,kind,tick,move}=attack;
    const beam=kind==='beam'||kind==='surge', progress=clamp(tick/(move.warn||1),0,1);
    c.save();
    c.fillStyle=mode==='warn'?'#ff32272d':mode==='trail'?'#37ff4640':beam?'#a5ff8978':'#ff56337a';
    c.fillRect(x,y,w,h);
    c.beginPath();c.rect(x,y,w,h);c.clip();
    c.strokeStyle=mode==='trail'?'#55f76c77':'#ff554769';c.lineWidth=5;
    for(let k=-h;k<w+80;k+=39) {
      c.beginPath();c.moveTo(x+k+t*14%39,y);c.lineTo(x+k+h+t*14%39,y+h);c.stroke();
    }
    if(mode==='hit'&&beam) {
      c.shadowColor='#6bff98';c.shadowBlur=34;c.fillStyle='#ecffe5';
      const wave=(tick-move.warn)/move.hit, wide=w>h;
      const taper=.12+.24*Math.sin(Math.PI*wave);
      for(const [fraction,color] of [[taper*2,'#56ff457c'],[taper,'#acff9b'],[taper*.23,'#efffe2']]){
        c.fillStyle=color;
        if(wide)c.fillRect(x,y+h*(1-fraction)/2,w,h*fraction);
        else c.fillRect(x+w*(1-fraction)/2,y,w*fraction,h);
      }
      sparks(c,x+w/2,y+h/2,wave,w*0.62,'#c5ffad',wide?0:Math.PI/2,Math.PI*1.5);
    }
    if(mode==='hit'&&kind==='domino'){
      c.fillStyle='#b1ff8d';c.strokeStyle='#131d12';c.lineWidth=4;
      const dy=y+(tick-move.warn)*h/move.hit;
      c.fillRect(x+w*.36,dy-80,w*.28,96);
      c.strokeRect(x+w*.36,dy-80,w*.28,96);
      text(c,'• •',x+w*.5,dy-36,21,'#194a1d');
    }
    if(mode==='hit'&&(kind==='sword'||kind==='hand')){
      const age=(tick-move.warn)/move.hit;
      const cx=x+w/2, cy=kind==='sword'?y+h*.46:y+h*.32;
      impactRing(c,cx,cy,age,w*.64,kind==='sword'?'#ceff7b':'#ffb760');
      sparks(c,cx,cy,age,w*.9,kind==='sword'?'#a9ff52':'#ffd291',Math.PI/2,Math.PI*1.6);
    }
    if(mode==='trail'){
      const fade=1-(tick-move.warn-move.hit)/move.trail;
      c.globalAlpha=fade;
      thPoly(c,[[x+w*.24,y],[x+w*.65,y+h*.28],[x+w*.42,y+h*.51],[x+w*.71,y+h*.72],[x+w*.55,y+h]],
        null,'#a5ff72',9);
      for(let i=0;i<12;i++)
        text(c,i%2?'0':'1',x+w*(.29+(i*13%9)/19),y+(i*81+(1-fade)*330)%h,18,'#acffab','monospace');
      c.globalAlpha=1;
    }
    if(mode==='warn'){
      c.fillStyle='#ff6953';c.fillRect(x,y,Math.min(w,w*progress),8);
      text(c,'!',x+w*.5,y+Math.min(130,h*.63),50,'#ffdfc6');
    }
    c.restore();
    c.strokeStyle=mode==='trail'?'#55ff54':'#ff604c';c.lineWidth=4;
    c.strokeRect(x,y,w,h);
  }

  function draw(canvas,t,now,match,state,attack) {
    const c=canvas.getContext('2d'), view=arView(canvas), W=view.width,H=view.height;
    c.setTransform(view.ratio,0,0,view.ratio,0,0);
    const scene=dialogues[state.stage];
    backdrop(c,W,H,t,state.stage!=='warmup'&&state.stage!=='intro');
    if(scene){cinematic(c,W,H,match,state,now);return}
    const m=AR.me, warm=state.stage==='warmup';
    const zoom=Math.min(view.zoom,Math.max(.49,W/700));
    const focusX=clamp(m.x,W/(2*zoom),Math.max(W/(2*zoom),AW-W/(2*zoom)));
    const focusY=clamp(m.y,H/(2*zoom),Math.max(H/(2*zoom),AH-H/(2*zoom)));
    c.save();
    c.translate(W/2+Math.sin(t*47)*match.shake*10,H/2+Math.cos(t*58)*match.shake*8);
    c.scale(zoom,zoom);c.translate(-focusX,-focusY);
    platform(c,state.split?EDGE:0,0,state.split?AW-EDGE:AW,AH,state.split,t);
    if(warm)apDJ(c,t);
    renderAttack(c,attack,t);
    if(state.stage==='fight'){
      const down=attack?.down, warning=attack?.mode==='warn';
      const pose=down?'down':attack?.kind==='hand'?(warning?'hand':attack.mode==='hit'?'impact':''):
        attack?.kind==='sword'?'sword':attack?.kind==='domino'&&attack.mode!=='rest'?'domino':'';
      const bx=down?hitbox.x:attack?.kind==='domino'&&attack.mode!=='rest'?1515:1505;
      const by=down?hitbox.y:attack?.kind==='domino'&&attack.mode!=='rest'?139:69;
      if(down){
        thGlow(c,bx,by,hitbox.r*1.3,'#a2ff4f78');
        c.strokeStyle='#d8ff78';c.lineWidth=5;c.setLineDash([14,10]);
        c.beginPath();c.arc(bx,by,hitbox.r,0,Math.PI*2);c.stroke();c.setLineDash([]);
      }
      const charging=warning&&(attack.kind==='beam'||attack.kind==='surge');
      model(c,bx,by,down?1.52:1.89,t,{phase:state.phase,pose,glow:charging?.65+attack.tick*.19:0});
      if(down)text(c,'БЕЙ ДУБИНКОЙ!',bx,by+hitbox.r+32,25,'#e7ff92');
    } else if(state.stage==='done')apDrawCrown(c,1505,350,.95);
    const players=Object.values(AR.oth).map(p=>({p,n:p.n,a:p.a,cs:p.cs,me:false}));
    players.push({p:m,n:M.fb?.nick||'Ты',a:M.fb?.fav||'verity',cs:typeof csStr==='function'?csStr():'',me:true});
    players.sort((a,b)=>a.p.y-b.p.y);
    for(const {p,n,a,cs,me} of players) {
      if(state.split&&p.x<EDGE)continue;
      c.globalAlpha=me&&match.hp===0?.40:1;
      arAvatar(c,p.x,p.y,a,n,cs,me,0,p.sw||0,p.stun>0||p.st,p.face||p.f||1,t,p.cr||me&&apWearCrown(),p.aim);
      c.globalAlpha=1;
    }
    for(const fx of AR.fx) {
      c.globalAlpha=1-fx.t/.85;
      text(c,fx.label,fx.x,fx.y-fx.t*46,28,'#fff097');
    }
    c.globalAlpha=1;c.restore();
  }

  function sceneFloor(c,t,split=0,drop=0) {
    c.save();c.translate(0,drop);
    thPoly(c,[[109,361],[471,328],[495-split*35,469+split*24],[51-split*144,487+split*194]],
      thGradient(c,108,327,402,490,['#6b2935','#3d1824','#230e18']),'#ed595c',3);
    thPoly(c,[[472+split*38,328],[800,360],[920,475],[500+split*9,469]],
      thGradient(c,530,328,780,490,['#602536','#3f1520','#200c18']),'#f36165',3);
    if(split)thPoly(c,[[495,465],[477,420],[493,383],[476,349]],null,'#ff6234',4);
    for(let i=0;i<7;i++){
      const x=111+i*107;
      if(split&&x<495)continue;
      thPoly(c,[[x+23,365],[x,436],[x-29,477]],null,'#c653505a',2);
    }
    thPoly(c,[[94,410],[467,382],[852,410]],null,'#a23e4a8a',2);
    thPoly(c,[[72,449],[486,420],[900,444]],null,'#a23e4a8a',2);
    c.restore();
  }

  function guard(c,x,y,r,nick,t,active=false){
    thGlow(c,x,y,r*2.3,active?'#ffdb524c':'#fc9b301d');
    thSoftBody(c,x,y,r,r,'#fff896','#ffd649','#a96b17');
    thEllipse(c,x-r*.27,y-r*.16,r*.09,r*.15,'#331a19');
    thEllipse(c,x+r*.31,y-r*.16,r*.09,r*.15,'#331a19');
    thShape(c,p=>{p.moveTo(x-r*.28,y+r*.18);p.quadraticCurveTo(x,y+r*.52,x+r*.30,y+r*.18)},null,'#331a19',2);
    if(active&&nick)text(c,nick,x,y-r-11,15,'#ffe584');
  }

  function presentPlayers(match) {
    const self=match.test?'me':ON.uid;
    const people=[{uid:self,n:M.fb?.nick||'Ты',a:M.fb?.fav||'verity'}];
    for(const [uid,player] of Object.entries(AR.oth)) {
      if(uid!==self&&uid!=='practice')people.push({uid,n:player.n||'Хранитель',a:player.a||'verity'});
    }
    for(const player of people)match.portraits.set(player.uid,player.a);
    return people.sort((a,b)=>String(a.uid).localeCompare(String(b.uid)));
  }

  function victoryCast(match,players) {
    const winners=fighters(match);
    if(!winners.length)return players;
    const lead=(match.config.seed||0)%winners.length;
    const ordered=winners.slice(lead).concat(winners.slice(0,lead));
    const cast=ordered.map(([uid,n])=>players.find(p=>p.uid===uid)||
      {uid,n,a:match.portraits.get(uid)||'verity'});
    return cast.concat(players.filter(p=>!winners.some(([uid])=>uid===p.uid)));
  }

  function renderCast(c,players,left,right,y,t,lead=0,columns=4) {
    const bob=motionPreference?.matches?0:1;
    const perRow=Math.min(columns,players.length), step=(right-left)/Math.max(1,perRow-1);
    const count=players.length;
    if(!count)return;
    for(let i=0;i<count;i++){
      const player=players[i], row=Math.floor(i/perRow), col=i%perRow;
      const rowSize=Math.min(perRow,count-row*perRow);
      const x=(left+right-(rowSize-1)*step)/2+col*step+(i===0?lead:0);
      const yy=y-row*60, radius=20, cy=yy+Math.sin(t*3.4+i)*3*bob;
      const selected=lead>0&&i===0;
      const sprite=IM[player.a+'1']||IM.verity1;
      thEllipse(c,x,yy+radius,23,7,'#09090f9e');
      thGlow(c,x,cy,radius*2,selected?'#efff9480':'#a9c8ff36');
      if(sprite?.complete&&sprite.naturalWidth) {
        c.save();c.beginPath();c.arc(x,cy,radius,0,Math.PI*2);c.clip();
        c.drawImage(sprite,x-radius,cy-radius,radius*2,radius*2);c.restore();
        c.strokeStyle=selected?'#f5ffb8':'#d5e4ff';c.lineWidth=2;
        c.beginPath();c.arc(x,cy,radius,0,Math.PI*2);c.stroke();
      } else guard(c,x,cy,radius,'',t);
      c.font='800 23px system-ui';
      const characters=Array.from(String(player.n));
      const nick=characters.length>19?characters.slice(0,18).join('')+'…':characters.join('');
      const maxText=Math.min(156,step-12);
      const width=Math.min(maxText,c.measureText(nick).width)+14, labelY=cy-radius-31;
      c.fillStyle=selected?'#40532a':'#0a1120ee';c.fillRect(x-width/2,labelY,width,26);
      c.fillStyle='#f7fbff';c.textAlign='center';c.fillText(nick,x,labelY+21,maxText);
    }
  }

  function sceneLight(c,x,y,t,intensity,color) {
    c.save();
    c.globalAlpha=intensity;
    const spread=motionPreference?.matches?0:22*Math.sin(t*1.15);
    thPoly(c,[[x-12,0],[x+12,0],[x+190+spread,y],[x-185+spread,y]],
      thGradient(c,x,0,x,y,['#ffffff00',color,'#ffffff00']));
    thEllipse(c,x+spread,y,140,19,color);
    c.restore();
  }

  function cinematic(c,w,h,match,state,now) {
    const t=Math.max(0,elapsed(now,state.at)), scale=Math.min(w/950,h/525);
    const players=presentPlayers(match);
    c.save();c.translate((w-950*scale)/2,(h-525*scale)/2-25);c.scale(scale,scale);
    if(state.stage==='intro'){
      const jump=clamp((t-.55)/1.55,0,1), lift=1-(1-jump)**3;
      const land=ease((t-8.3)/1.15), settle=ease((t-1.55)/.75);
      const y=515-305*lift+22*settle+56*land;
      const impact=clamp((t-9.15)/1.1,0,1), shake=motionPreference?.matches?0:Math.sin(impact*Math.PI)*5;
      c.save();c.translate(Math.sin(t*35)*shake,Math.cos(t*41)*shake);
      sceneLight(c,475,394,t,.62,'#f6ba634d');
      thGlow(c,475,250,190,'#fba65748');
      sceneFloor(c,t);
      const leap=clamp((t-.54)/1.3,0,1);
      impactRing(c,475,396,leap,199,'#ffe08c');
      sparks(c,475,410,leap,210,'#ffd29c',-Math.PI/2,Math.PI*1.2);
      c.save();
      c.beginPath();c.rect(0,0,950,450);c.clip();
      const wave=t>1.65&&t<7.9?Math.sin(t*10):0;
      const handX=545+wave*13, handY=y-47-wave*5;
      thPoly(c,[[510,y+17],[534,y-8],[handX,handY]],null,'#aa5736',10);
      thEllipse(c,handX,handY,10,10,'#ffdb94');
      apAdminity(c,475,y,74,t,0,false,false);
      c.restore();
      impactRing(c,475,405,impact,174,'#ffcf91');
      sparks(c,475,405,impact,145,'#ffcf91',-Math.PI/2,Math.PI*1.4);
      renderCast(c,players,185,765,432,t,0,5);
      c.restore();
    } else if(state.stage==='invasion'){
      const open=ease((t-6.9)/3.2), split=ease((t-11.2)/3.1), fall=ease((t-12.8)/3.3);
      const emerge=ease((t-10)/5.2), tremor=open*(1-split*.8);
      if(!motionPreference?.matches)c.translate(Math.sin(t*38)*tremor*6,Math.cos(t*41)*tremor*4);
      if(open){
        sceneLight(c,648,407,t,open*.8,'#77ff7844');
        apPortal(c,648,209,149*open,171*open,t,AP_PORTALS.green||AP_PORTALS.red);
        for(let i=0;i<18&&!motionPreference?.matches;i++){
          const a=i/18*6.28+t*.95, r=(163+12*Math.sin(i+t*2))*open;
          text(c,i%2?'0':'1',648+Math.cos(a)*r,209+Math.sin(a)*r,12+i%3*3,'#aaff897d','monospace');
        }
      }
      if(emerge) {
        c.save();c.globalAlpha=emerge;
        model(c,648,185+54*emerge,1.75,t,{pose:t>18.5?'draw':t>15.7?'':'rise',glow:.25*open});
        c.restore();
      }
      sceneFloor(c,t,split);
      const rupture=clamp((t-11.2)/2.15,0,1);
      sparks(c,484,401,rupture,227,'#ffc573',-Math.PI/2,Math.PI*1.25);
      impactRing(c,491,412,rupture,235,'#ff7a61');
      if(rupture>0&&rupture<1&&!motionPreference?.matches) {
        c.save();c.globalAlpha=1-rupture;
        for(let i=0;i<10;i++){
          c.save();
          c.translate(491+(i-4.5)*27*rupture,415-Math.sin(rupture*Math.PI)*(34+i%4*27));
          c.rotate(rupture*(i%2?4:-4));
          thPoly(c,[[-11,-4],[4,-12],[14,3],[0,9]],'#793142','#ff8272',2);
          c.restore();
        }
        c.restore();
      }
      if(t>15.7&&t<18.5){
        for(const xx of [545,755]){
          thPoly(c,[[xx-32,349],[xx-16,330],[xx+29,339],[xx+43,365],[xx+10,377],[xx-29,370]],
            '#152a11','#66cf36',3);
          thPoly(c,[[xx-18,366],[xx-13,357],[xx-3,353],[xx+12,354],[xx+20,364]],null,'#488b26',3);
        }
      }
      renderCast(c,players,520,860,452,t,0,3);
      if(fall<1){
        const shove=ease((t-7.2)/1.4);
        apAdminity(c,352-205*shove-132*fall,280-68*shove+340*fall,58,t,.8,true,false);
        if(t<7){
          thPoly(c,[[345,269],[361,265]],null,'#6d331e',3);
          thPoly(c,[[367,265],[380,273]],null,'#6d331e',3);
        }
      }
      impactRing(c,648,388,clamp((t-24)/1.05,0,1),330,'#b5ffc1');
    } else if(state.stage==='transform'){
      sceneFloor(c,t,1);
      sceneLight(c,494,398,t,.65,'#77ff6650');
      thGlow(c,493,215,185+50*Math.sin(t*4),'#53fd284f');
      const change=ease(t/4.8), surge=clamp((t-2.35)/1.3,0,1);
      impactRing(c,493,352,surge,268,'#77ff4a');
      sparks(c,493,212,surge,281,'#a6ff6b');
      for(let i=0;i<17;i++){
        const a=i/17*6.28+t*.8,r=214-90*change;
        text(c,i%2?'0':'1',494+Math.cos(a)*r,233+Math.sin(a)*r*.73,19,'#9fef6a','monospace');
      }
      c.save();
      if(!motionPreference?.matches)c.translate(Math.sin(t*32)*2,Math.sin(t*29)*2);
      model(c,496,236,1.28+change*.45,t,{phase:t>2.4?2:1,pose:'rise',glow:change});
      c.restore();
      renderCast(c,players,530,840,453,t,0,3);
    } else if(state.stage==='ending'){
      const cast=victoryCast(match,players);
      const fall=ease((t-4.4)/2.8), zoom=ease((t-6.4)/1.9)*(1-ease((t-10.4)/1.5));
      c.translate(-230*zoom,-175*zoom);c.scale(1+zoom*.40,1+zoom*.40);
      sceneFloor(c,t,1);
      if(fall<1){c.globalAlpha=1-fall;model(c,679-87*fall,213+390*fall,1.7,t,{phase:2,pose:fall>.06?'fall':''});c.globalAlpha=1}
      if(t>6.1&&t<18.2){
        const drop=ease((t-6.1)/1.2), glow=52+Math.sin(t*4)*12;
        thGlow(c,659,241+138*drop,glow,'#90fc405d');apDrawCrown(c,659,241+138*drop,.9);
        const landing=clamp((t-7.15)/1.2,0,1);
        impactRing(c,659,389,landing,96,'#ddff84');
        sparks(c,659,379,landing,105,'#edff98',-Math.PI/2,Math.PI*1.4);
      }
      renderCast(c,cast,540,840,451,t,Math.min(cast.length>1?38:0,ease((t-8.6)/2)*38),3);
      if(t>10.6){
        const inPortal=ease((t-10.6)/1.2);
        apPortal(c,800,283,64*inPortal,82*inPortal,t,AP_PORTALS.green||AP_PORTALS.red);
        apAdminity(c,802-56*inPortal,287-39*inPortal,54,t,0,false,true);
      }
      if(t>17){
        const magic=ease((t-17)/2);
        thGlow(c,660,373-40*magic,102*magic,'#c6ff6480');
        if(t>18.15){
          guard(c,660,373-44*magic,29,UNIT,t,true);
          apDrawCrown(c,660,300,.62);
          text(c,UNIT,660,433,24,'#d3ff99','monospace');
        }
      }
    } else if(state.stage==='prison'){
      prison(c,t);
    }
    c.restore();
  }

  function prison(c,t) {
    const advance=ease(t/3.8), reveal=ease((t-6.2)/2.8);
    c.fillStyle='#060b11';c.fillRect(0,0,950,525);
    thPoly(c,[[65,525],[428,208],[520,208],[883,525]],'#161c24','#41454e',4);
    thPoly(c,[[0,12],[427,204],[432,214],[0,514]],'#111b23','#263442',4);
    thPoly(c,[[950,12],[521,204],[516,214],[950,514]],'#171d29','#373d55',4);
    for(let i=0;i<5;i++){
      const d=(i/5+advance*.63)%1, width=28+d*142,height=48+d*226;
      for(const s of [-1,1]){
        const x=475+s*(52+d*356), y=220+32*d-height*.36;
        c.fillStyle='#050809';c.fillRect(x-width/2,y,width,height);
        thGlow(c,x,y+height*.40,width,(s<0?'#b8ff42':'#ff5c64')+'45');
        for(let j=0;j<6;j++)c.fillStyle='#324453',c.fillRect(x-width/2+j*width/5,y,2+d*4,height);
        if(reveal&&d>.32){
          thEllipse(c,x-width*.15,y+height*.37,3+d*5,4,s<0?'#d6ff82':'#ff5c69');
          thEllipse(c,x+width*.15,y+height*.37,3+d*5,4,s<0?'#d6ff82':'#ff5c69');
        }
      }
    }
    if(t>2.8&&t<7.6) {
      c.save();c.globalAlpha=ease((t-2.8)/.7)*(1-ease((t-6.75)/.85));
      c.fillStyle='#0b111a';c.fillRect(297,62,352,390);c.strokeStyle='#587383';c.lineWidth=7;c.strokeRect(297,62,352,390);
      thGlow(c,474,269,150,'#aaff3a33');
      thPoly(c,[[367,342],[579,342],[563,365],[371,361]],'#414b46','#272e2b',4);
      model(c,476,267,.68,t,{pose:'',glow:.14});
      for(let x=308;x<=639;x+=39){c.fillStyle='#32434b';c.fillRect(x,66,9,380)}
      c.restore();
    }
    if(t>8.5){
      c.save();c.globalAlpha=ease((t-8.5)/.9);
      c.fillStyle='#04060cb9';c.fillRect(0,0,950,525);
      text(c,'БОССЫ ИДУТ…',475,252,62,'#fd525d','monospace');
      text(c,'Следующее обновление',475,304,28,'#f5eff5');
      c.restore();
    }
  }

  function roster(match) {
    const self=String(M.fb?.nick||'Ты');
    const peers=Object.values(AR.oth).map(player=>String(player.n||'Хранитель'))
      .sort((a,b)=>a.localeCompare(b,'ru'));
    const names=[self,...peers];
    const markup=names.map((nick,i)=>'<li title="'+esc(nick)+'"><span>'+esc(nick)+'</span>'+
      (i===0?'<small>Ты</small>':'')+'</li>').join('');
    if(match.rosterMarkup!==markup) {
      $('vr-roster-count').textContent='Игроки · '+names.length;
      $('vr-roster-list').innerHTML=markup;
      match.rosterMarkup=markup;
    }
    return names.length;
  }

  function hud(match,state,attack,now) {
    const scene=dialogues[state.stage], phaseTime=elapsed(now,state.at);
    const dealtFirst=Math.min(Math.ceil(match.config.hp/2),match.p1.reduce((sum,hit)=>sum+hit.v,0));
    const damaged=dealtFirst+match.p2.reduce((sum,hit)=>sum+hit.v,0);
    const left=state.phase===1?Math.max(Math.floor(match.config.hp/2),match.config.hp-damaged):Math.max(0,match.config.hp-damaged);
    const players=roster(match);
    let markup='';
    if(state.stage==='waiting') {
      markup='<div class="vr-hud-panel"><strong>Боссфайт '+BOSS+'</strong><span>Вступление через '+apClock(state.at-now)+'</span></div>';
    } else if(state.stage==='warmup') {
      markup='<div class="vr-hud-panel"><small>♫ DJ АДМИНИТИ · '+players+' на арене</small><strong>Вечеринка · '+apClock(state.until-now)+'</strong>'+
        (match.config.contest?'<span>Турнир дубинок · 500 монет и 10 гемов</span>'+
          '<span>'+leaders(match).slice(0,3).map((row,i)=>(i+1)+'. '+esc(row.n)+' · '+row.v).join('　')+'</span>':'')+'</div>';
    } else if(state.stage==='fight'||state.stage==='transform'){
      const status=attack?.down?'Бей дубинкой, пока босс на арене!':attack?.mode==='warn'?attack.move.name+' · уйди из красной зоны':
        attack?.mode==='trail'?'Хакерский след · не наступай':attack?.mode==='hit'?attack.move.name:'Уклоняйся, пока босс не упадёт';
      markup='<div class="vr-hud-panel vr-boss"><small>ФАЗА '+(state.phase===1?'I':'II')+' · '+players+' на арене</small><strong>'+BOSS+'</strong>'+
        '<div class="vr-meter" role="meter" aria-label="Здоровье босса" aria-valuenow="'+left+'" aria-valuemin="0" aria-valuemax="'+match.config.hp+
        '"><i style="width:'+(left/match.config.hp*100)+'%"></i></div><span>'+left+' / '+match.config.hp+' HP</span>'+
        (state.until&&match.config.fightMinutes?'<span class="vr-clock">Осталось '+apClock(state.until-now)+'</span>':'')+
        (!scene?'<span class="vr-status">'+status+'</span><span class="vr-health">'+('♥'.repeat(Math.max(0,match.hp)))+
          ('♡'.repeat(3-Math.max(0,match.hp)))+(match.hp?'':' · Возвращение через '+apClock(match.downUntil-now))+'</span>':'')+'</div>';
    } else if(state.stage==='checking') {
      markup='<div class="vr-hud-panel"><strong>Время вышло</strong><span>Считаем последние удары…</span></div>';
    } else if(state.stage==='expired') {
      markup='<div class="vr-hud-panel"><strong>Время вышло</strong><span>1x1x1x1 остался на арене.</span></div>';
    } else if(state.stage==='done') {
      markup='<div class="vr-hud-panel"><strong>Босс повержен</strong><span>Боссы идут… · Следующее обновление</span></div>';
    }
    if(scene){
      const line=[...scene].reverse().find(item=>item[0]<=phaseTime);
      if(line&&(state.stage!=='prison'||phaseTime<8.4)){
        let speaker=line[1];
        const people=state.stage==='ending'&&speaker==='Хранитель'?fighters(match):[];
        if(people.length)speaker=people[(match.config.seed||0)%people.length][1];
        markup+='<div class="vr-dialogue"><small>'+esc(speaker)+'</small><div>'+esc(line[2])+'</div></div>';
      }
    }
    if(match.test)markup+='<span class="vr-preview">ТЕСТ</span>';
    if(!scene)markup+=AR.toasts.map(item=>'<div class="vr-toast">'+esc(item.s)+'</div>').join('');
    const container=$('arhud');
    if(container.innerHTML!==markup&&match.hud!==markup){container.innerHTML=markup;match.hud=markup}
    $('arn').classList.toggle('vr-cinematic',!!scene);
    $('vr-roster').hidden=!!scene;
    $('arsw').classList.toggle('cd',AR.me.cd>0||AR.me.stun>0||!match.hp);
  }

  function music() {
    if(!sound)return null;
    const stage=stateAt(current(),Date.now()).stage;
    return stage==='warmup'||stage==='intro'||stage==='waiting'?AP_MUSIC:
      ['done','checking','expired'].includes(stage)?null:battleMusic;
  }

  function renderAdmin(message='') {
    if(!ADM)return;
    const live=isOpen();
    const controls='<div class="vr-admin"><h3>🟢 Боссфайт '+BOSS+'</h3>'+
      '<p>Запуск откроет вход всем игрокам. После вступления DJ играет 5 минут. После сцены вторжения у игроков будет 10 минут на победу.</p>'+
      '<div class="ap-line"><label>HP босса <input type="number" min="200" max="6000" step="1" id="vr-hp" value="1344"'+(live?' disabled':'')+'></label>'+
      '<label><input type="checkbox" id="vr-contest" checked'+(live?' disabled':'')+'> Турнир дубинок</label></div>'+
      '<div class="vr-admin-grid">'+button('start','Запустить для всех',busy||live)+button('enter','Войти на общую арену',!live)+
      button('stop','Закрыть общую арену',busy||!live)+'</div><hr>'+
      '<h3>Тест на этом устройстве</h3><p>Полный тест идёт по тому же таймеру. Кнопки ниже сразу открывают отдельные сцены и атаки.</p>'+
      '<div class="vr-admin-grid">'+[['intro','Полный тест с открытия'],['warmup','DJ и турнир'],['invasion','Портал и раскол'],['phase1','Фаза I'],['transform','Превращение'],['phase2','Фаза II'],
        ['hand','Удар рукой'],['beam','Лазер'],['sword','Меч и след'],['domino','Домино ×6'],['surge','Усиленный луч'],
        ['down','Падение босса'],['ending','Корона и награда'],['prison','Тюрьма боссов']].map(([id,label])=>button('test-'+id,label)).join('')+
      '</div><p id="vr-admin-status" role="status">'+esc(message)+'</p></div>';
    mOpen('🛠 Админ-панель',apTabs()+controls,[['Закрыть',mClose]]);
  }

  async function command(kind) {
    if(!ADM||busy)return;
    const hp=clamp(Math.round(Number($('vr-hp')?.value)||1344),200,6000);
    const contest=!!$('vr-contest')?.checked;
    if(!onOk()){ $('vr-admin-status').textContent='Нет подключения к игре.';return }
    if(kind==='stop'&&!confirm('Закрыть арену для всех игроков?'))return;
    busy=true;refresh();
    const status=$('vr-admin-status');
    status.textContent=kind==='start'?'Открываю арену…':'Закрываю арену…';
    let message;
    try {
      await onAuth();
      const check=await db(ROOT,{etag:true});
      if(!check.ok)throw Error('Сервер арены ответил '+check.st+'.');
      if(!check.etag)throw Error('Сервер не вернул версию настроек арены.');
      await readConfig({[EVENT]:check.j});
      if(kind==='start'&&isOpen())throw Error('Общая арена уже открыта.');
      if(kind==='stop'&&!isOpen())throw Error('Общая арена уже закрыта.');
      const at=kind==='start'?Date.now()+15000:Date.now(), id=kind==='start'?TIMED_ID+at:active.id;
      const row={event:EVENT,kind,id,at,...(kind==='start'?{hp,contest,fightMinutes:FIGHT_MINUTES,seed:crypto.getRandomValues(new Uint32Array(1))[0]}:{})};
      const proof=await apSign(row);
      const body={...(check.j||{})};
      body[id]={...body[id],[kind]:proof};
      const result=await db(ROOT,{m:'PUT',b:body,ifMatch:check.etag});
      if(result.st===412)throw Error('Арена уже обновилась. Открой пульт снова.');
      if(result.st===401||result.st===403)throw Error('Firebase не разрешил изменить настройки арены для этого аккаунта.');
      if(!result.ok)throw Error('Сервер не принял команду ('+result.st+').');
      if(kind==='start'){active={...row,stop:0};runs.set(id,active)}
      else {active={...active,stop:at};runs.set(id,active)}
      message=kind==='start'?'Вход открыт. Вступление через 15 секунд.':'Арена закрыта.';
    }catch(error){message=error.message||'Нет связи с сервером.'}
    finally{busy=false;refresh();if(adminTab&&title())renderAdmin(message)}
  }

  function trial(stage) {
    if(!ADM)return;
    mClose();
    if(cur==='arn')arExit();
    arEnter({raidTest:true,stage});
  }

  function refresh() {
    const open=isOpen(), waiting=open&&Date.now()<active.at;
    const enter=$('vr-menu'), lobby=$('arb');
    enter.classList.toggle('hide',!open);
    if(open){
      const timer=waiting?' · старт через '+apClock(active.at-Date.now()):'';
      const markup='<strong>Войти на арену · '+BOSS+'</strong><small>ОБЩИЙ БОССФАЙТ'+timer+'</small>';
      if(enter.innerHTML!==markup)enter.innerHTML=markup;
      lobby.classList.remove('hide');lobby.textContent='🟢 Войти на арену';
    }
    const inRaid=cur==='arn'&&!!current();
    $('vr-tools').classList.toggle('hide',!inRaid);
    $('vr-open-admin').classList.toggle('hide',!ADM);
    const start=$('mc').querySelector('[data-vr="start"]');
    if(start&&title()){
      start.disabled=busy||open;
      $('mc').querySelector('[data-vr="stop"]').disabled=busy||!open;
      $('mc').querySelector('[data-vr="enter"]').disabled=!open;
      $('vr-hp').disabled=open||busy;
      $('vr-contest').disabled=open||busy;
    }
    if(!inRaid)$('arn').classList.remove('vr-cinematic');
  }

  function registerUnit() {
    TY[UNIT_KEY]={n:UNIT,cost:610,dmg:87,rate:1.05,rng:150,col:'#9bef42',
      d:'Награда за победу над 1x1x1x1. Светящийся осколок короны стреляет по Шумам.'};
    RA[UNIT_KEY]='Event';
    if(typeof MKNS!=='undefined')MKNS[UNIT_KEY]='награда за боссфайт';
    for(const phase of [1,2]){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
      const c=canvas.getContext('2d');
      thGlow(c,64,65,57,phase===2?'#62ff739d':'#e0ff698a');
      guard(c,64,76,36,'',0);
      apDrawCrown(c,64,39,1.10);
      IMG[UNIT_KEY+phase]=canvas.toDataURL();
      const img=new Image();img.src=IMG[UNIT_KEY+phase];IM[UNIT_KEY+phase]=img;
    }
  }

  window.VerityRaid={isOpen,readConfig,join,spawn,sync,frame,swing,blocked,music,battleMusic};
  $('vr-menu').onclick=()=>arEnter({raid:true});
  $('arn').insertAdjacentHTML('beforeend','<div id="vr-tools" class="hide"><details id="vr-roster"><summary id="vr-roster-count">Игроки</summary><ul id="vr-roster-list" aria-label="Игроки на арене"></ul></details><button type="button" id="vr-sound" aria-pressed="true">♫ Музыка</button><button type="button" id="vr-open-admin" class="hide">🛠 Боссфайт</button></div>');
  $('vr-sound').onclick=function(){sound=!sound;this.setAttribute('aria-pressed',sound);lmTick()};
  $('vr-open-admin').onclick=()=>{adminTab=true;admOpen()};
  const originalTabs=apTabs, originalPanel=admPanel, originalRefresh=apRefreshArena, originalScreen=scr;
  apTabs=function(){
    return originalTabs().replace('</div>',button('tab','🟢 Боссфайт')+'</div>').replace(
      'data-vr="tab"','data-vr="tab" aria-pressed="'+adminTab+'"').replace(
      /data-ap-tab="(main|party)" aria-pressed="true"/g, (s)=>adminTab?s.replace('true','false'):s);
  };
  admPanel=function(tab){
    if(tab==='main')adminTab=false;
    return adminTab&&ADM?renderAdmin():originalPanel.apply(this,arguments);
  };
  apRefreshArena=function(){originalRefresh.apply(this,arguments);refresh()};
  scr=function(){const result=originalScreen.apply(this,arguments);refresh();return result};
  $('mc').addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button||!title()||!ADM)return;
    if(button.dataset.apTab){adminTab=false;AP.tab=button.dataset.apTab;admPanel();return}
    const key=button.dataset.vr;
    if(key==='tab'){adminTab=true;admPanel()}
    if(key==='start'||key==='stop')command(key);
    if(key==='enter'){
      mClose();
      if(cur==='arn'&&AR.raid?.test)arExit();
      if(cur!=='arn')arEnter({raid:true});
    }
    if(key?.startsWith('test-'))trial(key.slice(5));
  },true);
  registerUnit();
  refresh();
})();
