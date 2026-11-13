// Demo only: no authentication, cloud sync, or private data protection yet.
const $=id=>document.getElementById(id);
const key='cozy-planner-demo-v1';
let state;try{state=JSON.parse(localStorage.getItem(key))||{}}catch{state={}}
state.events ||= [];state.tasks ||= [{id:1,name:'完成報告初稿 / Hoàn thành bản nháp',done:true},{id:2,name:'整理下週行程 / Sắp lịch tuần sau',done:false},{id:3,name:'運動 30 分鐘 / Tập thể dục 30 phút',done:false}];state.goals ||= {};
const now=new Date(),pad=n=>String(n).padStart(2,'0');let year=now.getFullYear(),month=now.getMonth(),selected=`${year}-${pad(month+1)}-${pad(now.getDate())}`;
function save(){localStorage.setItem(key,JSON.stringify(state))}
function render(){ $('monthTitle').textContent=`${year} / ${pad(month+1)}`; $('weekdays').innerHTML=['週日/CN','週一/T2','週二/T3','週三/T4','週四/T5','週五/T6','週六/T7'].map(x=>`<div>${x}</div>`).join('');let first=new Date(year,month,1).getDay(),length=new Date(year,month+1,0).getDate(),prev=new Date(year,month,0).getDate();$('days').replaceChildren();for(let i=0;i<Math.ceil((first+length)/7)*7;i++){let day=i-first+1,dt=new Date(year,month,day),date=`${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`,b=document.createElement('button');b.className='day'+(dt.getMonth()!==month?' muted':'')+(date===selected?' selected':'');let n=document.createElement('span');n.className='num';n.textContent=day<1?prev+day:day>length?day-length:day;b.append(n);state.events.filter(e=>e.date===date).slice(0,2).forEach(e=>{let c=document.createElement('span');c.className='chip';c.textContent=`${e.time} ${e.name}`;b.append(c)});b.onclick=()=>{selected=date;render()};$('days').append(b)}$('selectedTitle').textContent=`📅 ${selected} 行程 / Lịch trình`;$('eventList').replaceChildren();let ev=state.events.filter(e=>e.date===selected).sort((a,b)=>a.time.localeCompare(b.time));if(!ev.length){let p=document.createElement('p');p.className='empty';p.textContent='尚無行程 / Chưa có lịch trình';$('eventList').append(p)}ev.forEach(e=>{let row=document.createElement('div');row.className='event';let span=document.createElement('span');span.textContent=`${e.time} — ${e.name}`;let del=document.createElement('button');del.textContent='✕';del.title='刪除 / Xóa';del.onclick=()=>{if(confirm('刪除此行程？ / Xóa lịch này?')){state.events=state.events.filter(x=>x.id!==e.id);save();render()}};row.append(span,del);$('eventList').append(row)});renderTasks()}
function renderTasks(){$('taskList').replaceChildren();state.tasks.forEach(t=>{let row=document.createElement('div');row.className='task'+(t.done?' done':'');let box=document.createElement('input');box.type='checkbox';box.checked=t.done;box.onchange=()=>{t.done=box.checked;save();renderTasks()};let label=document.createElement('label');label.textContent=t.name;let del=document.createElement('button');del.textContent='✕';del.onclick=()=>{state.tasks=state.tasks.filter(x=>x.id!==t.id);save();renderTasks()};row.append(box,label,del);$('taskList').append(row)});let total=state.tasks.length,done=state.tasks.filter(t=>t.done).length,pct=total?Math.round(done/total*100):0;$('todayPct').textContent=pct+'%';$('donut').style.setProperty('--pct',pct+'%');$('stats').innerHTML='';[['今日 / Hôm nay',`${pct}%`],['已完成 / Đã xong',`${done} / ${total}`],['週、月、年 / Tuần, tháng, năm','將於雲端版本提供 / Sẽ có ở bản cloud']].forEach(([a,b])=>{let d=document.createElement('div');d.className='stat';let l=document.createElement('span'),r=document.createElement('strong');l.textContent=a;r.textContent=b;d.append(l,r);$('stats').append(d)})}
$('prev').onclick=()=>{month--;if(month<0){month=11;year--}selected=`${year}-${pad(month+1)}-01`;render()};$('next').onclick=()=>{month++;if(month>11){month=0;year++}selected=`${year}-${pad(month+1)}-01`;render()};$('addEvent').onclick=()=>{$('eventForm').reset();$('eventDate').value=selected;$('editor').showModal()};$('cancel').onclick=()=>$('editor').close();$('eventForm').onsubmit=e=>{e.preventDefault();if(!$('eventForm').reportValidity())return;state.events.push({id:crypto.randomUUID(),name:$('eventName').value.trim(),date:$('eventDate').value,time:$('eventTime').value});save();selected=$('eventDate').value;year=Number(selected.slice(0,4));month=Number(selected.slice(5,7))-1;$('editor').close();render()};$('addTask').onclick=()=>{let name=prompt('新增待辦 / Thêm việc cần làm');if(name?.trim()){state.tasks.push({id:Date.now(),name:name.trim(),done:false});save();renderTasks()}};for(const k of ['yearGoal','monthGoal','dayGoal'])$(k).value=state.goals[k]||'';$('saveGoals').onclick=()=>{for(const k of ['yearGoal','monthGoal','dayGoal'])state.goals[k]=$(k).value;save();alert('已儲存於此裝置 / Đã lưu trên thiết bị này (chưa đồng bộ)')};render();

/* Cozy Life Planner - Multiple Goals Upgrade */
(() => {
  const types = [
    { key: "year", title: "🌱 年度重要目標 / Mục tiêu năm" },
    { key: "month", title: "🌿 本月重要目標 / Mục tiêu tháng" },
    { key: "day", title: "⭐ 今日重要目標 / Mục tiêu ngày" }
  ];

  // Keep existing data and migrate old goals.
  if (!state.goalLists) {
    state.goalLists = { year: [], month: [], day: [] };
    for (const type of types) {
      const old = state.goals?.[type.key + "Goal"];
      if (old?.trim()) {
        state.goalLists[type.key].push({
          id: crypto.randomUUID(),
          name: old.trim(),
          progress: 0
        });
      }
    }
    save();
  }

  const panel = document.getElementById("goals");
  panel.replaceChildren();

  const style = document.createElement("style");
  style.textContent = `
    .goal-section {
      padding: 14px 0;
      border-bottom: 1px solid #eddfd0;
    }
    .goal-section h2 { margin-bottom: 12px; }
    .goal-card {
      background: #fff5e9;
      border: 1px solid #eedfce;
      border-radius: 14px;
      padding: 12px;
      margin-bottom: 10px;
    }
    .goal-name {
      font-size: 14px;
      font-weight: 600;
      overflow-wrap: anywhere;
      margin-bottom: 10px;
    }
    .goal-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }
    .goal-row input[type="range"] {
      flex: 1;
      min-width: 0;
      accent-color: #d97845;
    }
    .goal-row strong { min-width: 42px; }
    .goal-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    .goal-actions button { font-size: 12px; }
    .goal-add { width: 100%; margin-top: 8px; }
    .goal-summary {
      font-size: 12px;
      color: #85715c;
      margin-bottom: 10px;
    }
  `;
  document.head.append(style);

  function drawGoals() {
    panel.replaceChildren();

    for (const type of types) {
      const section = document.createElement("div");
      section.className = "goal-section";

      const heading = document.createElement("h2");
      heading.textContent = type.title;
      section.append(heading);

      const goals = state.goalLists[type.key] || [];
      const average = goals.length
        ? Math.round(
            goals.reduce((sum, g) => sum + g.progress, 0) /
              goals.length
          )
        : 0;

      const summary = document.createElement("p");
      summary.className = "goal-summary";
      summary.textContent =
        `${goals.length} 目標 / mục tiêu · ` +
        `平均進度 / Tiến độ: ${average}%`;
      section.append(summary);

      for (const goal of goals) {
        const card = document.createElement("div");
        card.className = "goal-card";

        const name = document.createElement("div");
        name.className = "goal-name";
        name.textContent = goal.name;

        const row = document.createElement("div");
        row.className = "goal-row";

        const range = document.createElement("input");
        range.type = "range";
        range.min = "0";
        range.max = "100";
        range.step = "5";
        range.value = goal.progress;

        const percent = document.createElement("strong");
        percent.textContent = goal.progress + "%";

        range.oninput = () => {
          goal.progress = Number(range.value);
          percent.textContent = goal.progress + "%";
          save();
        };
        range.onchange = drawGoals;

        row.append(range, percent);

        const actions = document.createElement("div");
        actions.className = "goal-actions";

        const edit = document.createElement("button");
        edit.textContent = "✎ 修改 / Sửa";
        edit.onclick = () => {
          const value = prompt("修改目標 / Sửa mục tiêu", goal.name);
          if (value?.trim()) {
            goal.name = value.trim();
            save();
            drawGoals();
          }
        };

        const complete = document.createElement("button");
        complete.textContent = "✓ 完成 / Hoàn thành";
        complete.onclick = () => {
          goal.progress = 100;
          save();
          drawGoals();
        };

        const remove = document.createElement("button");
        remove.textContent = "✕ 刪除 / Xóa";
        remove.onclick = () => {
          if (!confirm("確定刪除？ / Chắc chắn xóa?")) return;
          state.goalLists[type.key] = goals.filter(
            item => item.id !== goal.id
          );
          save();
          drawGoals();
        };

        actions.append(edit, complete, remove);
        card.append(name, row, actions);
        section.append(card);
      }

      const add = document.createElement("button");
      add.className = "goal-add primary";
      add.textContent = "＋ 新增目標 / Thêm mục tiêu";
      add.onclick = () => {
        const name = prompt("目標名稱 / Tên mục tiêu");
        if (!name?.trim()) return;

        state.goalLists[type.key].push({
          id: crypto.randomUUID(),
          name: name.trim(),
          progress: 0
        });

        save();
        drawGoals();
      };

      section.append(add);
      panel.append(section);
    }
  }

  drawGoals();
})();
