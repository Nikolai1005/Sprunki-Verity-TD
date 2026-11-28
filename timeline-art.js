(() => {
  'use strict';

  const width=960, height=540, circle=Math.PI*2;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const world=window.PastMachineArt;
  const intro=[
    {speaker:'Странник',text:'Вы готовы, хранители? Это будет большое приключение. Включаем портал!',seconds:5.5},
    {speaker:'Админити',text:'Я всё время играю в чужие игры. А что, если сделать свою? Вот мой первый Верити!',seconds:5},
    {speaker:'Админити',text:'Пусть Верити защищают луг от Шумов. Назову игру Sprunki Verity TD.',seconds:4.5},
    {speaker:'Хакерити',text:'Ты придумаешь волны, а я помогу с кодом. Давай сделаем первую версию вместе.',seconds:5},
    {speaker:'Админити',text:'Работает! Верити и Ловити держат оборону. Осталось выпустить игру.',seconds:4},
    {speaker:'Хакерити',text:'Этот фрагмент кода мне ещё пригодится.',seconds:3.8},
    {speaker:'Админити',text:'Хакерити ушёл. Но игра осталась у меня. Пора показать её игрокам.',seconds:5},
    {speaker:'Странник',text:'Первая версия открыта. На лугу уже слышно Шумов. Вперёд, хранители!',seconds:5}
  ];

  function rounded(c,x,y,w,h,r,fill,edge,lineWidth=1){
    thShape(c,p=>p.roundRect(x,y,w,h,r),fill,edge,lineWidth);
  }

  function disk(c,x,y,r,fill,edge,size=1){
    thShape(c,p=>p.arc(x,y,r,0,circle),fill,edge,size);
  }

  function line(c,points,color,stroke){
    thPoly(c,points,null,color,stroke);
  }

  function label(c,message,x,y,opts={}){
    const {color='#f6faff',size=14,align='left',mono=false}=opts;
    c.font='800 '+size+'px '+(mono?'monospace':'system-ui,sans-serif');
    c.fillStyle=color;
    c.textAlign=align;
    c.fillText(message,x,y);
  }

  function sprite(c,key,x,y,r){
    const image=IM[key+'1'];
    if(!image?.complete||!image.naturalWidth)return false;
    c.drawImage(image,x-r,y-r,r*2,r*2);
    return true;
  }

  function star(c,x,y,r,color){
    const points=Array.from({length:8},(_,i)=>{
      const theta=i*Math.PI/4, reach=i%2?r*.29:r;
      return [x+Math.sin(theta)*reach,y+Math.cos(theta)*reach];
    });
    thPoly(c,points,color);
  }

  function meadow(c,t,snow=false){
    const sky=snow?['#8ea9ea','#d0e2ff','#edf3ff']:['#67b9db','#b5ead9','#fff6c6'];
    c.fillStyle=thGradient(c,0,0,0,height,sky);
    c.fillRect(0,0,width,height);
    const terrain=snow?['#dce8fc','#bdcdeb','#a7badb']:['#b2ce72','#86b56b','#5d9764'];
    thGlow(c,149,97,64,snow?'#e4f2ff90':'#fff1abbb');
    disk(c,149,97,snow?26:37,snow?'#fbfdff':'#fff4ab');
    for(let i=0;i<5;i++){
      const x=(((i*231+t*5)%1110)+1110)%1110-85,y=53+i%3*42;
      c.globalAlpha=.48;
      thEllipse(c,x,y,78,16,'#ffffff');
      thEllipse(c,x-22,y-10,39,15,'#ffffff');
    }
    c.globalAlpha=1;
    thPoly(c,[[0,293],[75,203],[151,255],[221,190],[271,241],[340,169],[440,260],
      [550,193],[608,267],[742,185],[865,205],[960,244],[960,height],[0,height]],terrain[0]);
    thPoly(c,[[0,328],[148,272],[250,279],[362,322],[512,275],[693,301],[855,245],[960,278],
      [960,height],[0,height]],terrain[1]);
    thPoly(c,[[0,393],[110,347],[290,378],[444,350],[635,375],[814,340],[960,372],[960,height],[0,height]],
      thGradient(c,0,340,0,540,[terrain[1],terrain[2]]));
    for(let i=0;i<18;i++){
      const x=(i*97+63)%960,y=270+(i*17)%90,r=6+i%4*2;
      if(snow){
        thPoly(c,[[x-r,y+6],[x,y-14],[x+r,y+6]],'#7397b1','#d9ebff',1);
      }else{
        line(c,[[x,y+12],[x,y-2]],'#40644f',2);
        thEllipse(c,x,y-3,r,r*.9,i%3?'#689957':'#4f8b65');
        if(i%2===0)thEllipse(c,x-3,y-8,r*.6,r*.5,'#b1cb7d');
      }
    }
    for(let i=0;i<66;i++){
      const x=(i*109+29)%960,y=365+(i*79)%173;
      if(snow)disk(c,(x+t*(i%4+6))%960,y,1.6+i%2*.6,'#ffffffac');
      else thEllipse(c,x,y,2+i%5,.8,i%3?'#38694255':'#fbe69d9c');
    }
  }

  const palettes={
    lobby:{sky:['#171d40','#4e3972','#211c36'],floor:['#3d3557','#1d233c'],trim:'#9c82c7',glow:'#e1bb92'},
    halloween:{sky:['#1f132f','#703b63','#341b32'],floor:['#58374e','#231a36'],trim:'#da826b',glow:'#ffba69'},
    volcano:{sky:['#2a1728','#8d3b50','#321b32'],floor:['#51323c','#25182d'],trim:'#d46861',glow:'#ff8f63'},
    hacker:{sky:['#071e29','#20505b','#152e43'],floor:['#244f58','#101f34'],trim:'#52989c',glow:'#adf6bb'},
    party:{sky:['#181239','#573a84','#29234a'],floor:['#463466','#201b42'],trim:'#916bbd',glow:'#e0a2ff'},
    lab:{sky:['#122c4c','#496185','#28364a'],floor:['#45607b','#1b2d47'],trim:'#739fb9',glow:'#89f6eb'},
    raid:{sky:['#100c27','#2b204b','#2b2347'],floor:['#4c3a63','#251f43'],trim:'#8460a7',glow:'#a4fcd2'},
    future:{sky:['#1b2f52','#555690','#393b64'],floor:['#516381','#243453'],trim:'#87a6d1',glow:'#b9e8ff'}
  };

  function drawBackdrop(c,theme,t=0){
    c.save();
    const time=motion.matches?0:t;
    if(theme==='meadow'||theme==='snow'){
      meadow(c,time,theme==='snow');
      c.restore();
      return;
    }
    const palette=palettes[theme]??palettes.future;
    c.fillStyle=thGradient(c,0,0,0,height,palette.sky);
    c.fillRect(0,0,width,height);
    thGlow(c,726,133,237,palette.glow+'68');
    disk(c,726,133,56,palette.glow+'42',palette.glow+'a8',1.8);
    for(let i=0;i<30;i++){
      const x=(i*173+20+time*(i%3-1)*3)%width,y=(i*137+14)%253;
      if(i%8===0)star(c,x,y,4,palette.glow+'70');
      else thEllipse(c,x,y,1.5,1,palette.glow+'68');
    }
    const horizon=315;
    for(let i=0;i<12;i++){
      const x=i*90-18+(i%3)*5,y=horizon-70-(i*57)%111,w=41+i%3*18;
      thPoly(c,[[x,horizon],[x+4,y+17],[x+w*.5,y],[x+w,y+18],[x+w-5,horizon]],
        i%2?'#131b338e':'#232843a8',palette.trim+'4c',1);
      for(let row=0;row<3;row++){
        if(i%3!==1)rounded(c,x+18,y+26+row*14,w*.32,3,2,palette.glow+'76');
      }
    }
    thPoly(c,[[0,horizon],[960,horizon],[960,height],[0,height]],
      thGradient(c,0,horizon,0,height,palette.floor),palette.trim,1.8);
    for(let i=-7;i<=7;i++)line(c,[[480+i*40,horizon],[480+i*145,height]],palette.trim+'65',1.1);
    for(let i=1;i<8;i++){
      const row=horizon+i*i*4;
      line(c,[[0,row],[960,row]],palette.trim+'65',1.1);
    }
    if(theme==='lobby')lobbyDetails(c,palette);
    if(theme==='hacker'||theme==='lab')workbenches(c,theme==='lab',time);
    if(theme==='volcano')lava(c,time);
    if(theme==='raid'||theme==='future')riftDetails(c,theme==='raid',time);
    if(theme==='halloween')pumpkinDetails(c,time);
    if(theme==='party')partyDetails(c,time);
    c.restore();
  }

  function lobbyDetails(c,palette){
    for(const x of [87,872]){
      rounded(c,x-54,144,108,165,11,'#30294d',palette.trim,4);
      rounded(c,x-44,156,88,139,7,'#241b42','#e0b0f895',2);
      for(let j=0;j<5;j++){
        const y=177+j*21;
        line(c,[[x-36,y],[x+36,y]],'#b88ad8',1.3);
        const object=(j*19)%46-20;
        rounded(c,x+object,y-14,13,12,2,j%2?'#78b7dc':'#edb76f');
      }
    }
    rounded(c,382,261,196,36,7,'#312448','#9771c8',2);
    label(c,'ВЕРИТИЯ',480,285,{align:'center',color:'#f8d9ab',size:17});
  }

  function workbenches(c,lab,t){
    for(const x of [101,825]){
      rounded(c,x-50,214,100,78,8,'#152e44','#76a8ad',2.7);
      rounded(c,x-40,225,80,54,4,'#123c4a',lab?'#a6fff4':'#83df9e',1);
      for(let i=0;i<4;i++){
        const length=18+((i*27+Math.floor(t*5)*6)%48);
        line(c,[[x-31,236+i*10],[x-31+length,236+i*10]],lab?'#83fff4a0':'#8afeb4aa',2);
      }
      rounded(c,x-62,288,124,27,8,'#23384a','#5a9da4',2);
    }
  }

  function lava(c,t){
    for(let i=0;i<17;i++){
      const x=(i*103+t*10)%width,y=307-(i*57+t*12)%240;
      thEllipse(c,x,y,2+i%4,1.5,'#ffd5acaa');
    }
    thPoly(c,[[658,314],[738,210],[777,202],[858,313]],'#4a293e','#cf5d68',2.7);
    line(c,[[758,219],[732,254],[753,277],[706,322]],'#fa9b66',5);
  }

  function riftDetails(c,raid,t){
    const x=raid?784:866;
    world.portal(c,x,242,raid?72:57,t,raid?1:.85,true);
    for(let i=0;i<5;i++){
      const ix=672+i*43, y=181+Math.sin(t*1.5+i)*14+i%2*26;
      world.crystal(c,ix,y,9+i%3*2,raid?'#86f4a7':'#98d7ff',.2*i);
    }
  }

  function pumpkinDetails(c,t){
    for(const [x,y,r] of [[130,278,39],[834,281,34],[897,292,25]]){
      thGlow(c,x,y,r*1.9,'#ffa05c41');
      thEllipse(c,x,y,r,r*.65,'#ed864e');
      thEllipse(c,x+3,y,r*.77,r*.61,'#ffa958');
      thPoly(c,[[x-21,y-4],[x-9,y-13],[x-6,y-3]],'#612d42');
      thPoly(c,[[x+9,y-11],[x+19,y-2],[x+6,y-3]],'#612d42');
      line(c,[[x-18,y+8],[x-8,y+13],[x+2,y+8],[x+13,y+11]],'#692b3d',3);
      line(c,[[x,y-24],[x+5,y-31]],'#819573',5);
    }
  }

  function partyDetails(c,t){
    for(let i=0;i<6;i++){
      const x=50+i*169,angle=Math.sin(t*.88+i)*82;
      thPoly(c,[[x-4,0],[x+6,0],[x+angle+78,310],[x+angle-55,310]],
        i%2?'#cea2ff19':'#a2e6ff15');
      disk(c,x,12,9,i%2?'#f6bcce':'#c2d1ff');
    }
    thEllipse(c,480,83,31,31,'#8878ac');
    for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++){
      if(Math.hypot(i,j)>2.6)continue;
      c.fillStyle=(i+j)%2?'#e7c9ff':'#a6c4e7';
      c.globalAlpha=.54+Math.sin(t*2+i+j)*.3;
      c.fillRect(475+i*10,78+j*10,8,8);
    }
    c.globalAlpha=1;
  }

  function paper(c,progress){
    rounded(c,-58,-61,116,122,7,'#e8d2ac','#875557',1.9);
    thPoly(c,[[-58,39],[-49,59],[-58,59]],'#875557');
    for(let j=0;j<6;j++)line(c,[[-46,-42+j*16],[45,-42+j*16]],'#bd927ba6',1);
    const p=Math.max(0,Math.min(1,progress)), radius=30,cx=-4,cy=-2;
    if(p>0){
      thShape(c,path=>path.arc(cx,cy,radius,-Math.PI/2,-Math.PI/2+circle*p),null,'#8d555e',2);
    }
    if(p>.5){
      disk(c,cx-10,cy-5,2.9,'#8d555e');
      disk(c,cx+10,cy-5,2.9,'#8d555e');
    }
    if(p>.8){
      thShape(c,path=>path.arc(cx,cy+2,12,.1,Math.PI-.1),null,'#8d555e',2.2);
      line(c,[[-34,42],[18,42],[27,37]],'#b66f65',2);
    }
  }

  function smallGameScreen(c,x,y,w,h,t,active,stamp){
    c.save();
    c.translate(x,y);
    c.scale(w/300,h/180);
    rounded(c,0,0,300,180,5,'#142d43');
    rounded(c,7,8,286,25,5,'#374061');
    label(c,stamp??'SPRUNKI VERITY TD',150,25,{align:'center',size:13,mono:true,color:'#ebd5ff'});
    c.beginPath();c.rect(8,39,284,129);c.clip();
    for(let row=0;row<7;row++)for(let col=0;col<13;col++){
      c.fillStyle=(col+row)%2?'#8cbc7b':'#9aca83';
      c.fillRect(8+col*23,38+row*22,22,21);
    }
    const path=[[8,73],[84,73],[84,131],[173,131],[173,83],[247,83],[247,133],[294,133]];
    line(c,path,'#656846',21);
    line(c,path,'#c9aa72',15);
    sprite(c,'verity',62,96,16);
    sprite(c,'lovity',142,106,17);
    if(active){
      const cycle=(t*60)%135, x1=Math.min(84,15+cycle),y1=73+Math.max(0,cycle-69)*.8;
      disk(c,x1,y1,8,'#7c557c','#e7a4d1',1.3);
      if(cycle%31<15)line(c,[[68,94],[x1,y1]],'#fff3ab',2.5);
    }
    c.restore();
  }

  function room(c,t,scene){
    c.fillStyle=thGradient(c,0,0,0,height,['#382947','#66516d','#48304a']);
    c.fillRect(0,0,width,height);
    thGlow(c,286,268,210,'#ffbc9457');
    thGlow(c,624,190,190,'#92bce56a');
    for(let i=0;i<14;i++)line(c,[[i*72,0],[i*72,378]],'#d6a1ba18',1.7);

    rounded(c,109,74,165,237,12,'#291f38','#ad81a1',4);
    rounded(c,123,87,138,209,9,thGradient(c,0,87,0,300,['#363665','#62608a','#ba8da3']),'#655579',2);
    disk(c,208,134,25,'#f9cfac');
    for(let i=0;i<13;i++){
      const x=132+((i*57)%115),y=101+((i*109)%171);
      disk(c,x,y,1.3+(i%4)*.4,'#f4dfbf');
    }
    for(let i=0;i<6;i++){
      c.fillStyle='#342e4d';
      const left=123+i*24,top=225+(i*13)%25;
      c.fillRect(left,top,23,72);
      for(let row=0;row<3;row++)c.fillRect(left+6,top+7+row*15,7,7);
      disk(c,left+10,top+11,1.2,'#edaa7d');
    }
    line(c,[[194,89],[194,296]],'#a17b9b',3);
    line(c,[[124,201],[260,201]],'#a17b9b',3);

    rounded(c,711,104,148,12,5,'#a1839b');
    rounded(c,715,97,145,11,4,'#7d607d','#c59eb2',1.8);
    for(let i=0;i<4;i++){
      const x=730+i*22,h=[34,42,35,54][i];
      rounded(c,x,98-h,18,h,2,['#b36a82','#6b709f','#b88c67','#7a688f'][i],'#daa6ad',1.2);
      line(c,[[x+3,103-h],[x+14,103-h]],'#e5bdaf9c',1.3);
    }
    const frame=scene===6?'ВЕРСИЯ 1.0':'ПРОТОТИП';
    rounded(c,679,143,156,32,3,'#473249','#a98b9f',2);
    label(c,frame,757,164,{align:'center',size:11,mono:true,color:'#dfb8ba'});

    thPoly(c,[[0,369],[960,369],[960,540],[0,540]],thGradient(c,0,369,0,540,['#574153','#30273d']),'#79617a',2);
    for(let i=-6;i<=7;i++)line(c,[[488+i*37,369],[488+i*105,540]],'#ad7f9c31',1.5);
    for(let i=0;i<5;i++){
      const y=369+i*i*9;
      line(c,[[0,y],[960,y]],'#c9939d36',1.5);
    }
    thEllipse(c,500,454,330,30,'#21173095');
    rounded(c,254,339,20,112,4,'#4a374d','#8b6877',2);
    rounded(c,699,339,20,112,4,'#4a374d','#8b6877',2);
  }

  function deskFront(c){
    thPoly(c,[[226,330],[713,330],[749,349],[205,349]],'#b18a83','#c99a85',2);
    rounded(c,208,348,538,12,3,'#806073','#a07a80',1.6);
    thPoly(c,[[546,332],[671,332],[690,341],[537,341]],'#8980a0','#d7aac1',1.6);
    for(let row=0;row<2;row++)for(let col=0;col<11;col++)
      c.fillRect(549+col*11,333+row*4,7,2);
  }

  function computer(c,t,beat){
    rounded(c,494,160,228,164,15,'#39314e','#bca3ba',3.5);
    rounded(c,504,168,208,143,10,'#201e36','#8d889e',3);
    if(beat>=2)smallGameScreen(c,515,177,186,121,t,beat===4||beat===6);
    else{
      rounded(c,515,177,186,121,5,'#21384c');
      for(let i=0;i<5;i++){
        const y=192+i*17,span=13+((i*45+Math.floor(t*11)*7)%111);
        line(c,[[533,y],[533+span,y]],i%3?'#4e9f98':'#9ce6b2',3.5);
      }
    }
    rounded(c,577,321,57,14,4,'#88738f','#b59aa8',2);
    disk(c,696,316,2.5,'#9efac6');
    if(beat===6){
      const progress=Math.min(1,t/3.1);
      rounded(c,530,236,154,46,6,'#283851','#eac2bd',1.8);
      label(c,progress===1?'ОПУБЛИКОВАНО':'ПУБЛИКАЦИЯ',607,253,{align:'center',size:11,mono:true,color:'#f4dbbf'});
      rounded(c,540,261,134,10,4,'#16263c');
      if(progress>0)rounded(c,540,261,134*progress,10,4,'#8df2cb');
    }
  }

  function chip(c,x,y,r,t){
    c.save();c.translate(x,y);c.rotate(Math.sin(t*3)*.12);c.scale(r/25,r/25);
    thGlow(c,0,0,37,'#8affc176');
    rounded(c,-19,-23,38,46,5,'#284851','#9bffd2',2.8);
    for(let i=0;i<4;i++){
      line(c,[[-23,-13+i*9],[-20,-13+i*9]],'#ffc78d',2.3);
      line(c,[[20,-13+i*9],[23,-13+i*9]],'#ffc78d',2.3);
    }
    label(c,'< >',0,4,{align:'center',size:15,mono:true,color:'#c2ffe1'});
    c.restore();
  }

  function drawingScene(c,t,beat){
    room(c,t,beat);
    const typed=beat>=2&&beat!==5;
    const shadow=typed?0:Math.sin(t*3.9);
    const adminX=beat===3||beat===4?386:350;
    const lift=Math.sin(t*2.6)*2;
    if(beat>=3&&beat<=5){
      const leaving=beat===5?Math.max(0,Math.min(1,t/3.7)):0;
      const x=797+leaving*146,y=307+Math.sin(t*3)*6;
      thEllipse(c,x,y+72,56,11,'#241d416e');
      apHacker(c,x,y,64,t,false);
      if(beat===5){
        chip(c,703+leaving*186,314-34*Math.sin(Math.PI*leaving),21,t);
        c.globalAlpha=.28+.35*leaving;
        line(c,[[670,327],[732+leaving*100,305],[800+leaving*94,310]],'#b2ffd0',2.5);
        c.globalAlpha=1;
      }
    }
    thEllipse(c,adminX,377,58,12,'#2a182c7f');
    apAdminity(c,adminX,308+lift,65,t,beat===5?.88:.34,false,false);
    computer(c,t,beat);
    deskFront(c);
    c.save();c.translate(427,333);c.rotate(-.14);
    c.scale(.7,.49);
    const progress=beat===1?Math.min(1,.12+t/2.2):1;
    paper(c,progress);c.restore();
    if(beat===1){
      const a=Math.min(1,t/2.4)*circle;
      const x=427+Math.cos(a)*23,y=324+Math.sin(a)*15;
      line(c,[[381,325+shadow*9],[405,339+shadow*6],[x,y]],'#e3a85f',7);
      disk(c,x,y,5.6,'#ffd194');
      line(c,[[x-11,y-26],[x+3,y+5]],'#f7b170',4.1);
      line(c,[[x+1,y+2],[x+4,y+7]],'#8d475d',2.2);
    }else{
      line(c,[[401,326],[436,348],[546,338+Math.sin(t*13)*1.8]],'#d89a69',6.4);
      disk(c,546,338+Math.sin(t*13)*1.8,6,'#ffcd7e');
    }
    if(beat===5){
      c.fillStyle='rgba(21,17,41,'+Math.max(0,Math.min(.29,(t-.9)*.14))+')';
      c.fillRect(0,0,width,height);
    }
  }

  function portalIntro(c,t){
    world.flashback(c,t);
    const scale=Math.min(135,79+t*12);
    world.portal(c,661,286,scale,t,1,true);
    world.traveler(c,415,346,83,t);
    for(let i=0;i<18;i++){
      const theta=i*2.3999+t*.66, reach=52+i%7*16;
      star(c,661+Math.sin(theta)*reach,294+Math.cos(theta)*reach*1.15,3+i%4,'#c2f9ff98');
    }
  }

  function whiteFlash(c,t,after,end){
    if(motion.matches)return;
    const incoming=after?Math.max(0,1-t/.66):Math.max(0,(t-end+.6)/.6);
    if(!incoming)return;
    c.save();c.globalAlpha=Math.min(.95,incoming*.95);
    c.fillStyle='#f8fdff';c.fillRect(0,0,width,height);c.restore();
  }

  function drawIntro(c,beatIndex,time=0){
    const t=Math.max(0,time), index=Math.max(0,Math.min(intro.length-1,beatIndex));
    const animate=motion.matches?.25:t;
    if(index===0)portalIntro(c,animate);
    else if(index===7){
      drawBackdrop(c,'meadow',animate);
      world.portal(c,633,294,100,animate,1,true);
      world.traveler(c,429,359,57,animate);
      sprite(c,'verity',538,402,27);
      sprite(c,'lovity',728,410,28);
    }else drawingScene(c,animate,index);
    if(index===0||index===7)whiteFlash(c,t,false,intro[index].seconds);
    if(index===1)whiteFlash(c,t,true,intro[index].seconds);
  }

  function drawPaperBoss(c,x,y,r,time=0){
    const t=motion.matches?0:time;
    c.save();c.translate(x,y);c.scale(r/67,r/67);c.rotate(Math.sin(t*2.5)*.11);
    thGlow(c,0,0,81,'#fbc07462');
    thEllipse(c,0,58,68,12,'#59284173');
    thPoly(c,[[-61,-60],[-45,-69],[-38,-63],[-24,-70],[-14,-62],[5,-70],[18,-62],[41,-70],[61,-58],
      [65,34],[39,68],[-8,58],[-42,67],[-65,47]],thGradient(c,-55,-60,55,62,['#fff1c5','#f4c989','#c38e63']),
      '#7d4b5a',4.6);
    thPoly(c,[[39,68],[41,36],[65,34]],'#f9deb1','#9b5556',2.7);
    for(let i=0;i<4;i++){
      const y=-41+i*24;
      line(c,[[-46,y],[46,y]],'#976c7791',1.5);
      if(i===0||i===3)line(c,[[-44,y-7],[-39,y],[-31,y-9]],'#84566c',2.4);
    }
    thPoly(c,[[-41,-28],[-14,-11],[-17,-1],[-42,-12]],'#7b455b');
    thPoly(c,[[16,-12],[42,-27],[41,-12],[23,-3]],'#7b455b');
    thShape(c,p=>p.arc(0,38,28,Math.PI*1.12,Math.PI*1.88),null,'#7b455b',4.5);
    c.restore();
  }

  function drawCrown(c,x,y,r){
    c.save();c.translate(x,y);c.scale(r/55,r/55);
    thGlow(c,0,0,69,'#ffd49381');
    thPoly(c,[[-50,-25],[-26,-7],[-14,-31],[0,-13],[21,-33],[30,-9],[51,-28],[41,19],
      [31,28],[-35,27],[-42,17]],thGradient(c,-50,-32,38,26,['#fff3c8','#eea866','#a95662']),
      '#592d59',5);
    line(c,[[-39,14],[-25,19],[31,19],[41,11]],'#ffeec2',3.3);
    world.crystal(c,0,3,16,'#9cdcff',-.05);
    disk(c,-29,7,4.8,'#deb9fa','#85598a',1.4);
    disk(c,30,7,4.8,'#a5f5da','#577b8f',1.4);
    c.restore();
  }

  function drawBoss(c,x,y,r,time=0,phase=1){
    const t=motion.matches?0:time, active=phase>=2;
    c.save();
    if(active){
      thGlow(c,x,y,r*1.98,'#ff787671');
      for(let i=0;i<7;i++){
        const angle=i*circle/7+t*.85, f=.9+Math.sin(i+t*4)*.12;
        const dx=Math.cos(angle)*r,dy=Math.sin(angle)*r;
        line(c,[[x+dx*f,y+dy*f],[x+dx*1.28-dy*.15,y+dy*1.28+dx*.15],
          [x+dx*1.52,y+dy*1.52]],i%2?'#ffb093':'#e995ec',Math.max(1,r*.04));
      }
    }
    apNeon(c,x,y+(active?Math.sin(t*10)*r*.035:Math.sin(t*2.4)*r*.04),r*(active?1.06:1),t);
    if(active){
      const positions=[[-r*.32,-r*.29],[r*.31,-r*.27]];
      for(const [dx,dy] of positions){
        thGlow(c,x+dx,y+dy,r*.22,'#ff938a84');
        line(c,[[x+dx-r*.08,y+dy+r*.045],[x+dx+r*.07,y+dy-r*.055]],'#ffb58a',r*.065);
      }
    }
    c.restore();
  }

  function drawFuturity(c,x,y,r,phase=1){
    const active=phase>=2, accent=active?'#ffc189':'#b9fff3';
    c.save();c.translate(x,y);c.scale(r/65,r/65);
    thGlow(c,0,0,78,active?'#f7919b78':'#81efea64');
    thShape(c,p=>p.ellipse(0,0,70,42,-Math.PI/5,0,circle),null,'#69c7ee',3.2);
    thShape(c,p=>p.ellipse(0,0,67,39,Math.PI*.31,0,circle),null,'#c9a7ed',2.1);
    disk(c,0,0,50,thGradient(c,-38,-47,42,43,active?['#ffeabf','#f38eab','#735274']:['#d1ffff','#72afdb','#3d507f']),
      '#202e53',4.5);
    thShape(c,p=>p.arc(0,0,45,3.33,5.08),null,accent+'db',3.2);
    thPoly(c,[[-56,6],[-48,-3],[-43,16],[-48,30],[-59,16]],'#48558c',accent,2.1);
    thPoly(c,[[56,6],[48,-3],[43,16],[48,30],[59,16]],'#53618d',accent,2.1);
    rounded(c,-31,-14,62,27,12,'#243253','#e4c8ff',2.4);
    disk(c,-13,-1,4.5,accent);
    disk(c,13,-1,4.5,accent);
    thShape(c,p=>p.arc(0,15,16,.29,Math.PI-.29),null,'#2f3458',3.5);
    for(let i=0;i<7;i++){
      const theta=Math.PI*.16+i*Math.PI*.117;
      const x1=Math.cos(theta)*58,y1=Math.sin(theta)*58;
      const x2=x1*1.093,y2=y1*1.093;
      line(c,[[x1,y1],[x2,y2]],accent,2);
    }
    thPoly(c,[[-14,-65],[14,-65],[7,-52],[0,-46],[-7,-52]],'#434c7b',accent,2.5);
    world.crystal(c,0,-59,10,active?'#fcd9af':'#b4fcfa',0);
    star(c,-60,-37,8,accent);star(c,64,33,6,'#fae2b5');
    c.restore();
  }

  function drawFigurine(c,x,y,r,time=0){
    world.figure(c,x,y,r,motion.matches?0:time);
  }

  window.TimelineArt={intro,drawIntro,drawBackdrop,drawPaperBoss,drawBoss,drawCrown,drawFuturity,drawFigurine};
})();
