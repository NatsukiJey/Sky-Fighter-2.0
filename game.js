
"use strict";

/* =========================================
   SKY FIGHTER 2.0 — TO'LIQ O'YIN
========================================= */

const $ = id => document.getElementById(id);
const canvas = $("gameCanvas");
const ctx = canvas.getContext("2d");
const preview = $("previewCanvas");
const pctx = preview.getContext("2d");

const PLANES = [
  {name:"Falcon",price:0,color:"#42caff",hp:100,speed:4.5,damage:20,fire:330,desc:"Yangi uchuvchilar uchun muvozanatli samolyot."},
  {name:"Viper",price:250,color:"#49edac",hp:115,speed:5.4,damage:24,fire:300,desc:"Juda tez va chaqqon jangchi."},
  {name:"Thunder",price:500,color:"#ffd15b",hp:140,speed:4.2,damage:32,fire:390,desc:"Kuchli zarbali og'ir hujumchi."},
  {name:"Shadow",price:800,color:"#a68bff",hp:125,speed:5.8,damage:28,fire:250,desc:"Tezkor, maxfiy uslubdagi samolyot."},
  {name:"Blaze",price:1200,color:"#ff745c",hp:170,speed:4.6,damage:38,fire:310,desc:"Olov rangli kuchli jangchi."},
  {name:"Frost",price:1800,color:"#a6f4ff",hp:210,speed:4.1,damage:42,fire:350,desc:"Sovuq rangli, chidamli samolyot."},
  {name:"Phantom",price:2600,color:"#d8dcff",hp:165,speed:6.5,damage:44,fire:240,desc:"Juda tez uchadi va tez o'q uzadi."},
  {name:"Titan",price:3800,color:"#a1b1c5",hp:300,speed:3.6,damage:58,fire:410,desc:"Zirhli, bardoshli jang mashinasi."},
  {name:"Nova",price:5200,color:"#ff83e1",hp:230,speed:5.2,damage:65,fire:290,desc:"Energiya bilan jihozlangan hujumchi."},
  {name:"Spectre",price:7000,color:"#70ffdc",hp:250,speed:6.2,damage:72,fire:255,desc:"Tezlik va kuch uyg'unligi."},
  {name:"Dragon",price:9500,color:"#ff4e60",hp:350,speed:4.7,damage:85,fire:320,desc:"Ajdarho uslubidagi og'ir jangchi."},
  {name:"Galaxy",price:13000,color:"#8294ff",hp:400,speed:5.4,damage:100,fire:280,desc:"Kosmik texnologiyali qiruvchi."},
  {name:"Destroyer",price:18000,color:"#ffb55e",hp:500,speed:4.4,damage:130,fire:330,desc:"Dushmanga katta zarar yetkazadi."},
  {name:"Omega",price:25000,color:"#e78bff",hp:600,speed:5.7,damage:160,fire:260,desc:"Eng kuchli texnologiyalardan biri."},
  {name:"Apex",price:40000,color:"#ffffff",hp:800,speed:6.3,damage:200,fire:210,desc:"Afsonaviy hangarning eng kuchli jangchisi."}
];

const BOSS_NAMES = [
  "IRON TITAN","VOID HUNTER","STORM LORD",
  "DARK PHANTOM","GALAXY DESTROYER"
];

const THEMES = [
  {top:"#061124",bottom:"#10375a",glow:"#2484d0"},
  {top:"#170d2b",bottom:"#3d205b",glow:"#9a4bff"},
  {top:"#071c1b",bottom:"#15544e",glow:"#32e8c0"},
  {top:"#260f19",bottom:"#622b38",glow:"#ff5c78"},
  {top:"#10132e",bottom:"#303e7b",glow:"#788bff"}
];

let save = loadSave();
let coins = save.coins;
let owned = new Set(save.owned);
let selected = save.selected;
let totalKills = save.totalKills;
let record = save.record;

let running = false;
let paused = false;
let gameOver = false;
let boss = null;
let nextBossAt = (Math.floor(totalKills / 100) + 1) * 100;

let player = null;
let bullets = [];
let enemyBullets = [];
let enemies = [];
let particles = [];
let stars = [];
let keys = Object.create(null);
let pointer = {x:0,y:0,active:false};

let lastTime = 0;
let spawnTimer = 0;
let shotClock = 0;
let enemyShotClock = 0;
let bossSpawnPending = false;
let earnedThisRun = 0;
let killsThisRun = 0;
let audioOn = true;
let audioCtx = null;
let toastTimer = null;
let rafId = 0;
let lastShotSound = 0;

function loadSave() {
  const fallback = {
    coins:0,owned:[0],selected:0,totalKills:0,record:0
  };
  try {
    const data = JSON.parse(localStorage.getItem("skyFighter2Save"));
    if (!data || !Array.isArray(data.owned)) return fallback;
    const valid = data.owned.filter(n =>
      Number.isInteger(n) && n >= 0 && n < PLANES.length
    );
    return {
      coins:Math.max(0,Number(data.coins)||0),
      owned:[...new Set([0,...valid])],
      selected:Math.max(0,Math.min(14,Number(data.selected)||0)),
      totalKills:Math.max(0,Number(data.totalKills)||0),
      record:Math.max(0,Number(data.record)||0)
    };
  } catch {
    return fallback;
  }
}

function persist() {
  try {
    localStorage.setItem("skyFighter2Save",JSON.stringify({
      coins,owned:[...owned],selected,totalKills,record
    }));
  } catch {
    notify("Saqlash imkoni bo'lmadi. Brauzer xotirasini tekshir.");
  }
}

function currentPlane() {
  return PLANES[selected] || PLANES[0];
}

function levelNow() {
  return Math.floor(totalKills/100)+1;
}

function damageMultiplier() {
  return 1+(levelNow()-1)*0.08;
}

function bossMaxHp() {
  return Math.round(700+levelNow()*260);
}

/* ===== OVOZ EFFEKTLARI ===== */

function initAudio() {
  if (!audioOn) return;
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  } catch {}
}

function tone(freq,duration,type="sine",volume=.035,endFreq=null) {
  if (!audioOn) return;
  initAudio();
  if (!audioCtx) return;

  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20,freq),now);
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20,endFreq),now+duration
      );
    }

    gain.gain.setValueAtTime(volume,now);
    gain.gain.exponentialRampToValueAtTime(.001,now+duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now+duration);
  } catch {}
}

function playShoot() {
  const now = performance.now();
  if (now-lastShotSound<100) return;
  lastShotSound=now;
  tone(620,.055,"square",.012,250);
}

function playExplosion(big=false) {
  tone(big?105:170,big?.45:.2,"sawtooth",big?.065:.035,35);
  tone(big?70:260,big?.55:.13,"triangle",.02,45);
}

function playBuy() {
  tone(440,.1,"sine",.035,650);
  setTimeout(()=>tone(700,.12,"sine",.03,900),75);
}

/* ===== INTERFEYS ===== */

function notify(message) {
  const el=$("toast");
  el.textContent=message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove("show"),2200);
}

function updateInfo() {
  const p=currentPlane();
  $("coins").textContent=Math.floor(coins).toLocaleString("en-US");
  $("planeName").textContent=p.name;
  $("planeDesc").textContent=p.desc;
  $("planeHp").textContent=p.hp;
  $("planeDamage").textContent=Math.round(p.damage*damageMultiplier());
  $("planeSpeed").textContent=p.speed.toFixed(1);
  $("planeFire").textContent=(1000/p.fire).toFixed(1)+"/s";
  drawPreview();
}

function updateHUD() {
  $("coins").textContent=Math.floor(coins).toLocaleString("en-US");
  $("level").textContent=levelNow();
  $("kills").textContent=totalKills;
  $("record").textContent=record;
  $("bossIn").textContent=boss ? "BOSS!" :
    Math.max(0,nextBossAt-totalKills);

  $("missionText").textContent=
    `${totalKills%100} / 100 ta dushman`;

  const maxHp=player ? player.maxHp : currentPlane().hp;
  const hp=player ? Math.max(0,player.hp) : maxHp;
  $("hpText").textContent=`${Math.ceil(hp)} / ${maxHp}`;
  $("hpBar").style.width=(100*Math.max(0,hp/maxHp))+"%";
  $("hpBar").style.background=hp/maxHp<.3 ?
    "linear-gradient(90deg,#ff355e,#ff9d65)" :
    "linear-gradient(90deg,#20d994,#9affbd)";

  $("bossHud").classList.toggle("hidden",!boss);
  if (boss) {
    $("bossName").textContent=boss.name;
    $("bossBar").style.width=
      (100*Math.max(0,boss.hp/boss.maxHp))+"%";
    $("bossHpText").textContent=
      `${Math.ceil(boss.hp)} / ${boss.maxHp} HP`;
  }
}

function renderShop() {
  const grid=$("shopGrid");
  grid.replaceChildren();

  PLANES.forEach((p,i)=>{
    const card=document.createElement("article");
    card.className="plane-card"+
      (selected===i?" selected":"");

    const mini=document.createElement("canvas");
    mini.width=240;
    mini.height=112;
    const c=mini.getContext("2d");
    c.fillStyle="#081326";
    c.fillRect(0,0,240,112);
    for(let j=0;j<14;j++){
      c.fillStyle="#ffffff66";
      c.fillRect((j*43+11)%240,(j*27+9)%112,2,2);
    }
    drawPlane(c,120,56,1.05,p.color,false);
    card.appendChild(mini);

    const h=document.createElement("h3");
    h.textContent=`${String(i+1).padStart(2,"0")} · ${p.name}`;
    card.appendChild(h);

    const d=document.createElement("p");
    d.textContent=`${p.desc}\n❤️ ${p.hp} HP · 💥 ${p.damage} zarar · ⚡ ${p.speed} tezlik`;
    card.appendChild(d);

    const price=document.createElement("div");
    price.className="price";
    price.textContent=owned.has(i) ?
      "✓ Xarid qilingan" :
      `🪙 ${p.price.toLocaleString("en-US")}`;
    card.appendChild(price);

    const btn=document.createElement("button");
    btn.textContent=selected===i?"TANLANGAN":
      owned.has(i)?"TANLASH":"SOTIB OLISH";
    if(owned.has(i)) btn.classList.add("owned");
    btn.disabled=selected===i||(!owned.has(i)&&coins<p.price);

    btn.addEventListener("click",()=>{
      if(owned.has(i)){
        selected=i;
        persist();
        updateInfo();
        renderShop();
        notify(p.name+" tanlandi!");
        return;
      }

      if(coins<p.price){
        notify("Tanga yetarli emas!");
        return;
      }

      coins-=p.price;
      owned.add(i);
      selected=i;
      persist();
      updateInfo();
      renderShop();
      playBuy();
      notify(p.name+" sotib olindi!");
    });

    card.appendChild(btn);
    grid.appendChild(card);
  });
}

function openShop() {
  if(running&&!paused){
    paused=true;
    $("pauseScreen").classList.add("hidden");
    cancelAnimationFrame(rafId);
  }
  $("shopModal").classList.remove("hidden");
  renderShop();
}

function closeShop() {
  $("shopModal").classList.add("hidden");
  if(running&&!gameOver){
    paused=false;
    lastTime=performance.now();
    rafId=requestAnimationFrame(loop);
  }
}

function togglePause() {
  if(!running||gameOver||
    !$("shopModal").classList.contains("hidden")) return;

  paused=!paused;
  $("pauseScreen").classList.toggle("hidden",!paused);

  if(paused){
    cancelAnimationFrame(rafId);
  } else {
    lastTime=performance.now();
    rafId=requestAnimationFrame(loop);
  }
}

/* ===== SAMOLYOT CHIZISH ===== */

function drawPlane(c,x,y,size,color,down=false) {
  c.save();
  c.translate(x,y);
  if(down) c.rotate(Math.PI);
  c.scale(size,size);

  c.shadowBlur=15;
  c.shadowColor=color;
  c.fillStyle=color;
  c.beginPath();
  c.moveTo(0,-34);
  c.lineTo(7,-12);
  c.lineTo(31,8);
  c.lineTo(33,17);
  c.lineTo(8,12);
  c.lineTo(7,27);
  c.lineTo(17,34);
  c.lineTo(15,39);
  c.lineTo(0,35);
  c.lineTo(-15,39);
  c.lineTo(-17,34);
  c.lineTo(-7,27);
  c.lineTo(-8,12);
  c.lineTo(-33,17);
  c.lineTo(-31,8);
  c.lineTo(-7,-12);
  c.closePath();
  c.fill();
  c.shadowBlur=0;

  c.fillStyle="#102039";
  c.beginPath();
  c.moveTo(0,-25);
  c.lineTo(5,-8);
  c.lineTo(0,4);
  c.lineTo(-5,-8);
  c.closePath();
  c.fill();

  c.fillStyle="#dffaff";
  c.fillRect(-1.5,-18,3,9);

  c.globalAlpha=.7;
  c.fillStyle="#ffffff";
  c.fillRect(-2,-1,4,17);
  c.globalAlpha=1;

  c.fillStyle=color;
  c.shadowBlur=14;
  c.shadowColor=color;
  c.fillRect(-4,29,8,8);
  c.shadowBlur=0;
  c.restore();
}

function drawPreview() {
  const w=preview.width,h=preview.height;
  const p=currentPlane();
  pctx.clearRect(0,0,w,h);
  const g=pctx.createRadialGradient(w/2,h/2,5,w/2,h/2,135);
  g.addColorStop(0,p.color+"44");
  g.addColorStop(1,"#081326");
  pctx.fillStyle=g;
  pctx.fillRect(0,0,w,h);

  for(let i=0;i<22;i++){
    pctx.fillStyle="#ffffff77";
    pctx.fillRect((i*47+11)%w,(i*31+8)%h,2,2);
  }
  drawPlane(pctx,w/2,h/2+8,1.45,p.color);
}

/* ===== O'YIN BOSHLANISHI ===== */

function resizeCanvas() {
  const r=canvas.getBoundingClientRect();
  if(r.width<1||r.height<1) return;
  canvas.width=Math.round(r.width);
  canvas.height=Math.round(r.height);
  makeStars();

  if(player){
    player.x=Math.min(canvas.width-25,Math.max(25,player.x));
    player.y=Math.min(canvas.height-65,Math.max(150,player.y));
  }
  draw();
}

function makeStars() {
  stars=Array.from({length:120},()=>({
    x:Math.random()*canvas.width,
    y:Math.random()*canvas.height,
    size:Math.random()*1.8+.3,
    speed:20+Math.random()*65,
    alpha:.2+Math.random()*.8
  }));
}

function startGame() {
  cancelAnimationFrame(rafId);
  initAudio();

  const p=currentPlane();
  player={
    x:canvas.width/2,
    y:canvas.height*.76,
    hp:p.hp,
    maxHp:p.hp,
    lastShot:0,
    invulnerable:1.5
  };

  bullets=[];
  enemyBullets=[];
  enemies=[];
  particles=[];
  boss=null;
  bossSpawnPending=false;
  spawnTimer=.5;
  enemyShotClock=0;
  earnedThisRun=0;
  killsThisRun=0;

  running=true;
  paused=false;
  gameOver=false;

  $("startScreen").classList.add("hidden");
  $("pauseScreen").classList.add("hidden");
  $("endScreen").classList.add("hidden");
  $("shopModal").classList.add("hidden");
  $("bossHud").classList.add("hidden");
  $("statusText").textContent="Jang boshlandi!";
  lastTime=performance.now();
  updateHUD();
  rafId=requestAnimationFrame(loop);
}

function endGame() {
  if(gameOver) return;
  gameOver=true;
  running=false;
  paused=false;
  record=Math.max(record,totalKills);
  persist();
  $("finalKills").textContent=killsThisRun;
  $("finalReward").textContent=earnedThisRun.toLocaleString("en-US");
  $("endScreen").classList.remove("hidden");
  playExplosion(true);
  updateHUD();
}

/* ===== DUSHMANLAR VA BOSS ===== */

function spawnEnemy() {
  const level=levelNow();
  const elite=Math.random()<Math.min(.08+level*.012,.35);
  const hp=Math.round((35+level*18)*(elite?2.3:1));

  enemies.push({
    x:35+Math.random()*Math.max(1,canvas.width-70),
    y:-40,
    hp,maxHp:hp,
    speed:(55+Math.random()*45+level*4)*(elite?.8:1),
    radius:elite?23:17,
    elite,
    color:elite?"#ffad58":
      ["#ff667e","#c48cff","#ffdd78"][Math.floor(Math.random()*3)],
    vx:(Math.random()-.5)*45
  });
}

function spawnBoss() {
  if(boss||gameOver) return;
  const maxHp=bossMaxHp();
  const name=BOSS_NAMES[
    Math.floor((totalKills/100)-1)%BOSS_NAMES.length
  ] || BOSS_NAMES[0];

  boss={
    name,
    x:canvas.width/2,
    y:145,
    targetX:canvas.width/2,
    hp:maxHp,
    maxHp,
    radius:43,
    vx:105,
    fireClock:.8,
    specialClock:3.5,
    phase:0
  };

  bullets=[];
  bossSpawnPending=false;
  $("statusText").textContent="⚠️ BOSS KELDI!";
  notify("⚠️ "+name+" paydo bo'ldi!");
  tone(160,.6,"sawtooth",.055,60);
  updateHUD();
}

function killEnemy(index) {
  const e=enemies[index];
  if(!e) return;
  addExplosion(e.x,e.y,e.color,e.elite?24:13);
  playExplosion(false);

  const reward=Math.round((10+levelNow()*2)*(e.elite?2:1));
  coins+=reward;
  earnedThisRun+=reward;
  totalKills++;
  killsThisRun++;

  const newLevel=levelNow();
  if(totalKills%100===0&&!boss){
    bossSpawnPending=true;
    $("statusText").textContent="👑 BOSS JANGI BOSHLANADI!";
  } else if(newLevel>Math.floor((totalKills-1)/100)+1){
    notify("Yangi bosqich "+newLevel+"!");
  } else {
    $("statusText").textContent=`+${reward} tanga`;
  }

  enemies.splice(index,1);
  record=Math.max(record,totalKills);
  persist();
  updateHUD();
}

function damageBoss(amount) {
  if(!boss) return;
  boss.hp-=amount;
  addExplosion(
    boss.x+(Math.random()-.5)*45,
    boss.y+(Math.random()-.5)*35,
    "#ff9b67",2
  );

  if(boss.hp<=0){
    const defeated=boss;
    addExplosion(defeated.x,defeated.y,"#ffbc62",75);
    playExplosion(true);

    const reward=250+levelNow()*100;
    coins+=reward;
    earnedThisRun+=reward;
    boss=null;

    // Boss mag'lub bo'lgach, keyingi 100 ta dushman uchun hisob davom etadi.
    nextBossAt=(Math.floor(totalKills/100)+1)*100;

    persist();
    updateHUD();
    notify("🏆 BOSS YENGILDI! +"+reward+" tanga");
    $("statusText").textContent="🏆 Boss mag'lub bo'ldi!";
  }
}

function shoot(now) {
  const p=currentPlane();
  if(now-player.lastShot<p.fire) return;
  player.lastShot=now;
  const dmg=p.damage*damageMultiplier();

  bullets.push({
    x:player.x,y:player.y-30,vx:0,vy:-620,
    damage:dmg,color:p.color
  });

  if(selected>=4){
    bullets.push({
      x:player.x-14,y:player.y-12,vx:-32,vy:-570,
      damage:dmg*.5,color:p.color
    });
    bullets.push({
      x:player.x+14,y:player.y-12,vx:32,vy:-570,
      damage:dmg*.5,color:p.color
    });
  }

  if(selected>=10){
    bullets.push({
      x:player.x,y:player.y-35,vx:-70,vy:-550,
      damage:dmg*.45,color:"#ffffff"
    });
    bullets.push({
      x:player.x,y:player.y-35,vx:70,vy:-550,
      damage:dmg*.45,color:"#ffffff"
    });
  }
  playShoot();
}

/* ===== PORTLASH ZARRALARI ===== */

function addExplosion(x,y,color,count=12) {
  for(let i=0;i<count;i++){
    const angle=Math.random()*Math.PI*2;
    const speed=35+Math.random()*210;
    particles.push({
      x,y,
      vx:Math.cos(angle)*speed,
      vy:Math.sin(angle)*speed,
      life:.25+Math.random()*.65,
      maxLife:.9,
      size:2+Math.random()*5,
      color,
      glow:Math.random()>.5
    });
  }
}

/* ===== O'YIN FIZIKASI ===== */

function update(dt,now) {
  if(!player) return;

  const p=currentPlane();
  const w=canvas.width,h=canvas.height;
  let dx=0,dy=0;

  if(keys.ArrowLeft||keys.a) dx--;
  if(keys.ArrowRight||keys.d) dx++;
  if(keys.ArrowUp||keys.w) dy--;
  if(keys.ArrowDown||keys.s) dy++;

  if(pointer.active){
    const px=pointer.x-player.x;
    const py=pointer.y-player.y;
    dx=Math.abs(px)>5?Math.sign(px)*Math.min(1,Math.abs(px)/35):0;
    dy=Math.abs(py)>5?Math.sign(py)*Math.min(1,Math.abs(py)/35):0;
  }

  const length=Math.hypot(dx,dy)||1;
  if(dx||dy){
    player.x+=dx/length*p.speed*78*dt;
    player.y+=dy/length*p.speed*78*dt;
  }

  player.x=Math.max(24,Math.min(w-24,player.x));
  player.y=Math.max(120,Math.min(h-65,player.y));
  player.invulnerable=Math.max(0,player.invulnerable-dt);

  if(keys[" "]||keys.Space||keys.fire) shoot(now);

  spawnTimer-=dt;
  if(!boss&&spawnTimer<=0){
    spawnEnemy();
    spawnTimer=Math.max(.32,1.05-levelNow()*.025);
  }

  // O'yinchi o'qlari
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    b.x+=b.vx*dt;
    b.y+=b.vy*dt;

    if(b.y<-30||b.x<-30||b.x>w+30){
      bullets.splice(i,1);
      continue;
    }

    let hit=false;

    if(boss&&Math.hypot(b.x-boss.x,b.y-boss.y)<boss.radius+8){
      damageBoss(b.damage);
      bullets.splice(i,1);
      hit=true;
    }

    if(hit) continue;

    for(let j=enemies.length-1;j>=0;j--){
      const e=enemies[j];
      if(Math.hypot(b.x-e.x,b.y-e.y)<e.radius+5){
        e.hp-=b.damage;
        addExplosion(b.x,b.y,b.color,3);
        bullets.splice(i,1);
        hit=true;
        if(e.hp<=0) killEnemy(j);
        break;
      }
    }
  }

  // Oddiy dushmanlarning harakati va hujumi
  enemyShotClock-=dt;
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];
    e.y+=e.speed*dt;
    e.x+=e.vx*dt;
    if(e.x<e.radius||e.x>w-e.radius) e.vx*=-1;

    if(enemyShotClock<=0&&e.y>0&&e.y<h*.65){
      const vx=player.x-e.x,vy=player.y-e.y;
      const len=Math.hypot(vx,vy)||1;
      const speed=160+levelNow()*5;
      enemyBullets.push({
        x:e.x,y:e.y+12,
        vx:vx/len*speed,vy:vy/len*speed,
        damage:8+levelNow()*1.5
      });
      enemyShotClock=Math.max(.18,.65-levelNow()*.012);
    }

    if(Math.hypot(player.x-e.x,player.y-e.y)<e.radius+14){
      if(player.invulnerable<=0){
        player.hp-=18+levelNow()*2;
        player.invulnerable=.65;
        addExplosion(e.x,e.y,e.color,15);
        playExplosion(false);
        enemies.splice(i,1);
        if(player.hp<=0){endGame();return;}
      }
      continue;
    }

    if(e.y>h+35){
      enemies.splice(i,1);
      if(player.invulnerable<=0){
        player.hp-=5+levelNow();
        if(player.hp<=0){endGame();return;}
      }
    }
  }

  // Boss harakati va o'q uzishi
  if(boss){
    boss.phase+=dt;
    boss.x+=boss.vx*dt;
    if(boss.x<boss.radius+10||boss.x>w-boss.radius-10){
      boss.vx*=-1;
    }

    boss.fireClock-=dt;
    boss.specialClock-=dt;

    if(boss.fireClock<=0){
      const count=levelNow()>=6?5:3;
      for(let i=0;i<count;i++){
        const angle=Math.PI/2+(i-(count-1)/2)*.22;
        const speed=190+levelNow()*4;
        enemyBullets.push({
          x:boss.x,y:boss.y+30,
          vx:Math.cos(angle)*speed,
          vy:Math.sin(angle)*speed,
          damage:14+levelNow()*2
        });
      }
      boss.fireClock=Math.max(.35,.95-levelNow()*.02);
    }

    if(boss.specialClock<=0){
      for(let i=0;i<9;i++){
        const angle=(Math.PI*2*i)/9;
        const speed=135+levelNow()*3;
        enemyBullets.push({
          x:boss.x,y:boss.y,
          vx:Math.cos(angle)*speed,
          vy:Math.sin(angle)*speed,
          damage:12+levelNow()*2
        });
      }
      boss.specialClock=Math.max(1.5,3.8-levelNow()*.04);
      notify("⚠️ Boss maxsus hujum qilmoqda!");
    }

    if(Math.hypot(player.x-boss.x,player.y-boss.y)<boss.radius+20){
      if(player.invulnerable<=0){
        player.hp-=30+levelNow()*3;
        player.invulnerable=.8;
        addExplosion(player.x,player.y,"#ff667e",18);
        if(player.hp<=0){endGame();return;}
      }
    }
  }

  // Dushman o'qlari
  for(let i=enemyBullets.length-1;i>=0;i--){
    const b=enemyBullets[i];
    b.x+=b.vx*dt;
    b.y+=b.vy*dt;

    if(b.y>h+25||b.y<-25||b.x<-25||b.x>w+25){
      enemyBullets.splice(i,1);
      continue;
    }

    if(Math.hypot(player.x-b.x,player.y-b.y)<15){
      if(player.invulnerable<=0){
        player.hp-=b.damage;
        player.invulnerable=.3;
        addExplosion(b.x,b.y,"#ff5577",6);
        if(player.hp<=0){endGame();return;}
      }
      enemyBullets.splice(i,1);
    }
  }

  // Zarrachalar va yulduzlar
  for(let i=particles.length-1;i>=0;i--){
    const a=particles[i];
    a.x+=a.vx*dt;
    a.y+=a.vy*dt;
    a.vx*=Math.max(0,1-dt*.7);
    a.vy*=Math.max(0,1-dt*.7);
    a.life-=dt;
    if(a.life<=0) particles.splice(i,1);
  }

  for(const s of stars){
    s.y+=s.speed*dt;
    if(s.y>h){s.y=0;s.x=Math.random()*w;}
  }

  // Har 100 ta dushmanda boss
  if(bossSpawnPending&&!boss){
    bossSpawnPending=false;
    spawnBoss();
  }

  updateHUD();
}

/* ===== TURFA FONLAR VA GRAFIKA ===== */

function drawBackground() {
  const w=canvas.width,h=canvas.height;
  const theme=THEMES[Math.floor((levelNow()-1)/2)%THEMES.length];

  const g=ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,theme.top);
  g.addColorStop(1,theme.bottom);
  ctx.fillStyle=g;
  ctx.fillRect(0,0,w,h);

  // Uzoqdagi sayyora
  const px=w*.77,py=h*.38,rad=Math.min(w,h)*.18;
  const planet=ctx.createRadialGradient(
    px-rad*.3,py-rad*.3,3,px,py,rad
  );
  planet.addColorStop(0,theme.glow+"aa");
  planet.addColorStop(1,theme.glow+"05");
  ctx.fillStyle=planet;
  ctx.beginPath();
  ctx.arc(px,py,rad,0,Math.PI*2);
  ctx.fill();

  ctx.globalAlpha=.8;
  for(const s of stars){
    ctx.globalAlpha=s.alpha;
    ctx.fillStyle="#ffffff";
    ctx.fillRect(s.x,s.y,s.size,s.size);
  }
  ctx.globalAlpha=1;

  // Pastdagi uchish tezligi chiziqlari
  ctx.globalAlpha=.13;
  ctx.strokeStyle="#b5e8ff";
  ctx.lineWidth=1;
  for(let i=0;i<14;i++){
    const x=(i*79+Math.sin(i)*24)%w;
    const y=(i*117+performance.now()*.08)%h;
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.lineTo(x-3,y+20+levelNow()*2);
    ctx.stroke();
  }
  ctx.globalAlpha=1;
}

function draw() {
  if(!canvas.width||!canvas.height) return;
  const w=canvas.width,h=canvas.height;
  drawBackground();

  // O'yinchi o'qlari
  for(const b of bullets){
    ctx.save();
    ctx.shadowBlur=14;
    ctx.shadowColor=b.color;
    ctx.fillStyle=b.color;
    ctx.fillRect(b.x-2,b.y-10,4,17);
    ctx.fillStyle="#ffffff";
    ctx.fillRect(b.x-1,b.y-8,2,8);
    ctx.restore();
  }

  // Dushman o'qlari
  for(const b of enemyBullets){
    ctx.save();
    ctx.shadowBlur=12;
    ctx.shadowColor="#ff5679";
    ctx.fillStyle="#ff6783";
    ctx.beginPath();
    ctx.arc(b.x,b.y,4.5,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  // Dushman samolyotlari
  for(const e of enemies){
    drawPlane(ctx,e.x,e.y,e.elite?.72:.55,e.color,true);
    const bw=e.elite?44:32;
    ctx.fillStyle="#202b40";
    ctx.fillRect(e.x-bw/2,e.y-25,bw,4);
    ctx.fillStyle="#ff667e";
    ctx.fillRect(e.x-bw/2,e.y-25,bw*Math.max(0,e.hp/e.maxHp),4);
  }

  // Boss
  if(boss){
    const pulse=1+Math.sin(boss.phase*5)*.045;
    ctx.save();
    ctx.globalAlpha=.3;
    ctx.fillStyle="#ff5478";
    ctx.beginPath();
    ctx.arc(boss.x,boss.y,boss.radius*1.6*pulse,0,Math.PI*2);
    ctx.fill();
    ctx.restore();

    drawPlane(ctx,boss.x,boss.y,1.8*pulse,"#ff536e",true);

    ctx.save();
    ctx.strokeStyle="#ffb8c6";
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(boss.x,boss.y,boss.radius*1.35,0,Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  // O'yinchi
  if(player){
    const p=currentPlane();
    if(player.invulnerable<=0||Math.floor(performance.now()/90)%2===0){
      drawPlane(ctx,player.x,player.y,1,p.color,false);
    }
  }

  // Portlashlar
  for(const a of particles){
    ctx.save();
    ctx.globalAlpha=Math.max(0,a.life/a.maxLife);
    ctx.fillStyle=a.color;
    if(a.glow){
      ctx.shadowBlur=12;
      ctx.shadowColor=a.color;
    }
    ctx.fillRect(a.x,a.y,a.size,a.size);
    ctx.restore();
  }
}

function loop(now) {
  if(!running||paused||gameOver) return;
  const dt=Math.min((now-lastTime)/1000,.035);
  lastTime=now;
  update(dt,now);
  draw();

  if(running&&!paused&&!gameOver){
    rafId=requestAnimationFrame(loop);
  }
}

/* ===== KLAVIATURA VA TELEFON ===== */

window.addEventListener("keydown",e=>{
  const k=e.key.length===1?e.key.toLowerCase():e.key;
  if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)){
    e.preventDefault();
  }
  keys[k]=true;
  initAudio();

  if(e.key==="Escape"){
    if(!$("shopModal").classList.contains("hidden")) closeShop();
    else togglePause();
  }
});

window.addEventListener("keyup",e=>{
  const k=e.key.length===1?e.key.toLowerCase():e.key;
  keys[k]=false;
});

window.addEventListener("blur",()=>{
  keys=Object.create(null);
  pointer.active=false;
});

canvas.addEventListener("pointermove",e=>{
  if(e.pointerType==="mouse"&&e.buttons===0){
    const r=canvas.getBoundingClientRect();
    pointer.x=(e.clientX-r.left)*canvas.width/r.width;
    pointer.y=(e.clientY-r.top)*canvas.height/r.height;
    pointer.active=true;
  }
});

canvas.addEventListener("pointerdown",e=>{
  initAudio();
  const r=canvas.getBoundingClientRect();
  pointer.x=(e.clientX-r.left)*canvas.width/r.width;
  pointer.y=(e.clientY-r.top)*canvas.height/r.height;
  pointer.active=true;
  if(e.pointerType!=="mouse") keys.fire=true;
});

canvas.addEventListener("pointerup",()=>{keys.fire=false;});
canvas.addEventListener("pointerleave",e=>{
  if(e.pointerType==="mouse") pointer.active=false;
});

document.querySelectorAll("[data-key]").forEach(btn=>{
  const key=btn.dataset.key;
  const down=e=>{
    e.preventDefault();
    keys[key]=true;
    initAudio();
  };
  const up=e=>{
    e.preventDefault();
    keys[key]=false;
  };
  btn.addEventListener("pointerdown",down);
  btn.addEventListener("pointerup",up);
  btn.addEventListener("pointercancel",up);
  btn.addEventListener("pointerleave",up);
});

$("touchFire").addEventListener("pointerdown",e=>{
  e.preventDefault();
  keys.fire=true;
  initAudio();
});
["pointerup","pointercancel","pointerleave"].forEach(evt=>{
  $("touchFire").addEventListener(evt,()=>{keys.fire=false;});
});

/* ===== TUGMALAR ===== */

$("startBtn").addEventListener("click",startGame);
$("restartBtn").addEventListener("click",startGame);
$("pauseBtn").addEventListener("click",togglePause);
$("resumeBtn").addEventListener("click",togglePause);

$("shopBtn").addEventListener("click",openShop);
$("openShop").addEventListener("click",openShop);
$("pauseShopBtn").addEventListener("click",openShop);
$("endShopBtn").addEventListener("click",()=>{
  $("endScreen").classList.add("hidden");
  openShop();
});
$("closeShop").addEventListener("click",closeShop);

$("shopModal").addEventListener("click",e=>{
  if(e.target===$("shopModal")) closeShop();
});

$("soundBtn").addEventListener("click",()=>{
  audioOn=!audioOn;
  $("soundBtn").textContent=audioOn?"🔊 Ovoz":"🔇 Ovoz";
  if(audioOn){
    initAudio();
    tone(600,.12);
    notify("Ovoz yoqildi");
  } else {
    notify("Ovoz o'chirildi");
  }
});

window.addEventListener("resize",resizeCanvas);

/* ===== ISHGA TUSHIRISH ===== */

resizeCanvas();
updateInfo();
updateHUD();
draw();
