
/*
  Cozy Life Planner
  Quản lý lịch trình, công việc và mục tiêu.

  Dữ liệu lưu tại localStorage.
  Chỉ dùng ☆ và ★ để đánh dấu quan trọng.
*/

const $ = id => document.getElementById(id);
const STORAGE_KEY = "cozy-planner-demo-v1";

const pad = n => String(n).padStart(2, "0");

function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function todayKey() {
  return dateKey(new Date());
}

function periodKey(type, d = new Date()) {
  const key = dateKey(d);
  if (type === "day") return key;
  if (type === "month") return key.slice(0, 7);
  return key.slice(0, 4);
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random()}`;
}

function makeButton(label, handler, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = className;
  button.onclick = handler;
  return button;
}

function emptyMessage(message) {
  const p = document.createElement("p");
  p.className = "empty";
  p.textContent = message;
  return p;
}

// ==========================================
// 1. DỮ LIỆU
// ==========================================

let state;
let storageReadable = true;

try {
  state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
} catch {
  state = {};
  storageReadable = false;
  alert("無法讀取舊資料，已停止寫入 / Không đọc được dữ liệu cũ; đã ngừng ghi để tránh mất dữ liệu.");
}

if (!state || typeof state !== "object") state = {};
if (!Array.isArray(state.events)) state.events = [];
if (!Array.isArray(state.tasks)) state.tasks = [];

if (!state.goals || typeof state.goals !== "object") {
  state.goals = {};
}

if (!state.goalLists || typeof state.goalLists !== "object") {
  state.goalLists = {};
}

for (const type of ["day", "month", "year"]) {
  if (!Array.isArray(state.goalLists[type])) {
    state.goalLists[type] = [];
  }
}

function save() {
  if (!storageReadable) return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error(error);
    alert("資料儲存失敗 / Không thể lưu dữ liệu.");
    return false;
  }
}

const initialDate = new Date();

let year = initialDate.getFullYear();
let month = initialDate.getMonth();
let selected = todayKey();

let activeGoalType = "year";
let selectedTaskDate = todayKey();

const viewing = {
  day: periodKey("day"),
  month: periodKey("month"),
  year: periodKey("year")
};

const goalTypes = {
  year: "年度目標 / Mục tiêu năm",
  month: "月度目標 / Mục tiêu tháng",
  day: "每日目標 / Mục tiêu ngày"
};

// ==========================================
// 2. CHUYỂN ĐỔI DỮ LIỆU CŨ
// ==========================================

function migrateData() {
  for (const type of ["year", "month", "day"]) {
    const items = state.goalLists[type];
    const oldText = state.goals[type + "Goal"];

    if (
      !state.goalPeriodMigrationV1 &&
      typeof oldText === "string" &&
      oldText.trim() &&
      !items.some(g => g.name === oldText.trim())
    ) {
      items.push({
        id: makeId(),
        name: oldText.trim(),
        done: false,
        progress: 0,
        important: false
      });
    }

    for (const goal of items) {
      if (!goal.id) goal.id = makeId();

      if (typeof goal.important !== "boolean") {
        goal.important = false;
      }

      if (typeof goal.done !== "boolean") {
        goal.done = Number(goal.progress) >= 100;
      }

      if (!goal.period) {
        goal.period = periodKey(type);
      }

      goal.progress = goal.done ? 100 : 0;
    }
  }

  state.goalPeriodMigrationV1 = true;

  // Công việc cũ chưa có ngày sẽ được gắn vào
  // ngày thực hiện nâng cấp.
  for (const task of state.tasks) {
    if (!task.id) task.id = makeId();

    if (!task.date) {
      task.date = todayKey();
    }

    if (!task.repeat) {
      task.repeat = "none";
    }

    if (typeof task.important !== "boolean") {
      task.important = false;
    }

    if (
      !task.completions ||
      typeof task.completions !== "object"
    ) {
      task.completions = {};

      if (task.done) {
        task.completions[task.date] = true;
      }
    }
  }

  for (const task of state.tasks) {
    if (!Array.isArray(task.excludedDates)) task.excludedDates = [];
    if (!task.overrides || typeof task.overrides !== "object" || Array.isArray(task.overrides)) task.overrides = {};
    if (!task.endDate || !/^\d{4}-\d{2}-\d{2}$/.test(task.endDate)) task.endDate = "";
  }
  if (!Array.isArray(state.trash)) state.trash=[];
  for (const task of state.tasks) {
    task.notes=typeof task.notes==='string'?task.notes:'';
    task.goalRef=task.goalRef||'';
    task.remindAt=task.remindAt||'';
    task.skippedDates=Array.isArray(task.skippedDates)?task.skippedDates:[];
    task.completedAt=task.completedAt && typeof task.completedAt==='object'?task.completedAt:{};
    task.moved=task.moved && typeof task.moved==='object'?task.moved:{};
  }
  for (const event of state.events) event.notes=typeof event.notes==='string'?event.notes:'';
  save();
}

migrateData();

// ==========================================
// 3. ĐIỀU HƯỚNG
// ==========================================

const pageMap = {
  home: "homePage",
  calendar: "schedulePage",
  tasks: "schedulePage",
  goals: "schedulePage",
  future: "futurePage",
  performance: "performancePage",
  settings: "settingsPage"
};

function showPage(page) {
  const target = pageMap[page] ? page : "home";

  document.querySelectorAll(".app-page").forEach(el => {
    el.hidden = el.id !== pageMap[target];
  });

  document.querySelectorAll("nav a[data-page]").forEach(link => {
    const active =
      link.dataset.page === target ||
      (
        link.dataset.page === "calendar" &&
        ["tasks", "goals"].includes(target)
      );

    link.classList.toggle("active", active);
  });

  $("scheduleTasks").hidden = target !== "tasks";
  $("goalsPage").hidden = target !== "goals";

  if (target === "tasks") { selectedTaskDate=todayKey(); renderScheduleTasks(); }
  if (target === "goals") renderGoals();

  if (target === "home") {
    renderCalendar();
    renderTasks();
    renderImportantGoals();
    renderPerformance();
  }

  if (target === "performance") {
    renderPerformance();plannerChanged();
  }

  window.scrollTo(0, 0);
}

function navigate(page) {
  if (location.hash !== "#" + page) {
    location.hash = page;
  } else {
    showPage(page);
  }
}

document.querySelectorAll("nav a[data-page]").forEach(link => {
  link.onclick = event => {
    event.preventDefault();
    navigate(link.dataset.page);
  };
});

document.querySelectorAll("[data-schedule-section]").forEach(link => {
  link.onclick = event => {
    event.preventDefault();
    navigate(link.dataset.scheduleSection);
  };
});

document.querySelectorAll("[data-back-schedule]").forEach(button => {
  button.onclick = () => navigate("calendar");
});

window.addEventListener("hashchange", () => {
  showPage(location.hash.slice(1) || "home");
});

// ==========================================
// 4–7. LỊCH, SỰ KIỆN, CÔNG VIỆC
// ==========================================
const repeatLabels = {
  none: "不重複 / Không lặp lại", daily: "每天 / Hằng ngày",
  weekly: "每週 / Hằng tuần", monthly: "每月 / Hằng tháng",
  yearly: "每年 / Hằng năm"
};
const validDate = key => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key || "")) return false;
  const [y,m,d] = key.split("-").map(Number);
  const t = new Date(y,m-1,d);
  return t.getFullYear()===y && t.getMonth()===m-1 && t.getDate()===d;
};
function shiftDate(key, delta) {
  const d = parseDate(key); d.setDate(d.getDate()+delta); return dateKey(d);
}
function taskOccursOn(task,key) {
  if (!validDate(key) || !validDate(task.date) || key < task.date) return false;
  if (task.endDate && key > task.endDate) return false;
  if (task.excludedDates?.includes(key)) return false;
  if (task.moved && Object.values(task.moved).includes(key)) return true;
  if (task.moved && Object.hasOwn(task.moved,key)) return false;
  const repeat = task.repeat || "none";
  if (repeat === "none") return key === task.date;
  if (repeat === "daily") return true;
  const a=parseDate(task.date), b=parseDate(key);
  if (repeat === "weekly") return a.getDay() === b.getDay();
  if (repeat === "monthly") return a.getDate() === b.getDate();
  if (repeat === "yearly") return a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  return false;
}
function taskOrigin(task,key) {
  return Object.entries(task.moved||{}).find(([,destination])=>destination===key)?.[0] || key;
}
function taskStatus(task,key) {
  const original=taskOrigin(task,key);
  if(task.skippedDates?.includes(original)) return 'skipped';
  if(task.completions?.[original]) return 'done';
  return 'pending';
}
function taskNotes(task,key) { return task.overrides?.[taskOrigin(task,key)]?.notes ?? task.notes ?? ''; }
function taskReminder(task,key) { return task.overrides?.[taskOrigin(task,key)]?.remindAt ?? task.remindAt ?? ''; }
function goalIds(item) { return [...new Set([...(Array.isArray(item?.goalRefs)?item.goalRefs:[]),...(item?.goalRef?[item.goalRef]:[])].filter(Boolean))]; }
function taskGoals(task,key) { const o=task.overrides?.[taskOrigin(task,key)]; return o && (Object.hasOwn(o,'goalRefs')||Object.hasOwn(o,'goalRef')) ? goalIds(o) : goalIds(task); }
function taskGoal(task,key) { return taskGoals(task,key)[0] || ''; }
function allGoalChoices() { return ['day','month','year'].flatMap(type=>state.goalLists[type].map(g=>({id:g.id,label:`${goalTypes[type]} · ${g.period} · ${g.name}`}))); }
function goalPicker(selectedIds=[]) { const wrap=document.createElement('details');wrap.className='cozy-goal-picker';const summary=document.createElement('summary');summary.textContent='連結目標 / Liên kết mục tiêu';const list=document.createElement('div');list.className='cozy-goal-options';for(const g of allGoalChoices()){const label=document.createElement('label');const cb=document.createElement('input');cb.type='checkbox';cb.value=g.id;cb.checked=selectedIds.includes(g.id);label.append(cb,document.createTextNode(' '+g.label));list.append(label);}if(!list.children.length)list.append(emptyMessage('尚無目標 / Chưa có mục tiêu'));wrap.append(summary,list);return {wrap,values:()=>[...list.querySelectorAll('input:checked')].map(x=>x.value)}; }
function plannerChanged(){window.dispatchEvent(new Event('cozy:planner-updated'));}

function taskName(task,key) { return task.overrides?.[key]?.name ?? task.name; }
function taskImportant(task,key) { return task.overrides?.[key]?.important ?? !!task.important; }
function getTasksForDate(key) {
  return state.tasks.filter(t=>taskOccursOn(t,key))
    .sort((a,b)=>Number(taskImportant(b,key))-Number(taskImportant(a,key)));
}
function isTaskDone(task,key) { return taskStatus(task,key)==="done"; }
function refreshTaskViews() { renderTasks(); renderScheduleTasks(); renderCalendar(); }
function setTaskDone(task,key,done) {
  if (!task.completions) task.completions={};
  const original=taskOrigin(task,key);
  if (done) {
    task.completions[original]=true;
    task.completedAt[original]=new Date().toISOString();
    task.skippedDates=task.skippedDates.filter(d=>d!==original);
  } else {
    delete task.completions[original];delete task.completedAt[original];
  }
  syncDailyGoal(task,key);
  if (save()) refreshLinkedGoalViews();
}
function makeField(labelText,type,value="") {
  const label=document.createElement("label"); label.textContent=labelText;
  const input=document.createElement("input"); input.type=type; input.value=value;
  input.style.display="block"; input.style.width="100%"; label.append(input);
  return {label,input};
}
function selectChoice(message, allowed, fallback="0") {
  const answer=prompt(message,fallback);
  if (answer===null || answer==="0") return null;
  if (!allowed.includes(answer)) { alert("請選擇有效選項 / Hãy chọn phương án hợp lệ."); return null; }
  return answer;
}
function makeTaskEditor(container, date, task=null, mode="all") {
  container.querySelectorAll(".task-editor").forEach(el=>el.remove());
  const form=document.createElement("form"); form.className="task-editor";
  Object.assign(form.style,{display:"grid",gap:"12px",margin:"16px 0",padding:"16px",border:"1px solid #eadfd5",borderRadius:"12px"});
  const heading=document.createElement("h3");
  heading.textContent=task ? (mode==="single" ? "編輯單次 / Sửa riêng ngày" : mode==="future" ? "從此日起修改 / Sửa từ ngày này" : "編輯整個系列 / Sửa toàn bộ") : "新增待辦 / Thêm công việc";
  const name=makeField("工作名稱 / Tên công việc","text",task ? mode==="all" ? task.name : taskName(task,date) : "");
  name.input.required=true; name.input.maxLength=150;
  const start=makeField("開始日期 / Ngày bắt đầu","date",task && mode==="all" ? task.date : date);
  start.input.required=true;
  const end=makeField("結束日期 / Ngày kết thúc (không bắt buộc)","date",task?.endDate || "");
  const repeatLabel=document.createElement("label"); repeatLabel.textContent="重複設定 / Lặp lại";
  const repeat=document.createElement("select");
  Object.entries(repeatLabels).forEach(([value,label])=>{
    const opt=document.createElement("option");opt.value=value;opt.textContent=label;repeat.append(opt);
  });
  repeat.value=task?.repeat || "none"; repeatLabel.append(repeat);
  const notes=makeField("備註 / Ghi chú","text",task ? (mode==='all'?task.notes:taskNotes(task,date)) : '');
  const reminder=makeField("提醒時間 / Nhắc lúc","datetime-local",task ? (mode==='all'?task.remindAt:taskReminder(task,date)) : '');
   const goalPickerControl=goalPicker(task ? (mode==='all'?goalIds(task):taskGoals(task,date)) : []);
  const importantLabel=document.createElement("label");
  const important=document.createElement("input");important.type="checkbox";
  important.checked=task ? mode==="all" ? !!task.important : taskImportant(task,date) : false;
  importantLabel.append(important,document.createTextNode(" ★ 重要事項 / Quan trọng"));
  const hint=document.createElement("p");hint.style.fontSize="13px";
  hint.textContent=mode==="single" ? "只修改這一天的名稱與重要標記 / Chỉ sửa tên và dấu sao ngày này." : mode==="future" ? "之前的歷史保持不變 / Giữ nguyên lịch sử trước ngày chọn." : "變更重複規則可能影響舊紀錄顯示 / Đổi quy tắc có thể ảnh hưởng cách hiển thị lịch sử.";
  const single=mode==="single";
  start.label.hidden=single;repeatLabel.hidden=single;end.label.hidden=single;
  function toggleEnd(){ if(!single) end.label.hidden=repeat.value==="none"; }
  repeat.onchange=toggleEnd; toggleEnd();
  const actions=document.createElement("div");actions.style.display="flex";actions.style.gap="10px";
  const submit=document.createElement("button");submit.type="submit";submit.className="primary";submit.textContent="儲存 / Lưu";
  actions.append(submit,makeButton("取消 / Hủy",()=>form.remove()));
  form.append(heading,hint,name.label,start.label,repeatLabel,end.label,notes.label,reminder.label,goalPickerControl.wrap,importantLabel,actions);
  form.onsubmit=e=>{
    e.preventDefault();const title=name.input.value.trim();
    if(!title){alert("請輸入名稱 / Nhập tên công việc.");return;}
    if(single){
      const origin=taskOrigin(task,date);
      task.overrides[origin]={...task.overrides[origin],name:title,important:important.checked,notes:notes.input.value,remindAt:reminder.input.value,goalRefs:goalPickerControl.values(),goalRef:""};
    } else {
      const startDate=mode==="future" ? date : start.input.value;
      const endDate=repeat.value==="none" ? "" : end.input.value;
      if(!validDate(startDate) || (endDate && (!validDate(endDate) || endDate<startDate))){
        alert("日期不正確 / Ngày không hợp lệ.");return;
      }
      if(mode==="future"){
        // Split at date: old series ends the day before; new series starts on selected date.
        const previousEnd=shiftDate(date,-1);
        const oldEnd=task.endDate;
        const next={id:makeId(),name:title,date:startDate,repeat:repeat.value,
          endDate:endDate || (oldEnd && oldEnd>=date ? oldEnd : ""),
          important:important.checked,notes:notes.input.value,remindAt:reminder.input.value,goalRefs:goalPickerControl.values(),goalRef:"",
          completions:{},completedAt:{},skippedDates:[],moved:{},excludedDates:[],overrides:{}};
        for(const field of ['completedAt','moved']) {
          next[field]={};
          for(const [day,value] of Object.entries(task[field]||{})) if(day>=date) {
            next[field][day]=value;delete task[field][day];
          }
        }
        next.skippedDates=(task.skippedDates||[]).filter(day=>day>=date);
        task.skippedDates=(task.skippedDates||[]).filter(day=>day<date);
        for(const [day,done] of Object.entries(task.completions||{})){
          if(day>=date){next.completions[day]=done;delete task.completions[day];}
        }
        for(const day of task.excludedDates||[]){if(day>=date)next.excludedDates.push(day);}
        task.excludedDates=(task.excludedDates||[]).filter(day=>day<date);
        for(const [day,override] of Object.entries(task.overrides||{})){
          if(day>=date){next.overrides[day]=override;delete task.overrides[day];}
        }
        task.endDate=previousEnd;
        state.tasks.push(next);
      } else if(task){
        if(mode==="all" && task.repeat!=="none" && !confirm("修改整個系列可能改變歷史顯示，繼續？\nSửa cả chuỗi có thể đổi cách hiển thị lịch sử. Tiếp tục?"))return;
        Object.assign(task,{name:title,date:startDate,repeat:repeat.value,endDate,important:important.checked,
          notes:notes.input.value,remindAt:reminder.input.value,goalRefs:goalPickerControl.values(),goalRef:""});
      } else {
        state.tasks.push({id:makeId(),name:title,date:startDate,repeat:repeat.value,
          endDate,important:important.checked,notes:notes.input.value,remindAt:reminder.input.value,goalRefs:goalPickerControl.values(),goalRef:"",
          completions:{},completedAt:{},skippedDates:[],moved:{},excludedDates:[],overrides:{}});
      }
    }
    if(task)syncDailyGoal(task,date);
    if(save())refreshLinkedGoalViews();
  };
  container.append(form);name.input.focus();
}
function editTask(task,date) {
  let mode="all";
  if(task.repeat!=="none"){
    const answer=selectChoice("修改方式 / Cách sửa:\n1 = Chỉ ngày này\n2 = Từ ngày này trở đi\n3 = Toàn bộ chuỗi\n0 = Hủy",["1","2","3"],"1");
    if(!answer)return;
    mode={"1":"single","2":"future","3":"all"}[answer];
  }
  selectedTaskDate=date;navigate("tasks");renderScheduleTasks();
  makeTaskEditor($("scheduleTaskList"),date,task,mode);
}
function putInTrash(type, payload, label) {
  state.trash.push({id:makeId(),type,payload:structuredClone(payload),label,deletedAt:new Date().toISOString()});
}
function skipTask(task,key) {
  const origin=taskOrigin(task,key);
  if(!task.skippedDates.includes(origin)) task.skippedDates.push(origin);
  delete task.completions[origin];delete task.completedAt[origin];
  if(save())refreshTaskViews();
}
function moveTask(task,key) {
  const destination=prompt('移至日期 YYYY-MM-DD / Dời sang ngày:',key);
  if(!destination || !validDate(destination)) return;
  if(destination===key)return;
  if(taskOccursOn(task,destination)) {
    alert('目標日期已有此工作 / Ngày mới đã có công việc này.');return;
  }
  task.moved[taskOrigin(task,key)]=destination;
  if(save())refreshTaskViews();
}
function deleteTask(task,date) {
  if(task.repeat==="none"){
    if(!confirm("刪除此工作？ / Xóa công việc này?"))return;
    putInTrash('task',task,task.name);
    state.tasks=state.tasks.filter(t=>t!==task);
  } else {
    const choice=selectChoice("刪除方式 / Cách xóa:\n1 = Chỉ ngày này\n2 = Từ ngày này trở đi (giữ lịch sử)\n3 = Toàn bộ chuỗi và lịch sử\n0 = Hủy",["1","2","3"]);
    if(!choice)return;
    if(choice==="1"){
      putInTrash('occurrence',{taskId:task.id,date},taskName(task,date));
      if(!task.excludedDates.includes(date))task.excludedDates.push(date);
    } else if(choice==="2"){
      if(!confirm("保留之前的歷史並停止未來重複？\nGiữ lịch sử trước ngày này và dừng các lần sau?"))return;
      putInTrash('future',{taskId:task.id,oldEnd:task.endDate,date},task.name);
      task.endDate=shiftDate(date,-1);
      // Retain historical records, including completion history, without deleting data.
    } else {
      if(!confirm("將刪除全部紀錄！ / Xóa toàn bộ chuỗi và lịch sử?"))return;
      putInTrash('task',task,task.name);
      state.tasks=state.tasks.filter(t=>t!==task);
    }
  }
  if(save())refreshTaskViews();
}
// Liên kết tự động: một công việc được đánh sao = một mục tiêu của ngày đó.
function linkedDailyGoal(task,key) {
  return state.goalLists.day.find(g=>g.linkedTaskId===task.id && g.period===key);
}
function syncDailyGoal(task,key) {
  const existing=linkedDailyGoal(task,key);
  const important=taskImportant(task,key);
  if (!important) {
    if(existing) state.goalLists.day=state.goalLists.day.filter(g=>g!==existing);
    return;
  }
  const done=isTaskDone(task,key);
  if(existing) {
    Object.assign(existing,{name:taskName(task,key),done,progress:done?100:0,important:true});
  } else {
    state.goalLists.day.push({id:makeId(),period:key,name:taskName(task,key),done,
      progress:done?100:0,important:true,linkedTaskId:task.id});
  }
}
function refreshLinkedGoalViews() {
  refreshTaskViews();refreshGoals();plannerChanged();
}
function createTaskRow(task,key){
  const wrapper=document.createElement('div');
  const row=document.createElement('div');row.className='cozy-task-row';
  const status=taskStatus(task,key);
  const check=document.createElement('input');check.type='checkbox';check.checked=status==='done';
  check.setAttribute('aria-label','完成 / Hoàn thành');
  check.onchange=()=>setTaskDone(task,key,check.checked);
  const name=document.createElement('span');name.className='cozy-task-name'+(status==='done'?' is-done':status==='skipped'?' is-skipped':'');
  name.textContent=taskName(task,key);
  const star=makeButton(taskImportant(task,key)?'★':'☆',()=>{
    const origin=taskOrigin(task,key);
    if(task.repeat==='none')task.important=!task.important;
    else task.overrides[origin]={...task.overrides[origin],important:!taskImportant(task,key)};
    syncDailyGoal(task,key);
    if(save())refreshLinkedGoalViews();
  },'goal-star'+(taskImportant(task,key)?' starred':''));
  star.title='重要 / Quan trọng';
  const menu=document.createElement('details');
  const trigger=document.createElement('summary');trigger.textContent='⋯';trigger.title='更多 / Tùy chọn';
  const actions=document.createElement('div');actions.className='cozy-task-actions';
  const action=(label,fn)=>actions.append(makeButton(label,()=>{menu.open=false;fn();}));
  action('編輯 / Sửa',()=>editTask(task,key));
  action('移動 / Dời',()=>moveTask(task,key));
  if(status!=='skipped')action('略過 / Bỏ qua',()=>skipTask(task,key));
  if(status==='skipped')action('恢復未完成 / Chưa hoàn thành',()=>{
    task.skippedDates=task.skippedDates.filter(d=>d!==taskOrigin(task,key));
    if(save())refreshTaskViews();
  });
  action('刪除 / Xóa',()=>deleteTask(task,key));
  menu.append(trigger,actions);row.append(check,name,star,menu);wrapper.append(row);
  const completed=task.completedAt?.[taskOrigin(task,key)];
  const goal=Object.values(state.goalLists).flat().find(g=>g.id===taskGoal(task,key));
  const meta=[status==='skipped'?'已略過 / Đã bỏ qua':'',completed?'完成 / Xong: '+new Date(completed).toLocaleString('vi-VN'):'',taskNotes(task,key),goal?'🎯 '+goal.name:''].filter(Boolean);
  if(meta.length){const info=document.createElement('div');info.className='cozy-task-meta';info.textContent=meta.join(' · ');wrapper.append(info);}
  return wrapper;
}

function renderTasks(){
  const box=$("taskList");box.replaceChildren();const key=todayKey();const tasks=getTasksForDate(key);
  if(!tasks.length)box.append(emptyMessage("今日尚無待辦事項 / Hôm nay chưa có công việc"));
  tasks.forEach(t=>box.append(createTaskRow(t,key)));
}
function getOverdueTasks(){
  const result=[],today=todayKey();let truncated=false;
  for(const task of state.tasks){
    if(!validDate(task.date)||task.date>=today)continue;
    let key=task.date,count=0;
    while(key<today&&count<20000){
      if(taskOccursOn(task,key)&&taskStatus(task,key)==='pending')result.push({task,key});
      key=shiftDate(key,1);count++;
      if(task.endDate&&key>task.endDate)break;
      if(task.repeat==="none")break;
    }
    if(count>=20000&&key<today)truncated=true;
  }
  result.sort((a,b)=>b.key.localeCompare(a.key));return {result,truncated};
}
let showAllOverdue=false;
function renderOverdue(container){
  const {result,truncated}=getOverdueTasks();
  const section=document.createElement("section");section.style.marginTop="24px";
  const h=document.createElement("h3");h.textContent=`逾期待辦 / Công việc quá hạn (${result.length}${truncated?"+":""})`;section.append(h);
  if(truncated)section.append(emptyMessage("部分很久以前的資料未統計 / Lịch sử quá xa chưa thống kê hết."));
  if(!result.length)section.append(emptyMessage("沒有逾期待辦 / Không có việc quá hạn"));
  (showAllOverdue?result:result.slice(0,50)).forEach(({task,key})=>{
    const row=document.createElement("div");row.className="task";
    const label=document.createElement("span");label.textContent=`${key} — ${taskName(task,key)} `;
    row.append(label,makeButton("完成 / Xong",()=>setTaskDone(task,key,true)),makeButton("略過 / Bỏ qua",()=>skipTask(task,key)),makeButton("查看 / Xem",()=>{selectedTaskDate=key;renderScheduleTasks();}));
    section.append(row);
  });
  if(result.length>50)section.append(makeButton(showAllOverdue?"收起 / Thu gọn":"顯示全部 / Hiện tất cả",()=>{showAllOverdue=!showAllOverdue;renderScheduleTasks();}));
  container.append(section);
}
function renderScheduleTasks(){
  const box=$('scheduleTaskList');if(!box)return;box.replaceChildren();
  const toolbar=document.createElement('div');toolbar.className='cozy-toolbar';
  const date=document.createElement('input');date.type='date';date.value=selectedTaskDate;date.title='選擇日期 / Chọn ngày';
  date.onchange=()=>{if(validDate(date.value)){selectedTaskDate=date.value;renderScheduleTasks();}};
  toolbar.append(date,
    makeButton('＋ 新增 / Thêm',()=>makeTaskEditor(box,selectedTaskDate), 'primary'));
  box.append(toolbar);
  const search=document.createElement('div');search.className='cozy-search';
  const query=document.createElement('input');query.type='search';query.placeholder='搜尋待辦事項 / Tìm công việc...';query.value=taskSearch;
  query.setAttribute('aria-label','搜尋待辦事項 / Tìm công việc');
  const glass=makeButton('⌕',()=>query.focus());glass.title='搜尋 / Tìm kiếm';glass.setAttribute('aria-label','搜尋 / Tìm kiếm');
  search.append(query,glass);box.append(search);
  const results=document.createElement('div');results.className='cozy-task-list';box.append(results);
  const summary=document.createElement('p');summary.className='goal-summary';box.append(summary);
  function draw(){
    const key=selectedTaskDate;
    // Tự liên kết các công việc đã đánh dấu sao từ bản trước.
    let linkedChanged=false;
    for(const t of getTasksForDate(key)) if(taskImportant(t,key)) {
      const g=linkedDailyGoal(t,key);
      if(!g || g.name!==taskName(t,key) || g.done!==isTaskDone(t,key)) {
        syncDailyGoal(t,key);linkedChanged=true;
      }
    }
    if(linkedChanged){save();renderImportantGoals();renderPerformance();}
    const tasks=getTasksForDate(key).filter(t=>taskName(t,key).toLocaleLowerCase().includes(taskSearch.toLocaleLowerCase()));
    results.replaceChildren();
    if(!tasks.length)results.append(emptyMessage('沒有符合的待辦 / Không có công việc phù hợp'));
    tasks.forEach(t=>results.append(createTaskRow(t,key)));
    const all=getTasksForDate(key);summary.textContent=`${key} · 已完成 / Hoàn thành: ${all.filter(t=>isTaskDone(t,key)).length}/${all.length}`;
  }
  query.oninput=()=>{taskSearch=query.value;draw();};draw();
  const eventFold=document.createElement('details');eventFold.className='cozy-fold';
  const eventHeading=document.createElement('summary');eventHeading.textContent='行程 / Sự kiện ('+state.events.filter(e=>e.date===selectedTaskDate).length+')';
  eventFold.append(eventHeading);
  const events=state.events.filter(e=>e.date===selectedTaskDate).sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')));
  if(!events.length)eventFold.append(emptyMessage('尚無行程 / Chưa có sự kiện'));
  events.forEach(event=>{
    const row=document.createElement('div');row.className='cozy-event-row';
    const label=document.createElement('span');label.textContent=`${event.time||''} ${event.name||''}${event.notes?' · '+event.notes:''}`;
    row.append(label,makeButton('編輯 / Sửa',()=>openEventEditor(event)),makeButton('×',()=>{
      if(!confirm('刪除此行程？ / Xóa sự kiện?'))return;
      putInTrash('event',event,event.name);state.events=state.events.filter(e=>e!==event);
      if(save()){renderScheduleTasks();renderCalendar();}
    }));eventFold.append(row);
  });
  eventFold.append(makeButton('＋ 新增行程 / Thêm sự kiện',()=>{
    selected=selectedTaskDate;openEventEditor();
  }));box.append(eventFold);
  const overdueFold=document.createElement('details');overdueFold.className='cozy-fold';
  const {result,truncated}=getOverdueTasks();
  const overdueTitle=document.createElement('summary');overdueTitle.textContent=`逾期待辦 / Quá hạn (${result.length}${truncated?'+':''})`;
  overdueFold.append(overdueTitle);
  if(truncated)overdueFold.append(emptyMessage('較早資料可能未完全統計 / Có thể thiếu dữ liệu quá cũ'));
  if(!result.length)overdueFold.append(emptyMessage('沒有逾期待辦 / Không có việc quá hạn'));
  (showAllOverdue?result:result.slice(0,50)).forEach(({task,key})=>{
    const row=document.createElement('div');row.className='cozy-event-row';
    const label=document.createElement('span');label.textContent=`${key} · ${taskName(task,key)}`;
    row.append(label,makeButton('完成 / Xong',()=>setTaskDone(task,key,true)),
      makeButton('略過 / Bỏ qua',()=>skipTask(task,key)),
      makeButton('查看 / Xem',()=>{selectedTaskDate=key;renderScheduleTasks();}));overdueFold.append(row);
  });
  if(result.length>50)overdueFold.append(makeButton(showAllOverdue?'收起 / Thu gọn':'顯示全部 / Hiện tất cả',()=>{
    showAllOverdue=!showAllOverdue;renderScheduleTasks();
  }));box.append(overdueFold);
}

function addTask(){selectedTaskDate=todayKey();navigate("tasks");renderScheduleTasks();makeTaskEditor($("scheduleTaskList"),selectedTaskDate);}
$("addTask").onclick=addTask;
function renderCalendar(){
  $("monthTitle").textContent=`${year} / ${pad(month+1)}`;$("weekdays").replaceChildren();
  ["週日/CN","週一/T2","週二/T3","週三/T4","週四/T5","週五/T6","週六/T7"].forEach(t=>{const e=document.createElement("div");e.textContent=t;$("weekdays").append(e);});
  const first=new Date(year,month,1).getDay(),len=new Date(year,month+1,0).getDate();
  const weekMode=localStorage.getItem('cozy-calendar-view')==='week';
  const selectedDt=parseDate(selected)||new Date();
  const weekStart=new Date(selectedDt);weekStart.setDate(weekStart.getDate()-weekStart.getDay());
  const cells=weekMode?7:Math.ceil((first+len)/7)*7;
  $("days").replaceChildren();
  for(let i=0;i<cells;i++){
    const dt=weekMode?new Date(weekStart.getFullYear(),weekStart.getMonth(),weekStart.getDate()+i):new Date(year,month,i-first+1),key=dateKey(dt),button=document.createElement("button");button.type="button";
    button.className="day"+(dt.getMonth()!==month?" muted":"")+(key===selected?" selected":"");
    const num=document.createElement("span");num.className="num";num.textContent=dt.getDate();button.append(num);
    state.events.filter(e=>e.date===key).slice(0,2).forEach(e=>{const chip=document.createElement("span");chip.className="chip";chip.textContent=`${e.time||""} ${e.name||""}`;button.append(chip);});
    // The large calendar shows created events only; tasks remain in task lists.
    button.onclick=()=>{selected=key;selectedTaskDate=key;year=dt.getFullYear();month=dt.getMonth();renderCalendar();};$("days").append(button);
  }
  renderEvents();
  let toggle=$('cozyWeekToggle');
  if(!toggle){toggle=makeButton('',()=>{localStorage.setItem('cozy-calendar-view',localStorage.getItem('cozy-calendar-view')==='week'?'month':'week');renderCalendar();});toggle.id='cozyWeekToggle';$('monthTitle').parentElement.append(toggle);}
  toggle.textContent=weekMode?'月曆 / Xem tháng':'週曆 / Xem tuần';
}
let editingEvent=null;
function openEventEditor(event=null){editingEvent=event;$("eventForm").reset();$("eventName").value=event?.name||"";$("eventDate").value=event?.date||selected;$("eventTime").value=event?.time||"";
  let notes=$('cozyEventNotes');
  if(!notes){const field=makeField('備註 / Ghi chú','text');notes=field.input;notes.id='cozyEventNotes';$('eventForm').append(field.label);}
  notes.value=event?.notes||'';const old=$('cozyEventGoalPicker');if(old)old.remove();const pick=goalPicker(goalIds(event));pick.wrap.id='cozyEventGoalPicker';$('eventForm').querySelector('menu').before(pick.wrap);$('editor')._goalValues=pick.values;$('editor').showModal();}
function renderEvents(){
  if (!$('selectedTitle') || !$('eventList')) return;
  $("selectedTitle").textContent=`${selected} 行程與待辦 / Lịch và công việc`;
  const box=$("eventList");box.replaceChildren();
  const h=document.createElement("h3");h.textContent="行程 / Sự kiện";box.append(h);
  const events=state.events.filter(e=>e.date===selected).sort((a,b)=>String(a.time||"").localeCompare(String(b.time||"")));
  if(!events.length)box.append(emptyMessage("尚無行程 / Chưa có sự kiện"));
  events.forEach(e=>{
    const row=document.createElement("div");row.className="event";row.style.display="flex";row.style.gap="10px";
    const label=document.createElement("span");label.textContent=`${e.time||""} — ${e.name||""}${e.notes?" · "+e.notes:""}`;label.style.flex="1";
    row.append(label,makeButton("編輯 / Sửa",()=>openEventEditor(e)),makeButton("X",()=>{
      if(!confirm("刪除此行程？ / Xóa sự kiện?"))return;
      putInTrash('event',e,e.name);state.events=state.events.filter(x=>x!==e);if(save()){renderCalendar();plannerChanged();}
    }));box.append(row);
  });
  const t=document.createElement("h3");t.textContent="待辦事項 / Công việc";box.append(t);
  const tasks=getTasksForDate(selected);
  if(!tasks.length)box.append(emptyMessage("尚無待辦 / Chưa có công việc"));
  tasks.forEach(task=>box.append(createTaskRow(task,selected)));
  box.append(makeButton("查看當日待辦 / Xem công việc ngày này",()=>{selectedTaskDate=selected;navigate("tasks");}));
}
$("prev").onclick=()=>{
  if(localStorage.getItem('cozy-calendar-view')==='week'){
    selected=shiftDate(selected,-7);year=Number(selected.slice(0,4));month=Number(selected.slice(5,7))-1;
  }else{month--;if(month<0){month=11;year--;}selected=`${year}-${pad(month+1)}-01`;}
  renderCalendar();
};
$("next").onclick=()=>{
  if(localStorage.getItem('cozy-calendar-view')==='week'){
    selected=shiftDate(selected,7);year=Number(selected.slice(0,4));month=Number(selected.slice(5,7))-1;
  }else{month++;if(month>11){month=0;year++;}selected=`${year}-${pad(month+1)}-01`;}
  renderCalendar();
};
$("addEvent").onclick=()=>openEventEditor();
$("cancel").onclick=()=>{editingEvent=null;$("editor").close();};
$("editor").addEventListener("close",()=>{editingEvent=null;});
$("eventForm").onsubmit=e=>{
  e.preventDefault();if(!$("eventForm").reportValidity())return;
  const name=$("eventName").value.trim(),date=$("eventDate").value,time=$("eventTime").value;
  if(!name||!validDate(date)){alert("資料不正確 / Thông tin không hợp lệ.");return;}
  const notes=$('cozyEventNotes')?.value||'';const goalRefs=$('editor')._goalValues?.()||[];
  if(editingEvent)Object.assign(editingEvent,{name,date,time,notes,goalRefs,goalRef:''});
  else state.events.push({id:makeId(),name,date,time,notes,goalRefs});
  if(!save())return;
  selected=date;year=Number(date.slice(0,4));month=Number(date.slice(5,7))-1;
  editingEvent=null;$("editor").close();renderCalendar();renderScheduleTasks();plannerChanged();
};

// ==========================================
// 8. MỤC TIÊU THEO NGÀY / THÁNG / NĂM
// ==========================================

function getGoals(type, key = viewing[type]) {
  return state.goalLists[type].filter(
    goal => goal.period === key
  );
}

function renderGoalPeriodPicker(manager) {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.flexWrap = "wrap";
  row.style.alignItems = "center";
  row.style.gap = "10px";
  row.style.margin = "14px 0";

  const label = document.createElement("label");
  label.textContent = "選擇日期 / Chọn thời gian: ";

  const input = document.createElement("input");

  input.type =
    activeGoalType === "day"
      ? "date"
      : activeGoalType === "month"
        ? "month"
        : "number";

  input.value = viewing[activeGoalType];

  if (activeGoalType === "year") {
    input.min = "1900";
    input.max = "9999";
    input.step = "1";
    input.style.width = "110px";
  }

  input.onchange = () => {
    const value = input.value;

    const patterns = {
      day: /^\d{4}-\d{2}-\d{2}$/,
      month: /^\d{4}-\d{2}$/,
      year: /^\d{4}$/
    };

    if (!patterns[activeGoalType].test(value)) {
      input.value = viewing[activeGoalType];
      return;
    }

    viewing[activeGoalType] = value;
    renderGoals();
  };

  label.append(input);
  row.append(label);
  manager.append(row);
}

function renderGoals() {
  const manager = $("goalManager");
  if (!manager) return;

  manager.replaceChildren();

  document.querySelectorAll("[data-goal-type]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.goalType === activeGoalType
    );
  });

  const title = document.createElement("h2");
  title.textContent = goalTypes[activeGoalType];
  // Tabs already indicate the active goal period.

  renderGoalPeriodPicker(manager);

  const add = makeButton(
    "新增目標 / Thêm mục tiêu",
    () => {
      const name = prompt("目標名稱 / Nhập tên mục tiêu");
      if (!name?.trim()) return;

      state.goalLists[activeGoalType].push({
        id: makeId(),
        period: viewing[activeGoalType],
        name: name.trim(),
        done: false,
        progress: 0,
        important: false
      });

      save();
      refreshGoals();
    },
    "primary"
  );

  manager.append(add);

  const goals = getGoals(activeGoalType);

  if (!goals.length) {
    manager.append(
      emptyMessage(
        "尚未建立目標 / Chưa có mục tiêu cho thời gian này"
      )
    );
  }

  goals.forEach(goal => {
    const card = document.createElement("div");
    card.className = "goal-card";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!goal.done;

    checkbox.onchange = () => {
      goal.done = checkbox.checked;
      goal.progress = goal.done ? 100 : 0;
      if(goal.linkedTaskId) {
        const task=state.tasks.find(t=>t.id===goal.linkedTaskId);
        if(task) {
          const origin=taskOrigin(task,goal.period);
          task.completions ||= {};task.completedAt ||= {};task.skippedDates ||= [];
          if(goal.done){task.completions[origin]=true;task.completedAt[origin]=new Date().toISOString();task.skippedDates=task.skippedDates.filter(d=>d!==origin);}
          else {delete task.completions[origin];delete task.completedAt[origin];}
        }
      }
      if(save())refreshLinkedGoalViews();
    };

    const star = makeButton(
      goal.important ? "★" : "☆",
      () => {
        goal.important = !goal.important;
        if(save())refreshGoals();
      },
      "goal-star" + (goal.important ? " starred" : "")
    );

    star.title = "重要目標 / Mục tiêu quan trọng";

    const name = document.createElement("span");
    name.className =
      "goal-name" + (goal.done ? " completed" : "");
    name.textContent = goal.name;

    const edit = makeButton("Sửa", () => {
      const value = prompt(
        "修改目標 / Sửa mục tiêu",
        goal.name
      );

      if (!value?.trim()) return;

      goal.name = value.trim();
      if(save())refreshGoals();
    });

    const remove = makeButton("X", () => {
      if (!confirm("確定刪除？ / Chắc chắn xóa?")) return;

      putInTrash('goal',{...goal,goalType:activeGoalType},goal.name);
      state.goalLists[activeGoalType] =
        state.goalLists[activeGoalType].filter(
          item => item !== goal
        );

      if(save())refreshGoals();
    });

    const actions=document.createElement('details');actions.className='cozy-actions';
    const more=document.createElement('summary');more.textContent='⋯';more.setAttribute('aria-label','更多操作 / Thao tác khác');
    const menu=document.createElement('div');menu.className='cozy-action-menu';menu.append(edit,remove);
    actions.append(more,menu);
    card.append(checkbox, name, star, actions);
    manager.append(card);
    const linkedTasks=state.tasks.filter(t=>goalIds(t).includes(goal.id)||Object.values(t.overrides||{}).some(o=>goalIds(o).includes(goal.id)));
    const linkedEvents=state.events.filter(e=>goalIds(e).includes(goal.id));
    const linkedFinance=(()=>{try{const f=JSON.parse(localStorage.getItem('cozy-finance-v1'))||{};return ['budgets','savings','debts'].flatMap(k=>(f[k]||[]).filter(x=>goalIds(x).includes(goal.id)));}catch{return []}})();
    if(linkedTasks.length||linkedEvents.length||linkedFinance.length){
      const detail=document.createElement('details');detail.className='cozy-goal-links';const summary=document.createElement('summary');summary.textContent=`關聯項目 / Liên kết (${linkedTasks.length+linkedEvents.length+linkedFinance.length})`;detail.append(summary);
      for(const t of linkedTasks){const row=document.createElement('div');row.textContent='☑ '+t.name;detail.append(row)}
      for(const e of linkedEvents){const row=document.createElement('div');row.textContent='◷ '+e.date+' '+e.name;detail.append(row)}
      for(const f of linkedFinance){const row=document.createElement('div');row.textContent='＄ '+f.name;detail.append(row)}
      manager.append(detail);
    }
  });

  const completed = goals.filter(goal => goal.done).length;

  const summary = document.createElement("p");
  summary.className = "goal-summary";
  summary.textContent =
    `已完成 / Hoàn thành: ${completed} / ${goals.length}`;

  manager.append(summary);
}

document.querySelectorAll("[data-goal-type]").forEach(button => {
  button.onclick = () => {
    activeGoalType = button.dataset.goalType;
    renderGoals();
  };
});

// ==========================================
// 9. MỤC TIÊU QUAN TRỌNG TRANG CHỦ
// ==========================================

function renderImportantGoals() {
  const list = $("importantGoalList");
  if (!list) return;

  list.replaceChildren();

  let count = 0;

  for (const type of ["year", "month", "day"]) {
    const important = getGoals(
      type,
      periodKey(type)
    ).filter(goal => goal.important && !goal.done);

    if (!important.length) continue;

    count++;

    const heading = document.createElement("h3");
    heading.className = "important-heading";
    heading.textContent = goalTypes[type];
    list.append(heading);

    important.forEach(goal => {
      const row = document.createElement("div");
      row.className =
        "important-goal" +
        (goal.done ? " completed" : "");

      const star = document.createElement("span");
      star.textContent = "★";

      const name = document.createElement("span");
      name.textContent = goal.name;

      row.append(star, name);
      list.append(row);
    });
  }

  // No starred goals: leave the panel empty.
}

// ==========================================
// 10. BIỂU ĐỒ HIỆU SUẤT MỤC TIÊU
// ==========================================

function goalStats(type, key = periodKey(type)) {
  const goals = getGoals(type, key);
  const done = goals.filter(goal => goal.done).length;

  return {
    total: goals.length,
    done,
    pct: goals.length
      ? Math.round(done / goals.length * 100)
      : 0
  };
}

function updateDonut(id, textId, pct) {
  const donut = $(id);
  const text = $(textId);

  if (!donut || !text) return;

  donut.style.setProperty("--pct", pct + "%");
  text.textContent = pct + "%";
}

function renderPerformance() {
  for (const type of ["day", "month", "year"]) {
    const result = goalStats(type);

    updateDonut(
      type + "Donut",
      type + "Pct",
      result.pct
    );
  }

  const todayStats = goalStats("day");

  updateDonut(
    "donut",
    "todayPct",
    todayStats.pct
  );

  const container = $("stats");
  if (!container) return;

  container.replaceChildren();

  [
    [
      "今日目標 / Mục tiêu ngày",
      todayStats.pct + "%"
    ],
    [
      "已完成 / Đã hoàn thành",
      `${todayStats.done} / ${todayStats.total}`
    ]
  ].forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "stat";

    const left = document.createElement("span");
    left.textContent = label;

    const right = document.createElement("strong");
    right.textContent = value;

    row.append(left, right);
    container.append(row);
  });
}

function refreshGoals() {
  renderGoals();
  renderImportantGoals();
  renderPerformance();
  plannerChanged();
}

// ==========================================
// 11. TỰ ĐỘNG CẬP NHẬT NGÀY MỚI
// ==========================================

let lastToday = todayKey();

function checkDateRollover() {
  const current = todayKey();

  if (current === lastToday) return;

  const previous = lastToday;
  lastToday = current;

  // Nếu đang xem ngày hôm qua thì tự chuyển
  // sang hôm nay. Nếu đang xem ngày khác
  // do tự chọn thì giữ nguyên.
  if (selectedTaskDate === previous) {
    selectedTaskDate = current;
  }

  if (selected === previous) {
    selected = current;
    year = Number(current.slice(0, 4));
    month = Number(current.slice(5, 7)) - 1;
  }

  for (const type of ["day", "month", "year"]) {
    const previousKey =
      type === "day"
        ? previous
        : type === "month"
          ? previous.slice(0, 7)
          : previous.slice(0, 4);

    if (viewing[type] === previousKey) {
      viewing[type] = periodKey(type);
    }
  }

  renderCalendar();
  renderTasks();
  renderScheduleTasks();
  refreshGoals();
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) checkDateRollover();
});

window.addEventListener("focus", checkDateRollover);

setInterval(checkDateRollover, 60 * 1000);


// ==========================================
// EXTRA: FILTER, REMINDERS, TRASH, BACKUP
// ==========================================
let taskSearch='';

function exportBackup(){
  const blob=new Blob([JSON.stringify({format:'cozy-life-planner',version:2,exportedAt:new Date().toISOString(),data:state},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`cozy-backup-${todayKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function importBackup(file){
  if(!file)return;
  file.text().then(raw=>{
    const parsed=JSON.parse(raw),data=parsed?.format==='cozy-life-planner'?parsed.data:parsed;
    if(!data||!Array.isArray(data.tasks)||!Array.isArray(data.events)||!data.goalLists||!['day','month','year'].every(k=>Array.isArray(data.goalLists[k])))throw Error('Invalid format');
    if(!confirm('將覆蓋目前資料，請先匯出備份。\nNhập sẽ thay dữ liệu hiện tại. Hãy xuất sao lưu trước.'))return;
    const previous=state;state=data;
    if(!save()){state=previous;return;}
    location.reload();
  }).catch(()=>alert('檔案格式錯誤 / File sao lưu không hợp lệ.'));
}
function renderTrash(){
  const root=$('cozyTrash');if(!root)return;root.replaceChildren();
  const title=document.createElement('h3');title.textContent=`資料回收桶 / Thùng rác (${state.trash.length})`;root.append(title);
  state.trash.forEach(entry=>{
    const row=document.createElement('div');row.className='task';
    const label=document.createElement('span');label.textContent=`${entry.label} · ${entry.deletedAt.slice(0,10)}`;
    const restore=makeButton('還原 / Khôi phục',()=>{
      const item=entry.payload;
      if(entry.type==='task'){
        if(state.tasks.some(t=>t.id===item.id)){alert('資料已存在 / Đã tồn tại.');return;}
        state.tasks.push(item);
      } else if(entry.type==='event'){
        if(state.events.some(e=>e.id===item.id)){alert('資料已存在 / Đã tồn tại.');return;}
        state.events.push(item);
      } else if(entry.type==='goal'){
        const type=item.goalType;if(!state.goalLists[type]||state.goalLists[type].some(g=>g.id===item.id))return;
        const goal={...item};delete goal.goalType;state.goalLists[type].push(goal);
      } else {
        const task=state.tasks.find(t=>t.id===item.taskId);if(!task){alert('找不到原工作 / Không còn công việc gốc.');return;}
        if(entry.type==='occurrence')task.excludedDates=task.excludedDates.filter(d=>d!==item.date);
        if(entry.type==='future')task.endDate=item.oldEnd;
      }
      state.trash=state.trash.filter(x=>x.id!==entry.id);if(save()){renderTrash();refreshTaskViews();refreshGoals();}
    });
    const purge=makeButton('永久刪除 / Xóa vĩnh viễn',()=>{if(!confirm('無法還原！ / Không thể khôi phục!'))return;state.trash=state.trash.filter(x=>x.id!==entry.id);if(save())renderTrash();});
    row.append(label,restore,purge);root.append(row);
  });
}
function initSafetyPanel(){
  const parent=$('cozyDataTools')||$('settingsPage');if(!parent)return;
  const panel=document.createElement('section');panel.style.padding='16px';panel.style.margin='16px 0';
  const h=document.createElement('h3');h.textContent='資料管理 / Quản lý dữ liệu';panel.append(h);
  panel.append(makeButton('匯出備份 JSON / Xuất sao lưu',exportBackup));
  const picker=document.createElement('input');picker.type='file';picker.accept='.json,application/json';picker.onchange=()=>importBackup(picker.files[0]);panel.append(picker);
  const trash=document.createElement('div');trash.id='cozyTrash';panel.append(trash);parent.append(panel);renderTrash();
}
const reminderSeen=new Set();
function checkReminders(){
  if(document.hidden)return;
  const now=Date.now();
  for(const task of state.tasks){
    const keys=new Set([todayKey(),...Object.values(task.moved||{})]);
    for(const key of keys){
      if(!taskOccursOn(task,key)||taskStatus(task,key)!=='pending')continue;
      const time=taskReminder(task,key);if(!time)continue;
      const scheduled=task.repeat==='none'?time:`${key}T${time.slice(11,16)}`;
      const moment=new Date(scheduled).getTime();const id=`${task.id}:${key}:${time}`;
      if(Number.isFinite(moment)&&moment<=now&&moment>now-60000&&!reminderSeen.has(id)){
        reminderSeen.add(id);alert(`提醒 / Nhắc việc: ${taskName(task,key)}`);
      }
    }
  }
}
initSafetyPanel();setInterval(checkReminders,30000);

// ==========================================
// 12. KHỞI ĐỘNG
// ==========================================

renderCalendar();
renderTasks();
renderScheduleTasks();
refreshGoals();

showPage(location.hash.slice(1) || "home");
// Minimal interface: lightweight tab controls (no changes to stored data).
function initMinimalTabs(){
  document.querySelectorAll('[data-finance-tab]').forEach(button=>{
    button.onclick=()=>{
      document.querySelectorAll('[data-finance-tab]').forEach(b=>b.classList.toggle('active',b===button));
      const text=$('financePlaceholder');if(text)text.textContent=button.dataset.financeTab==='income'
        ?'收入管理尚未開放 / Quản lý thu nhập đang được phát triển.'
        :'支出管理尚未開放 / Quản lý chi phí đang được phát triển.';
    };
  });
  document.querySelectorAll('[data-performance-tab]').forEach(button=>{
    button.onclick=()=>{
      const type=button.dataset.performanceTab;
      document.querySelectorAll('[data-performance-tab]').forEach(b=>b.classList.toggle('active',b===button));
      document.querySelectorAll('[data-performance-card]').forEach(card=>card.hidden=card.dataset.performanceCard!==type);
    };
  });
}
initMinimalTabs();

// FINANCE V1 - independent storage; shared renderers for Finance, Home, Performance.
(function(){
'use strict';
const KEY='cozy-finance-v1', el=id=>document.getElementById(id), now=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}, uid=()=>crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(36).slice(2);
const defaults=()=>({version:1,accounts:[{id:'cash',name:'現金 / Tiền mặt',kind:'cash',currency:'TWD',opening:0},{id:'bank-default',name:'銀行 / Ngân hàng',kind:'bank',currency:'TWD',opening:0}],categories:[{id:'food',name:'餐飲 / Ăn uống',type:'expense',icon:'🍜'},{id:'study',name:'學習 / Học tập',type:'expense',icon:'📚'},{id:'transport',name:'交通 / Đi lại',type:'expense',icon:'🚌'},{id:'home',name:'住房 / Nhà ở',type:'expense',icon:'🏠'},{id:'otherexp',name:'其他支出 / Chi khác',type:'expense',icon:'🧾'},{id:'salary',name:'薪資 / Lương',type:'income',icon:'💼'},{id:'otherinc',name:'其他收入 / Thu khác',type:'income',icon:'💰'}],transactions:[],budgets:[],savings:[],debts:[],recurring:[],rates:{TWD:1},rateDate:'',rateSource:''});
let data;try{const raw=JSON.parse(localStorage.getItem(KEY));data=raw&&raw.version===1?Object.assign(defaults(),raw):defaults()}catch{data=defaults()}
// Normalize legacy account kind/type without replacing balances or transaction links.
for(const a of data.accounts){
  if(a.kind!=='cash'&&a.kind!=='bank'){
    const raw=String(a.kind||a.type||'').toLowerCase();
    a.kind=raw==='cash'||a.id==='cash'||/現金|tiền mặt/i.test(a.name||'')?'cash':'bank';
  }
  if(a.opening==null){
    const original=a.initialBalance??a.openingBalance??a.balance??0;
    a.opening=Number(original)||0;
  }
}
// Migration for older localStorage: preserve every existing account and transaction.
// Add a zero-balance bank account only when none exists.
if(!data.accounts.some(a=>a.kind==='bank')){
  data.accounts.push({id:'bank-default',name:'銀行 / Ngân hàng',kind:'bank',currency:'TWD',opening:0});
  try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){console.warn('Could not persist bank migration',e)}
}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(data));render();plannerChanged();return true}catch(e){alert('無法儲存 / Không lưu được: '+e.message);return false}};
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const money=(n,cur='TWD')=>new Intl.NumberFormat('en-US',{maximumFractionDigits:cur==='VND'?0:2}).format(Number(n)||0)+' '+cur;
const monthStart=()=>selectedMonth+'-01';let selectedMonth=now().slice(0,7),view='transactions',filter='all',starOnly=false,search='';
const acct=id=>data.accounts.find(x=>x.id===id),cat=id=>data.categories.find(x=>x.id===id);
const rate=cur=>cur==='TWD'?1:(Number(data.rates[cur])||null);
const convert=(amount,cur)=>{const r=rate(cur);return r==null?null:Number(amount)*r};
const amountTwd=t=>t.twdAmount==null?convert(t.amount,t.currency):Number(t.twdAmount);
const balance=a=>Number(a.opening||0)+data.transactions.reduce((sum,t)=>sum+(t.accountId===a.id?(['income','transfer_in','debt_in'].includes(t.type)?1:-1)*Number(t.amount):0),0);
const totalBalance=()=>data.accounts.reduce((sum,a)=>{const v=convert(balance(a),a.currency);return v==null?sum:sum+v},0);
const inPeriod=(date,period=selectedMonth)=>date?.slice(0,7)===period;
const periodRows=(period=selectedMonth)=>data.transactions.filter(t=>inPeriod(t.date,period)&&['income','expense'].includes(t.type));
const totals=(rows)=>rows.reduce((s,t)=>{const n=amountTwd(t);if(n!==null)s[t.type]+=n;else s.missing=true;return s},{income:0,expense:0,missing:false});
const fmt=val=>money(val,'TWD');
function refreshRates(){const currencies=[...new Set([...data.accounts.map(a=>a.currency),...data.transactions.map(t=>t.currency)])].filter(c=>c!=='TWD');if(!currencies.length)return Promise.resolve();return fetch('https://open.er-api.com/v6/latest/TWD').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(j=>{if(j.result!=='success'||!j.rates)throw Error('Invalid response');for(const c of currencies){const v=Number(j.rates[c]);if(v>0)data.rates[c]=1/v}data.rateDate=now();data.rateSource='open.er-api.com';save()}).catch(()=>{render();});}
function addCurrencyField(){return {name:'currency',label:'幣別 / Tiền tệ',type:'select',options:['TWD','VND','USD','JPY','CNY','EUR','KRW','HKD','SGD'].map(v=>[v,v])}}
function field(f,value){const id='f_'+f.name,required=f.required?'required':'';let input;if(f.type==='select')input=`<select id="${id}" ${required}>${(f.options||[]).map(([v,l])=>`<option value="${esc(v)}" ${String(value)===String(v)?'selected':''}>${esc(l)}</option>`).join('')}</select>`;else if(f.type==='checkbox')input=`<input id="${id}" type="checkbox" ${value?'checked':''}>`;else if(f.type==='textarea')input=`<textarea id="${id}">${esc(value||'')}</textarea>`;else input=`<input id="${id}" type="${f.type||'text'}" value="${esc(value??'')}" ${required} ${f.type==='number'?'min="0" step="any"':''}>`;return `<label class="fin-field">${esc(f.label)}${input}</label>`}
function dialog(title,fields,values,onSubmit){el('finDialogTitle').textContent=title;el('finFields').innerHTML=fields.map(f=>field(f,values[f.name])).join('');const planDialog=/預算|儲蓄|債務/.test(title);let picker=null;if(planDialog){picker=goalPicker(goalIds(values));el('finFields').append(picker.wrap)}el('finForm').onsubmit=e=>{e.preventDefault();const v={};for(const f of fields){const input=el('f_'+f.name);v[f.name]=f.type==='checkbox'?input.checked:input.value}if(picker){v.goalRefs=picker.values();v.goalRef=''}try{if(onSubmit(v)!==false)el('finDialog').close()}catch(err){alert(err.message)}};el('finDialog').showModal()}
const opt=(items)=>items.map(x=>[x.id,x.name]);
function transactionForm(existing=null,defaultsValue={}){const d=Object.assign({type:'expense',date:now(),currency:'TWD',amount:'',name:'',accountId:data.accounts[0]?.id||'',categoryId:'',notes:'',starred:false,repeat:'none'},existing||{},defaultsValue);const fields=[{name:'type',label:'類型 / Loại',type:'select',options:[['expense','支出 / Chi'],['income','收入 / Thu'],['transfer','轉帳 / Chuyển tiền']]},{name:'name',label:'名稱 / Tên giao dịch',required:true},{name:'amount',label:'金額 / Số tiền',type:'number',required:true},addCurrencyField(),{name:'date',label:'日期 / Ngày',type:'date',required:true},{name:'accountId',label:'帳戶 / Tài khoản',type:'select',options:opt(data.accounts)},{name:'toAccountId',label:'轉入帳戶 / Tài khoản nhận (chỉ chuyển tiền)',type:'select',options:[['','—'],...opt(data.accounts)]},{name:'notes',label:'備註 / Ghi chú',type:'textarea'},{name:'starred',label:'★ 重要 / Quan trọng',type:'checkbox'},{name:'repeat',label:'重複 / Lặp lại (chỉ tạo mới)',type:'select',options:[['none','不重複 / Không lặp'],['weekly','每週 / Mỗi tuần'],['monthly','每月 / Mỗi tháng'],['yearly','每年 / Mỗi năm']]}];dialog(existing?'編輯交易 / Sửa giao dịch':'新增交易 / Thêm giao dịch',fields,d,v=>{const n=Number(v.amount);if(!(n>0))throw Error('Số tiền phải lớn hơn 0');if(!acct(v.accountId))throw Error('Chọn tài khoản');if(v.type==='transfer'){if(existing)throw Error('請新增轉帳交易 / Hãy tạo giao dịch chuyển tiền mới.');if(!v.toAccountId||v.toAccountId===v.accountId)throw Error('Chọn tài khoản nhận khác tài khoản nguồn');const dest=acct(v.toAccountId),source=acct(v.accountId);if(source.currency!==v.currency)throw Error('Đơn vị tiền phải trùng tài khoản nguồn');const toAmt=source.currency===dest.currency?n:convert(n,source.currency)!=null&&rate(dest.currency)!=null?convert(n,source.currency)/rate(dest.currency):null;if(toAmt==null)throw Error('Cần kết nối mạng để lấy tỷ giá');const group=uid();data.transactions.push({id:uid(),transferId:group,type:'transfer_out',name:v.name,amount:n,currency:source.currency,date:v.date,accountId:source.id,notes:v.notes},{id:uid(),transferId:group,type:'transfer_in',name:v.name,amount:toAmt,currency:dest.currency,date:v.date,accountId:dest.id,notes:v.notes});return save()}
const account=acct(v.accountId);if(account.currency!==v.currency)throw Error('Tiền tệ giao dịch phải trùng tài khoản. Hãy chọn tài khoản phù hợp.');const converted=convert(n,v.currency);if(converted===null)throw Error('Chưa có tỷ giá '+v.currency+'/TWD. Hãy kết nối Internet và thử lại.');const t={id:existing?.id||uid(),type:v.type,name:v.name.trim(),amount:n,currency:v.currency,twdAmount:converted,date:v.date,accountId:v.accountId,categoryId:existing?.categoryId||'',notes:v.notes,starred:v.starred};if(existing)Object.assign(existing,t);else if(v.repeat!=='none'){data.recurring.push({id:uid(),template:t,repeat:v.repeat,nextDate:v.date,confirmed:[]});}else data.transactions.push(t);return save()})}

function enhanceTransactionDialog(){
 const type=el('f_type'),category=el('f_categoryId'),account=el('f_accountId');
 if(!type||!category)return;
 const categoryLabel=category.closest('label');
 const toLabel=el('f_toAccountId')?.closest('label');
 const addButton=document.createElement('button');addButton.type='button';addButton.className='fin-inline-category-button';addButton.textContent='＋ 新分類 / Danh mục mới';
 const newBox=document.createElement('div');newBox.className='fin-inline-category-editor';newBox.hidden=true;
 newBox.innerHTML='<label>分類名稱 / Tên danh mục <input type="text" id="finNewCategoryName" placeholder="名稱 / Tên danh mục"></label><button type="button" id="finSaveNewCategory">新增 / Thêm</button>';
 categoryLabel.after(addButton,newBox);
 function sync(){
  const isTransfer=type.value==='transfer';
  if(toLabel)toLabel.hidden=!isTransfer;
  categoryLabel.hidden=isTransfer;addButton.hidden=isTransfer;newBox.hidden=true;
  const previous=category.value;
  category.innerHTML='<option value="">—</option>'+data.categories.filter(c=>c.type===type.value).map(c=>`<option value="${esc(c.id)}">${esc(c.icon||'')} ${esc(c.name)}</option>`).join('');
  if([...category.options].some(o=>o.value===previous))category.value=previous;
  const a=acct(account.value);if(a&&el('f_currency'))el('f_currency').value=a.currency;
 }
 type.addEventListener('change',sync);
 account.addEventListener('change',()=>{const a=acct(account.value);if(a&&el('f_currency'))el('f_currency').value=a.currency});
 addButton.onclick=()=>{newBox.hidden=!newBox.hidden;if(!newBox.hidden)el('finNewCategoryName').focus()};
 el('finSaveNewCategory').onclick=()=>{
  const name=el('finNewCategoryName').value.trim();if(!name||type.value==='transfer')return;
  const c={id:uid(),name,type:type.value,icon:'📁'};
  data.categories.push(c);save();sync();category.value=c.id;newBox.hidden=true;
 };
 sync();
}
function nextDate(d,repeat){const [y,m,day]=d.split('-').map(Number);const date=new Date(y,m-1,day);if(repeat==='weekly')date.setDate(date.getDate()+7);else if(repeat==='monthly'){const x=new Date(y,m,1);x.setDate(Math.min(day,new Date(y,m+1,0).getDate()));return x.toISOString().slice(0,10)}else{const x=new Date(y+1,m-1,1);x.setDate(Math.min(day,new Date(y+1,m,0).getDate()));return x.toISOString().slice(0,10)}return date.toISOString().slice(0,10)}
function confirmRecurring(r){const t={...r.template,id:uid(),date:r.nextDate,recurringId:r.id};data.transactions.push(t);r.confirmed.push(r.nextDate);r.nextDate=nextDate(r.nextDate,r.repeat);save()}
function removeTransaction(t){if(!confirm('確定刪除？ / Xóa giao dịch này?'))return;const ids=t.transferId?data.transactions.filter(x=>x.transferId===t.transferId).map(x=>x.id):[t.id];data.transactions=data.transactions.filter(x=>!ids.includes(x.id));save()}
function transactionRow(t,home=false){const sign=t.type==='income'||t.type==='transfer_in'?'+':'−';return `<div class="fin-row" data-fin-id="${esc(t.id)}">${home?'':`<button class="fin-star ${t.starred?'active':''}" data-action="star" aria-label="Đánh dấu quan trọng">${t.starred?'★':'☆'}</button>`}<div class="fin-info"><strong>${esc(t.name)}</strong><small>${esc(t.date)} · ${esc(acct(t.accountId)?.name||'')} · ${esc(t.type==='income'?'收入 / Thu':t.type==='expense'?'支出 / Chi':'轉帳 / Chuyển tiền')}</small></div><span class="fin-amount ${sign==='+'?'fin-positive':''}">${sign}${money(t.amount,t.currency)}</span>${home?'':`<details class="fin-dots"><summary aria-label="Tùy chọn">⋯</summary><div class="fin-dots-list"><button data-fin-edit="transaction" data-fin-target="${esc(t.id)}">編輯 / Sửa</button><button data-fin-action="copy" data-fin-target="${esc(t.id)}">複製 / Sao chép</button><button data-fin-delete="transaction" data-fin-target="${esc(t.id)}">刪除 / Xóa</button></div></details>`}</div>`}
function renderImportant(){const root=el('importantFinanceList');if(!root)return;const items=data.transactions.filter(t=>t.starred&&['income','expense'].includes(t.type)&&inPeriod(t.date,now().slice(0,7))).sort((a,b)=>a.date.localeCompare(b.date));root.innerHTML=items.map(t=>transactionRow(t,true)).join('');}
function renderTransactions(){const rows=data.transactions.filter(t=>inPeriod(t.date)&&(!search||[t.name,t.notes].join(' ').toLowerCase().includes(search))&&(filter==='all'||t.type===filter)&&(!starOnly||t.starred)).sort((a,b)=>b.date.localeCompare(a.date));el('finList').innerHTML=rows.length?rows.map(t=>transactionRow(t)).join(''):'<p class="fin-empty">尚無交易 / Chưa có giao dịch</p>';const pending=data.recurring.filter(r=>r.nextDate<=now());el('finPending').innerHTML=pending.length?'<h3>待確認 / Chờ xác nhận</h3>'+pending.map(r=>`<div class="fin-row"><div class="fin-info">${esc(r.template.name)}<small>${esc(r.nextDate)} · ${money(r.template.amount,r.template.currency)}</small></div><button data-recurring="${esc(r.id)}">✓ 確認 / Xác nhận</button><button data-skip="${esc(r.id)}">略過 / Bỏ qua</button></div>`).join(''):'';}
function renderSummary(){
 el('finMonth').textContent=selectedMonth.replace('-',' / ');
 const v=totals(periodRows());
 el('finSummary').innerHTML=`<div class="fin-v2-total"><p><span class="fin-positive">收入 / Thu +${fmt(v.income)} TWD</span>　<span>支出 / Chi −${fmt(v.expense)} TWD</span></p></div>`;
 renderOverviewAvailable();
}
function renderOverviewAvailable(){
 const root=el('finOverviewAvailable');if(!root)return;
 const rows=data.accounts.map(a=>({a,actual:balance(a),available:reserveByAccount(a).available}));
 const actual=rows.reduce((sum,r)=>sum+(convert(r.actual,r.a.currency)||0),0);
 const available=rows.reduce((sum,r)=>sum+(convert(r.available,r.a.currency)||0),0);
 const isCash=a=>a.kind==='cash'||a.type==='cash'||a.id==='cash'||/^(現金|tiền mặt)/i.test(String(a.name||'').trim());
 const group=items=>({actual:items.reduce((n,r)=>n+(convert(r.actual,r.a.currency)||0),0),available:items.reduce((n,r)=>n+(convert(r.available,r.a.currency)||0),0)});
 const cash=group(rows.filter(r=>isCash(r.a))),bank=group(rows.filter(r=>!isCash(r.a)));
 const row=(name,r)=>`<div class="fin-balance-row"><span>${name}</span><span>${fmt(r.actual)}</span><strong>${fmt(r.available)}</strong></div>`;
 root.innerHTML=`<div class="fin-available fin-available-v3 fin-overview"><div class="fin-balance-totals"><div><small>實際總餘額 / Tổng số dư thực tế</small><strong>${fmt(actual)}</strong><small>TWD</small></div><div><small>實際可用餘額 / Tổng tiền khả dụng</small><strong>${fmt(available)}</strong><small>TWD</small></div></div><div class="fin-balance-table"><div class="fin-balance-row fin-balance-head"><span>帳戶 / Tài khoản</span><span>實際 / Thực tế</span><span>可用 / Khả dụng</span></div>${row('現金 / Tiền mặt',cash)}${row('銀行 / Ngân hàng',bank)}</div></div>`;
}
function simpleRows(id,items,html){const root=el(id);if(!root)return;root.innerHTML=items.length?items.map(html).join(''):'<p class="fin-empty">尚無資料 / Chưa có dữ liệu</p>'}
function renderManage(){simpleRows('finAccounts',data.accounts,a=>`<div class="fin-row"><div class="fin-info"><strong>${esc(a.name)}</strong><small>${esc(a.currency)}</small></div><strong>${money(balance(a),a.currency)}</strong><button data-edit-account="${esc(a.id)}">⋯</button></div>`);simpleRows('finBudgets',data.budgets,b=>{const spent=budgetSpent(b),limit=Number(b.limit)+(b.rollover?budgetRollover(b):0);return `<div class="fin-row"><div class="fin-info"><strong>${esc(b.name)}</strong><small>${esc(b.period)} · ${fmt(spent)} / ${fmt(limit)}</small><div class="fin-progress"><span style="width:${Math.min(100,limit?spent/limit*100:0)}%"></span></div></div><button data-edit-budget="${esc(b.id)}">⋯</button></div>`});simpleRows('finSavings',data.savings,s=>`<div class="fin-row"><div class="fin-info"><strong>${esc(s.name)}</strong><small>${fmt(s.allocated)} / ${fmt(s.target)} · ${s.goalRef?'🔗 '+esc(s.goalRef):''}</small><div class="fin-progress"><span style="width:${Math.min(100,s.target?s.allocated/s.target*100:0)}%"></span></div></div><button data-add-saving="${esc(s.id)}">＋</button><button data-edit-saving="${esc(s.id)}">⋯</button></div>`);simpleRows('finDebts',data.debts,d=>`<div class="fin-row"><div class="fin-info"><strong>${esc(d.name)}</strong><small>${esc(d.kind==='lent'?'Cho vay':'Đi vay')} · Còn ${money(d.principal-d.paid,d.currency)}</small></div><button data-pay-debt="${esc(d.id)}">Thanh toán</button><button data-edit-debt="${esc(d.id)}">⋯</button></div>`);simpleRows('finCategories',data.categories,x=>`<div class="fin-row"><div class="fin-info">${esc(x.icon||'📁')} ${esc(x.name)} <small>${esc(x.type)}</small></div><button data-edit-category="${esc(x.id)}">⋯</button></div>`)}
function budgetWindow(b,offset=0){const d=new Date();if(b.period==='week'){const mon=new Date(d);mon.setDate(mon.getDate()-(mon.getDay()+6)%7+offset*7);return [mon.toISOString().slice(0,10),new Date(mon.getTime()+7*86400000).toISOString().slice(0,10)]}if(b.period==='year')return [String(d.getFullYear()+offset)+'-01-01',String(d.getFullYear()+offset+1)+'-01-01'];const start=new Date(d.getFullYear(),d.getMonth()+offset,1),end=new Date(d.getFullYear(),d.getMonth()+offset+1,1);return [start.toISOString().slice(0,10),end.toISOString().slice(0,10)]}
function budgetSpent(b,offset=0){const [from,to]=budgetWindow(b,offset);return data.transactions.filter(t=>t.type==='expense'&&t.date>=from&&t.date<to&&(!b.categoryId||b.categoryId===t.categoryId)).reduce((sum,t)=>sum+(amountTwd(t)||0),0)}
function budgetRollover(b){return Math.max(0,Number(b.limit)-budgetSpent(b,-1))}
function reportRows(period,reference){return data.transactions.filter(t=>['income','expense'].includes(t.type)&&t.date.slice(0,period==='day'?10:period==='month'?7:4)===reference)}

let finSection='planning', reportPeriod='month', reportAccount='all';
function finMenu(type,id,extra=''){return `<details class="fin-dots"><summary aria-label="Tùy chọn">⋯</summary><div class="fin-dots-list"><button data-fin-edit="${esc(type)}" data-fin-target="${esc(id)}">編輯 / Sửa</button>${extra}<button data-fin-delete="${esc(type)}" data-fin-target="${esc(id)}">刪除 / Xóa</button></div></details>`}
function reserveByAccount(a){const saved=data.savings.reduce((n,s)=>n+(s.accountId===a.id?Number(s.allocated||0):0),0);const budget=data.budgets.reduce((n,b)=>n+(b.accountId===a.id?Math.max(0,Number(b.accumulated??b.reservedAmount??0)||0):0),0);const debts=data.debts.reduce((n,d)=>n+(d.kind==='borrowed'&&d.reserve&&d.reserveAccountId===a.id?Math.max(0,Number(d.principal)-Number(d.paid)):0),0);return {saved,budget,debts,available:balance(a)-saved-budget-debts}}
function renderAvailable(){
  const rows=data.accounts.map(a=>({a,...reserveByAccount(a),actual:balance(a)}));
  const totalActual=rows.reduce((n,r)=>n+(convert(r.actual,r.a.currency)||0),0);
  const totalAvailable=rows.reduce((n,r)=>n+(convert(r.available,r.a.currency)||0),0);
  const totalReserved=rows.reduce((n,r)=>n+(convert(r.saved+r.budget+r.debts,r.a.currency)||0),0);
  const isCashAccount=a=>a.kind==='cash'||a.type==='cash'||a.id==='cash'||/^(現金|tiền mặt)/i.test(String(a.name||'').trim());
  const cashRows=rows.filter(r=>isCashAccount(r.a));
  const bankRows=rows.filter(r=>!isCashAccount(r.a));
  const group=(items)=>({
    actual:items.reduce((n,r)=>n+(convert(r.actual,r.a.currency)||0),0),
    available:items.reduce((n,r)=>n+(convert(r.available,r.a.currency)||0),0)
  });
  const cash=group(cashRows),bank=group(bankRows);
  const row=(label,r)=>`<div class="fin-balance-row"><span>${label}</span><span>${fmt(r.actual)}</span><strong>${fmt(r.available)}</strong></div>`;
  const detailRows=rows.map(r=>`<div class="fin-balance-detail-row"><span>${esc(r.a.name)}</span><span>${money(r.actual,r.a.currency)}</span><strong>${money(r.available,r.a.currency)}</strong></div>`).join('');
  if(!el('finAvailable'))return;el('finAvailable').innerHTML=`<div class="fin-available fin-available-v3">
    <div class="fin-balance-totals">
      <div><small>實際總餘額 / Tổng số dư thực tế</small><strong>${fmt(totalActual)}</strong><small>TWD</small></div>
      <div><small>實際可用餘額 / Tổng tiền khả dụng</small><strong class="${totalAvailable<0?'fin-balance-negative':''}">${fmt(totalAvailable)}</strong><small>TWD</small></div>
    </div>
    <div class="fin-balance-table">
      <div class="fin-balance-row fin-balance-head"><span>帳戶 / Tài khoản</span><span>實際 / Thực tế</span><span>可用 / Khả dụng</span></div>
      ${row('現金 / Tiền mặt',cash)}
      ${row('銀行 / Ngân hàng',bank)}
    </div>
    <details class="fin-reserved-details"><summary>已累積及分配總額 / Tổng đã tích lũy và phân bổ: ${fmt(totalReserved)} TWD <span aria-hidden="true">⌄</span></summary>
      <div class="fin-reserved-breakdown">${detailRows||'<small>尚無帳戶 / Chưa có tài khoản</small>'}</div>
      <p>已累積金額會從指定帳戶的可用餘額扣除。 / Tiền tích lũy được trừ khỏi khả dụng của đúng tài khoản, không trừ khỏi số dư thực tế.</p>
    </details>
  </div>`;
}

function renderPlans(){
 const plans=[...data.budgets.map(item=>({kind:'budget',item})),...data.savings.map(item=>({kind:'saving',item})),...data.debts.map(item=>({kind:'debt',item}))];
 if(!el('finPlans'))return;el('finPlans').innerHTML=plans.length?plans.map(({kind,item:x})=>{
  let label='',detail='',progress='';
  if(kind==='budget'){
   const accumulated=Number(x.accumulated??x.reservedAmount??0),goal=Number(x.limit||0);
   label='▥';
   const unit={day:'天 / ngày',week:'週 / tuần',month:'月 / tháng',year:'年 / năm'}[x.durationUnit||x.period]||'月 / tháng';
   detail=`預算 / Ngân sách · 已累積 / Đã tích lũy: ${fmt(accumulated)} / ${fmt(goal)} TWD · 累積期間 / Chu kỳ: ${fmt(x.durationCount||1)} ${unit}`;
   progress=`<div class="fin-progress"><span style="width:${Math.min(100,goal?accumulated/goal*100:0)}%"></span></div>`;
  }else if(kind==='saving'){
   label='♧';detail=`儲蓄 / Tiết kiệm · 已累積 / Đã tích lũy: ${fmt(x.allocated)} / ${fmt(x.target)} TWD`;
   progress=`<div class="fin-progress"><span style="width:${Math.min(100,x.target?x.allocated/x.target*100:0)}%"></span></div>`;
  }else{
   label='♧';detail=`債務 / Công nợ · 本金 / Gốc: ${money(x.principal,x.currency)} · 已償還 / Đã trả: ${money(x.paid||0,x.currency)} · 剩餘 / Còn lại: ${money(x.principal-(x.paid||0),x.currency)}`;
  }
  const acc=acct(x.accountId||x.reserveAccountId);
  return `<div class="fin-plan-item"><div class="fin-plan-line"><span class="fin-plan-icon">${label}</span><div class="fin-info"><strong>${esc(x.name)}</strong><small>${detail}${acc?' · '+esc(acc.name):''}</small></div>${finMenu(kind,x.id)}</div>${progress}</div>`;
 }).join(''):'<p class="fin-empty">尚無計畫 / Chưa có kế hoạch</p>';
}

function renderV2(){renderAvailable();renderPlans();if(!el('finAccounts'))return;el('finAccounts').innerHTML=data.accounts.map(a=>`<div class="fin-row"><div class="fin-info"><strong>${esc(a.name)}</strong><small>實際 / Thực tế: ${money(balance(a),a.currency)} · 可用 / Khả dụng: ${money(reserveByAccount(a).available,a.currency)}</small></div><b>${money(balance(a),a.currency)}</b>${finMenu('account',a.id)}</div>`).join('');const sel=el('finReportAccount');if(sel){const old=sel.value;sel.innerHTML='<option value="all">全部 / Tất cả</option>'+data.accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('');sel.value=data.accounts.some(a=>a.id===old)?old:'all';reportAccount=sel.value}}
function svgBar(values){const max=Math.max(1,...values.flatMap(x=>[x.income,x.expense]));const w=540,h=230,base=190,space=500/Math.max(1,values.length);return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Biểu đồ cột thu nhập và chi tiêu" class="fin-svg"><line x1="24" y1="${base}" x2="535" y2="${base}" stroke="#d6c8bc"/>${values.map((x,i)=>{const center=30+(i+.5)*space,hi=155*x.income/max,he=155*x.expense/max;return `<rect x="${center-20}" y="${base-hi}" width="17" height="${hi}" rx="3" fill="#76a68a"><title>Thu: ${fmt(x.income)}</title></rect><rect x="${center+2}" y="${base-he}" width="17" height="${he}" rx="3" fill="#d49a72"><title>Chi: ${fmt(x.expense)}</title></rect><text x="${center}" y="211" text-anchor="middle" font-size="11" fill="currentColor">${esc(x.label)}</text>`}).join('')}</svg>`}
function svgPie(groups){const entries=Object.entries(groups).filter(([,n])=>n>0),total=entries.reduce((n,[,v])=>n+v,0);if(!total)return '<p class="fin-empty">尚無支出 / Chưa có chi tiêu</p>';const colors=['#d49a72','#76a68a','#b2a0c9','#e5c46b','#88b9c2','#c68b91'];let pos=0;const slices=entries.map(([name,val],i)=>{const start=pos;pos+=val/total;return `${colors[i%colors.length]} ${start*100}% ${pos*100}%`});return `<div class="fin-pie-layout"><div class="fin-pie" role="img" aria-label="Biểu đồ tròn chi tiêu theo tên giao dịch" style="background:conic-gradient(${slices.join(',')})"></div><div class="fin-pie-legend">${entries.map(([name,val],i)=>`<div><i style="background:${colors[i%colors.length]}"></i><span>${esc(name)}</span><b>${Math.round(val/total*100)}%</b></div>`).join('')}</div></div>`}
function financeChartData(period='month',account='all'){const base=new Date(),out=[];for(let i=4;i>=0;i--){let from,to,label;if(period==='year'){const y=base.getFullYear()-i;from=`${y}-01-01`;to=`${y+1}-01-01`;label=String(y)}else if(period==='day'){const d=new Date(base.getFullYear(),base.getMonth(),base.getDate()-i);from=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');const next=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1);to=next.getFullYear()+'-'+String(next.getMonth()+1).padStart(2,'0')+'-'+String(next.getDate()).padStart(2,'0');label=String(d.getMonth()+1)+'/'+d.getDate()}else{const d=new Date(base.getFullYear(),base.getMonth()-i,1);from=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01';const next=new Date(d.getFullYear(),d.getMonth()+1,1);to=next.getFullYear()+'-'+String(next.getMonth()+1).padStart(2,'0')+'-01';label=String(d.getMonth()+1)}const v=totals(data.transactions.filter(t=>t.date>=from&&t.date<to&&(account==='all'||t.accountId===account)&&['income','expense'].includes(t.type)));out.push({label,...v})}return out}
function chartMarkup(period='month',account='all'){const rows=data.transactions.filter(t=>t.type==='expense'&&(account==='all'||t.accountId===account)&&t.date.slice(0,period==='day'?10:period==='year'?4:7)===(period==='month'?selectedMonth:now().slice(0,period==='day'?10:4)));const groups={};rows.forEach(t=>{const name=(t.name||'未命名 / Chưa đặt tên').trim();groups[name]=(groups[name]||0)+(amountTwd(t)||0)});return `<h3>收入與支出 / Thu nhập và chi tiêu</h3><div class="fin-chart-key"><span>● 收入 / Thu</span><span>● 支出 / Chi</span></div>${svgBar(financeChartData(period,account))}<h3>支出項目分析 / Phân tích chi tiêu theo tên giao dịch</h3>${svgPie(groups)}`}
function renderReport(){if(!el('finReportContent'))return;el('finReportContent').innerHTML=chartMarkup(reportPeriod,reportAccount)}
function renderPerformanceFinance(){const root=el('finPerformanceStats');if(!root)return;root.innerHTML=['day','month','year'].map(type=>{const key=now().slice(0,type==='day'?10:type==='month'?7:4),v=totals(reportRows(type,key));return `<div class="fin-row"><div class="fin-info"><strong>${{day:'每日 / Ngày',month:'每月 / Tháng',year:'每年 / Năm'}[type]}</strong><small>收入 ${fmt(v.income)} · 支出 ${fmt(v.expense)}</small></div><strong>${fmt(v.income-v.expense)}</strong></div>`}).join('');const charts=el('finPerformanceCharts');if(charts)charts.innerHTML=chartMarkup('month','all')}
function render(){renderImportant();renderPerformanceFinance();if(!el('finSummary'))return;renderSummary();renderTransactions();renderV2();renderReport()}
function openAccount(a){
  // Cash is a single permanent account; additional accounts are bank accounts.
  const isCash=a?.kind==='cash';
  dialog(isCash?'編輯現金帳戶 / Sửa tài khoản tiền mặt':a?'編輯銀行帳戶 / Sửa tài khoản ngân hàng':'新增銀行帳戶 / Thêm ngân hàng',[
    {name:'name',label:'帳戶名稱 / Tên tài khoản',required:true},
    addCurrencyField(),
    {name:'opening',label:'期初餘額 / Số dư ban đầu',type:'number'}
  ],a||{name:'銀行 / Ngân hàng',currency:'TWD',opening:0},v=>{
    if(a){
      if(a.currency!==v.currency&&data.transactions.some(t=>t.accountId===a.id))throw Error('Không đổi tiền tệ tài khoản đã có giao dịch');
      Object.assign(a,{name:v.name,kind:isCash?'cash':'bank',currency:v.currency,opening:Number(v.opening)});
    }else data.accounts.push({id:uid(),name:v.name,kind:'bank',currency:v.currency,opening:Number(v.opening)});
    save();refreshRates();
  });
}
function openCategory(a){dialog('分類 / Danh mục thu chi',[{name:'name',label:'名稱 / Tên',required:true},{name:'type',label:'類型 / Loại',type:'select',options:[['expense','支出 / Chi'],['income','收入 / Thu']]},{name:'icon',label:'圖示 / Biểu tượng'}],a||{name:'',type:'expense',icon:'📁'},v=>{if(a)Object.assign(a,v);else data.categories.push({...v,id:uid()});save()})}
function openBudget(a){
 dialog('預算 / Ngân sách',[
  {name:'name',label:'名稱 / Tên kế hoạch',required:true},
  {name:'limit',label:'目標金額 / Hạn mức muốn đạt (TWD)',type:'number',required:true},
  {name:'durationCount',label:'累積期數 / Số chu kỳ tích lũy',type:'number',required:true},
  {name:'durationUnit',label:'時間單位 / Đơn vị chu kỳ',type:'select',options:[['day','天 / Ngày'],['week','週 / Tuần'],['month','月 / Tháng'],['year','年 / Năm']]},
  {name:'accumulated',label:'已累積金額 / Đã tích lũy (TWD)',type:'number',required:true},
  {name:'accountId',label:'累積帳戶 / Tài khoản tích lũy',type:'select',options:opt(data.accounts.filter(x=>x.currency==='TWD'))}
 ],a?{...a,accumulated:a.accumulated??a.reservedAmount??0,durationCount:a.durationCount||1,durationUnit:a.durationUnit||a.period||'month'}:{name:'',limit:'',durationCount:1,durationUnit:'month',accumulated:0,accountId:data.accounts.find(x=>x.currency==='TWD')?.id||''},v=>{
  const limit=Number(v.limit),accumulated=Number(v.accumulated),durationCount=Number(v.durationCount);
  if(!Number.isFinite(limit)||limit<=0||!Number.isFinite(accumulated)||accumulated<0||accumulated>limit||!Number.isInteger(durationCount)||durationCount<=0)throw Error('請輸入有效數字 / Nhập số hợp lệ; tiền tích lũy không vượt mục tiêu.');
  const account=acct(v.accountId);
  if(!account||account.currency!=='TWD')throw Error('請選擇新臺幣帳戶 / Chọn tài khoản TWD.');
  const previous=a?Number(a.accumulated??a.reservedAmount??0):0;
  const oldAccount=a?acct(a.accountId):null;
  const increase=accumulated-(oldAccount?.id===account.id?previous:0);
  const available=reserveByAccount(account).available;
  if(increase>available+0.000001)throw Error('可用餘額不足 / Tiền khả dụng không đủ.');
  const updated={...v,limit,accumulated,durationCount,reservedAmount:accumulated,reserve:true,rollover:false,period:v.durationUnit};
  if(a)Object.assign(a,updated);else data.budgets.push({...updated,id:uid()});
  save();plannerChanged();
 });
}

function openSaving(a){
 dialog('儲蓄 / Tiết kiệm',[
  {name:'name',label:'名稱 / Tên kế hoạch',required:true},
  {name:'target',label:'目標金額 / Hạn mức muốn đạt (TWD)',type:'number',required:true},
  {name:'durationCount',label:'累積期數 / Số chu kỳ tích lũy',type:'number',required:true},
  {name:'durationUnit',label:'時間單位 / Đơn vị chu kỳ',type:'select',options:[['day','日 / Ngày'],['week','週 / Tuần'],['month','月 / Tháng'],['year','年 / Năm']]},
  {name:'allocated',label:'已累積金額 / Đã tích lũy (TWD)',type:'number',required:true},
  {name:'accountId',label:'累積帳戶 / Tài khoản tích lũy',type:'select',options:opt(data.accounts.filter(x=>x.currency==='TWD'))}
 ],a?{...a,durationCount:a.durationCount||1,durationUnit:a.durationUnit||'month',allocated:a.allocated||0}:{name:'',target:'',durationCount:1,durationUnit:'month',allocated:0,accountId:data.accounts.find(x=>x.currency==='TWD')?.id||''},v=>{
  const target=Number(v.target),allocated=Number(v.allocated),durationCount=Number(v.durationCount);
  if(!(target>0)||!Number.isFinite(allocated)||allocated<0||allocated>target||!Number.isInteger(durationCount)||durationCount<1)throw Error('請輸入有效金額及期間 / Nhập số tiền và chu kỳ hợp lệ.');
  const account=acct(v.accountId);if(!account||account.currency!=='TWD')throw Error('請選擇 TWD 帳戶 / Chọn tài khoản TWD.');
  const previous=a&&a.accountId===account.id?Number(a.allocated||0):0;
  if(allocated-previous>reserveByAccount(account).available+0.000001)throw Error('可用餘額不足 / Không đủ tiền khả dụng.');
  const updated={...v,target,allocated,durationCount};
  if(a)Object.assign(a,updated);else data.savings.push({...updated,id:uid()});save();plannerChanged();
 });
}
function openDebt(a){
 dialog('債務 / Công nợ',[
  {name:'name',label:'名稱 / Tên người hoặc khoản nợ',required:true},
  {name:'kind',label:'類型 / Loại',type:'select',options:[['lent','借出 / Cho vay'],['borrowed','借入 / Đi vay']]},
  {name:'principal',label:'本金 / Số tiền gốc',type:'number',required:true},addCurrencyField(),
  {name:'accountId',label:'撥款／收款帳戶 / Tài khoản giải ngân/nhận tiền',type:'select',options:[['','尚未發生 / Chưa phát sinh dòng tiền'],...opt(data.accounts)]},
  {name:'paid',label:'已償還金額 / Số tiền đã trả hoặc thu hồi',type:'number',required:true},
  {name:'reserve',label:'預留還款資金 / Dành riêng tiền để trả nợ',type:'checkbox'},
  {name:'reserveAccountId',label:'預計還款帳戶 / Tài khoản dự kiến trả nợ',type:'select',options:[['','不選擇 / Không chọn'],...opt(data.accounts)]}
 ],a?{...a,paid:a.paid||0}:{name:'',kind:'lent',principal:'',currency:'TWD',accountId:'',paid:0,reserve:false,reserveAccountId:''},v=>{
  const principal=Number(v.principal),paid=Number(v.paid),previous=Number(a?.paid||0);
  if(!(principal>0)||!Number.isFinite(paid)||paid<0||paid>principal)throw Error('本金與已償還金額無效 / Số tiền gốc hoặc đã trả không hợp lệ.');
  if(a&&(a.kind!==v.kind||a.currency!==v.currency||a.accountId!==v.accountId)&&data.transactions.some(t=>t.debtId===a.id))throw Error('已有資金紀錄，不能更換類型、幣別或帳戶 / Khoản nợ đã phát sinh dòng tiền; không thể đổi loại, tiền tệ hoặc tài khoản.');
  const flowAccount=acct(v.reserveAccountId||v.accountId);
  const delta=paid-previous;
  if(delta!==0&&(!flowAccount||flowAccount.currency!==v.currency))throw Error('請選擇同幣別的收付款帳戶 / Chọn tài khoản thanh toán cùng tiền tệ.');
  if(delta>0&&v.kind==='borrowed'&&reserveByAccount(flowAccount).available<delta)throw Error('可用餘額不足 / Không đủ tiền khả dụng để trả nợ.');
  if(!a&&v.accountId&&acct(v.accountId)?.currency!==v.currency)throw Error('帳戶幣別不符 / Tiền tệ tài khoản không khớp.');
  const d=a||{id:uid()};
  if(!a){data.debts.push(d);if(v.accountId)data.transactions.push({id:uid(),type:v.kind==='lent'?'debt_out':'debt_in',name:v.name,amount:principal,currency:v.currency,date:now(),accountId:v.accountId,debtId:d.id});}
  Object.assign(d,{...v,principal,paid});
  if(delta!==0){
   // One signed adjustment transaction preserves previous repayment history and prevents double counting.
   data.transactions.push({id:uid(),type:delta>0?(v.kind==='lent'?'debt_in':'debt_out'):(v.kind==='lent'?'debt_out':'debt_in'),name:'償還調整 / Điều chỉnh trả nợ: '+v.name,amount:Math.abs(delta),currency:v.currency,date:now(),accountId:flowAccount.id,debtId:d.id,debtSettlement:true});
  }
  save();
 });
}
function download(name,content,type){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function csv(){const header=['date','type','name','amount','currency','twdAmount','account','category','notes','starred'];const lines=[header.join(','),...data.transactions.map(t=>header.map(k=>`"${String(k==='account'?acct(t.accountId)?.name||'':k==='category'?cat(t.categoryId)?.name||'':t[k]??'').replace(/"/g,'""')}"`).join(','))];download('cozy-finance.csv','\uFEFF'+lines.join('\r\n'),'text/csv;charset=utf-8')}
function wire(){el('finCancel').onclick=()=>el('finDialog').close();el('finAdd').onclick=()=>transactionForm();el('finPrev').onclick=()=>moveMonth(-1);el('finNext').onclick=()=>moveMonth(1);document.querySelectorAll('[data-fin-view]').forEach(b=>b.onclick=()=>{view=b.dataset.finView;document.querySelectorAll('[data-fin-view]').forEach(x=>x.classList.toggle('active',x===b));el('finTransactions').hidden=view==='report';el('finReport').hidden=view!=='report';el('finManage').hidden=true});el('finSearch').oninput=e=>{search=e.target.value.toLowerCase();renderTransactions()};el('finFilter').onclick=()=>el('finFilterOptions').hidden=!el('finFilterOptions').hidden;el('finType').onchange=e=>{filter=e.target.value;renderTransactions()};el('finOnlyStar').onchange=e=>{starOnly=e.target.checked;renderTransactions()};el('finAddAccount').onclick=()=>openAccount();el('finAddBudget').onclick=()=>openBudget();el('finAddSaving').onclick=()=>openSaving();el('finAddDebt').onclick=()=>openDebt();el('finAddPlan').onclick=()=>{dialog('新增計畫 / Thêm kế hoạch',[{name:'kind',label:'計畫類型 / Loại kế hoạch',type:'select',options:[['budget','預算 / Ngân sách'],['saving','儲蓄 / Tiết kiệm'],['debt','債務 / Công nợ']]}],{kind:'budget'},v=>{queueMicrotask(()=>({budget:openBudget,saving:openSaving,debt:openDebt}[v.kind])());return true})};document.querySelectorAll('[data-fin-section]').forEach(b=>b.onclick=()=>{finSection=b.dataset.finSection;document.querySelectorAll('[data-fin-section]').forEach(x=>x.classList.toggle('active',x===b));['transactions','planning','accounts'].forEach(x=>el('fin'+x[0].toUpperCase()+x.slice(1)+'Inner').hidden=x!==finSection)});el('finReportPeriod').onchange=e=>{reportPeriod=e.target.value;renderReport()};el('finReportAccount').onchange=e=>{reportAccount=e.target.value;renderReport()};el('finExportCsv').onclick=csv;el('finBackup').onclick=()=>download('cozy-finance-backup.json',JSON.stringify(data,null,2),'application/json');el('finRestore').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const value=JSON.parse(await file.text());if(value.version!==1||!Array.isArray(value.transactions)||!Array.isArray(value.accounts)||!Array.isArray(value.categories))throw Error('Sai định dạng');if(confirm('Nhập sẽ thay thế toàn bộ dữ liệu Thu chi hiện tại. Tiếp tục?')){data=value;save()}}catch(err){alert('Không nhập được: '+err.message)}e.target.value=''};
document.addEventListener('click',e=>{const b=e.target.closest('[data-fin-edit],[data-fin-delete],[data-fin-action]');if(!b)return;const type=b.dataset.finEdit||b.dataset.finDelete, id=b.dataset.finTarget, action=b.dataset.finAction;if(action==='copy'){const t=data.transactions.find(x=>x.id===id);if(t)transactionForm(null,{...t,id:undefined,repeat:'none'});return}if(action==='allocate'){const s=data.savings.find(x=>x.id===id);if(s)addSaving(s);return}if(action==='repay'){const d=data.debts.find(x=>x.id===id);if(d)payDebt(d);return}const arr={transaction:data.transactions,account:data.accounts,budget:data.budgets,saving:data.savings,debt:data.debts,category:data.categories}[type];const obj=arr?.find(x=>x.id===id);if(!obj)return;if(b.dataset.finEdit){({transaction:transactionForm,account:openAccount,budget:openBudget,saving:openSaving,debt:openDebt,category:openCategory}[type])(obj);return}if(!confirm('確定刪除？ / Xác nhận xóa '+obj.name+'?'))return;if(type==='transaction'){const ids=obj.transferId?data.transactions.filter(x=>x.transferId===obj.transferId).map(x=>x.id):[obj.id];data.transactions=data.transactions.filter(x=>!ids.includes(x.id));save();return}if(type==='account'&&obj.kind==='cash'){alert('Tài khoản Tiền mặt là tài khoản mặc định, chỉ có thể sửa.');return}if(type==='account'&&(data.transactions.some(t=>t.accountId===id)||data.budgets.some(x=>x.accountId===id)||data.savings.some(x=>x.accountId===id)||data.debts.some(x=>x.accountId===id||x.reserveAccountId===id))){alert('Tài khoản đang có giao dịch; không thể xóa.');return}if(type==='category'&&data.transactions.some(t=>t.categoryId===id)){alert('Danh mục đang được sử dụng; không thể xóa.');return}if(type==='debt'&&data.transactions.some(t=>t.debtId===id)){alert('Công nợ đã phát sinh dòng tiền; cần xử lý giao dịch liên quan trước.');return}data[type==='account'?'accounts':type==='budget'?'budgets':type==='saving'?'savings':type==='debt'?'debts':'categories']=arr.filter(x=>x.id!==id);save()});
document.addEventListener('click',e=>{const b=e.target.closest('[data-action],[data-recurring],[data-skip],[data-edit-account],[data-edit-budget],[data-edit-saving],[data-add-saving],[data-edit-debt],[data-pay-debt],[data-edit-category]');if(!b)return;const t=data.transactions.find(x=>x.id===b.closest('[data-fin-id]')?.dataset.finId);if(b.dataset.action==='star'&&t){t.starred=!t.starred;save()}else if(b.dataset.action==='menu'&&t){const action=prompt('1 = Sửa, 2 = Sao chép, 3 = Xóa','1');if(action==='1'){if(t.transferId)alert('Chuyển khoản chỉ hỗ trợ xóa và tạo lại');else transactionForm(t)}if(action==='2')transactionForm(null,{...t,id:undefined,repeat:'none'});if(action==='3')removeTransaction(t)}else if(b.dataset.recurring){const r=data.recurring.find(x=>x.id===b.dataset.recurring);if(r)confirmRecurring(r)}else if(b.dataset.skip){const r=data.recurring.find(x=>x.id===b.dataset.skip);if(r){r.nextDate=nextDate(r.nextDate,r.repeat);save()}}else if(b.dataset.editAccount)openAccount(acct(b.dataset.editAccount));else if(b.dataset.editBudget)openBudget(data.budgets.find(x=>x.id===b.dataset.editBudget));else if(b.dataset.editSaving)openSaving(data.savings.find(x=>x.id===b.dataset.editSaving));else if(b.dataset.addSaving)addSaving(data.savings.find(x=>x.id===b.dataset.addSaving));else if(b.dataset.editDebt)openDebt(data.debts.find(x=>x.id===b.dataset.editDebt));else if(b.dataset.payDebt)payDebt(data.debts.find(x=>x.id===b.dataset.payDebt));else if(b.dataset.editCategory)openCategory(cat(b.dataset.editCategory));});
el('importantFinanceList').addEventListener('click',e=>{const id=e.target.closest('[data-fin-id]')?.dataset.finId;if(id){location.hash='#future';view='transactions';document.querySelector('[data-fin-view="transactions"]').click();search='';el('finSearch').value='';renderTransactions();setTimeout(()=>document.querySelector(`[data-fin-id="${CSS.escape(id)}"]`)?.scrollIntoView({block:'center'}),100)}});
}
function moveMonth(delta){const [y,m]=selectedMonth.split('-').map(Number);const d=new Date(y,m-1+delta,1);selectedMonth=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');render()}
wire();render();if(data.rateDate!==now())refreshRates();
})();

// ==========================================
// 效率分析 V2 — non-destructive, read-only analysis + isolated simulations
// ==========================================
(function(){
'use strict';
const $e=id=>document.getElementById(id);
const KEY='cozy-efficiency-v2';
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);
const dateNow=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const dayAdd=(s,n)=>{const [y,m,d]=s.split('-').map(Number);const dt=new Date(y,m-1,d+n);return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`};
let cache={reports:[],scenarios:[]},canWrite=true;
try{const v=JSON.parse(localStorage.getItem(KEY));if(v&&typeof v==='object')cache={reports:Array.isArray(v.reports)?v.reports:[],scenarios:Array.isArray(v.scenarios)?v.scenarios:[]}}catch(e){canWrite=false;console.warn('Efficiency storage unreadable; write disabled',e)}
function persist(){if(!canWrite){alert('無法讀取舊資料，停止寫入 / Không đọc được dữ liệu cũ; không ghi đè.');return false}try{localStorage.setItem(KEY,JSON.stringify(cache));return true}catch(e){alert('無法儲存 / Không lưu được');return false}}
let main='report';
const getPlanner=()=>{try{const v=JSON.parse(localStorage.getItem('cozy-planner-demo-v1'));return v&&typeof v==='object'?v:{} }catch{return {}}};
const getFin=()=>{try{const v=JSON.parse(localStorage.getItem('cozy-finance-v1'));return v&&typeof v==='object'?v:{} }catch{return {}}};
const pref=(type,date)=>type==='day'?date:type==='month'?date.slice(0,7):date.slice(0,4);
function bounds(type,key){const start=type==='day'?key:type==='month'?key+'-01':key+'-01-01';const end=type==='day'?dayAdd(start,1):type==='month'?dayAdd(new Date(Number(key.slice(0,4)),Number(key.slice(5,7)),1).getFullYear()+'-'+String(new Date(Number(key.slice(0,4)),Number(key.slice(5,7)),1).getMonth()+1).padStart(2,'0')+'-01',0):String(Number(key)+1)+'-01-01';return [start,end]}
function endOfPeriod(type,key){if(type==='day')return dayAdd(key,1);if(type==='month'){const [y,m]=key.split('-').map(Number);const d=new Date(y,m,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`}return `${Number(key)+1}-01-01`}
function taskOccurs(t,day){if(!t.date||day<t.date||t.endDate&&day>t.endDate||t.excludedDates?.includes(day))return false;if(Object.values(t.moved||{}).includes(day))return true;if(Object.prototype.hasOwnProperty.call(t.moved||{},day))return false;const r=t.repeat||'none';if(r==='none')return t.date===day;if(r==='daily')return true;const a=new Date(t.date+'T12:00:00'),b=new Date(day+'T12:00:00');if(r==='weekly')return a.getDay()===b.getDay();if(r==='monthly')return a.getDate()===b.getDate();if(r==='yearly')return a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();return false}
function taskInstance(t,day){const origin=Object.entries(t.moved||{}).find(([,d])=>d===day)?.[0]||day;const skip=(t.skippedDates||[]).includes(origin);const done=!skip&&!!t.completions?.[origin];const o=t.overrides?.[origin];const refs=o&&(Object.hasOwn(o,'goalRefs')||Object.hasOwn(o,'goalRef'))?goalIds(o):goalIds(t);return {id:t.id,day,origin,name:t.overrides?.[origin]?.name||t.name||'',done,skipped:skip,goalRefs:refs}}
function collect(type,key,planner,includeFuture=false){const from=type==='day'?key:type==='month'?key+'-01':key+'-01-01',to=endOfPeriod(type,key),today=dateNow();const items=[];let cursor=from,limit=0;while(cursor<to&&(includeFuture||cursor<=today)&&limit++<367){for(const t of planner.tasks||[])if(taskOccurs(t,cursor))items.push(taskInstance(t,cursor));cursor=dayAdd(cursor,1)}return items}
function finance(type,key,fin){let income=0,expense=0,unknown=0;for(const t of fin.transactions||[]){if(!['income','expense'].includes(t.type)||String(t.date||'').slice(0,key.length)!==key)continue;const rate=t.currency==='TWD'?1:Number(fin.rates?.[t.currency]);const amount=t.twdAmount!=null?Number(t.twdAmount):Number(t.amount)*(rate||NaN);if(!Number.isFinite(amount)){unknown++;continue}if(t.type==='income')income+=amount;else expense+=amount}return {income,expense,net:income-expense,unknown}}
function metrics(type,key){const p=getPlanner(),f=getFin();const goals=(p.goalLists?.[type]||[]).filter(g=>g.period===key);const tasks=collect(type,key,p);return {type,key,goals,tasks,finance:finance(type,key,f)}}
function donut(done,total){const pct=total?Math.round(done/total*100):0;return `<div class="eff-donut" style="--done:${pct}%"><span>${pct}%</span></div>`}
function line(label,value){return `<div class="eff-line"><span>${label}</span><strong>${value}</strong></div>`}
function bar(done,total){const pct=total?done/total*100:0;return `<div class="eff-bar" role="img" aria-label="${done}/${total}"><span style="width:${pct}%"></span></div>`}
function showGoal(id){const m=metrics($e('effPeriod').value,periodValue()),g=m.goals.find(x=>String(x.id)===id);if(!g)return;const p=getPlanner(),start=g.period.length===10?g.period:g.period.length===7?g.period+'-01':g.period+'-01-01',end=endOfPeriod(g.period.length===10?'day':g.period.length===7?'month':'year',g.period);
const related=collect(g.period.length===10?'day':g.period.length===7?'month':'year',g.period,p,true).filter(t=>t.goalRefs.includes(id));const complete=related.filter(t=>t.done).length;const events=(p.events||[]).filter(e=>goalIds(e).includes(id)&&e.date>=start&&e.date<end);const f=getFin();const plans=['budgets','savings','debts'].flatMap(k=>(f[k]||[]).filter(x=>goalIds(x).includes(id)));const target=$e('effGoalDetail');target.hidden=false;target.innerHTML=`<h4>${safe(g.name)}</h4><div class="eff-goal-detail">${donut(complete,related.length)}<div>${line('關聯任務 / Công việc liên kết',`${complete}/${related.length}`)}${line('目標狀態 / Trạng thái mục tiêu',g.done?'已完成 / Đã hoàn thành':'未完成 / Chưa hoàn thành')}</div></div>${related.length?related.map(t=>`<div class="eff-line"><span>${t.done?'🟢':'🔴'} ${safe(t.name)} <small>${safe(t.day)}</small></span></div>`).join(''):'<p class="empty">尚無關聯任務 / Chưa có công việc liên kết.</p>'}${events.map(e=>`<div class="eff-line">◷ ${safe(e.date)} · ${safe(e.name)}</div>`).join('')}${plans.map(x=>`<div class="eff-line">＄ ${safe(x.name)}</div>`).join('')}`}
function periodValue(){return $e('effDate').value}
function render(){if(!$e('effReport'))return;const type=$e('effPeriod').value,key=periodValue();if(!key)return;const m=metrics(type,key),goalsDone=m.goals.filter(g=>g.done).length,tasksDone=m.tasks.filter(t=>t.done).length,fin=m.finance;
$e('effSummary').innerHTML=`<div>${line('目標 / Mục tiêu',`${goalsDone}/${m.goals.length}`)}</div><div>${line('任務 / Công việc',`${tasksDone}/${m.tasks.length}`)}</div><div>${line('收支差額 / Chênh lệch',`${fmt(fin.net)} TWD${fin.unknown?' *':''}`)}</div>`;
$e('effGoals').innerHTML=`<div class="eff-chart-head">${donut(goalsDone,m.goals.length)}<div>${line('已完成 / Đã hoàn thành',goalsDone)}${line('未完成 / Chưa hoàn thành',m.goals.length-goalsDone)}</div></div><div class="eff-goal-list">${m.goals.length?m.goals.map(g=>`<button type="button" data-eff-goal="${safe(g.id)}">${g.done?'🟢':'🔴'} ${safe(g.name)} <span>›</span></button>`).join(''):'<p class="empty">尚無目標 / Chưa có mục tiêu.</p>'}</div><div id="effGoalDetail" hidden></div>`;
$e('effTasks').innerHTML=`<div class="eff-chart-head">${donut(tasksDone,m.tasks.length)}<div>${line('已完成 / Đã hoàn thành',tasksDone)}${line('未完成 / Chưa hoàn thành',m.tasks.length-tasksDone)}</div></div>${bar(tasksDone,m.tasks.length)}<div class="eff-legend"><span>● 已完成 / Đã xong</span><span>● 未完成 / Chưa xong</span></div>`;
$e('effFinance').innerHTML=`${line('收入 / Thu nhập',fmt(fin.income)+' TWD')}${line('支出 / Chi tiêu',fmt(fin.expense)+' TWD')}${line('差額 / Chênh lệch',fmt(fin.net)+' TWD')}${fin.unknown?`<p class="empty">${fin.unknown} 筆交易缺少匯率 / ${fin.unknown} giao dịch thiếu tỷ giá, chưa cộng.</p>`:''}`;
const notes=[];if(!m.goals.length&&!m.tasks.length)notes.push('本期尚無目標與任務 / Kỳ này chưa có mục tiêu và công việc.');else {if(m.goals.length)notes.push(`目標完成 ${goalsDone}/${m.goals.length} / Hoàn thành ${goalsDone}/${m.goals.length} mục tiêu.`);if(m.tasks.length)notes.push(`任務完成 ${tasksDone}/${m.tasks.length} / Hoàn thành ${tasksDone}/${m.tasks.length} công việc.`);if(m.tasks.some(t=>!t.done&&t.day<dateNow()))notes.push('有尚未完成的過去任務 / Có công việc trong quá khứ chưa hoàn thành.')}notes.push(fin.net>=0?'收入不低於支出 / Thu nhập không thấp hơn chi tiêu.':'支出高於收入 / Chi tiêu vượt thu nhập.');$e('effInsights').innerHTML=notes.map(n=>`<p>${safe(n)}</p>`).join('');
const today=dateNow(),past=key<pref(type,today);$e('effForecast').innerHTML= past?'<p class="empty">歷史期間 / Đây là kỳ đã qua.</p>':m.tasks.length?`<p>依目前紀錄，已完成 ${tasksDone}/${m.tasks.length} 項任務。 / Theo dữ liệu hiện có, đã xong ${tasksDone}/${m.tasks.length} công việc.</p><p class="empty">無足夠依據預測目標完成日期 / Chưa đủ dữ liệu để dự đoán ngày hoàn thành mục tiêu.</p>`:'<p class="empty">資料不足，尚無法預測 / Chưa đủ dữ liệu dự báo.</p>';
renderSaved();}
function renderSaved(){const root=$e('effSaved');root.innerHTML=cache.reports.length?cache.reports.slice().reverse().map(r=>`<div class="eff-line"><span>${safe(r.key)} · ${safe(r.savedAt.slice(0,10))} · ${r.goalsDone}/${r.goalsTotal} 目標 · ${r.tasksDone}/${r.tasksTotal} 任務</span><button type="button" data-eff-delete-report="${safe(r.id)}">刪除</button></div>`).join(''):'<p class="empty">尚無已儲存報告 / Chưa lưu báo cáo.</p>'}
function changePeriod(){const t=$e('effPeriod').value,d=$e('effDate');d.type=t==='day'?'date':t==='month'?'month':'number';d.min=t==='year'?'1900':'';d.max=t==='year'?'9999':'';d.value=pref(t,dateNow());render()}
function saveReport(){const m=metrics($e('effPeriod').value,periodValue());const r={id:String(Date.now())+Math.random(),savedAt:new Date().toISOString(),type:m.type,key:m.key,goalsTotal:m.goals.length,goalsDone:m.goals.filter(g=>g.done).length,tasksTotal:m.tasks.length,tasksDone:m.tasks.filter(t=>t.done).length,finance:m.finance};cache.reports.push(r);if(!persist())cache.reports.pop();renderSaved()}
const fields=['Income','Expense','Hours','Minutes','Work','Duration','Days'];
function labInputs(){const v={};for(const f of fields)v[f]=Number($e('eff'+f).value);return v}
function calculate(v){const daily=v.Hours*60+v.Minutes;return {net:(v.Income-v.Expense)*v.Days/30,capacity:Math.floor(daily*v.Days/v.Duration),required:v.Work*v.Duration,available:daily*v.Days}}
function valid(v){return fields.every(f=>Number.isFinite(v[f])&&v[f]>=0)&&v.Hours<=24&&v.Minutes<=59&&v.Hours*60+v.Minutes<=1440&&v.Duration>0&&v.Days>=1&&Number.isInteger(v.Work)&&Number.isInteger(v.Days)}
function renderLab(){const v=labInputs(),root=$e('effSimulation');if(!valid(v)){root.textContent='請輸入有效數值 / Vui lòng nhập giá trị hợp lệ.';return}const c=calculate(v);root.innerHTML=`<h3>模擬結果 / Kết quả</h3>${line('預估收支差額 / Chênh lệch dự tính',fmt(c.net)+' TWD')}${line('可安排任務 / Số việc đủ thời gian',fmt(c.capacity))}${line('計畫任務 / Công việc dự kiến',fmt(v.Work))}${line('所需時間 / Thời gian cần',fmt(c.required/60)+' 小時 / giờ')}${line('可用時間 / Thời gian có',fmt(c.available/60)+' 小時 / giờ')}<p class="empty">僅依輸入數值推算，不修改實際資料 / Chỉ là mô phỏng theo giả định, không thay đổi dữ liệu thật.</p>`;renderScenarios()}
function renderScenarios(){const root=$e('effScenarios');root.innerHTML=cache.scenarios.map(s=>{const c=calculate(s.inputs);return `<div class="eff-line"><span><strong>${safe(s.name)}</strong><small> ${fmt(c.net)} TWD · ${fmt(c.capacity)} 任務</small></span><span><button type="button" data-eff-load="${safe(s.id)}">載入 / Mở</button> <button type="button" data-eff-remove="${safe(s.id)}">刪除</button></span></div>`}).join('')}
function saveScenario(){const v=labInputs();if(!valid(v))return alert('請輸入有效數值 / Dữ liệu không hợp lệ.');const s={id:String(Date.now())+Math.random(),name:$e('effScenarioName').value.trim()||'方案 '+(cache.scenarios.length+1),inputs:v};cache.scenarios.push(s);if(!persist())cache.scenarios.pop();renderScenarios()}
function init(){if(!$e('effPeriod'))return;document.querySelectorAll('[data-eff-main]').forEach(b=>b.onclick=()=>{main=b.dataset.effMain;document.querySelectorAll('[data-eff-main]').forEach(x=>x.classList.toggle('active',x===b));$e('effReport').hidden=main!=='report';$e('effLab').hidden=main!=='lab';if(main==='report')render();else renderLab()});$e('effPeriod').onchange=changePeriod;$e('effDate').onchange=render;$e('effSaveReport').onclick=saveReport;$e('effSaveScenario').onclick=saveScenario;for(const f of fields)$e('eff'+f).addEventListener('input',renderLab);$e('effGoals').addEventListener('click',e=>{const b=e.target.closest('[data-eff-goal]');if(b)showGoal(b.dataset.effGoal)});$e('effSaved').addEventListener('click',e=>{const b=e.target.closest('[data-eff-delete-report]');if(!b)return;if(!confirm('刪除此報告？ / Xóa báo cáo đã lưu?'))return;cache.reports=cache.reports.filter(r=>r.id!==b.dataset.effDeleteReport);if(persist())renderSaved()});$e('effScenarios').addEventListener('click',e=>{const load=e.target.closest('[data-eff-load]'),del=e.target.closest('[data-eff-remove]');if(load){const s=cache.scenarios.find(x=>x.id===load.dataset.effLoad);if(s){for(const f of fields)$e('eff'+f).value=s.inputs[f];renderLab()}}if(del){if(!confirm('刪除此方案？ / Xóa phương án?'))return;cache.scenarios=cache.scenarios.filter(x=>x.id!==del.dataset.effRemove);if(persist())renderScenarios()}});window.addEventListener('storage',e=>{if(['cozy-planner-demo-v1','cozy-finance-v1'].includes(e.key)&&!$e('effReport').hidden)render()});window.addEventListener('cozy:planner-updated',()=>{if(!$e('effReport').hidden)render()});document.addEventListener('click',e=>{if(e.target.closest('#performancePage'))return;if(location.hash==='#performance')queueMicrotask(render)},true);changePeriod();renderLab();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
