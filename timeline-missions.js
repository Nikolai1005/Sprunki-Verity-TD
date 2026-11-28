/* Historical missions use their own compact battlefield and never alter an active TD match. */
(() => {
  'use strict';

  const width=960,height=540;
  const middle=19;
  const firstUnits=['verity','lovity'];
  const units={
    verity:{label:'Verity',cost:55,damage:16,range:156,rate:.69,color:'#ffdf5f'},
    lovity:{label:'Lovity',cost:65,damage:9,range:146,rate:.78,color:'#ff9cce',slow:.68},
    demonity:{label:'Demonity',cost:95,damage:26,range:149,rate:.86,color:'#e18af8'},
    lord:{label:'Lord Verity',cost:98,damage:18,range:172,rate:.92,color:'#f2ab61',aura:true},
    moggity:{label:'Moggity',cost:78,damage:20,range:140,rate:.72,color:'#83d891'},
    pumpkinity:{label:'Pumpkinity',cost:88,damage:20,range:151,rate:.99,color:'#ffa35e',splash:.44},
    phonk:{label:'Phonkity',cost:92,damage:23,range:155,rate:.84,color:'#b2a4ff',splash:.37},
    freezity:{label:'Freezity',cost:84,damage:14,range:151,rate:.7,color:'#a3f6ff',slow:.54},
    simonity:{label:'Simonity',cost:94,damage:23,range:150,rate:.75,color:'#ffec86'},
    chronosity:{label:'Chronosity',cost:107,damage:31,range:160,rate:.92,color:'#87ffe2',slow:.76}
  };
  const themes={
    meadow:['#364027','#947445','#ffffd4'],lobby:['#231c41','#8183a5','#ffdd91'],
    halloween:['#311c32','#997052','#ffc377'],volcano:['#2a1c2a','#8f6559','#ffb783'],
    hacker:['#081b23','#386956','#b0f2cb'],party:['#211a43','#785c97','#fddca8'],
    lab:['#151e3d','#627498','#a7ecff'],snow:['#1b4058','#6388ad','#e2f9ff'],
    raid:['#281833','#805b89','#ffc1d4'],future:['#122041','#526bbb','#b8f8ff']
  };
  const paths=[
    [[-16,192],[273,192],[273,320],[622,320],[622,204],[976,204]],
    [[-16,322],[182,322],[182,201],[447,201],[447,323],[715,323],[715,212],[976,212]],
    [[-16,203],[196,203],[196,327],[427,327],[427,215],[729,215],[729,326],[976,326]],
    [[-16,271],[184,271],[313,189],[594,189],[700,324],[976,324]],
    [[-16,311],[237,311],[336,200],[623,200],[740,305],[976,305]]
  ];
  const terrain=[
    [[150,264],[220,132],[343,250],[385,375],[527,256],[560,373],[680,262],[783,145],[810,272]],
    [[104,245],[237,259],[306,143],[366,265],[516,266],[596,385],[645,257],[778,267],[854,149]],
    [[117,270],[225,262],[282,383],[366,263],[476,269],[578,151],[651,273],[782,268],[865,383]],
    [[147,214],[217,333],[356,254],[426,128],[492,249],[585,252],[658,183],[749,258],[843,383]],
    [[141,242],[235,376],[320,310],[389,146],[495,267],[598,149],[650,271],[761,364],[858,244]]
  ];
  const defaultSpan=45;

  function record(version,title,theme,description,lore,settings={}){
    return {version,title,theme,description,lore,kind:'battle',reward:45,span:defaultSpan,path:0,profile:'mixed',...settings};
  }

  const catalog=[
    record('1.0','Первый запуск','meadow','Поставь Verity и Lovity на лугу. Переживи десять коротких волн и победи Обрывити — оживший листок задач.',
      'До первой волны Админити записывал каждую идею на листке. Так родились первые защитники.',{reward:100,span:84,waves:10,profile:'first',boss:'paper'}),
    record('1.05','След Demonity','lobby','Открой старый ящик. Демонити гарантирован на третьей попытке.',
      'В первых ящиках слышался странный шёпот. Хакерити оставил там след своего кода.',{kind:'crate',reward:35,span:11}),
    record('1.15','Три кода Лорда','lobby','Обыщи лобби, найди три спрятанных кода и передай их Лорду Верити.',
      'За каждую записку Лорд отвечал улыбкой. Теперь он знает, где искать разлом.',{kind:'hunt',reward:100,span:29}),
    record('1.16','Первая полночь','halloween','Сдержи летучих Шумов. Lovity замедляет быстрые цели.',
      'Когда на часах пробило полночь, тыквы загорелись сами по себе.',{path:1,profile:'fast',loan:'pumpkinity'}),
    record('1.17','Лавка ботов','lobby','Охраняй тележку торговца. В середине боя приедет прочный Шум.',
      'Бот-коллекционер скупал лишних Верити и собирал историю игры по крупицам.',{path:3,profile:'heavy',span:48}),
    record('1.18','Всемирный рынок','lobby','Проведи заказ по трём станциям доставки. Ищи путь от мельницы до прилавка.',
      'Код игрока помогал покупателям узнавать друг друга.',{kind:'route',route:['Мельница','Часы','Прилавок'],props:['Мельница','Часы','Фонарь','Прилавок','Ящик'],span:22}),
    record('1.19','Цена одной сделки','party','Удержи вход на рынок, пока лавки закрывают ставни.',
      'Первые сделки пережили немало волн. У каждого Верити появилась своя редкость.',{path:4,profile:'fast',span:48}),
    record('1.20','Первый друг','meadow','Подай сигналы в порядке Привет → В бой → Мост.',
      'В одиночку охраняли дорогу. Вместе стали защищать всю Веритию.',{kind:'signal',sequence:['Привет','В бой','Мост'],choices:['Мост','Привет','Стоп','В бой'],span:20}),
    record('1.21','Жерло вулкана','volcano','Отрази каменный рой. Оранжевые трещины предупреждают, какую позицию подожжёт лава.',
      'Вулкан был первым местом, где волны продолжались даже после победы над боссом.',{path:2,profile:'heavy',rule:'lava',span:55,loan:'moggity'}),
    record('1.22','Питомцы на дежурстве','meadow','Защити Пушистика. Его круг ускоряет огонь ближайших башен.',
      'Пушистик впервые встал рядом с Верити и помог удержать целую волну.',{path:1,profile:'mixed',rule:'pet',span:48}),
    record('1.25','Подарочный код','lobby','Восстанови нарисованный код с коробки. Читай подсказку слева направо.',
      'Коды в Ле́тописи были знаками дружбы. Один из них сохранился на старом подарке.',{kind:'signal',sequence:['Колокол','Луна','Призма','Ключ'],clue:'Колокол звенит у Луны. Под Луной сияет Призма. Ключ спрятан за Призмой.',choices:['Ключ','Луна','Призма','Колокол'],span:26}),
    record('1.26','Почта хранителей','snow','Не пропусти Шумов к почтовому ящику. Некоторые враги прячутся за щитом.',
      'Друзья впервые отправляли друг другу короткие фразы и подарки.',{path:3,profile:'shield',span:46}),
    record('1.28','Три новые формы','lab','Сдержи жвачную волну и танков. Попробуй замедление Lovity и широкую атаку Pumpkinity.',
      'Obesity стал живой стеной, а Gumity показал, что форма может меняться прямо в бою.',{path:4,profile:'mixed',loan:'pumpkinity',span:45}),
    record('1.29','Дежурство вдвоём','snow','Зажги маяк союзника. Рядом с ним башни получают поддержку.',
      'Раньше каждый охранял свою базу. Потом друзья впервые собрались на одном поле.',{path:2,profile:'shield',rule:'ally',span:53}),
    record('1.30','Спаси конфеты','halloween','Останови воров у витрины. Быстрые Шумы особенно опасны после замедленной волны.',
      'Старый Хэллоуин закончился проводами, но последняя конфета осталась в архиве.',{path:0,profile:'fast',loan:'pumpkinity',span:44}),
    record('1.31','Обещание Хакерити','hacker','Расставь воспоминания в порядке Сейф → Площадь → Разлом → Тень.',
      'Посреди танцев Хакерити пообещал вернуться. Это обещание слышал только Админити.',
      {kind:'signal',sequence:['Сейф','Площадь','Разлом','Тень'],choices:['Разлом','Сейф','Тень','Площадь'],span:26}),
    record('1.32','Последний бит','party','Запусти усилитель. Пока идут волны, нажатия в отмеченную долю ускоряют Верити.',
      'Музыка автора стала сердцем вечеринки. Даже Шумы двигались в такт.',{path:3,profile:'fast',rule:'beat',loan:'phonk',span:50}),
    record('1.33','Хакерский пропуск','hacker','Удержи поле до конца и собери отметки пропуска за побеждённых Шумов.',
      'На пропуске осталось странное число. Хакерити использовал его, чтобы прятать подсказки.',{path:1,profile:'shield',span:47}),
    record('1.36','Шкатулка у сцены','party','Верни пропавшие детали к пульту: найди кабель, катушку и пластинку.',
      'Площадь строили как место встреч. Позже под ней нашли старую ветку времени.',
      {kind:'route',route:['Кабель','Катушка','Пластинка'],props:['Катушка','Кабель','Стакан','Пластинка','Кнопка'],span:20}),
    record('1.43','Трещина Хакерити','hacker','Удержи волны и настрой терминал. Сохрани усиление башен, пока 1×1×1×1 не выйдет к повороту. Freezity замедляет босса.',
      'Украденный код узнал первую версию Веритии и открыл портал обратно.',{path:4,profile:'hacker',loan:'freezity',span:71,boss:'rift',rule:'terminal',reward:150}),
    record('1.44','Хакерити возвращается','hacker','Отбей эхо усиленного Хакерити. Укрепляй позиции до второй атаки.',
      'После трещины Хакерити увидел, что усиленный код умеет повреждать и самого создателя.',{path:1,profile:'hacker',loan:'demonity',span:51}),
    record('1.45','Магазин изобретателя','lab','Подбери комплект: укрепи башни кругом поддержки и отрази проверочную волну.',
      'У разработчика впервые появилась мастерская, где игроки могли менять оформление.',{path:3,profile:'mixed',rule:'ally',span:48}),
    record('1.50','Лаборатория слияния','lab','Соедини руны: Жар → Лёд → Время. Корона стабилизирует последнюю руну.',
      'Два знакомых Верити слились в нового защитника. Сломанный код пытался повторить опыт.',
      {kind:'signal',sequence:['Жар','Лёд','Время'],choices:['Холод','Время','Жар','Лёд'],crown:true,span:27}),
    record('1.51','Мировая карта','snow','Прикрой свободу маршрута на снежной карте. Щитовики пробуют пройти через мост.',
      'На мировой карте защитники впервые увидели соседние измерения.',{path:2,profile:'shield',span:50,loan:'freezity'}),
    record('1.52','Летопись Веритии','lobby','Восстанови главы: Рисунок → Код → Луг → Арена.',
      'Странник оставил на полях летописи фразу о будущем. Теперь она ведёт к последнему порталу.',
      {kind:'signal',sequence:['Рисунок','Код','Луг','Арена'],choices:['Арена','Луг','Рисунок','Код'],span:24}),
    record('1.53','Шумный Автобус','meadow','Громкий автобус атакует крайние позиции. Держи башни у поворота.',
      'Вот так на самой тихой дороге появился самый громкий противник.',{path:1,profile:'heavy',rule:'lava',span:52}),
    record('1.54','Редкий Busity','party','Защити билетную кассу, пока Busity увозит пассажиров.',
      'Игроки берегли билеты. Только несколько хранили память о первом стоке.',{path:0,profile:'fast',span:47}),
    record('1.55','Мифический кейс','lab','Кейс Pressity укрепляет ближайшие башни. Удержи противников подальше от него.',
      'Pressity первым испытал силу давления на сбившийся поток времени.',{path:4,profile:'heavy',rule:'pet',span:51}),
    record('1.56','Первая арена абьюза','party','Найди старые дубинку, билет и артефакт. Передай их на стойку.',
      'Игроки впервые бежали по общей арене с джойстиком и никами над головой.',
      {kind:'route',route:['Дубинка','Билет','Артефакт'],props:['Билет','Пульт','Дубинка','Сейф','Артефакт'],span:24}),
    record('1.57','Возвращение автора','party','Поддержи сцену: отбей волны, зажигая музыкальные импульсы в такт.',
      'Вернувшись, Админити не стал стирать старую карту. Он включил на ней свет.',{path:3,profile:'mixed',loan:'phonk',rule:'beat',span:51}),
    record('1.58','Осенний праздник','halloween','Сохрани праздничный стол. Pumpkinity полезен, когда враги собираются вместе.',
      'За одним столом впервые встретились герои из разных версий.',{path:2,profile:'fast',loan:'pumpkinity',span:49}),
    record('1.60','Набег на застолье','halloween','Гости с бронёй пробуют выйти через кухню. Усиль центр поля.',
      'Игроки защищали угощения, пока из разлома высыпала целая армия незваных гостей.',{path:1,profile:'shield',span:49}),
    record('1.64','Раздача на вечеринке','party','Защити дроп от налётов Шумов, пока Админити готовит следующую раздачу.',
      'Старая вечеринка сохранилась в солнечном блике на одной из наград.',{path:4,profile:'mixed',rule:'ally',span:48}),
    record('1.65','Два пульта','party','Заряди музыкальные пульты. Кнопку импульса жми в момент, когда лампы светятся.',
      'Бас и синтезатор вместе открыли проход по запечатанной арене.',{path:0,profile:'fast',loan:'phonk',rule:'beat',span:51}),
    record('1.69','Тикеты вечеринки','lobby','Собери три печати рынка: Трофей → Билет → Сток.',
      'Накопленные тикеты стали памятью о событиях, а не только платой за награду.',
      {kind:'signal',sequence:['Трофей','Билет','Сток'],choices:['Сток','Ящик','Билет','Трофей'],span:23}),
    record('1.70','Две лимитки','halloween','Перехвати глитч-индюшек, пока лавка не потеряла Туркинити.',
      'Возле инвентаря нашли вторую линию кода Хакерити. Она вела к настоящему боссфайту.',{path:3,profile:'hacker',span:53,loan:'demonity'}),
    record('1.72','Собранные воспоминания','future','Совмести страницы Луга, Арены, Сейфа и Будущего с помощью Короны.',
      'То, что казалось обрывками, стало маршрутом через все версии.',
      {kind:'signal',sequence:['Луг','Арена','Сейф','Будущее'],choices:['Сейф','Луг','Будущее','Арена'],crown:true,span:27}),
    record('1.74','Арена боссфайта','raid','Удержи опасный разлом. Корона прерывает оглушающую волну.',
      'Теперь хранители знали, как встречать врага на его территории.',{path:2,profile:'hacker',rule:'lava',boss:'echo',reward:80,span:54,loan:'simonity'}),
    record('1.77','Тюрьма боссов','raid','Сдержи последнюю толпу из Тюрьмы. Прерывай заряды печатью Короны.',
      'Из клетки вынесли обломок часов. Странник позже вставил его в Машину прошлого.',{path:4,profile:'heavy',rule:'lava',span:55,loan:'chronosity'}),
    record('1.79','Замок будущего','future','Сдержи последнюю атаку с помощью временного Chronosity, затем вставь Корону прошлого в портал.',
      'Листок с первой идеей, украденный код и часы собрались в одну линию. Теперь она ведёт дальше.',
      {path:1,profile:'hacker',boss:'final',rule:'seal',crown:true,reward:200,span:64,loan:'chronosity'})
  ].map((mission,index)=>Object.freeze({...mission,number:index+1,waves:mission.waves??(mission.kind==='battle'?3:0)}));
  Object.freeze(catalog);

  const creatureTypes={
    noise:{hp:42,speed:95,color:'#7787b6',radius:18},
    runner:{hp:30,speed:141,color:'#e090a9',radius:15},
    tank:{hp:94,speed:64,color:'#9c9bc5',radius:24},
    shield:{hp:69,speed:84,color:'#88cdc9',radius:21},
    glitch:{hp:67,speed:112,color:'#8affab',radius:18},
    paper:{hp:720,speed:46,color:'#fff2bf',radius:39,boss:true},
    rift:{hp:1250,speed:48,color:'#d3a2ff',radius:59,boss:true},
    echo:{hp:950,speed:50,color:'#ff98d8',radius:42,boss:true},
    final:{hp:1320,speed:44,color:'#97faff',radius:50,boss:true}
  };
  const names={paper:'Обрывити',rift:'1×1×1×1',echo:'Эхо Разлома',final:'Хранитель печати'};
  const profiles={
    first:['noise','noise','runner'],mixed:['noise','runner','tank','noise'],
    fast:['runner','runner','noise','runner'],heavy:['noise','tank','noise','tank'],
    shield:['noise','shield','runner','tank'],hacker:['runner','glitch','shield','noise']
  };
  const huntProps=['Доска задач','Большие часы','Витрина ящиков','Стол Админити','Галерея','Лорд Верити'];
  const huntFragments=new Map([['Большие часы','ВРЕМЯ'],['Стол Админити','ИГРА'],['Галерея','ВЕРИТИ']]);
  const propSymbols=['◇','◷','▣','✧','⬡','♛'];
  const terminalSequence=['Руна','Импульс','Ключ'];
  const terminalChoices=['Импульс','Шум','Ключ','Руна'];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

  function buildPath(index){
    const points=paths[index].map(([x,y])=>({x,y}));
    let length=0;
    const segments=points.slice(1).map((end,i)=>{
      const start=points[i],span=dist(start,end),offset=length;
      length+=span;
      return {start,end,offset,span};
    });
    return {points,length,at(distance){
      const arc=clamp(distance,0,length);
      const leg=segments.find(part=>arc<=part.offset+part.span)??segments.at(-1);
      const rate=(arc-leg.offset)/leg.span;
      return {x:leg.start.x+(leg.end.x-leg.start.x)*rate,y:leg.start.y+(leg.end.y-leg.start.y)*rate};
    }};
  }

  function buildWaves(mission){
    const plan=[];
    const isFirst=mission.number===1;
    const bossDelay=isFirst?63:mission.boss?mission.span-14:0;
    // Follow-up groups fit on one stretch of the road and arrive even if a wave was cleared quickly.
    const step=(mission.boss?bossDelay-8:mission.span-8)/Math.max(1,mission.waves-1);
    for(let wave=1;wave<=mission.waves;wave++){
      const group=profiles[mission.profile];
      const count=isFirst?3+Math.floor(wave/3):4+wave+(mission.number>28?2:0);
      for(let i=0;i<count;i++){
        const type=group[(i+wave+(isFirst?0:mission.number))%group.length];
        plan.push({when:.65+(wave-1)*step+i*(isFirst?.62:.76),type,wave});
      }
    }
    if(mission.boss)plan.push({when:bossDelay,type:mission.boss,wave:mission.waves});
    return plan.sort((a,b)=>a.when-b.when);
  }

  function create(index,options={}){
    const {crown=false,demonity=false,assist=false,reinforce=false,futurity=false,onComplete,onDefeat,onCue}=options;
    const mission=catalog[index];
    if(!mission)throw new RangeError('Unknown historical mission');
    const isBattle=mission.kind==='battle';
    const path=buildPath(mission.path), slots=terrain[mission.path].map(([x,y])=>({x,y,tower:null,stun:0}));
    const keys=mission.number===1?firstUnits:[...firstUnits,
      demonity?'demonity':'moggity',mission.loan??(mission.number<12?'lord':'moggity')].filter((key,i,list)=>list.indexOf(key)===i);
    const baseHealth=mission.number===1?14:12;
    const state={
      elapsed:0,battleTime:0,phase:'ready',coins:isBattle?(mission.number===1?170:mission.boss==='rift'?390:245)+(reinforce?55:0):null,
      health:isBattle?baseHealth:null,maxHealth:isBattle?baseHealth:null,wave:0,selected:keys[0],
      enemies:[],shots:[],effects:[],slots,cursor:0,attempts:0,found:new Set(),step:0,plan:[],
      report:'',result:null,boss:null,bossPhase:0,warning:null,fieldPulse:0,towerPhase:0,phaseMeter:0,freeze:0,freezeCooldown:0,
      stageClock:0,crownUsed:false,shieldOpened:false,kills:0,terminalSolved:false,eventTick:0,freezeLent:false
    };
    const bonusPoint=slots[2];

    function cue(kind){onCue?.(kind)}

    function complete(){
      if(state.result)return;
      state.phase='result';
      state.result={coins:mission.reward,crown:mission.boss==='rift',demonity:mission.kind==='crate',elapsed:Math.round(state.elapsed)};
      cue('success');
      onComplete?.(state.result);
    }

    function defeat(){
      if(state.result)return;
      state.phase='result';
      state.result={defeat:true,elapsed:Math.round(state.elapsed)};
      state.report='Поле потеряно. Переиграй эту миссию.';
      cue('defeat');
      onDefeat?.();
    }

    function begin(){
      if(state.phase!=='ready')return false;
      state.phase='battle';
      state.plan=buildWaves(mission);
      state.report='Волны начались.';
      cue('start');
      return true;
    }

    function putTower(slot){
      if(!isBattle||!['ready','battle','boss'].includes(state.phase)||!slot||slot.tower)return false;
      const tower=units[state.selected];
      if(state.coins<tower.cost){
        state.report='Для '+tower.label+' нужно '+tower.cost+' монет.';
        return false;
      }
      state.coins-=tower.cost;
      slot.tower={key:state.selected,cooldown:.27,shots:0};
      state.report=tower.label+' занимает позицию.';
      cue('place');
      return true;
    }

    function select(key){
      if(!keys.includes(key)||!isBattle||state.result)return false;
      state.selected=key;
      return true;
    }

    function pulse(){
      if(state.phase!=='battle'&&state.phase!=='boss')return false;
      if(state.fieldPulse>0)return false;
      if(mission.rule==='beat'&&state.battleTime%4>1){
        state.report='Лови голубую долю на круге пульта.';
        return false;
      }
      if(!['ally','beat'].includes(mission.rule))return false;
      state.fieldPulse=mission.rule==='beat'?3.2:6;
      state.report=mission.rule==='beat'?'Верити вошли в такт.':'Маяк ускоряет ближайших Верити.';
      cue('ability');
      return true;
    }

    function useFreeze(){
      const eligible=crown&&mission.number>20||futurity;
      if(!eligible||state.freezeCooldown>0||!['battle','boss'].includes(state.phase)||!state.enemies.length)return false;
      state.freeze=futurity?10:3.5;
      state.freezeCooldown=futurity?90:20;
      state.crownUsed=state.crownUsed||crown;
      state.warning=null;
      state.report=futurity?'Futurity остановил время.':'Корона прошлого сдерживает разлом.';
      cue('freeze');
      return true;
    }

    function chooseSequence(choice,sequence,final){
      if(!Array.isArray(sequence))return false;
      if(choice!==sequence[state.step]){
        state.step=choice===sequence[0]?1:0;
        state.report='Символы сбились. Проверь подсказку.';
        cue('miss');
        return false;
      }
      state.step++;
      cue('place');
      if(state.step===sequence.length)final();
      else state.report='Верно. Найди следующий символ.';
      return true;
    }

    function interact(label){
      if(mission.kind==='hunt'){
        if(label==='Лорд Верити'){
          if(state.found.size===3){state.report='Лорд Верити: «Спасибо, хранители!»';complete()}
          else state.report='Лорд Верити: «Вернись с тремя кодами. Ищи там, где они остались с давних пор».';
        }else if(huntFragments.has(label)){
          const word=huntFragments.get(label);
          state.found.add(word);
          state.report='Найден код «'+word+'». '+state.found.size+'/3.';
          cue('place');
        }else state.report='Здесь кода нет. Проверь часы, стол и галерею.';
        return true;
      }
      if(mission.kind==='route'){
        const next=mission.route[state.step];
        if(label!==next){state.report='Сначала найди «'+next+'».';return false}
        state.step++;cue('place');
        if(state.step===mission.route.length)complete();
        else state.report='Станция отмечена. Следующая — «'+mission.route[state.step]+'».';
        return true;
      }
      return false;
    }

    function action(id){
      if(state.result)return false;
      if(id==='start')return begin();
      if(id.startsWith('place-')&&isBattle)return putTower(slots[Number(id.slice(6))-1]);
      if(id.startsWith('prop-')&&(mission.kind==='hunt'||mission.kind==='route')){
        const props=mission.kind==='hunt'?huntProps:mission.props;
        const label=props[Number(id.slice(5))];
        return label?interact(label):false;
      }
      if(id==='crate'&&mission.kind==='crate'&&state.attempts<3){
        state.attempts++;
        state.stageClock=.82;
        state.report=['Призрак шепчет из пустого ящика.','На дне осталась искра Демонити.','Из ящика вышел Demonity.'][state.attempts-1];
        if(state.attempts===3)complete();
        else cue('place');
        return true;
      }
      if(id==='phase'&&state.phaseMeter>=1&&['battle','boss'].includes(state.phase)){
        state.phaseMeter=0;state.towerPhase=7;state.report='Фаза 2: семь секунд усиленного огня.';cue('ability');return true;
      }
      if(id==='pulse')return pulse();
      if(id==='freeze')return useFreeze();
      if(id==='seal'&&state.phase==='seal'&&crown){
        state.crownUsed=true;state.shieldOpened=true;complete();return true;
      }
      if(id.startsWith('symbol-')){
        if(state.phase==='terminal'){
          const choice=terminalChoices[Number(id.slice(7))];
          if(!choice)return false;
          return chooseSequence(choice,terminalSequence,()=>{
            state.phase='boss';
            state.stageClock=0;
            state.terminalSolved=true;
            state.report='Через трещину вырвался 1×1×1×1.';
            cue('rift');
          });
        }
        if(mission.kind==='signal'){
          const choice=mission.choices[Number(id.slice(7))];
          if(!choice)return false;
          return chooseSequence(choice,mission.sequence,()=>{
            if(mission.crown&&!crown){
              state.step=0;state.report='Нужна Корона прошлого. Получи её в трещине Хакерити.';return;
            }
            state.crownUsed=Boolean(mission.crown);
            complete();
          });
        }
      }
      return false;
    }

    function spawn(entry){
      const definition=creatureTypes[entry.type];
      const power=mission.number===1?.58:1+mission.number*.008;
      const scale=entry.type==='paper'?.85:entry.type==='rift'?1:power;
      const enemy={type:entry.type,p:-14,hp:Math.round(definition.hp*scale),max:Math.round(definition.hp*scale),
        x:-14,y:path.points[0].y,slow:0,attackAt:definition.boss?3.7:0,age:0,boss:Boolean(definition.boss)};
      state.enemies.push(enemy);
      if(enemy.boss){
        state.boss=enemy;
        state.bossPhase=1;
        state.report=names[enemy.type]+' вышел на дорогу.';
        cue('boss');
      }
      state.wave=Math.max(state.wave,entry.wave);
    }

    function activateBoss(){
      if(state.stageClock<1.4||state.boss)return;
      const wave=state.plan[state.cursor];
      if(wave?.type==='rift')state.cursor++;
      spawn({type:'rift',wave:mission.waves});
    }

    function kill(enemy){
      enemy.dead=true;
      state.coins+=enemy.boss?36:enemy.type==='tank'?15:11;
      state.phaseMeter=Math.min(1,state.phaseMeter+(enemy.boss?.1:.105));
      state.kills++;
      state.effects.push({x:enemy.x,y:enemy.y,age:0,color:creatureTypes[enemy.type].color});
      if(enemy.boss){state.warning=null;cue('bossDown')}
    }

    function damageEnemy(enemy,damage){
      if(enemy.dead)return;
      const armor=enemy.type==='shield'&&enemy.hp>enemy.max*.46?.67:1;
      enemy.hp=Math.max(0,enemy.hp-damage*armor);
      if(enemy.hp===0)kill(enemy);
    }

    function attack(slot,dt){
      const tower=slot.tower;
      if(!tower||slot.stun>0)return;
      const stats=units[tower.key];
      tower.cooldown=Math.max(0,tower.cooldown-dt);
      if(tower.cooldown>0)return;
      const target=state.enemies.reduce((best,enemy)=>!enemy.dead&&enemy.p>=4&&dist(slot,enemy)<=stats.range&&
        (!best||best.p<enemy.p)?enemy:best,null);
      if(!target)return;
      const nearPet=(mission.rule==='pet'||state.fieldPulse>0&&mission.rule==='ally')&&dist(slot,bonusPoint)<200;
      const nearLord=slots.some(other=>other!==slot&&other.stun<=0&&units[other.tower?.key]?.aura&&dist(slot,other)<172);
      tower.cooldown=stats.rate*(nearPet?.79:1)*(nearLord?.82:1)*(state.fieldPulse>0&&mission.rule==='beat'?.71:1);
      tower.shots++;
      const total=stats.damage*(state.towerPhase>0?1.79:1)*(nearLord?1.11:1)*(tower.key==='demonity'&&tower.shots%6===0?1.6:1);
      damageEnemy(target,total);
      if(stats.slow){
        target.slow=.78;
        target.slowScale=target.boss?.84:stats.slow;
      }
      if(stats.splash){
        for(const enemy of state.enemies){
          if(enemy!==target&&!enemy.dead&&dist(target,enemy)<58)damageEnemy(enemy,total*stats.splash);
        }
      }
      state.shots.push({from:slot,to:{x:target.x,y:target.y},color:stats.color,age:0});
    }

    function targetTowers(enemy){
      const occupied=slots.filter(slot=>slot.tower&&slot.stun<.05);
      if(!occupied.length)return [];
      occupied.sort((a,b)=>dist(a,enemy)-dist(b,enemy));
      const size=enemy.type==='rift'&&state.bossPhase===2?2:1;
      return occupied.slice(0,size);
    }

    function telegraph(enemy,dt){
      if(!enemy.boss||enemy.type==='paper'||state.freeze>0||state.warning)return;
      if(enemy.type==='rift'&&state.bossPhase===1&&enemy.hp<enemy.max*.48){
        state.bossPhase=2;
        state.report='Фаза 2. 1×1×1×1 атакует две башни одновременно!';
        enemy.attackAt=.75;
        state.effects.push({x:enemy.x,y:enemy.y,age:0,color:'#fc75af',large:true});
        cue('phase');
      }
      enemy.attackAt-=dt;
      if(enemy.attackAt>0)return;
      const targets=targetTowers(enemy);
      if(targets.length){
        state.warning={targets,left:state.bossPhase===2?1.12:1.55,duration:state.bossPhase===2?3.35:2.25};
        state.report='Отмеченные башни сейчас оглушит импульс.';
        cue('warn');
      }
      enemy.attackAt=state.bossPhase===2?5.8:8.8;
    }

    function animateWarnings(dt){
      if(state.warning){
        state.warning.left-=dt;
        if(state.warning.left<=0){
          const {targets,duration}=state.warning;
          for(const slot of targets){
            slot.stun=Math.max(slot.stun,duration);
            state.effects.push({x:slot.x,y:slot.y,age:0,color:'#f78fbb'});
          }
          state.warning=null;
          cue('impact');
        }
      }
      if(mission.rule==='lava'){
        const cycle=Math.floor(state.battleTime/13);
        if(cycle>state.eventTick){
          state.eventTick=cycle;
          const target=slots.filter(slot=>slot.tower&&slot.stun<.05)[(mission.number+cycle)%Math.max(1,slots.filter(slot=>slot.tower&&slot.stun<.05).length)];
          if(target&&!state.warning)state.warning={targets:[target],left:1.65,duration:2};
        }
      }
    }

    function enemyUpdate(enemy,dt){
      if(enemy.dead||state.freeze>0)return;
      enemy.age+=dt;
      enemy.slow=Math.max(0,enemy.slow-dt);
      const definition=creatureTypes[enemy.type], speed=definition.speed*(enemy.slow>0?enemy.slowScale:1);
      enemy.p+=speed*dt;
      Object.assign(enemy,path.at(enemy.p));
      telegraph(enemy,dt);
      if(enemy.p>=path.length){
        enemy.dead=true;
        state.health=Math.max(0,state.health-(enemy.boss?state.maxHealth:1));
        cue('impact');
      }
    }

    function battleTick(dt){
      state.stageClock+=dt;
      if(state.phase==='boss')activateBoss();
      else {
        state.battleTime+=dt;
        while(state.cursor<state.plan.length&&state.plan[state.cursor].when<=state.battleTime){
          const event=state.plan[state.cursor];
          if(event.type==='rift')break;
          state.cursor++;spawn(event);
        }
      }
      if(state.freeze<=0)animateWarnings(dt);
      for(const slot of slots){slot.stun=Math.max(0,slot.stun-dt);attack(slot,dt)}
      for(const enemy of state.enemies)enemyUpdate(enemy,dt);
      state.enemies=state.enemies.filter(enemy=>!enemy.dead);
      if(!state.health){defeat();return}
      if(state.enemies.length)return;

      const next=state.plan[state.cursor];
      if(state.phase==='battle'&&next?.type==='rift'&&state.battleTime>=next.when){
        state.phase='terminal';state.step=0;state.report='Терминал в трещине. Активируй символы в указанном порядке.';
        cue('rift');
      }else if(!next&&state.cursor===state.plan.length){
        if(mission.boss==='rift'&&!state.boss)return;
        if(mission.rule==='seal'){
          state.phase='seal';
          state.report='Портал защищён. Установи Корону прошлого.';
          cue('rift');
        }else complete();
      }
    }

    function update(dt){
      if(!Number.isFinite(dt)||dt<=0||state.result)return;
      dt=clamp(dt,0,.1);
      state.elapsed+=dt;
      for(const effect of state.effects)effect.age+=dt;
      state.effects=state.effects.filter(effect=>effect.age<.6);
      for(const shot of state.shots)shot.age+=dt;
      state.shots=state.shots.filter(shot=>shot.age<.15);
      state.freeze=Math.max(0,state.freeze-dt);
      state.freezeCooldown=Math.max(0,state.freezeCooldown-dt);
      state.fieldPulse=Math.max(0,state.fieldPulse-dt);
      state.towerPhase=Math.max(0,state.towerPhase-dt);
      if(state.phase==='battle'||state.phase==='boss')battleTick(dt);
      else if(state.stageClock>0&&mission.kind==='crate')state.stageClock=Math.max(0,state.stageClock-dt);
    }

    const propCenters=[[205,226],[465,182],[739,228],[274,374],[590,370],[807,379]];
    const orderFields=[[380,355],[540,355],[700,355],[230,355]];

    function point(x,y){
      if(state.result||!Number.isFinite(x)||!Number.isFinite(y))return false;
      const spot={x,y};
      if(state.phase==='terminal'||mission.kind==='signal'){
        const i=orderFields.findIndex(([px,py])=>dist(spot,{x:px,y:py})<58);
        return i>=0&&action('symbol-'+i);
      }
      if(isBattle){
        const slot=slots.find(site=>dist(spot,site)<34);
        return putTower(slot);
      }
      if(mission.kind==='crate')return dist(spot,{x:480,y:291})<124&&action('crate');
      const items=mission.kind==='hunt'?huntProps:mission.props;
      const index=propCenters.slice(0,items.length).findIndex(([px,py])=>dist(spot,{x:px,y:py})<74);
      return index<0?false:interact(items[index]);
    }

    function getUI(){
      const actions=[];
      const opt=(id,label,disabled=false)=>actions.push({id,label,disabled});
      const combat=['battle','boss'].includes(state.phase);
      const ready=state.phase==='ready';
      const terminal=state.phase==='terminal';
      if(isBattle&&ready)opt('start','Начать волны',!slots.some(slot=>slot.tower));
      if(combat){
        opt('phase',state.towerPhase>0?'Фаза 2 · '+Math.ceil(state.towerPhase)+' с':'Вторая фаза · '+Math.floor(state.phaseMeter*100)+'%',
          state.phaseMeter<1||state.towerPhase>0);
        if(mission.rule==='ally')opt('pulse','Зажечь маяк',state.fieldPulse>0);
        if(mission.rule==='beat')opt('pulse',state.battleTime%4<=1?'В такт · импульс':'Импульс пульта',state.fieldPulse>0||state.battleTime%4>1);
      }
      if(state.phase==='seal')opt('seal','Вставить Корону',!crown);
      if(terminal)terminalChoices.forEach((choice,i)=>opt('symbol-'+i,choice));
      if(!state.result&&mission.kind==='crate')opt('crate','Открыть ящик · '+state.attempts+'/3');
      if(!state.result&&mission.kind==='hunt')huntProps.forEach((choice,i)=>opt('prop-'+i,choice));
      if(!state.result&&mission.kind==='route')mission.props.forEach((choice,i)=>opt('prop-'+i,choice));
      if(!state.result&&mission.kind==='signal')mission.choices.forEach((choice,i)=>opt('symbol-'+i,choice));

      const hints=terminal?'Руна → Импульс → Ключ':mission.kind==='signal'?
        mission.clue??mission.sequence.join(' → '):mission.kind==='hunt'?'Коды '+state.found.size+'/3':mission.kind==='route'?
        'Станции '+state.step+'/'+mission.route.length:state.phase==='seal'?'Вставь Корону в портал.':
        ready&&isBattle?'Выбери башню, нажми на свободную позицию и начни волны.':mission.description;
      const freezeActive=combat&&(crown&&mission.number>20||futurity);
      return {
        status:state.report||mission.description,details:hints,coins:state.coins,
        health:state.health,maxHealth:state.maxHealth,wave:state.wave,waveCount:mission.waves,
        timer:Math.floor(state.elapsed),bossHP:state.boss?.hp??null,bossMax:state.boss?.max??null,bossPhase:state.bossPhase,
        towers:isBattle&&(ready||combat)?keys.map(key=>({key,label:units[key].label,cost:units[key].cost,selected:key===state.selected,
          disabled:state.coins<units[key].cost})):[],
        slots:isBattle&&(ready||combat)?slots.map((slot,i)=>({id:'place-'+(i+1),label:'Позиция '+(i+1),disabled:Boolean(slot.tower)||state.coins<units[state.selected].cost})):[],
        actions,freeze:freezeActive?{ready:state.freezeCooldown<=0&&Boolean(state.enemies.length),left:Math.ceil(state.freezeCooldown)}:null,
        result:state.result
      };
    }

    function rounded(ctx,x,y,w,h,r,fill,stroke){
      ctx.beginPath();ctx.roundRect(x,y,w,h,r);
      if(fill){ctx.fillStyle=fill;ctx.fill()}
      if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}
    }

    function label(ctx,value,x,y,color,size=20){
      ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font='750 '+size+'px system-ui, sans-serif';ctx.fillText(value,x,y);
    }

    function circle(ctx,x,y,r,color,stroke){
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
      if(color){ctx.fillStyle=color;ctx.fill()}
      if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}
    }

    function line(ctx,from,to,color,w){
      ctx.strokeStyle=color;ctx.lineWidth=w;
      ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();
    }

    function drawEnemy(ctx,enemy){
      const stats=creatureTypes[enemy.type], art=window.TimelineArt;
      const {x,y}=enemy;
      if(x<0)return;
      if(enemy.type==='paper'&&art?.drawPaperBoss)art.drawPaperBoss(ctx,x,y,stats.radius,enemy.age);
      else if(enemy.boss&&art?.drawBoss)art.drawBoss(ctx,x,y,stats.radius,enemy.age,state.bossPhase);
      else{
        const r=stats.radius;
        ctx.globalAlpha=.43;circle(ctx,x,y+3,r+8,stats.color);ctx.globalAlpha=1;
        rounded(ctx,x-r,y-r,r*2,r*2,enemy.type==='runner'?7:13,stats.color,'#20233a');
        if(enemy.type==='shield'){
          ctx.lineWidth=3;ctx.strokeStyle='#dcfcf0';ctx.beginPath();
          ctx.arc(x,y,r+5,-1.15,1.15);ctx.stroke();
        }
        circle(ctx,x-5,y-2,2.8,'#262a3f');circle(ctx,x+5,y-2,2.8,'#262a3f');
        if(enemy.type==='glitch')label(ctx,'×',x,y-11,'#1e5346',11);
      }

      const radius=enemy.boss?55:stats.radius*.93, barY=y+(enemy.boss?stats.radius+13:-stats.radius-12);
      rounded(ctx,x-radius,barY,radius*2,6,3,'#101723b5');
      rounded(ctx,x-radius,barY,radius*2*enemy.hp/enemy.max,6,3,enemy.boss?'#ffb0b4':'#f8e6a4');
    }

    function drawTower(ctx,slot,index,palette){
      const {x,y,tower}=slot;
      const color=tower?units[tower.key].color:palette[2];
      const marked=state.warning?.targets.includes(slot);
      ctx.lineWidth=2;
      circle(ctx,x,y+5,27,'#141a33ab',marked?'#ffb6cf':color+'b8');
      if(!tower){
        if(state.coins>=units[state.selected].cost)circle(ctx,x,y+5,19,'#ffffff13','#ffffff47');
        label(ctx,String(index+1),x,y+5,'#f0edee',16);
      }else{
        const sprite=typeof IM==='object'&&IM[tower.key+(state.towerPhase>0?'2':'1')];
        if(sprite&&sprite.complete&&sprite.naturalWidth)ctx.drawImage(sprite,x-30,y-45,60,60);
        else{
          circle(ctx,x,y-10,21,color,'#151a31');circle(ctx,x-7,y-12,2.8,'#141a31');circle(ctx,x+7,y-12,2.8,'#141a31');
          line(ctx,{x:x-6,y:y-3},{x:x+6,y:y-3},'#23213b',2);
        }
        if(slot.stun>0){
          circle(ctx,x,y-8,27,'#9ca6ffa0','#c9e4ff');
          label(ctx,'◷',x,y-8,'#20153d',31);
        }
      }
      if(marked){
        ctx.lineWidth=3;
        circle(ctx,x,y,33,null,'#ffa2c1');
        label(ctx,'!',x,y-44,'#fa7eaa',23);
      }
    }

    function drawBattle(ctx,palette){
      ctx.lineJoin='round';ctx.lineCap='round';
      for(const [w,color] of [[77,'#10203aab'],[64,palette[1]],[3,palette[2]+'7a']]){
        ctx.strokeStyle=color;ctx.lineWidth=w;
        ctx.setLineDash(w===3?[12,16]:[]);
        ctx.beginPath();
        path.points.forEach((position,i)=>i===0?ctx.moveTo(position.x,position.y):ctx.lineTo(position.x,position.y));
        ctx.stroke();
      }
      ctx.setLineDash([]);
      if(mission.rule==='pet'||mission.rule==='ally'){
        ctx.lineWidth=2;
        circle(ctx,bonusPoint.x,bonusPoint.y,66,palette[2]+'16',palette[2]+'79');
        label(ctx,mission.rule==='pet'?'✧':'◇',bonusPoint.x,bonusPoint.y-48,palette[2],25);
      }
      if(mission.rule==='beat'){
        const active=state.battleTime%4<=1;
        circle(ctx,89,443,37,active?'#5fd5edaa':'#221735',active?'#b1f3ff':'#a67cce');
        label(ctx,'♫',89,443,'#fff3d5',36);
      }
      slots.forEach((slot,i)=>drawTower(ctx,slot,i,palette));
      state.enemies.forEach(enemy=>drawEnemy(ctx,enemy));
      for(const shot of state.shots){
        ctx.globalAlpha=1-shot.age/.15;
        line(ctx,{x:shot.from.x,y:shot.from.y-14},shot.to,shot.color,5);
      }
      for(const effect of state.effects){
        ctx.globalAlpha=1-effect.age/.6;
        ctx.lineWidth=effect.large?6:3;
        circle(ctx,effect.x,effect.y,4+effect.age*(effect.large?110:54),null,effect.color);
      }
      ctx.globalAlpha=1;
      if(state.freeze>0){
        ctx.fillStyle='#aeeaff29';ctx.fillRect(0,0,width,height);
        label(ctx,'ВРЕМЯ ОСТАНОВЛЕНО',width/2,62,'#e3faff',26);
      }
      if(state.phase==='seal')drawOverlay(ctx,'Портал ждёт Корону',palette);
    }

    function drawOverlay(ctx,title,palette){
      ctx.fillStyle='#07111bbb';ctx.fillRect(0,0,width,height);
      rounded(ctx,222,100,516,309,22,'#13172eef',palette[2]);
      label(ctx,title,480,160,palette[2],31);
      window.TimelineArt?.drawCrown?.(ctx,480,273,76);
    }

    function drawPuzzle(ctx,palette){
      const terminal=state.phase==='terminal', choices=terminal?terminalChoices:mission.choices;
      if(terminal)ctx.fillStyle='#070b1aca',ctx.fillRect(0,0,width,height);
      rounded(ctx,166,133,628,277,24,'#111930e8',palette[2]);
      label(ctx,terminal?'Терминал Хакерити':mission.title,480,181,palette[2],29);
      const sequence=terminal?terminalSequence:mission.sequence;
      sequence.forEach((word,i)=>{
        const x=480+(i-(sequence.length-1)/2)*105, verified=i<state.step;
        rounded(ctx,x-43,218,86,45,11,verified?'#5f9f81':'#243154','#86adda');
        label(ctx,verified?word:'◇',x,241,'#fff0d9',19);
      });
      choices.forEach((word,i)=>{
        const [x,y]=orderFields[i];
        rounded(ctx,x-60,y-33,120,66,15,'#3d4c78',palette[2]);
        label(ctx,word,x,y,'#fff6df',19);
      });
      if(mission.crown&&crown)window.TimelineArt?.drawCrown?.(ctx,744,150,45);
    }

    function drawHunt(ctx,palette){
      const items=mission.kind==='hunt'?huntProps:mission.props;
      items.forEach((name,i)=>{
        const [x,y]=propCenters[i];
        const discovered=mission.kind==='hunt'?state.found.has(huntFragments.get(name)):mission.route.slice(0,state.step).includes(name);
        const isLord=name==='Лорд Верити';
        rounded(ctx,x-79,y-43,158,102,18,discovered?'#235d59eb':'#1d2949df',palette[2]);
        const sprite=isLord&&typeof IM==='object'?IM.lord1:null;
        if(sprite?.complete&&sprite.naturalWidth)ctx.drawImage(sprite,x-27,y-40,54,54);
        else label(ctx,discovered?'✓':propSymbols[i],x,y-11,palette[2],30);
        label(ctx,name,x,y+36,'#fff4dc',16);
      });
    }

    function drawCrate(ctx,palette){
      const lift=state.stageClock>0?Math.sin(state.stageClock*9)*9:0;
      const x=480,y=284+lift;
      ctx.lineWidth=2;
      rounded(ctx,x-110,y-67,220,140,21,'#6d314c',palette[2]);
      rounded(ctx,x-127,y-66,254,46,17,'#905571',palette[2]);
      rounded(ctx,x-22,y-37,44,46,10,palette[2],palette[1]);
      label(ctx,state.attempts===3?'✦':'◈',x,y-14,'#392344',29);
      label(ctx,'Demonity',x,y+129,palette[2],29);
    }

    function draw(ctx,w=width,h=height){
      const art=window.TimelineArt, palette=themes[mission.theme];
      ctx.save();ctx.scale(w/width,h/height);
      if(art?.drawBackdrop)art.drawBackdrop(ctx,mission.theme,state.elapsed);
      else{ctx.fillStyle=palette[0];ctx.fillRect(0,0,width,height)}
      ctx.lineWidth=2;
      if(state.phase==='terminal'||mission.kind==='signal')drawPuzzle(ctx,palette);
      else if(isBattle)drawBattle(ctx,palette);
      else if(mission.kind==='crate')drawCrate(ctx,palette);
      else drawHunt(ctx,palette);
      ctx.restore();
    }

    return {mission,state,update,draw,point,select,action,useFreeze,getUI};
  }

  window.TimelineMissions=Object.freeze({catalog,create,middle,width,height});
})();
