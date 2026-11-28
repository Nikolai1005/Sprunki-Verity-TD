/* Online movement and baton contact for the scheduled 3D arena. */
(() => {
  'use strict';
  const channel='vault-abuse-v1', ageLimit=2800, scale=16;
  const uidPattern=/^[A-Za-z0-9_-]{1,128}$/;
  let frame=null, latest=null, peers={}, busy=false, writing=false, auth=null, uid=null;
  let lastWrite=0, lastAttack=0;
  const seen=new Set();
  const event=()=>VaultAbuse.adminWindow();
  const stage=()=>cur==='vault-abuse'&&VaultAbuse.getFrame();

  function send(type,details={}){
    if(frame&&frame===stage()&&M.past?.vaultRun)
      frame.contentWindow.postMessage({channel,run:M.past.vaultRun,type,...details},location.origin);
  }
  function getName(row){return typeof row.n==='string'?row.n.slice(0,16):'Хранитель'}
  function fresh(row,now,session){
    return row?.pa===session.id&&row.c===2&&Number.isFinite(row.t)&&now-row.t<ageLimit&&row.t<now+3000&&
      Number.isFinite(row.x)&&Number.isFinite(row.y)&&Math.abs(row.x-1000)<=46*scale&&Math.abs(row.y-760)<=41*scale;
  }

  function setup(current){
    if(frame===current)return;
    frame=current;latest=null;peers={};uid=null;lastWrite=0;lastAttack=0;seen.clear();auth=null;
  }

  function authenticate(current){
    if(uid||auth)return;
    auth=onAuth().then(()=>{
      if(frame!==current||!uidPattern.test(ON.uid||''))return;
      uid=ON.uid;
      send('pvp-status',{online:true});
    }).catch(()=>{}).finally(()=>{if(frame===current)auth=null});
  }

  async function sync(){
    const current=stage(),session=event();
    if(!current||!session||!onOk()||ON.ban)return;
    setup(current);
    if(!latest)return;
    if(!uid){authenticate(current);return}
    const now=Date.now();
    if(!writing&&now-lastWrite>=330&&!AR.putTask){
      const state=latest,n=M.fb?.nick||'Хранитель';
      lastWrite=now;writing=true;
      const put=db('arena/p/'+uid,{m:'PUT',b:{
        x:Math.round(1000+state.x*scale),y:Math.round(760+state.z*scale),
        a:M.fb?.fav||'verity',n,cs:csStr(),pa:session.id,c:state.active?2:0,
        s:state.swing?1:0,st:state.stun?1:0,f:state.face<0?-1:1,t:{'.sv':'timestamp'}
      }});
      AR.putTask=put;
      put.then(result=>{if(!result.ok)send('pvp-status',{online:false})}).catch(()=>{}).finally(()=>{
        writing=false;
        if(AR.putTask===put)AR.putTask=null;
      });
    }
    if(busy||!latest.active)return;
    busy=true;
    try{
      const [presence,hits]=await Promise.all([db('arena/p'),db('arena/hits/'+uid)]);
      if(frame!==current||stage()!==current||event()?.id!==session.id)return;
      if(!presence.ok){send('pvp-status',{online:false});return}
      const received=Date.now();
      peers=Object.fromEntries(Object.entries(presence.j||{}).filter(([id,row])=>id!==uid&&uidPattern.test(id)&&fresh(row,received,session)));
      send('pvp-peers',{players:Object.entries(peers).slice(0,32).map(([id,row])=>({
        id,n:getName(row),x:(row.x-1000)/scale,z:(row.y-760)/scale,
        face:row.f===-1?-1:1,swing:row.s===1,stun:row.st===1
      }))});
      if(hits.ok)for(const [id,hit] of Object.entries(hits.j||{})){
        if(seen.has(id)||!uidPattern.test(id)||hit?.pa!==session.id)continue;
        if(seen.size>=160)seen.delete(seen.values().next().value);
        seen.add(id);
        const attacker=peers[hit.f];
        if(latest.active&&attacker&&Number.isFinite(hit.t)&&received-hit.t<2500&&hit.t<received+3000)
          send('pvp-hit',{id:hit.f,n:getName(attacker),x:(attacker.x-1000)/scale,z:(attacker.y-760)/scale});
        db('arena/hits/'+uid+'/'+id,{m:'DELETE'}).catch(()=>{});
      }
    }catch{}
    finally{busy=false}
  }

  addEventListener('message',e=>{
    const current=stage(),data=e.data,session=event();
    if(!current||!session||e.source!==current.contentWindow||e.origin!==location.origin||
       data?.channel!==channel||data.run!==M.past?.vaultRun||!onOk()||ON.ban)return;
    setup(current);
    if(data.type==='pvp-state'){
      if(!Number.isFinite(data.x)||!Number.isFinite(data.z)||Math.abs(data.x)>46||Math.abs(data.z)>41)return;
      latest=data;
      if(!uid)authenticate(current);
      return;
    }
    if(data.type!=='pvp-strike'||!uid||!latest?.active||!uidPattern.test(data.target||''))return;
    const now=Date.now(),target=peers[data.target];
    if(now-lastAttack<680||!fresh(target,now,session)||target.st===1||
       Math.hypot(latest.x-(target.x-1000)/scale,latest.z-(target.y-760)/scale)>4.6)return;
    lastAttack=now;
    const hitId=crypto.randomUUID();
    db('arena/hits/'+data.target+'/'+hitId,{m:'PUT',b:{
      f:uid,pa:session.id,t:{'.sv':'timestamp'}
    }}).then(result=>{if(result.ok)send('pvp-contact',{n:getName(target)})}).catch(()=>{});
  });

  setInterval(sync,420);
  window.VaultPvp={isPublishing:current=>frame===current&&Boolean(uid&&latest)};
})();
