(() => {
  'use strict';

  const stats=[
    {damage:1,cooldown:1,range:1},
    {damage:1.20,cooldown:.95,range:1.06,costPercent:55},
    {damage:1.45,cooldown:.90,range:1.12,costPercent:85}
  ];
  const level=unit=>Math.max(1,Math.min(3,Math.floor(Number(unit.upgradeLevel)||1)));
  const bonus=unit=>stats[level(unit)-1];
  const supported=unit=>unit&&TY[unit.k]&&TY[unit.k].dmg>0&&!TY[unit.k].testAttack;
  const cost=unit=>level(unit)<3?Math.max(25,Math.ceil(TY[unit.k].cost*stats[level(unit)].costPercent/500)*5):0;
  const damageMultiplier=xD, cooldownMultiplier=xC, rangeMultiplier=xR;
  xD=unit=>damageMultiplier(unit)*bonus(unit).damage;
  xC=unit=>cooldownMultiplier(unit)*bonus(unit).cooldown;
  xR=unit=>rangeMultiplier(unit)*bonus(unit).range;
  window.RoundUpgrades={damage:unit=>bonus(unit).damage};

  function priceFor(unit){
    if(!supported(unit))return 'У этого Верити прокачка пока недоступна';
    if(level(unit)===3)return 'Уровень 3/3 · Максимум';
    const next=stats[level(unit)];
    return 'До ур. '+(level(unit)+1)+': +'+Math.round((next.damage-1)*100)+'% обычного урона, −'+Math.round((1-next.cooldown)*100)+'% интервала, +'+Math.round((next.range-1)*100)+'% дальности';
  }

  function purchase(unit,guest,expectedLevel){
    if(!G||G.over||!G.units.includes(unit)||!supported(unit)||level(unit)!==expectedLevel||level(unit)>=3)return false;
    if(Boolean(unit.og)!==guest)return false;
    const wallet=guest?'gc':'coins', price=cost(unit);
    if((G[wallet]||0)<price)return false;
    G[wallet]-=price;
    unit.upgradeLevel=level(unit)+1;
    (G.waves=G.waves||[]).push({x:unit.x,y:unit.y,t:0,c:'#ffd978',radius:31});
    hud();
    if(G.selU===unit)showU();
    say(TY[unit.k].n+' · уровень '+level(unit));
    return true;
  }

  function refreshUpgradeButton(){
    const button=$('round-upgrade'), unit=G?.selU;
    if(!button||!unit)return;
    button.disabled=!!G.over||!!unit.og||!supported(unit)||level(unit)>=3||G.coins<cost(unit);
  }

  const originalShow=showU;
  showU=function(){
    originalShow();
    const unit=G?.selU;
    if(!supported(unit)||G.guest||unit.og)return;
    const panel=document.createElement('div');
    panel.className='round-upgrade-panel';
    panel.innerHTML='<b>Уровень '+level(unit)+'/3</b><small>'+priceFor(unit)+'</small>'+
      '<button type="button" id="round-upgrade" class="go">'+(level(unit)===3?'Максимум':'Улучшить · '+cost(unit)+' 🪙')+'</button>';
    $('ust').appendChild(panel);
    $('round-upgrade').onclick=()=>{
      if(!purchase(unit,false,level(unit)))say('Не хватает монет или уже максимальный уровень.');
    };
    refreshUpgradeButton();
  };

  const originalHUD=hud;
  hud=function(){originalHUD();if(G&&ROUND_WAVES[G.key])$('wmx').textContent='/'+battleWaveLimit();refreshUpgradeButton()};

  const originalApply=coApply;
  coApply=function(action){
    if(action?.ty!=='u')return originalApply(action);
    const unit=G?.units.find(unit=>unit.og&&unit.cx===action.x&&unit.cy===action.y);
    if(unit)purchase(unit,true,action.level);
  };

  const originalClick=cv.onclick;
  cv.onclick=function(event){
    if(G?.guest&&!G.over){
      const point=cell(cvPos(event));
      const unit=G.units.find(unit=>unit.cx===point[0]&&unit.cy===point[1]&&unit.mine);
      if(supported(unit)&&level(unit)<3){
        const expected=level(unit),price=cost(unit);
        mOpen(TY[unit.k].n+' · уровень '+expected+'/3','<p>'+priceFor(unit)+'</p>',[
          ['Улучшить · '+price+' 🪙',function(){
            mClose();
            if(G.coins<price)return say('Не хватает монет.');
            db('rooms/'+CO.host+'/a',{m:'POST',b:{ty:'u',x:unit.cx,y:unit.cy,level:expected,t:{'.sv':'timestamp'}}})
              .then(result=>say(result.ok?'Запрос на улучшение отправлен.':'Не удалось улучшить.'))
              .catch(()=>say('Не удалось улучшить.'));
          }],
          ['Продать',function(){mClose();db('rooms/'+CO.host+'/a',{m:'POST',b:{ty:'s',x:unit.cx,y:unit.cy,t:{'.sv':'timestamp'}}})}],
          ['Отмена',mClose]
        ]);
        return;
      }
    }
    return originalClick.call(this,event);
  };

  const originalDraw=draw;
  draw=function(){
    originalDraw();
    if(!G)return;
    x.save();
    for(const unit of G.units){
      if(level(unit)<=1)continue;
      x.fillStyle='#2d2040';x.fillRect(unit.x+5,unit.y+7,15,11);
      x.fillStyle='#ffe387';x.font='bold 9px system-ui';x.textAlign='center';
      x.fillText('★'+level(unit),unit.x+12.5,unit.y+16);
    }
    x.restore();
  };
})();
