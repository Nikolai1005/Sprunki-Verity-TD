(() => {
  'use strict';

  const prism = {radius:58, targets:2, every:3, phaseEvery:2, power:.45, phasePower:.55};
  const pole = {life:1.8, recovery:4, every:3, phaseEvery:2,
    slow:[.25,.35], bossSlow:[.10,.15], bonus:[20,32], bossBonus:[13,21]};
  const beat = {radius:125, targets:3, life:3, every:4, phaseEvery:3, power:[.30,.45], cap:[24,50]};
  const percent = fraction => Math.round(fraction * 100) + '%';
  const units = Object.freeze({
    prismity:{n:'Prismity',rar:'Epic',limited:true,unlockTickets:600,cost:295,dmg:24,rate:.96,rng:110,col:'#76ebff',
      ability:'Расщепление света',
      d:`Каждый ${prism.every}-й выстрел преломляется и бьёт до ${prism.targets} врагов рядом с целью на ${percent(prism.power)} урона. В фазе 2 — каждый ${prism.phaseEvery}-й на ${percent(prism.phasePower)}.`},
    polarity:{n:'Polarity',rar:'Legendary',limited:true,unlockTickets:900,cost:365,dmg:29,rate:1.10,rng:106,col:'#ffc860',
      ability:'Полярная метка',
      d:`Каждый ${pole.every}-й выстрел ставит метку на ${pole.life.toLocaleString('ru-RU')} с и замедляет цель на ${percent(pole.slow[0])}. Удар башни другого типа снимает метку и наносит ещё ${pole.bonus[0]} урона. В фазе 2 метка срабатывает каждый ${pole.phaseEvery}-й выстрел, замедляет на ${percent(pole.slow[1])} и добавляет ${pole.bonus[1]} урона. На боссах эффект слабее. Одна метка на врага за ${pole.recovery} с.`},
    metronity:{n:'Metronity',rar:'Mythic',limited:true,unique:true,unlockTickets:1300,cost:440,dmg:22,rate:1,rng:110,col:'#79edb6',
      ability:'Вступление в такт',
      d:`Каждый ${beat.every}-й выстрел подзаряжает до ${beat.targets} ближайших союзных башен на ${beat.life} с. Следующее попадание каждой наносит на ${percent(beat.power[0])} больше урона (до +${beat.cap[0]}). В фазе 2 — каждый ${beat.phaseEvery}-й выстрел и +${percent(beat.power[1])} (до +${beat.cap[1]}). Одна башня на команду.`}
  });

  function register() {
    for (const [key, unit] of Object.entries(units)) {
      TY[key] = unit;
      RA[key] = unit.rar;
      EXU.push(key);
      MKNS[key] = 'лимитка за тикеты Арены хранилища';
      for (const phase of [1, 2]) {
        const size = 144, canvas = thCanvas(size, size), art = new Image();
        window.TicketLimitedArt.draw(canvas.getContext('2d'), key, phase, size);
        const imageKey = key + phase;
        IMG[imageKey] = canvas.toDataURL();
        art.src = IMG[imageKey];
        IM[imageKey] = art;
      }
    }
  }

  function ray(from, to, color) {
    G.shots.push({a:from[0], b:from[1], c:to[0], e:to[1], t:.24, col:color});
  }

  function pulse([px, py], color, radius) {
    (G.waves ||= []).push({x:px, y:py, t:0, c:color, radius});
  }

  function refract(tower, target, damage, point, phaseTwo) {
    if (tower.n % (phaseTwo ? prism.phaseEvery : prism.every)) return;
    const nearby = [];
    for (const enemy of G.en) {
      if (enemy === target || enemy.dead || enemy.po || inv(enemy)) continue;
      const position = pos(enemy.d);
      const distance = Math.hypot(position[0] - point[0], position[1] - point[1]);
      if (distance <= prism.radius) nearby.push({enemy, position, distance});
    }
    nearby.sort((a,b) => a.distance - b.distance || b.enemy.d - a.enemy.d);
    const branches = nearby.slice(0, prism.targets);
    for (const {enemy, position} of branches) {
      ray(point, position, '#e59eff');
      hit(enemy, damage * (phaseTwo ? prism.phasePower : prism.power));
    }
    if (branches.length) pulse(point, '#98f1ff', prism.radius);
  }

  function marked(enemy, now) {
    return enemy.ticketPole?.until > now;
  }

  function magnetize(tower, target, point, phaseTwo) {
    const now = G.ticketBattleTime;
    if (tower.n % (phaseTwo ? pole.phaseEvery : pole.every) || target.dead || target.ticketPoleReady > now) return;
    const phase = Number(phaseTwo);
    target.ticketPole = {until:now + pole.life,
      slow:(target.boss ? pole.bossSlow : pole.slow)[phase],
      bonus:(target.boss ? pole.bossBonus : pole.bonus)[phase]};
    target.ticketPoleReady = now + pole.recovery;
    G.hasTicketEffects = true;
    pulse(point, '#ffca64', 35);
  }

  function charged(tower, now) {
    return tower.ticketBeat?.until > now;
  }

  function conduct(tower, phaseTwo) {
    if (tower.n % (phaseTwo ? beat.phaseEvery : beat.every)) return;
    const now = G.ticketBattleTime, phase = Number(phaseTwo), origin = [tower.x, tower.y];
    const nearby = [];
    for (const ally of G.units) {
      if (ally.k === 'metronity' || !(TY[ally.k]?.dmg > 0) || ally.po || charged(ally, now)) continue;
      const distance = Math.hypot(ally.x - tower.x, ally.y - tower.y);
      if (distance <= beat.radius) nearby.push({ally, distance});
    }
    nearby.sort((a,b) => a.distance - b.distance);
    const recipients = nearby.slice(0, beat.targets);
    for (const {ally} of recipients) {
      ally.ticketBeat = {until:now + beat.life, power:beat.power[phase], cap:beat.cap[phase]};
      ray(origin, [ally.x, ally.y], '#aafcd3');
    }
    if (recipients.length) {
      G.hasTicketEffects = true;
      pulse(origin, '#78edb6', beat.radius);
    }
  }

  function attack(tower, target, damage, point, phaseTwo) {
    hit(target, damage);
    if (tower.k === 'prismity') refract(tower, target, damage, point, phaseTwo);
    else if (tower.k === 'polarity') magnetize(tower, target, point, phaseTwo);
    else if (tower.k === 'metronity') conduct(tower, phaseTwo);
  }

  function step(battle, dt) {
    battle.ticketBattleTime = (battle.ticketBattleTime || 0) + dt;
  }

  function slow(enemy, battle) {
    return marked(enemy, battle.ticketBattleTime) ? 1 - enemy.ticketPole.slow : 1;
  }

  function modifyDamage(battle, enemy, amount) {
    const tower = battle?.cu;
    if (!tower || enemy.dead || enemy.po || !(amount > 0)) return amount;
    const now = battle.ticketBattleTime;
    let bonus = 0;
    if (charged(tower, now)) {
      const charge = tower.ticketBeat;
      delete tower.ticketBeat;
      bonus += Math.min(charge.cap, amount * charge.power);
    }
    if (tower.k !== 'polarity' && marked(enemy, now) && !inv(enemy)) {
      bonus += enemy.ticketPole.bonus;
      delete enemy.ticketPole;
      pulse(pos(enemy.d), '#fff2a9', 29);
    }
    return amount + bonus;
  }

  function drawEffects(ctx, battle) {
    if (!battle.hasTicketEffects) return;
    const now = battle.ticketBattleTime;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffd365';
    for (const enemy of battle.en) {
      if (!(enemy.ticketPoleVisual || marked(enemy, now)) || enemy.dead || enemy.po || inv(enemy)) continue;
      const [px, py] = pos(enemy.d);
      const radius = ET[enemy.ty].r + 3;
      ctx.beginPath();
      ctx.arc(px, py, radius, -.9, .9);
      ctx.arc(px, py, radius, Math.PI - .9, Math.PI + .9);
      ctx.stroke();
    }
    ctx.fillStyle = '#aaffc2';
    for (const tower of battle.units) {
      if (!(tower.ticketBeatVisual || charged(tower, now))) continue;
      ctx.fillRect(tower.x - 3, tower.y - 22, 6, 3);
    }
    ctx.restore();
  }

  window.TicketLimitedUnits = units;
  window.TicketLimitedBattle = {register, attack, step, slow, modifyDamage, drawEffects, marked, charged};
})();
