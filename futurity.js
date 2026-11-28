(() => {
  'use strict';

  const key = 'futurity';
  const chargeTime = 90;
  const stopTime = 10;
  const piercingDistance = 60;
  const coopAction = 7;
  const ice = '#a9f7ff';

  TY[key] = {
    n: 'Futurity', cost: 720, dmg: 54, rate: .92, rng: 123, col: ice, limited: true, unique: true,
    d: 'Relic за прохождение всех 40 миссий «Ивента прошлого». Каждый 3-й выстрел пробивает ближайшего врага за целью (30% урона), в фазе 2 — каждый 2-й (40%). Один Futurity на поле. После установки каждые 90 с можно остановить время на 10 с.'
  };
  RA[key] = 'Relic';
  MKNS[key] = 'награда за «Ивент прошлого»';
  EXU.push(key);

  function makePortraits() {
    const art = window.TimelineArt;
    if (!art) return;
    for (const phase of [1, 2]) {
      const canvas = thCanvas(144, 144);
      const sprite = new Image();
      art.drawFuturity(canvas.getContext('2d'), 72, 72, 54, phase);
      const portrait = key + phase;
      IMG[portrait] = canvas.toDataURL();
      sprite.src = IMG[portrait];
      IM[portrait] = sprite;
    }
  }
  if (window.TimelineArt) makePortraits();
  else document.addEventListener('DOMContentLoaded', makePortraits, {once: true});

  function attack(tower, target, damage, [px, py], phaseTwo) {
    const progress = target.d;
    hit(target, damage);
    if (tower.n % (phaseTwo ? 2 : 3) !== 0) return;
    let rear = null;
    for (const enemy of G.en) {
      const distance = progress - enemy.d;
      if (enemy === target || enemy.dead || enemy.po || inv(enemy) || distance < 0 || distance > piercingDistance) continue;
      if (!rear || enemy.d > rear.d) rear = enemy;
    }
    if (!rear) return;
    const [tx, ty] = pos(rear.d);
    G.shots.push({a: px, b: py, c: tx, e: ty, t: .22, col: ice});
    (G.waves ||= []).push({x: tx, y: ty, t: 0, c: ice, radius: 24});
    hit(rear, damage * (phaseTwo ? .4 : .3));
  }

  const controls = document.createElement('div');
  controls.className = 'futurity-controls';
  controls.hidden = true;
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'futurity-freeze';
  button.className = 'go';
  button.title = 'Futurity останавливает врагов на 10 секунд. Одна зарядка за 90 секунд боя.';
  button.setAttribute('aria-keyshortcuts', 'T');
  controls.appendChild(button);
  $('shop').after(controls);

  function hasEnemies(battle) {
    return battle.en.some(enemy => !enemy.dead && !enemy.po);
  }

  // A replacement must recharge from zero. Selling during a stop leaves the existing stop intact.
  function syncTower(battle) {
    const tower = battle.units.find(unit => unit.k === key);
    const state = battle.futurity;
    if (tower !== state?.source && (tower || state?.frozen > 0)) {
      battle.futurity = {source: tower, cooldown: tower ? chargeTime : 0, frozen: state?.frozen || 0};
    } else if (!tower && !(state?.frozen > 0)) {
      delete battle.futurity;
    }
    return battle.futurity;
  }

  function canActivate(battle, tower, state) {
    return battle && !battle.over && tower && state && !state.frozen && !state.cooldown &&
      !battle.past?.paused && !battle.past?.frozen && hasEnemies(battle);
  }

  function refreshControls() {
    const battle = G;
    const state = battle?.guest ? battle.futurity : battle && syncTower(battle);
    const tower = battle?.guest ? battle.units.find(unit => unit.k === key) : state?.source;
    controls.hidden = cur !== 'game' || !battle || !!battle.over || (!tower && !state?.frozen);
    if (controls.hidden) return;
    const owned = tower && (battle.guest ? tower.mine : !tower.og);
    const remaining = Math.ceil((state?.cooldown || 0) - .0001);
    const stopped = Math.ceil((state?.frozen || 0) - .0001);
    const label = state?.frozen ? `Время остановлено · ${Math.max(1, stopped)} с` :
      remaining > 0 ? `Futurity · зарядка ${remaining} с` :
      !state ? 'Futurity · зарядка' : !owned ? 'Futurity · готов у напарника' : 'Остановить время · 10 с · T';
    if (button.textContent !== label) button.textContent = label;
    button.disabled = !owned || !canActivate(battle, tower, state);
  }

  function activate(fromGuest = false) {
    const battle = G;
    if (!battle || battle.guest) return false;
    const state = syncTower(battle);
    const tower = state?.source;
    if (!canActivate(battle, tower, state) || Boolean(tower.og) !== fromGuest) return false;
    state.frozen = stopTime;
    state.cooldown = chargeTime;
    (battle.waves ||= []).push({x: tower.x, y: tower.y, t: 0, c: ice, radius: 72});
    window.PastMachineBattle?.cue(660, .27, 110);
    say('Futurity остановил время на 10 секунд. Верити продолжают атаковать.');
    refreshControls();
    return true;
  }

  let sending = false;
  async function requestActivation() {
    if (cur !== 'game' || controls.hidden || button.disabled || sending) return;
    if (!G.guest) { activate(); return; }
    sending = true;
    try {
      const response = await db('rooms/' + CO.host + '/a', {
        m: 'POST', b: {ty: 'm', m: coopAction, t: {'.sv': 'timestamp'}}
      });
      if (!response.ok && G?.guest) say('Не удалось остановить время.');
    } catch {
      if (G?.guest) say('Не удалось остановить время.');
    } finally {
      sending = false;
    }
  }

  button.addEventListener('click', requestActivation);
  addEventListener('keydown', event => {
    if (event.code !== 'KeyT' || event.repeat || event.altKey || event.ctrlKey || event.metaKey ||
        event.target?.closest?.('input,textarea,select,[contenteditable=true]') || !$('modal').classList.contains('hide') ||
        cur !== 'game' || controls.hidden || button.disabled) return;
    event.preventDefault();
    requestActivation();
  });

  const simulate = upd;
  upd = function(dt, elapsed = dt) {
    const battle = G;
    if (!battle || battle.guest || battle.past?.paused) return simulate(dt);
    const state = battle.futurity || syncTower(battle);
    if (!state) return simulate(dt);
    // Allied knockback can change path positions outside the enemy movement loop.
    const held = state.frozen > 0 ? battle.en.map(enemy => [enemy, enemy.d]) : [];
    try {
      return simulate(dt);
    } finally {
      for (const [enemy, progress] of held) enemy.d = progress;
      state.frozen = Math.max(0, state.frozen - elapsed);
      state.cooldown = Math.max(0, state.cooldown - elapsed);
      if (state.frozen < 1e-7) state.frozen = 0;
      if (state.cooldown < 1e-7) state.cooldown = 0;
      refreshControls();
    }
  };

  const applyAction = coApply;
  coApply = function(action) {
    if (action?.ty === 'm' && action.m === coopAction) {
      if (G?.coop?.g) activate(true);
      return;
    }
    return applyAction(action);
  };

  const snapshot = coSnap;
  coSnap = function() {
    const serial = snapshot();
    const state = G.futurity;
    if (!state) return serial;
    const data = JSON.parse(serial);
    data.ft = [Math.ceil(state.cooldown * 10) / 10, Math.ceil(state.frozen * 10) / 10];
    return JSON.stringify(data);
  };

  const receive = coApplySnap;
  coApplySnap = function(data) {
    if (G?.guest) {
      if (data.ft) G.futurity = {cooldown: data.ft[0], frozen: data.ft[1]};
      else delete G.futurity;
    }
    return receive(data);
  };

  const updateHud = hud;
  hud = function() {
    updateHud();
    refreshControls();
  };

  const drawBoard = draw;
  draw = function() {
    drawBoard();
    const state = G?.futurity;
    if (!state?.frozen || G.over) return;
    x.save();
    const edge = x.createRadialGradient(cv.width / 2, cv.height / 2, cv.height / 3, cv.width / 2, cv.height / 2, cv.width * .53);
    edge.addColorStop(0, 'transparent');
    edge.addColorStop(1, '#64e6ff55');
    x.fillStyle = edge;
    x.fillRect(0, 0, cv.width, cv.height);
    x.lineWidth = 3;
    x.strokeStyle = '#9bf2ffb3';
    x.strokeRect(6, 6, cv.width - 12, cv.height - 12);
    const px = cv.width - 28, py = 29;
    x.fillStyle = '#0c253a';
    x.beginPath(); x.arc(px, py, 13, 0, Math.PI * 2); x.fill();
    x.lineWidth = 2;
    x.strokeStyle = ice;
    x.beginPath();
    x.arc(px, py, 13, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * state.frozen / stopTime);
    x.stroke();
    x.beginPath(); x.moveTo(px, py - 7); x.lineTo(px, py); x.lineTo(px + 5, py + 3); x.stroke();
    x.restore();
  };

  window.FuturityBattle = {attack};
})();
