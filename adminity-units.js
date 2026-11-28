(() => {
  'use strict';
  const keys = {volt:'voltity',cash:'cashity',disco:'discolordity'};
  const farm = {income:[44,76,120], upgrades:[180,290]};
  const fieldHalf = 120;
  const units = {
    voltity:{n:'Voltity',rar:'Legendary',limited:true,unlockTickets:1000,cost:380,dmg:28,rate:1.07,rng:113,col:'#7deaff',
      ability:'Цепная молния',d:'После попадания молния перескакивает на пять следующих врагов, по 36% урона. В фазе 2 она наносит удвоенный урон всем целям вдоль вертикального участка дорожки, начиная с места удара. На горизонтальном участке остаётся цепь.'},
    cashity:{n:'Cashity',rar:'Epic',limited:true,unique:true,unlockTickets:800,cost:330,dmg:0,rate:1,rng:0,col:'#a8e470',
      ability:'Касса раунда',d:'Ферма без атаки. В конце каждой волны приносит 44 / 76 / 120 монет раунда. Улучшения стоят 180 и 290 монет. Один Cashity на команду.'},
    discolordity:{n:'Discolordity',rar:'Mythic',limited:true,unique:true,unlockTickets:1500,cost:520,dmg:26,rate:1.12,rng:107,col:'#fb92fd',
      ability:'Четыре такта',d:'По кругу: двойной урон, оглушение, отбрасывание, усиленный удар (+50%). Во второй фазе вокруг него действует поле 6×6 клеток: ближайшие Верити наносят на 12% больше урона и атакуют чаще, враги теряют 38% скорости. У боссов контроль слабее.'}
  };
  const fashion = {
    vaultgold:{n:'Рамка «Ключ от сейфа»',type:'fr',id:'vault',col:'#ffd276',unlockTickets:420,ability:'Рамка аватарки',d:'Золотое кольцо с голубой защёлкой.'},
    vaultneon:{n:'Ник «Неон сейфа»',type:'nc',id:'vault',col:'#9ff5e2',unlockTickets:300,ability:'Цвет ника',d:'Мятный неон для имени в профиле и списке игроков.'},
    vaulthalo:{n:'Свечение «Диско-кольцо»',type:'tw',id:'vault',col:'#fb92fd',unlockTickets:550,ability:'Свечение башен',d:'Розово-фиолетовое свечение для поставленных Верити.'}
  };
  const offers = Object.freeze({...units,...fashion});
  const level = tower => Math.max(1,Math.min(3,Number(tower.upgradeLevel)||1));
  const special = tower => tower?.k===keys.cash ? {
    cost:farm.upgrades[level(tower)-1]||0,
    text:level(tower)<3?'Доход: '+farm.income[level(tower)-1]+' → '+farm.income[level(tower)]+' 🪙 за волну':
      'Максимум · '+farm.income[2]+' 🪙 за волну'
  } : null;

  function drawArt(c,key,p){
    const phase=p===2, color=units[key].col;
    c.save();c.translate(72,75);
    const shape=(points,fill,line='#211831',width=3)=>{
      c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
      c.fillStyle=fill;c.fill();c.strokeStyle=line;c.lineWidth=width;c.stroke();
    };
    const oval=(x,y,rx,ry,fill)=>{
      c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();
    };
    oval(0,50,49,6,'#24213e47');
    if(phase){
      c.strokeStyle=color;c.lineWidth=3;c.beginPath();c.ellipse(0,0,61,53,-.47,0,Math.PI*2);c.stroke();
      for(let i=0;i<7;i++){const a=i*2.399;oval(Math.cos(a)*59,Math.sin(a)*54,2.6,2.6,'#fbf6b4');}
    }
    const skin=c.createRadialGradient(-21,-24,4,0,8,58);
    skin.addColorStop(0,'#fff7cc');skin.addColorStop(.4,color);skin.addColorStop(1,phase?'#4f2b6b':'#26475b');
    oval(0,0,49,49,'#211831');oval(0,0,45,45,skin);
    for(const direction of [-1,1]){
      oval(direction*15,1,4.8,8,'#1b1932');oval(direction*15-1,-2,1.2,2,'#fff');
      oval(direction*30,12,5,2.6,phase?'#ff95cd':'#f9e6ac');
    }
    c.strokeStyle='#231932';c.lineWidth=4;c.lineCap='round';c.beginPath();c.moveTo(-16,17);
    c.quadraticCurveTo(0,phase?37:30,16,16);c.stroke();
    if(key===keys.volt){
      shape([[-38,-27],[-24,-48],[20,-48],[38,-26],[18,-20],[-18,-20]],'#253a62');
      shape([[-6,-64],[20,-61],[8,-46],[24,-46],[-11,-11],[-2,-36],[-19,-36]],phase?'#ffb76b':'#eeff9c');
    }else if(key===keys.cash){
      shape([[-37,-28],[-29,-51],[27,-51],[38,-28],[19,-21],[-20,-21]],'#2c6c57');
      shape([[-20,-50],[20,-50],[19,-30],[-20,-30]],'#f7d577');
      c.fillStyle='#75552f';c.font='900 18px system-ui';c.textAlign='center';c.fillText('₵',0,-34);
    }else{
      shape([[-43,-22],[-41,-47],[-19,-35],[0,-60],[18,-36],[41,-48],[43,-23]],'#624075');
      for(const [sx,sy] of [[-29,-34],[0,-44],[29,-34]])oval(sx,sy,6,6,'#fce586');
      shape([[-31,-7],[31,-7],[27,11],[8,11],[0,4],[-9,11],[-27,11]],'#191b39',color,2.8);
      c.strokeStyle='#fff0f5';c.lineWidth=2;c.beginPath();c.moveTo(-23,-2);c.lineTo(-13,-2);c.moveTo(12,-2);c.lineTo(22,-2);c.stroke();
    }
    c.restore();
  }

  function register(){
    for(const [key,unit] of Object.entries(units)){
      TY[key]=unit;RA[key]=unit.rar;EXU.push(key);
      MKNS[key]='лимитка лавки Adminity';
      for(const phase of [1,2]){
        const portrait=thCanvas(144,144),art=new Image(),id=key+phase;
        drawArt(portrait.getContext('2d'),key,phase);
        IMG[id]=portrait.toDataURL();art.src=IMG[id];IM[id]=art;
      }
    }
    for(const item of Object.values(fashion))COS[item.type].push([item.id,item.n,null,item.col]);
  }

  function zap(from,to,color,width=.18){
    G.shots.push({a:from[0],b:from[1],c:to[0],e:to[1],t:width,col:color});
  }

  function visible(enemy){return !enemy.dead&&!enemy.po&&!inv(enemy)}

  function chain(start,point,damage){
    const following=G.en.filter(enemy=>enemy!==start&&visible(enemy)&&enemy.d<=start.d&&start.d-enemy.d<=280)
      .sort((a,b)=>b.d-a.d).slice(0,5);
    let origin=point;
    for(const enemy of following){
      const next=pos(enemy.d);
      zap(origin,next,'#b8f5ff');hit(enemy,damage*.36);origin=next;
    }
  }

  function volt(target,damage,point,phaseTwo){
    const segment=phaseTwo&&segs.find(([a,b,len,start])=>a[0]===b[0]&&target.d>=start&&target.d<=start+len);
    if(!segment){hit(target,damage);chain(target,point,damage);return}
    // The battle engine already applies the shared phase bonus to the damage argument.
    const amount=damage*.8;
    const [, ,length,start]=segment;
    const end=start+length;
    zap(point,pos(start),'#e6fcff',.32);
    zap(point,pos(end),'#e6fcff',.32);
    hit(target,amount);
    for(const enemy of G.en.slice()){
      if(enemy!==target&&visible(enemy)&&enemy.d>=start&&enemy.d<=end)hit(enemy,amount);
    }
  }

  function disco(unit,target,damage,point){
    const beat=(unit.n-1)%4;
    hit(target,damage*[2,1,1,1.5][beat]);
    if(!target.dead&&beat===1&&!(target.discoStunGuard>0)){
      target.stun=Math.max(target.stun||0,target.boss?.22:.9);
      target.discoStunGuard=target.boss?6:2.7;
    }
    if(!target.dead&&beat===2&&!target.boss&&!(target.discoPushGuard>0)){
      target.d=Math.max(0,target.d-22);
      target.orbitRevision=(target.orbitRevision||0)+1;
      target.discoPushGuard=2.5;
    }
    (G.waves||=[]).push({x:point[0],y:point[1],t:0,c:['#ffab68','#a4ddff','#83ffcd','#fb9df3'][beat],radius:25});
  }

  function attack(unit,target,damage,point,phaseTwo){
    if(unit.k===keys.volt)volt(target,damage,point,phaseTwo);
    else if(unit.k===keys.disco)disco(unit,target,damage,point);
  }

  function getField(){
    if(!G||G.over)return null;
    return G.units.find(tower=>tower.k===keys.disco&&!tower.pastLock&&!tower.pastGuestLock&&
      !(tower.curse>0)&&((G.p2&&G.cool<=0)||tower.inf>0));
  }
  function inside(field,x,y){return Math.abs(field.x-x)<fieldHalf&&Math.abs(field.y-y)<fieldHalf}
  function boosts(tower){
    const field=getField();
    return field&&field!==tower&&inside(field,tower.x,tower.y);
  }
  function slow(enemy,dt){
    for(const key of ['discoStunGuard','discoPushGuard'])if(enemy[key]>0)enemy[key]=Math.max(0,enemy[key]-dt);
    const field=getField();
    return field&&inside(field,...pos(enemy.d))?(enemy.boss?.87:.62):1;
  }
  function draw(c){
    const field=getField();
    if(!field)return;
    const x=field.x-fieldHalf,y=field.y-fieldHalf;
    c.save();c.beginPath();c.rect(0,0,640,400);c.clip();
    c.fillStyle='#dc83ff27';c.fillRect(x,y,240,240);
    c.strokeStyle='#ffcbffa6';c.lineWidth=1.8;c.setLineDash([7,4]);c.strokeRect(x,y,240,240);
    c.restore();
  }
  function pay(battle){
    if(battle.guest||battle.adminTest||battle.cashPaidWave===battle.wave||battle.wave<1)return;
    battle.cashPaidWave=battle.wave;
    const tower=battle.units.find(unit=>unit.k===keys.cash);
    if(!tower)return;
    const wallet=tower.og&&battle.coop?.g?'gc':'coins';
    battle[wallet]+=farm.income[level(tower)-1];
    (battle.waves||=[]).push({x:tower.x,y:tower.y,t:0,c:'#ffe398',radius:28});
  }
  function owned(profile,key){
    const cosmetic=fashion[key];
    return Boolean(cosmetic?profile.cos?.own?.[cosmetic.type+cosmetic.id]:profile.own[key]);
  }
  function setOwned(profile,key,value){
    const cosmetic=fashion[key];
    if(!cosmetic){if(value===undefined)delete profile.own[key];else profile.own[key]=value;return}
    profile.cos??={};profile.cos.own??={};
    if(value===undefined)delete profile.cos.own[cosmetic.type+cosmetic.id];
    else profile.cos.own[cosmetic.type+cosmetic.id]=value;
  }

  window.AdminityShop = {offers,units,fashion,register,attack,special,pay,slow,draw,boosts,owned,setOwned};
})();
