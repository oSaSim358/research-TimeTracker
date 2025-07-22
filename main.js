/* ───────── util ───────── */
const utils={
  uuid:()=>crypto.randomUUID(),
  sanitize:s=>s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])),
  formatDate:d=>`${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`,
  bytesUsed:()=>new Blob(Object.values(localStorage)).size,
  msToMin:ms=>Math.round(ms/60000),
  checkStorage(){
    const lim=4*1024*1024;
    if(this.bytesUsed()>lim*0.9)alert("ローカルストレージがまもなく上限です。バックアップをご検討ください。");
  }
};
const ICONS={edit:'✏️',del:'🗑️'};
let state={running:false,startTime:null,task:"",rafId:null,bgTimer:null};
/* DOM */
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const presetContainer=$("#presetContainer"),
      taskInput=$("#taskInput"),
      timerDisplay=$("#timerDisplay"),
      toggleBtn=$("#toggleBtn"),
      logTbody=$("#logTable tbody"),
      themeSwitch=$("#themeSwitch"),
      iconSun=$("#theme-icon-sun"),iconMoon=$("#theme-icon-moon"),
      modal=$("#modal"),modalTask=$("#modalTask"),modalSec=$("#modalSec"),modalSecRow=$("#modalSecRow");

/* ───────── storage ───────── */
const KEYS={logs:"researchLogs_v3",presets:"researchPresets_v3",theme:"researchTheme_v3"};
const storage={
  logs:()=>JSON.parse(localStorage.getItem(KEYS.logs)||"[]").map(l=>{
    if(!("durationMs" in l)&&"duration"in l){l.durationMs=l.duration*60000;delete l.duration;}
    return l;
  }),
  saveLogs:a=>{localStorage.setItem(KEYS.logs,JSON.stringify(a));utils.checkStorage();},
  presets:()=>JSON.parse(localStorage.getItem(KEYS.presets)||'["研究","論文執筆","実験","資料整理"]'),
  savePresets:a=>localStorage.setItem(KEYS.presets,JSON.stringify([...new Set(a.filter(Boolean))])),
  theme:()=>localStorage.getItem(KEYS.theme)||"light",
  saveTheme:t=>localStorage.setItem(KEYS.theme,t)
};

/* ───────── theme ───────── */
function applyTheme(t){
  document.documentElement.dataset.theme=t;
  iconSun.style.display=t==="dark"?"none":"block";
  iconMoon.style.display=t==="dark"?"block":"none";
}
themeSwitch.onclick=()=>{const n=storage.theme()==="light"?"dark":"light";storage.saveTheme(n);applyTheme(n);};

/* ───────── timer ───────── */
function updateDisplay(){
  const diff=Date.now()-state.startTime,
        h=String(Math.floor(diff/3600000)).padStart(2,"0"),
        m=String(Math.floor(diff/60000)%60).padStart(2,"0"),
        s=String(Math.floor(diff/1000)%60).padStart(2,"0");
  timerDisplay.textContent=`${h}:${m}:${s}`;
  document.title=`${h}:${m}:${s} - ${state.task||"計測中"}`;
}
function rafLoop(){ if(!state.running)return; updateDisplay(); state.rafId=requestAnimationFrame(rafLoop); }

function startTimer(){
  const task=taskInput.value.trim();
  if(!task){alert("作業内容を入力してください。");return;}
  state={...state,running:true,startTime:Date.now(),task};
  toggleBtn.textContent="終了";
  toggleBtn.style.background="var(--danger)";
  taskInput.disabled=true;presetContainer.style.pointerEvents="none";
  rafLoop();
}
function stopTimer(){
  cancelAnimationFrame(state.rafId);clearInterval(state.bgTimer);
  const durationMs=Date.now()-state.startTime;
  if(durationMs>0){
    const logs=storage.logs();
    logs.push({id:utils.uuid(),task:state.task,start:state.startTime,durationMs});
    storage.saveLogs(logs);renderLogs();
  }
  state={running:false,startTime:null,task:"",rafId:null,bgTimer:null};
  toggleBtn.textContent="開始";
  toggleBtn.style.background="var(--accent)";
  taskInput.value="";taskInput.disabled=false;presetContainer.style.pointerEvents="auto";
  timerDisplay.textContent="00:00:00";document.title="研究タイムトラッカー";
}
toggleBtn.onclick=()=>state.running?stopTimer():startTimer();
toggleBtn.style.background="var(--accent)";
/* Enter でトグル */
document.addEventListener("keydown",e=>{ if(e.key==="Enter"&&e.target===document.body)toggleBtn.click();});
/* 背景タブ対策 */
document.addEventListener("visibilitychange",()=>{
  if(!state.running)return;
  if(document.hidden){cancelAnimationFrame(state.rafId);state.bgTimer=setInterval(updateDisplay,1000);}
  else{clearInterval(state.bgTimer);rafLoop();}
});
/* unload 警告 */
window.addEventListener("beforeunload",e=>{if(state.running){e.preventDefault();e.returnValue="";}});

/* ───────── presets ───────── */
function renderPresets(){
  presetContainer.innerHTML="";
  storage.presets().forEach((p,i)=>{
    const b=document.createElement("button");
    b.textContent=p;b.className="preset-btn";b.draggable=true;
    b.style.background=`hsl(${i*60%360} 60% 80%)`;
    presetContainer.appendChild(b);
  });
}
/* D&D 並べ替え */
let dragEl=null;
presetContainer.addEventListener("dragstart",e=>{
  if(e.target.classList.contains("preset-btn")){dragEl=e.target;e.target.classList.add("dragging");}
});
presetContainer.addEventListener("dragover",e=>{
  e.preventDefault();
  const after=[...presetContainer.children].find(c=>c!==dragEl&&e.clientX<=c.getBoundingClientRect().left+c.offsetWidth/2);
  presetContainer.insertBefore(dragEl,after||null);
});
presetContainer.addEventListener("dragend",()=>{
  dragEl.classList.remove("dragging");
  storage.savePresets([...presetContainer.children].map(b=>b.textContent));});
presetContainer.addEventListener("click",e=>{
  if(e.target.classList.contains("preset-btn"))taskInput.value=e.target.textContent;
});
presetContainer.addEventListener("keydown",e=>{
  if(e.key==="Enter"&&e.target.classList.contains("preset-btn")){e.preventDefault();taskInput.value=e.target.textContent;}
});

/* ───────── logs ───────── */
function renderLogs(){
  logTbody.innerHTML="";
  storage.logs().slice().reverse().forEach(l=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td>${utils.formatDate(new Date(l.start))}</td>
      <td>${utils.sanitize(l.task)}</td>
      <td>${utils.msToMin(l.durationMs)}</td>
      <td class="log-actions">
        <button data-e="${l.id}">${ICONS.edit}</button>
        <button data-d="${l.id}">${ICONS.del}</button>
      </td>`;
    logTbody.appendChild(tr);
  });
}
/* 編集・削除 (delegation) */
logTbody.onclick=e=>{
  const id=e.target.closest("button")?.dataset?.e;
  const del=e.target.closest("button")?.dataset?.d;
  if(id) openLogModal(id);
  else if(del) deleteLog(del);
};
function deleteLog(id){
  if(!confirm("削除しますか？"))return;
  storage.saveLogs(storage.logs().filter(l=>l.id!==id));renderLogs();
}

/* ───────── modal ───────── */
let modalCurrentId=null;
function openModal(title,showSec=true){
  $("#modalTitle").textContent=title;
  modalSecRow.style.display=showSec?"":"none";
  modal.classList.add("show");
  modalTask.focus();
}
function closeModal(){ modal.classList.remove("show"); modalCurrentId=null; }
$("#modalCancel").onclick=closeModal;
modal.addEventListener("click",e=>{ if(e.target===modal)closeModal(); });

function openLogModal(id){
  const log=storage.logs().find(l=>l.id===id);
  if(!log)return;
  modalCurrentId=id;
  modalTask.value=log.task;
  modalSec.value=Math.round(log.durationMs/1000);
  openModal("ログを編集",true);
}
$("#modalOK").onclick=()=>{
  /* プリセット編集モード */
  if (modalSecRow.style.display === "none") {   // ←プリセット編集モード
    const arr = modalTask.value
               .split("\n")
               .map(s => s.trim())
               .filter(Boolean);
    storage.savePresets(arr);
    renderPresets();
    closeModal();
    return;
  }
  /* ログ編集モード */
  const task=modalTask.value.trim();
  const sec=parseInt(modalSec.value,10);
  if(!task||sec<0||!Number.isFinite(sec)){alert("内容を確認してください");return;}
  const logs=storage.logs();
  const idx=logs.findIndex(l=>l.id===modalCurrentId);
  if(idx>-1){logs[idx].task=task;logs[idx].durationMs=sec*1000;}
  storage.saveLogs(logs);renderLogs();closeModal();
};

/* プリセット編集ボタン → multi-line modal */
$("#btnEditPresets").onclick=()=>{
  modalCurrentId=null;
  modalTask.value=storage.presets().join("\n");
  modalSecRow.style.display = "none";
  openModal("プリセット編集",false);
};

/* ───────── report ───────── */
$("#btnGenerate").onclick=()=>{
  const s=$("#reportStart").value,e=$("#reportEnd").value;
  if(!s||!e)return alert("期間を選択してください");
  const start=new Date(s),end=new Date(e);end.setHours(23,59,59,999);
  const logs=storage.logs().filter(l=>l.start>=start&&l.start<=end);
  if(!logs.length){$("#reportOutput").value="期間内データなし";return;}
  const weeks={};
  logs.forEach(l=>{
    const idx=Math.floor((l.start-start)/(1000*60*60*24*7));
    const ws=new Date(start);ws.setDate(ws.getDate()+idx*7);
    const key=utils.formatDate(ws);
    weeks[key]??={};
    weeks[key][l.task]=(weeks[key][l.task]||0)+utils.msToMin(l.durationMs);
  });
  let txt="期間\t作業\t時間(分)\n";
  Object.keys(weeks).sort().forEach(k=>{
    const ws=new Date(k),we=new Date(ws);we.setDate(we.getDate()+6);
    const period=`${utils.formatDate(ws)}～${utils.formatDate(we>end?end:we)}`;
    Object.entries(weeks[k]).forEach(([t,m])=>txt+=`${period}\t${t}\t${m}\n`);
  });
  $("#reportOutput").value=txt;
};
$("#btnCopy").onclick=()=>{
  const val=$("#reportOutput").value;
  if(!val){alert("集計を先に実行してください");return;}
  navigator.clipboard.writeText(val).then(()=>alert("コピーしました"));
};

/* ───────── init ───────── */
function init(){
  applyTheme(storage.theme());
  const today=new Date();
  $("#reportStart").valueAsDate=new Date(today.getFullYear(),today.getMonth(),1);
  $("#reportEnd").valueAsDate=new Date(today.getFullYear(),today.getMonth()+1,0);
  renderPresets();renderLogs();utils.checkStorage();
  $$("button,input").forEach(el=>el.setAttribute("tabindex","0"));
}
document.addEventListener("DOMContentLoaded",init);

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js");
}