/* The giant attacks the same meadow and towers as the regular Time Machine defense. */
(() => {
  'use strict';

  const key = 'time_rift_giant';
  const name = '1×1×1×1';
  const limit = 300;
  const phaseOpens = 75, phaseDeadline = 105, finalCharge = 252;
  const baseHealth = 15400;
  const path = [[-1,7],[3,7],[3,9],[7,9],[7,5],[11,5],[11,8],[16,8]];
  const top = 200;
  const arc = 2 * Math.PI;
  const baseColor = '#b2ee69';
  const furyColor = '#ffb46c';
  const beamColor = '#b9ed8a';
  const entryHealth = {time_shift:96,time_skip:76,time_guard:225,time_lock:132,time_mend:151};
  const groups = [
    ['time_shift','time_skip','time_shift','time_guard'],
    ['time_lock','time_guard','time_mend','time_skip','time_shift'],
    ['time_guard','time_skip','time_lock','time_mend','time_guard','time_shift']
  ];
  let board;

  ET[key] = {n:name, c:'#6bc55a', r:24, hp:baseHealth, v:0};

  function allowCell(cx, cy) {
    return Number.isInteger(cx) && Number.isInteger(cy) && cx >= 0 && cx < 16 && cy >= 5 && cy < 10;
  }

  function positionTowers(battle) {
    const occupied = new Set();
    const displaced = [];
    for (const tower of battle.units) {
      const code = tower.cx + ',' + tower.cy;
      if (allowCell(tower.cx,tower.cy) && !road[code] && !occupied.has(code)) occupied.add(code);
      else displaced.push(tower);
    }
    const cells = [];
    for (let cy=5; cy<10; cy++) for (let cx=0; cx<16; cx++) {
      const code = cx + ',' + cy;
      if (!road[code] && !occupied.has(code)) cells.push({cx,cy});
    }
    for (const tower of displaced) {
      if (!cells.length) {
        const wallet = tower.og && battle.coop?.g ? 'gc' : 'coins';
        battle[wallet] += Math.floor(TY[tower.k].cost * .7);
        battle.units.splice(battle.units.indexOf(tower),1);
        if (battle.selU === tower) battle.selU = null;
        continue;
      }
      cells.sort((a,b) =>
        Math.hypot(a.cx-tower.cx,a.cy-tower.cy) - Math.hypot(b.cx-tower.cx,b.cy-tower.cy));
      const {cx,cy} = cells.shift();
      tower.cx = cx;
      tower.cy = cy;
      tower.x = (cx + .5) * C;
      tower.y = (cy + .5) * C;
      tower.pastLock = tower.pastWard = 0;
    }
  }

  function prepare(battle) {
    const state = {
      time:0, phase:0, status:'ready', attackAt:9, spawnAt:18, wave:0,
      reinforcement:[], warning:null, burst:0
    };
    setMap('meadow',path);
    battle.past.rift = state;
    battle.past.frozen = 0;
    battle.past.cooldown = 0;
    battle.run = false;
    battle.next = 0;
    battle.q = 0;
    battle.en.length = 0;
    battle.shots.length = 0;
    if (!battle.guest) {
      positionTowers(battle);
      battle.coins += 440;
      if (battle.coop?.g) battle.gc += 440;
    }
    return state;
  }

  function start(battle) {
    const state = battle.past.rift || prepare(battle);
    if (state.status !== 'ready' || battle.guest) return;
    const health = baseHealth + (battle.coop?.g ? 3800 : 0);
    state.status = 'battle';
    state.phase = 1;
    state.boss = {...mk(key,610), hp:health, max:health, boss:true, v:0};
    battle.en.push(state.boss);
    battle.run = true;
    battle.boss = true;
    say('Целься в светящийся узел на дорожке. Гигант отмечает башни перед ударом!');
    cue(96,.46,54);
  }

  function cue(hz, length, end) {
    window.PastMachineBattle?.cue(hz,length,end);
  }

  function damage(enemy, amount, tower) {
    if (enemy.ty !== key) return amount;
    const state = G.past?.rift;
    if (!state) return amount;
    let cap = 680;
    if (tower?.k==='demonity') cap = TY.demonity.dmg * (G.p2||tower.inf>0?6.4:2.6);
    if (tower?.k==='vamp') cap = TY.vamp.dmg * (G.p2||tower.inf>0?3.4:1.15);
    const floor = state.phase===1?Math.ceil(enemy.max*.53):
      state.time<finalCharge?Math.ceil(enemy.max*.13):0;
    return Math.max(0,Math.min(amount,cap,enemy.hp-floor));
  }

  function addReinforcement(state) {
    const type = state.reinforcement.shift();
    const template = ET[type];
    const health = entryHealth[type] + state.wave * 7;
    G.en.push({...mk(type,0), hp:health, max:health, v:template.v, boss:false,
      radius:template.r, chrono:true, skill:type==='time_lock'?7:0});
  }

  function tickReinforcement(state) {
    if (state.time < state.spawnAt) return;
    if (!state.reinforcement.length) {
      state.wave++;
      const source = groups[Math.min(2,state.phase + (state.wave>4 ? 0 : -1))];
      state.reinforcement = [...source];
      state.nextGroup = state.time + (state.phase===2?19:24);
    }
    addReinforcement(state);
    state.spawnAt = state.reinforcement.length ? state.time + .85 : state.nextGroup;
  }

  function warnTowers(state) {
    const maxTargets = state.phase === 2 ? 3 : 2;
    const [atX,atY] = pos(state.boss.d);
    const targets = G.units.filter(tower => !tower.pastLock && !tower.pastWard);
    targets.sort((a,b) => Math.hypot(a.x-atX,a.y-atY) - Math.hypot(b.x-atX,b.y-atY));
    if (!targets.length) {
      state.attackAt = state.time + 1.3;
      return;
    }
    state.warning = {targets:targets.slice(0,maxTargets), until:state.time+(state.phase===2?1.62:2.1)};
    state.attackAt = state.time + (state.phase===2?10.2:14);
    say('Метки разлома на поле. Отмеченные башни скоро оглушит!');
    cue(360,.16,280);
  }

  function hitWarning(state) {
    const warning = state.warning;
    state.warning = null;
    for (const tower of warning.targets) {
      if (!G.units.includes(tower) || tower.pastWard>0) continue;
      tower.pastLock = state.phase===2?4.1:2.8;
      tower.pastWard = 15;
      G.shots.push({a:320,b:113,c:tower.x,e:tower.y-4,t:.34,col:'#ff987b'});
      (G.waves ||= []).push({x:tower.x,y:tower.y,t:0,c:'#ffb591',radius:34});
    }
    cue(134,.24,62);
  }

  function update(battle, dt, elapsed) {
    const state = battle.past.rift;
    if (!state || !['battle','cleanup'].includes(state.status) || battle.guest) return null;
    state.time = Math.min(limit,Math.max(state.time,elapsed??state.time+dt));
    state.burst = Math.max(0,state.burst-dt);
    if (battle.lives <= 0) {
      state.status = 'lost';
      return state.status;
    }
    if (state.boss.dead && state.status==='battle') {
      state.status = 'cleanup';
      battle.past.fragments = Math.max(1,battle.past.fragments+10);
      state.warning = null;
      state.spawnAt = Math.min(state.spawnAt, state.time + 5);
      say('Гигант повержен. Удержи луг до закрытия разлома!');
      cue(560,.72,930);
    }
    if (state.time >= limit) {
      state.status = state.boss.dead?'won':'lost';
      return state.status;
    }
    if(state.status==='cleanup'){
      if(!battle.past.frozen&&!battle.futurity?.frozen)tickReinforcement(state);
      return null;
    }
    if (state.phase===1 && (state.time>=phaseDeadline || state.time>=phaseOpens&&state.boss.hp<=Math.ceil(state.boss.max*.53))) {
      state.phase = 2;
      state.burst = 2;
      state.attackAt = Math.max(state.attackAt,state.time+3.2);
      say('Фаза 2. Разлом раскалился. Гигант атакует сразу три башни!');
      cue(150,.55,380);
    }
    if(state.time>=finalCharge && !state.coreExposed){
      state.coreExposed=true;
      state.burst=2;
      say('Ядро полностью открыто. Добей гиганта до закрытия разлома!');
      cue(315,.42,675);
    }
    if (battle.past.frozen || battle.futurity?.frozen) return null;
    const motion = state.phase===2?2:1;
    const next = 619 + Math.sin(state.time*.185)*38*motion;
    state.boss.d = Math.min(710,Math.max(560,next));
    if (state.warning && state.time >= state.warning.until) hitWarning(state);
    if (!state.warning && state.time >= state.attackAt) warnTowers(state);
    tickReinforcement(state);
    return null;
  }

  function snapshot(battle) {
    const state = battle.past.rift;
    if (!state) return undefined;
    const warning = state.warning;
    return {phase:state.phase,time:Math.round(state.time*10)/10,burst:Math.round(state.burst*10)/10,status:state.status,
      warning:warning?{until:warning.until,targets:warning.targets.flatMap(tower=>{
        const index=battle.units.indexOf(tower);
        return index>=0?[index]:[];
      })}:null};
  }

  function receive(battle, remote) {
    if (!remote) return;
    let state = battle.past.rift;
    if (!state) {
      // Normal guest snapshots have already populated units and enemies for this tick.
      setMap('meadow',path);
      state = battle.past.rift = {};
    }
    state.phase = remote.phase;
    state.time = remote.time;
    state.burst = remote.burst;
    state.status = remote.status;
    state.boss = battle.en.find(enemy=>enemy.ty===key);
    state.warning = remote.warning && {until:remote.warning.until,
      targets:remote.warning.targets.map(index=>battle.units[index]).filter(Boolean)};
  }

  function poly(c, points, fill, stroke, width) {
    thPoly(c,points,fill,stroke,width);
  }

  function ellipse(c, x, y, rx, ry, fill, stroke, width) {
    thShape(c,p=>p.ellipse(x,y,rx,ry,0,0,arc),fill,stroke,width);
  }

  function gradient(c, x1, y1, x2, y2, colors) {
    return thGradient(c,x1,y1,x2,y2,colors);
  }

  function bossArm(c, side, attack, glow) {
    c.save();
    c.scale(side,1);
    c.translate(57,-16);
    c.rotate(-.13+attack*.19);
    poly(c,[[0,-4],[52,-18],[70,75],[45,92],[1,80]],gradient(c,1,-14,64,88,['#374253','#101022','#030913']),'#09131f',4);
    poly(c,[[52,-18],[65,-18],[80,67],[70,75]],'#071622','#203345',2);
    poly(c,[[4,65],[52,57],[56,69],[7,78]],'#263746',glow,1.7);
    poly(c,[[1,81],[45,91],[50,109],[11,100]],'#080d18','#212c39',2);
    c.restore();
  }

  function drawGiant(c,x,y,scale,phase=1,age=0,charge=0) {
    const motion = thReducedMotion()?0:age;
    const hue = phase===2?furyColor:baseColor;
    c.save();
    c.translate(x,y+Math.sin(motion*1.8)*1.8);
    c.scale(scale,scale);
    ellipse(c,0,93,125,15,'#06122156');
    thGlow(c,0,-12,148,phase===2?'#56bc6696':'#67f79d64');
    poly(c,[[-76,-22],[-40,-42],[44,-44],[82,-21],[72,70],[49,92],[-54,92],[-64,71]],
      gradient(c,0,-45,30,98,['#6dbd5e','#317544','#102b36']),'#102232',5);
    poly(c,[[-37,-9],[24,-13],[40,27],[20,61],[-29,55],[-43,24]],'#1c593f','#73be66',2.7);
    poly(c,[[-19,14],[12,3],[29,23],[12,41],[-20,36]],'#173143',hue,2.7);
    poly(c,[[-5,14],[10,14],[14,23],[8,32],[-5,27]],phase===2?'#ffc277':'#a2f585');
    bossArm(c,-1,Math.min(1,charge),hue);
    bossArm(c,1,Math.min(1,charge)*.65,hue);
    poly(c,[[-44,-98],[43,-98],[52,-81],[42,-55],[24,-46],[-30,-47],[-48,-61],[-52,-81]],
      gradient(c,-35,-90,39,-42,['#629a58','#356b41','#152d34']),'#0d1c26',5);
    poly(c,[[-40,-79],[-27,-83],[-11,-75],[-20,-70],[-37,-71]],'#ff654e','#2a252b',2.6);
    poly(c,[[39,-80],[23,-82],[8,-75],[17,-68],[35,-72]],'#ff765a','#2a252b',2.6);
    if (phase===2 || charge>0) {
      thGlow(c,-25,-76,23,'#ff3c3a98');
      thGlow(c,25,-76,23,'#ff8d3698');
    }
    poly(c,[[-33,-64],[31,-64],[23,-52],[-25,-52]],'#092026','#091522',2);
    for(let i=0;i<6;i++){
      const tooth=-28+i*9.2;
      poly(c,[[tooth,-63],[tooth+7,-63],[tooth+4,-56+(i%2)*2]],i%2?'#a7f27c':'#c9f19c');
    }
    poly(c,[[-58,-102],[-54,-129],[-40,-134],[-35,-109],[-21,-112],[-17,-143],
      [17,-143],[22,-111],[38,-113],[42,-133],[54,-133],[59,-103],
      [44,-94],[18,-97],[-14,-96],[-40,-94]],gradient(c,-20,-143,20,-92,['#bbdc7b','#57884d','#223e39']),'#13282a',4);
    poly(c,[[-47,-106],[-21,-103],[15,-104],[48,-106]],null,hue,2.7);
    poly(c,[[-8,-129],[7,-129],[11,-119],[0,-112],[-11,-118]],'#a4d67b','#20393a',2);
    c.restore();
  }

  function makeBoard() {
    const c = thCanvas(640,400);
    const ctx = c.getContext('2d');
    ctx.fillStyle=gradient(ctx,0,0,0,249,['#0d182a','#173a43','#426957']);
    ctx.fillRect(0,0,640,249);
    ctx.fillStyle='#294951';
    for(let i=0;i<8;i++){
      const left=i*97-37;
      poly(ctx,[[left,203],[left+24,142-(i%4)*16],[left+58,178],[left+82,128+(i%5)*7],[left+103,200]],i%2?'#2c5057':'#2c5356');
    }
    ctx.fillStyle=gradient(ctx,0,198,0,400,['#749e62','#3e7850','#2d5b49']);
    ctx.fillRect(0,top,640,400-top);
    for(let cy=5;cy<10;cy++)for(let cx=0;cx<16;cx++){
      const px=cx*C, py=cy*C;
      ctx.fillStyle=(cx+cy)%2?'#87bf6630':'#a4ce7f28';
      ctx.fillRect(px+.5,py+.5,C-1,C-1);
      if(road[cx+','+cy])continue;
      const ix=px+7+((cx*13+cy*17)%19), iy=py+10+((cx*11+cy*5)%17);
      ellipse(ctx,ix,iy,2.2,1.35,(cx+cy)%3===0?'#caa968':'#a1c485');
      poly(ctx,[[ix+8,iy+9],[ix+10,iy+3],[ix+11,iy+9]],null,'#9abd7d72',1.3);
    }
    ctx.lineCap='round';
    ctx.lineJoin='round';
    for(const [width,color] of [[42,'#152f2c'],[36,'#936746'],[26,'#b88556'],[17,'#c29668']]){
      ctx.strokeStyle=color;
      ctx.lineWidth=width;
      ctx.beginPath();
      PT.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
      ctx.stroke();
    }
    ctx.lineWidth=1.4;
    ctx.strokeStyle='#ccd89888';
    ctx.beginPath();
    ctx.moveTo(0,top+1);
    ctx.lineTo(640,top+1);
    ctx.stroke();
    for(let posX=8;posX<630;posX+=29){
      poly(ctx,[[posX,201],[posX+4,195],[posX+8,201]],'#a2c38978');
    }
    return c;
  }

  function drawBoard(c,battle) {
    if (!board) board = makeBoard();
    c.drawImage(board,0,0);
    const state = battle.past.rift;
    const phase = state.phase||1;
    const defeated = state.status==='cleanup'||state.status==='won';
    const health = state.boss?.max?Math.max(0,state.boss.hp/state.boss.max):defeated?0:1;
    const age = thReducedMotion()?0:performance.now()/1000;
    const power = state.warning?Math.max(0,1-(state.warning.until-state.time)/2.1):0;
    c.save();
    if (state.burst>0 && !thReducedMotion()) {
      c.fillStyle = '#c3f890'+Math.round(Math.max(0,state.burst/2)*78).toString(16).padStart(2,'0');
      c.fillRect(0,0,640,top);
    }
    window.PastMachineArt.portal(c,552,122,43,age,Number(!defeated),true);
    c.globalAlpha = defeated?.26:1;
    drawGiant(c,320,116,.72,phase,age,power);
    c.globalAlpha = 1;
    thShape(c,p=>p.roundRect(14,10,182,50,8),'#12283ed9','#7da686',1.5);
    c.textAlign='left'; c.fillStyle='#edf6db'; c.font='900 15px system-ui';
    c.fillText(name,26,31);
    c.fillStyle='#c9d8bb'; c.font='800 11px system-ui';
    const stage = state.status==='ready'?'ПОДГОТОВКА':defeated?'УДЕРЖИ ЛУГ':'ФАЗА '+phase+' / 2';
    c.fillText(stage,26,48);
    const time = Math.max(0,Math.ceil(limit-state.time));
    c.textAlign='right'; c.font='900 16px system-ui'; c.fillStyle='#e6f8dc';
    c.fillText(Math.floor(time/60)+':'+String(time%60).padStart(2,'0'),184,37);
    thShape(c,p=>p.roundRect(461,14,164,8,4),'#111a24','#acc598',1.1);
    c.fillStyle = phase===2?furyColor:baseColor;
    c.fillRect(463,16,160*health,4);
    if(!defeated && state.status!=='ready'){
      c.textAlign='center';c.fillStyle='#e3f2cd';c.font='800 10px system-ui';
      const sealed = phase===1&&state.time<phaseOpens&&health<=.531 || phase===2&&state.time<finalCharge&&health<=.131;
      c.fillText(sealed?'ЯДРО ПОД ЩИТОМ':Math.ceil(state.boss?.hp??0).toLocaleString('ru-RU')+' HP',543,36);
    }
    c.restore();
  }

  function drawEnemy(c,enemy,battle) {
    if (enemy.ty!==key) return false;
    const [x,y] = pos(enemy.d);
    const color = battle.past.rift.phase===2?furyColor:beamColor;
    c.save();
    thGlow(c,x,y,39,color+'88');
    ellipse(c,x,y,16,7,'#082d32c9',color,1.8);
    poly(c,[[x,y-11],[x+9,y-3],[x,y+4],[x-9,y-3]],color,'#eef9d8',1.5);
    c.beginPath();
    c.strokeStyle = color+'82';
    c.setLineDash([3,5]);
    c.moveTo(320,137);
    c.lineTo(x,y-11);
    c.stroke();
    c.restore();
    return true;
  }

  function drawEffects(c,battle) {
    const state = battle.past.rift;
    if (!state?.warning) return;
    const pulse = thReducedMotion()?0:Math.sin(performance.now()/110)*3;
    c.save();
    c.strokeStyle = state.phase===2?'#ffa67e':'#ffe1a3';
    c.fillStyle = '#e36b5457';
    c.lineWidth = 2;
    for(const tower of state.warning.targets){
      if(!battle.units.includes(tower))continue;
      c.beginPath();
      c.arc(tower.x,tower.y,21+pulse,0,arc);
      c.fill();
      c.stroke();
      c.setLineDash([4,5]);
      c.beginPath();
      c.moveTo(320,101);
      c.lineTo(tower.x,tower.y-6);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle='#fff6c5';
      c.font='900 13px system-ui';
      c.textAlign='center';
      c.fillText('!',tower.x,tower.y-19);
      c.fillStyle='#e36b5457';
    }
    c.restore();
  }

  window.RiftFinale = {key,limit,prepare,start,update,allowCell,damage,snapshot,receive,drawBoard,drawEnemy,drawEffects,drawGiant};
})();
