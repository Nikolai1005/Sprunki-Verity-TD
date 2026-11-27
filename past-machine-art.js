/* The Time Machine uses the same canvas and character art as the original arena. */
(() => {
  'use strict';

  const full = Math.PI * 2;
  const artCache = new Map();
  const ink = {
    ice: '#9cf5ff', blue: '#50a9ff', violet: '#ba99ff', gold: '#ffca7d',
    rose: '#ff89b5', dark: '#0c122b'
  };
  const rocks = Array.from({length:58}, (_, i) => ({
    x: (i * 227.71 + 182) % 2010, y: (i * 193.63 + 74) % 1410,
    w: 15 + (i * 17) % 76, h: 9 + (i * 13) % 53, i
  }));

  function background(c, width, height, colors) {
    c.fillStyle = thGradient(c, 0, 0, 0, height, colors);
    c.fillRect(0, 0, width, height);
  }

  function circle(c, x, y, radius, fill, stroke, width) {
    thShape(c, p => p.arc(x, y, radius, 0, full), fill, stroke, width);
  }

  function line(c, points, color, width) {
    thPoly(c, points, null, color, width);
  }

  function crystal(c, x, y, size, color, tilt=0) {
    c.save(); c.translate(x,y); c.rotate(tilt); c.scale(size,size);
    thPoly(c,[[0,-1],[.52,-.34],[.38,.52],[0,1],[-.48,.39],[-.56,-.37]],
      thGradient(c,-.6,-.7,.6,.7,['#e0faff',color,'#21173d']),color,.08);
    thPoly(c,[[0,-1],[.04,.17],[-.48,.39],[-.56,-.37]],'#e5faff6b');
    line(c,[[0,-.98],[.04,.17],[.38,.52]],'#fff9',.055);
    c.restore();
  }

  function portal(c, x, y, size, time, charge=1, worn=false) {
    c.save();c.translate(x,y);c.scale(size/100,size/100);
    thEllipse(c,0,62,95,17,'#06101f90');
    thGlow(c,0,0,114,charge>0?'#629eff82':'#8b73cc5c');
    const rim=thGradient(c,-60,-90,65,83,['#e0f5fe','#60789f','#222544']);
    thShape(c,p=>p.ellipse(0,0,57,78,0,0,full),
      thGradient(c,0,-75,0,77,['#10192e','#2a3b65','#162443']),rim,12);
    for(let j=0;j<15;j++){
      if(worn&&(j===2||j===11))continue;
      const a=(j/15)*full, px=Math.cos(a)*61, py=Math.sin(a)*81;
      c.save();c.translate(px,py);c.rotate(a);
      thPoly(c,[[-6,-5],[10,-7],[16,0],[10,7],[-6,5]],j%3===0?ink.gold:'#93aacb','#1b2748',2);
      c.restore();
    }
    c.save();
    thShape(c,p=>p.ellipse(0,0,49,70,0,0,full),'#fff');
    c.clip();
    const color=c.createRadialGradient(0,0,4,0,0,74);
    color.addColorStop(0,charge?'#e9fbff':'#202747');
    color.addColorStop(.35,charge?'#81d2ff':'#30406d');
    color.addColorStop(1,charge?'#222250':'#141a2d');
    c.fillStyle=color;c.fillRect(-51,-74,102,148);
    if(charge>0){
      c.strokeStyle='#d5fbffd5';c.lineWidth=2.4;
      for(let i=0;i<5;i++){
        const angle=time*1.2+i*1.26;
        c.beginPath();c.ellipse(0,0,27+i*5,46+i*4,.24*Math.sin(angle),angle,angle+1.95);c.stroke();
      }
    }else{
      line(c,[[-47,-29],[-10,-9],[-21,17],[16,25],[5,63]],'#c7aeff92',3);
      line(c,[[-10,-9],[23,-19],[34,-53]],'#c7aeff74',2);
    }
    c.restore();
    thShape(c,p=>p.ellipse(0,0,50,71,0,0,full),null,charge?'#baf6ff':'#a6a5d4',2.5);
    for(const s of [-1,1]){
      thPoly(c,[[s*54,38],[s*79,54],[s*83,72],[s*41,72]],'#2e395a','#7896b8',3);
      line(c,[[s*50,64],[s*72,64]],charge?'#8cecff':'#b8a8ef',3);
    }
    c.restore();
  }

  function white(c) {
    background(c,2000,1400,['#fbfdff','#e8f3fc','#ffffff']);
    const haze=c.createRadialGradient(1000,475,30,1000,475,560);
    haze.addColorStop(0,'#ffffff');haze.addColorStop(1,'#ffffff00');
    c.fillStyle=haze;c.fillRect(440,0,1120,1035);
    c.strokeStyle='#87aec027';c.lineWidth=1.4;
    for(let row=60;row<1400;row+=84){c.beginPath();c.moveTo(0,row);c.lineTo(2000,row);c.stroke()}
    for(let col=30;col<2000;col+=84){c.beginPath();c.moveTo(col,0);c.lineTo(col,1400);c.stroke()}
    for(const radius of [175,274,416]){
      thShape(c,p=>p.ellipse(1000,675,radius,radius*.58,0,0,full),null,'#6c9abe2c',2.2);
    }
    for(const r of rocks.slice(0,32)){
      const color=r.i%4===0?'#96c3e4':'#ffffff';
      thEllipse(c,r.x,r.y,3+r.i%4,1+r.i%3,color);
    }
  }

  function stone(c,r,colors) {
    thPoly(c,[[r.x-r.w,r.y+r.h*.3],[r.x-r.w*.38,r.y-r.h],[r.x+r.w*.36,r.y-r.h*.63],
      [r.x+r.w,r.y+r.h*.15],[r.x+r.w*.28,r.y+r.h]],colors[r.i%colors.length],'#6679a338',1);
    line(c,[[r.x-r.w*.38,r.y-r.h],[r.x,r.y],[r.x+r.w*.28,r.y+r.h]],'#8c92c14a',1.4);
  }

  function ruins(c) {
    background(c,2000,1400,['#0b112c','#23244b','#15192e']);
    thGlow(c,1250,300,600,'#5383b66e');
    thGlow(c,515,690,542,'#594c8e57');
    thPoly(c,[[0,680],[288,740],[498,672],[768,720],[1120,641],[1360,722],[1550,565],[1810,640],[2000,590],
      [2000,1400],[0,1400]],thGradient(c,0,620,0,1390,['#383553','#242f4d','#171d34']),'#7b8db55d',4);
    for(const r of rocks){
      if(r.y<660){
        stone(c,r,['#1b1d37','#262948','#302747']);
        line(c,[[r.x-r.w*.38,r.y-r.h],[r.x+r.w*.36,r.y-r.h*.63]],'#91bdc4a1',1.5);
      }else if(r.x<725||r.x>1240||r.y>880){
        stone(c,r,['#24263d','#37425d','#3c3656']);
        if(r.i%4===0)crystal(c,r.x,r.y-r.h*.7,12+r.w*.35,r.i%2?ink.ice:ink.violet,.22);
      }
    }
    const cracks=[[[0,971],[388,905],[620,970],[840,891],[1000,1010],[1294,966],[1502,1097],[2000,1005]],
      [[862,1400],[942,1292],[895,1240],[1050,1150],[1000,1010]],
      [[1470,722],[1517,789],[1380,851],[1502,1097],[1640,1200],[1590,1400]]];
    for(const path of cracks){line(c,path,'#152038',12);line(c,path,'#92a9fc70',2.2)}
  }

  function retroland(c) {
    background(c,2000,1400,['#bceab8','#77b861','#379070']);
    const road=PT0.map(([x,y])=>[x*2.8+32,y*2.9+145]);
    line(c,road,'#855b46',78);
    line(c,road,'#d7ad72',67);
    for(const r of rocks){
      if(r.x>720&&r.x<1240&&r.y>680&&r.y<840)continue;
      thEllipse(c,r.x,r.y,15+r.i%11,8+r.i%8,'#2e7c4a88');
      if(r.i%2===0){
        c.fillStyle='#715341';c.fillRect(r.x-3,r.y-18,6,20);
        thEllipse(c,r.x,r.y-21,14+r.i%9,20+r.i%11,r.i%4?'#368a56':'#4ba963');
      }
    }
  }

  function retrodisco(c) {
    background(c,2000,1400,['#2a173c','#1c1730','#29182c']);
    for(let row=0;row<8;row++)for(let col=0;col<10;col++){
      const palette=['#85447b','#33629d','#8b536c','#3b8089','#744d99'];
      c.fillStyle=palette[(col*2+row*3)%palette.length];
      c.fillRect(500+col*100,330+row*83,97,80);
    }
    c.lineWidth=7;c.strokeStyle='#ffb674';c.strokeRect(489,319,1022,681);
    for(const [x,y] of [[440,340],[1560,340],[440,990],[1560,990]]){
      thShape(c,p=>p.roundRect(x-41,y-71,82,142,14),'#221830','#9d809c',3);
      circle(c,x,y-22,23,'#433657','#e1a6d0',3);
      circle(c,x,y+28,15,'#433657','#9d75a5',3);
    }
  }

  function flashback(c,time) {
    background(c,960,540,['#1b223e','#68566e','#a06e5d']);
    thGlow(c,685,230,290,'#e4a98166');
    thPoly(c,[[0,391],[150,345],[279,352],[364,298],[480,378],[606,309],[760,355],[960,275],
      [960,540],[0,540]],'#3b3948');
    thPoly(c,[[0,432],[150,424],[315,388],[467,430],[612,401],[803,426],[960,391],
      [960,540],[0,540]],'#292b38');
    line(c,[[0,429],[150,422],[315,386],[467,428],[612,399],[803,424],[960,389]],'#d1977b90',2);
    for(let i=0;i<23;i++){
      const x=(i*169)%960,y=(i*281)%303;
      thEllipse(c,x,y,1.5,1.3,'#f7d3a2bb');
    }
    for(let i=0;i<3;i++){
      const x=142+i*109,y=349-i*7;
      thPoly(c,[[x-38,y+22],[x-34,y-2],[x,y-25],[x+36,y-2],[x+38,y+22]],'#5e4e58','#ad7c71',1.4);
      thEllipse(c,x,y+2,7,8,'#ffd08692');
    }
    if(time<1.5)thGlow(c,724,283,180,'#8bd8f369');
  }

  function traveler(c,x,y,size,time=0) {
    c.save();c.translate(x,y+Math.sin(time*2.8)*size*.035);c.scale(size/60,size/60);
    thEllipse(c,0,57,52,12,'#060e2153');
    thGlow(c,0,0,86,'#74bbfb65');
    thPoly(c,[[-54,37],[-43,-35],[-19,-67],[18,-67],[42,-35],[54,37],[34,53],[-31,53]],
      thGradient(c,-44,-65,35,58,['#609dc6','#344d77','#162341']),'#181d34',4);
    thShape(c,p=>p.ellipse(0,-1,39,43,0,0,full),
      thGradient(c,-29,-36,30,34,['#334c72','#15233e','#252044']),'#acdcf2',3);
    for(const side of [-1,1]){
      const eye=side*14;
      thEllipse(c,eye,-7,4.5,8.3,'#ccfbff',side*.1);
      line(c,[[side*44,-34],[side*35,16],[side*47,35]],'#5686a0',2.5);
    }
    thShape(c,p=>{p.moveTo(-12,15);p.quadraticCurveTo(0,23,12,15)},null,'#b1e6f5',2.3);
    thPoly(c,[[-34,38],[-5,43],[34,35],[24,58],[-25,58]],'#276876','#72c8da',2.8);
    crystal(c,0,46,12,ink.ice);
    c.restore();
  }

  const invaderPalettes=[
    ['#c1ebff','#497ca6','#152a46'],['#aefad7','#3a987f','#183548'],
    ['#fdceac','#9e6982','#392743'],['#e6c5ff','#8359ba','#302450'],
    ['#b8fff3','#4eaaa0','#234452'],['#fac8e5','#9b548e','#462344']
  ];

  function invader(c,x,y,size,variant,time=0) {
    const [light,base,dark]=invaderPalettes[variant];
    c.save();c.translate(x,y);c.scale(size/25,size/25);
    thEllipse(c,0,13,21,6,'#070d24a0');
    const outer=variant===2?[[-24,12],[-23,-12],[-13,-20],[13,-20],[23,-12],[24,12],[13,17],[-13,17]]:
      [[-18,10],[-19,-9],[-7,-19],[8,-20],[19,-9],[18,10],[10,15],[-10,15]];
    thPoly(c,outer,thGradient(c,-14,-17,16,15,[light,base,dark]),dark,2.2);
    thShape(c,p=>p.roundRect(-11,-8,22,11,4),dark,base,1.1);
    line(c,[[-6,-3],[6,-3]],light,1.9);
    if(variant===1){
      for(const side of [-1,1])line(c,[[side*14,-3],[side*25,-10],[side*23,6]],light,2);
    }else if(variant===2){
      line(c,[[-18,6],[-11,12],[11,12],[18,6]],light,2.6);
    }else if(variant===3){
      thShape(c,p=>p.ellipse(0,1,25,8,-.31,0,full),null,light,1.8);
      circle(c,0,-15,3,light,dark,1);
    }else if(variant===4){
      line(c,[[0,4],[0,12]],light,2.1);
      line(c,[[-4,8],[4,8]],light,2.1);
    }else if(variant===5){
      for(const side of [-1,1])crystal(c,side*(18+Math.sin(time*3)*2),5,5,light,side*.45);
    }else line(c,[[-7,8],[7,8]],light,1.8);
    c.restore();
  }

  function archon(c,x,y,size,time,phase=0) {
    c.save();c.translate(x,y);c.scale(size/100,size/100);
    const glow=phase===2?ink.rose:phase===1?ink.violet:ink.ice;
    thEllipse(c,0,61,86,18,'#050a1bb0');
    thGlow(c,0,-7,125,glow+'63');
    c.save();c.rotate(time*.23);
    for(let i=0;i<12;i++){
      c.save();c.rotate(i*full/12);
      thPoly(c,[[64,-8],[89,-6],[98,0],[89,6],[64,8]],'#33476a',glow,2.9);
      c.restore();
    }
    circle(c,0,0,74,null,'#718bb6',5);
    c.restore();
    thPoly(c,[[-55,44],[-65,-24],[-39,-59],[0,-68],[39,-59],[65,-24],[55,44],[28,63],[-28,63]],
      thGradient(c,-60,-64,57,58,['#bac9e5','#505881','#1d2144']),'#171a38',5);
    circle(c,0,-3,43,'#1c2444','#9ea4c8',4);
    circle(c,0,-3,34,null,glow+'7f',2.4);
    const hand=-time*.95;
    line(c,[[Math.cos(hand)*30,-3+Math.sin(hand)*30],[0,-3],[0,-25]],glow,3.1);
    circle(c,0,-3,5,glow);
    line(c,[[-48,22],[-26,30],[-17,54]],'#afbae0',2.5);
    line(c,[[48,22],[26,30],[17,54]],'#afbae0',2.5);
    if(phase>0)line(c,[[-17,-63],[-13,-30],[7,-14],[-3,6],[23,32]],glow,3.5);
    for(const side of [-1,1]){
      thPoly(c,[[side*56,1],[side*85,-16],[side*94,21],[side*78,48],[side*55,44]],
        '#2f385c',glow,2.8);
      crystal(c,side*68,26,11,glow,side*.24);
    }
    c.restore();
  }

  function figure(c,x,y,r,time=0) {
    c.save();c.translate(x,y);c.rotate(Math.sin(time*1.5)*.18);c.scale(r/60,r/60);
    thGlow(c,0,0,83,'#88caff7e');
    thPoly(c,[[-29,47],[-21,36],[21,36],[29,47],[26,56],[-26,56]],'#4a5a91',ink.ice,3);
    thPoly(c,[[-15,35],[-9,16],[9,16],[15,35]],'#82d1de','#234e76',3);
    circle(c,0,-6,29,thGradient(c,-24,-29,23,18,['#ebfcff','#5bbdde','#544887']),'#203a62',3);
    for(const eye of [-9,9])thEllipse(c,eye,-7,2.4,4.8,'#223657');
    thShape(c,p=>{p.moveTo(-11,3);p.quadraticCurveTo(0,16,11,3)},null,'#2d3f56',2);
    crystal(c,0,-34,10,ink.gold);
    c.restore();
  }

  function unit(c,x,y,r,phase) {
    c.save();c.translate(x,y);c.scale(r/56,r/56);
    const lit=phase?'#e1c9ff':'#a9f3ff';
    thGlow(c,0,0,68,lit+'75');
    thShape(c,p=>p.ellipse(0,-1,58,40,-.4,0,full),null,'#384a7b',5);
    circle(c,0,0,44,thGradient(c,-25,-35,27,38,phase?['#e4d4ff','#7d6bd6','#352250']:['#edfeff','#78b8dd','#294e88']),
      '#29365a',4);
    for(const s of [-1,1]){
      thEllipse(c,s*14,-3,4.9,8.5,'#242c4e',phase?s*.22:0);
      if(phase)line(c,[[s*8,-12],[s*22,-17]],'#302447',2.7);
    }
    thShape(c,p=>{p.moveTo(-15,11);p.quadraticCurveTo(0,phase?32:24,15,11)},null,'#29335c',3.1);
    thShape(c,p=>p.ellipse(0,-1,58,40,-.4,0,Math.PI),null,lit,3.7);
    thPoly(c,[[-10,-41],[10,-41],[2,-30],[10,-22],[-10,-22],[-2,-30]],ink.gold,'#64517d',2.1);
    c.restore();
  }

  function cover(c) {
    background(c,960,220,['#101a36','#302345','#413159']);
    thGlow(c,755,104,237,'#5997da91');
    for(let i=0;i<40;i++){
      const x=(i*131+449)%960,y=(i*47)%220;
      thEllipse(c,x,y,1.4+(i%3)*.55,1.2,i%6?'#adc2e497':'#ffd4ad');
    }
    for(let j=0;j<3;j++){
      const height=115+j*30;
      const points=Array.from({length:23},(_,i)=>[i*46,height+Math.sin(i*2.23+j)*16+j*i*1.6]);
      thPoly(c,[...points,[1012,220],[0,220]],['#51618736','#30395c','#1b2644'][j]);
    }
    portal(c,765,110,112,.5);
    crystal(c,672,159,13,ink.violet,.5);
    crystal(c,862,64,16,ink.ice,-.33);
    traveler(c,886,176,31);
  }

  function board(path) {
    if(artCache.has('board'))return artCache.get('board');
    const canvas=thCanvas(640,400),c=canvas.getContext('2d');
    background(c,640,400,['#18253f','#272b48','#141d35']);
    thGlow(c,538,188,245,'#6662b23f');
    for(let y=0;y<10;y++)for(let x=0;x<16;x++){
      c.fillStyle=(x+y)%2?'#4b51831a':'#8dd3f014';
      c.fillRect(x*40+1,y*40+1,38,38);
    }
    for(const r of rocks){
      const p={x:r.x*.32,y:r.y*.285,w:r.w*.24,h:r.h*.19,i:r.i};
      stone(c,p,['#232844','#2f3352','#333251']);
      if(r.i%6===0)crystal(c,p.x,p.y-3,5+r.i%6,ink.violet,.35);
    }
    line(c,path,'#131c32',37);
    line(c,path,'#766a9e',32);
    line(c,path,'#444968',26);
    c.setLineDash([2,10]);line(c,path,'#9bd1f38a',2);c.setLineDash([]);
    artCache.set('board',canvas);
    return canvas;
  }

  function field(c,kind) {
    if(!artCache.has(kind)){
      const painters={white,ruins,retroland,retrodisco};
      const canvas=thCanvas(2000,1400);
      painters[kind](canvas.getContext('2d'));
      artCache.set(kind,canvas);
    }
    c.drawImage(artCache.get(kind),0,0);
  }

  window.PastMachineArt={cover,field,flashback,portal,traveler,archon,invader,figure,unit,crystal,board};
})();
