
"use strict";

/*
  COZY LIFE PLANNER
  Schedule management upgrade

  Uses the existing index.html and style.css.
  Storage key is unchanged.
*/

const $ = id => document.getElementById(id);
const STORAGE_KEY = "cozy-planner-demo-v1";

const pad = n => String(n).padStart(2, "0");

function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayKey() {
  return dateKey(new Date());
}

function validDate(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key || "")) return false;

  const [y, m, d] = key.split("-").map(Number);
  const value = new Date(y, m - 1, d);

  return value.getFullYear() === y &&
    value.getMonth() === m - 1 &&
    value.getDate() === d;
}

function parseDate(key) {
  if (!validDate(key)) return null;
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(key, days) {
  const date = parseDate(key);
  if (!date) return key;
  date.setDate(date.getDate() + days);
  return dateKey(date);
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
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.className = className;
  b.onclick = handler;
  return b;
}

function emptyMessage(message) {
  const p = document.createElement("p");
  p.className = "empty";
  p.textContent = message;
  return p;
}

function makeField(labelText, type, value = "") {
  const label = document.createElement("label");
  label.textContent = labelText;

  const input = document.createElement("input");
  input.type = type;
  input.value = value;
  input.style.display = "block";
  input.style.width = "100%";
  label.append(input);

  return { label, input };
}

function styleForm(form) {
  Object.assign(form.style, {
    display: "grid",
    gap: "12px",
    padding: "16px",
    margin: "16px 0",
    border: "1px solid #eadfd5",
    borderRadius: "12px"
  });
}

function styleRow(row) {
  Object.assign(row.style, {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "10px"
  });
}

// =====================================
// 1. LOAD AND PROTECT DATA
// =====================================

let state;
let storageReadable = true;

try {
  const raw = localStorage.getItem(STORAGE_KEY);
  state = raw ? JSON.parse(raw) : {};
} catch (error) {
  console.error(error);
  storageReadable = false;
  state = {};
  alert(
    "無法讀取原有資料，已停止儲存以避免覆蓋。" +
    "\nKhông đọc được dữ liệu cũ. Ứng dụng sẽ không ghi đè dữ liệu."
  );
}

if (!state || typeof state !== "object" ||
    Array.isArray(state)) {
  state = {};
}

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
  if (!storageReadable) {
    alert("資料尚未安全載入 / Chưa thể lưu dữ liệu an toàn.");
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error(error);
    alert("儲存失敗 / Lưu dữ liệu thất bại.");
    return false;
  }
}

// =====================================
// 2. MIGRATE OLD DATA
// =====================================

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
        period: periodKey(type),
        name: oldText.trim(),
        done: false,
        progress: 0,
        important: false
      });
    }

    for (const goal of items) {
      if (!goal.id) goal.id = makeId();
      if (!goal.period) goal.period = periodKey(type);

      if (typeof goal.done !== "boolean") {
        goal.done = Number(goal.progress) >= 100;
      }

      goal.important = !!goal.important;
      goal.progress = goal.done ? 100 : 0;
    }
  }

  state.goalPeriodMigrationV1 = true;

  for (const task of state.tasks) {
    if (!task.id) task.id = makeId();

    if (!validDate(task.date)) {
      task.date = todayKey();
    }

    if (!["none", "daily", "weekly", "monthly", "yearly"]
      .includes(task.repeat)) {
      task.repeat = "none";
    }

    task.important = !!task.important;

    if (!task.completions ||
        typeof task.completions !== "object" ||
        Array.isArray(task.completions)) {
      task.completions = {};
      if (task.done) task.completions[task.date] = true;
    }

    if (!Array.isArray(task.excludedDates)) {
      task.excludedDates = [];
    }

    if (!task.overrides ||
        typeof task.overrides !== "object" ||
        Array.isArray(task.overrides)) {
      task.overrides = {};
    }

    if (!validDate(task.endDate)) {
      task.endDate = "";
    }
  }

  for (const event of state.events) {
    if (!event.id) event.id = makeId();
  }

  save();
}

migrateData();

// =====================================
// 3. VIEW STATE
// =====================================

const now = new Date();

let year = now.getFullYear();
let month = now.getMonth();
let selected = todayKey();
let selectedTaskDate = todayKey();
let activeGoalType = "year";

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

const repeatLabels = {
  none: "不重複 / Không lặp lại",
  daily: "每天 / Hằng ngày",
  weekly: "每週 / Hằng tuần",
  monthly: "每月 / Hằng tháng",
  yearly: "每年 / Hằng năm"
};

// =====================================
// 4. NAVIGATION
// =====================================

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

  if (target === "tasks") renderScheduleTasks();
  if (target === "goals") renderGoals();

  if (target === "home") {
    renderCalendar();
    renderTasks();
    renderImportantGoals();
    renderPerformance();
  }

  if (target === "performance") renderPerformance();

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
  link.onclick = e => {
    e.preventDefault();
    navigate(link.dataset.page);
  };
});

document.querySelectorAll("[data-schedule-section]")
  .forEach(link => {
    link.onclick = e => {
      e.preventDefault();
      navigate(link.dataset.scheduleSection);
    };
  });

document.querySelectorAll("[data-back-schedule]")
  .forEach(button => {
    button.onclick = () => navigate("calendar");
  });

window.addEventListener("hashchange", () => {
  showPage(location.hash.slice(1) || "home");
});

// =====================================
// 5. RECURRING TASK RULES
// =====================================

function occursByRule(task, key) {
  if (!validDate(key) || !validDate(task.date)) {
    return false;
  }

  if (key < task.date) return false;
  if (task.endDate && key > task.endDate) return false;

  const repeat = task.repeat || "none";

  if (repeat === "none") return key === task.date;
  if (repeat === "daily") return true;

  const start = parseDate(task.date);
  const current = parseDate(key);

  if (repeat === "weekly") {
    return start.getDay() === current.getDay();
  }

  if (repeat === "monthly") {
    return start.getDate() === current.getDate();
  }

  if (repeat === "yearly") {
    return start.getMonth() === current.getMonth() &&
      start.getDate() === current.getDate();
  }

  return false;
}

function taskOccursOn(task, key) {
  if (!occursByRule(task, key)) return false;

  return !task.excludedDates.includes(key);
}

function taskName(task, key) {
  const override = task.overrides?.[key];

  return typeof override?.name === "string"
    ? override.name
    : task.name;
}

function taskImportant(task, key) {
  const override = task.overrides?.[key];

  return typeof override?.important === "boolean"
    ? override.important
    : task.important;
}

function getTasksForDate(key) {
  return state.tasks
    .filter(task => taskOccursOn(task, key))
    .sort((a, b) =>
      Number(taskImportant(b, key)) -
      Number(taskImportant(a, key))
    );
}

function isTaskDone(task, key) {
  return !!task.completions?.[key];
}

function refreshTasks() {
  renderTasks();
  renderScheduleTasks();
  renderCalendar();
}

function setTaskDone(task, key, done) {
  if (done) {
    task.completions[key] = true;
  } else {
    delete task.completions[key];
  }

  save();
  refreshTasks();
}

// =====================================
// 6. EDIT / ADD TASK
// =====================================

function showTaskForm(
  container,
  defaultDate,
  editingTask = null,
  mode = "series"
) {
  container.querySelectorAll(".task-editor-form")
    .forEach(form => form.remove());

  const form = document.createElement("form");
  form.className = "task-editor-form";
  styleForm(form);

  const single = !!editingTask && mode === "single";

  const title = document.createElement("h3");
  title.textContent = editingTask
    ? single
      ? "編輯單次待辦 / Sửa riêng ngày này"
      : "編輯整個系列 / Sửa toàn bộ chuỗi"
    : "新增待辦 / Thêm công việc";

  const nameField = makeField(
    "工作名稱 / Tên công việc",
    "text",
    editingTask
      ? single
        ? taskName(editingTask, defaultDate)
        : editingTask.name
      : ""
  );

  nameField.input.required = true;
  nameField.input.maxLength = 150;

  const dateField = makeField(
    "開始日期 / Ngày bắt đầu",
    "date",
    editingTask?.date || defaultDate
  );

  dateField.input.required = true;

  const repeatLabel = document.createElement("label");
  repeatLabel.textContent = "重複設定 / Lặp lại";

  const repeatSelect = document.createElement("select");

  for (const [value, text] of Object.entries(repeatLabels)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    repeatSelect.append(option);
  }

  repeatSelect.value = editingTask?.repeat || "none";
  repeatLabel.append(repeatSelect);

  const endField = makeField(
    "結束日期 / Ngày kết thúc lặp lại",
    "date",
    editingTask?.endDate || ""
  );

  const importantLabel = document.createElement("label");
  const importantInput = document.createElement("input");
  importantInput.type = "checkbox";

  importantInput.checked = editingTask
    ? single
      ? taskImportant(editingTask, defaultDate)
      : editingTask.important
    : false;

  importantLabel.append(
    importantInput,
    document.createTextNode(
      " ★ 重要事項 / Công việc quan trọng"
    )
  );

  const note = document.createElement("p");
  note.style.fontSize = "13px";
  note.style.opacity = "0.75";

  if (single) {
    note.textContent =
      "只修改這一天的名稱與重要標記。" +
      " / Chỉ sửa tên và dấu sao của ngày này.";

    dateField.label.hidden = true;
    repeatLabel.hidden = true;
    endField.label.hidden = true;
  } else {
    note.textContent =
      "每月31日不會出現在沒有31日的月份。" +
      " / Ngày 31 không xuất hiện trong tháng thiếu ngày 31.";
  }

  function updateEndVisibility() {
    if (!single) {
      endField.label.hidden =
        repeatSelect.value === "none";
    }
  }

  repeatSelect.onchange = updateEndVisibility;
  updateEndVisibility();

  const actions = document.createElement("div");
  styleRow(actions);

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "primary";
  submit.textContent = "儲存 / Lưu";

  const cancel = makeButton(
    "取消 / Hủy",
    () => form.remove()
  );

  actions.append(submit, cancel);

  form.append(
    title,
    note,
    nameField.label,
    dateField.label,
    repeatLabel,
    endField.label,
    importantLabel,
    actions
  );

  form.onsubmit = e => {
    e.preventDefault();

    const name = nameField.input.value.trim();

    if (!name) {
      alert("請輸入名稱 / Hãy nhập tên công việc.");
      return;
    }

    if (single) {
      editingTask.overrides[defaultDate] = {
        ...editingTask.overrides[defaultDate],
        name,
        important: importantInput.checked
      };
    } else {
      const startDate = dateField.input.value;
      const endDate = repeatSelect.value === "none"
        ? ""
        : endField.input.value;

      if (!validDate(startDate)) {
        alert("開始日期錯誤 / Ngày bắt đầu không hợp lệ.");
        return;
      }

      if (
        endDate &&
        (!validDate(endDate) || endDate < startDate)
      ) {
        alert(
          "結束日期不能早於開始日期。" +
          " / Ngày kết thúc không thể trước ngày bắt đầu."
        );
        return;
      }

      if (editingTask) {
        editingTask.name = name;
        editingTask.date = startDate;
        editingTask.repeat = repeatSelect.value;
        editingTask.endDate = endDate;
        editingTask.important = importantInput.checked;
      } else {
        state.tasks.push({
          id: makeId(),
          name,
          date: startDate,
          repeat: repeatSelect.value,
          endDate,
          important: importantInput.checked,
          completions: {},
          excludedDates: [],
          overrides: {}
        });
      }
    }

    save();
    refreshTasks();
  };

  container.append(form);
  nameField.input.focus();
  form.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}

function editTask(task, key) {
  selectedTaskDate = key;
  navigate("tasks");
  renderScheduleTasks();

  let mode = "series";

  if (task.repeat !== "none") {
    const choice = prompt(
      "選擇修改方式 / Chọn cách chỉnh sửa:\n" +
      "1 = Chỉ ngày này\n" +
      "2 = Toàn bộ chuỗi\n" +
      "0 = Hủy",
      "1"
    );

    if (choice === null || choice === "0") return;

    if (!["1", "2"].includes(choice)) {
      alert("請選擇 1 或 2 / Hãy chọn 1 hoặc 2.");
      return;
    }

    mode = choice === "1" ? "single" : "series";
  }

  showTaskForm(
    $("scheduleTaskList"),
    key,
    task,
    mode
  );
}

function deleteTask(task, key) {
  if (task.repeat === "none") {
    if (!confirm("刪除此工作？ / Xóa công việc này?")) {
      return;
    }

    state.tasks = state.tasks.filter(item => item !== task);
  } else {
    const choice = prompt(
      "選擇刪除方式 / Chọn cách xóa:\n" +
      "1 = Chỉ lần xuất hiện này\n" +
      "2 = Xóa toàn bộ chuỗi và lịch sử\n" +
      "0 = Hủy",
      "0"
    );

    if (choice === null || choice === "0") return;

    if (choice === "1") {
      if (!task.excludedDates.includes(key)) {
        task.excludedDates.push(key);
      }
    } else if (choice === "2") {
      if (!confirm(
        "將刪除整個系列及完成紀錄。" +
        "\nXóa cả chuỗi và lịch sử hoàn thành?"
      )) return;

      state.tasks = state.tasks.filter(item => item !== task);
    } else {
      return;
    }
  }

  save();
  refreshTasks();
}

function createTaskRow(task, key, compact = false) {
  const done = isTaskDone(task, key);

  const row = document.createElement("div");
  row.className = "task" + (done ? " done" : "");
  styleRow(row);

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = done;

  checkbox.onchange = () => {
    setTaskDone(task, key, checkbox.checked);
  };

  const label = document.createElement("span");
  label.textContent = taskName(task, key);
  label.style.flex = "1";
  label.style.minWidth = "100px";

  if (done) {
    label.style.textDecoration = "line-through";
    label.style.opacity = "0.6";
  }

  const star = makeButton(
    taskImportant(task, key) ? "★" : "☆",
    () => {
      if (task.repeat === "none") {
        task.important = !task.important;
      } else {
        task.overrides[key] = {
          ...task.overrides[key],
          important: !taskImportant(task, key)
        };
      }

      save();
      refreshTasks();
    },
    "goal-star" +
      (taskImportant(task, key) ? " starred" : "")
  );

  row.append(checkbox, label, star);

  if (!compact) {
    row.append(
      makeButton("編輯 / Sửa", () => editTask(task, key)),
      makeButton("X", () => deleteTask(task, key))
    );
  }

  return row;
}

// =====================================
// 7. HOME TASKS
// =====================================

function renderTasks() {
  const container = $("taskList");
  container.replaceChildren();

  const key = todayKey();
  const tasks = getTasksForDate(key);

  if (!tasks.length) {
    container.append(
      emptyMessage(
        "今日尚無待辦事項 / Hôm nay chưa có công việc"
      )
    );
  }

  tasks.forEach(task => {
    container.append(createTaskRow(task, key));
  });
}

function addTask() {
  selectedTaskDate = todayKey();
  navigate("tasks");
  renderScheduleTasks();

  showTaskForm(
    $("scheduleTaskList"),
    selectedTaskDate
  );
}

$("addTask").onclick = addTask;

// =====================================
// 8. OVERDUE TASKS
// =====================================

/*
  Overdue means an occurrence before today
  that has not been completed.

  Maximum scan window: 20,000 days per task.
  The interface initially displays 50 records.
*/

const OVERDUE_SCAN_LIMIT = 20000;
let overdueExpanded = false;

function getOverdueTasks() {
  const today = todayKey();
  const results = [];
  let scanTruncated = false;

  for (const task of state.tasks) {
    if (!validDate(task.date) || task.date >= today) {
      continue;
    }

    let cursor = task.date;
    let checked = 0;

    while (cursor < today && checked < OVERDUE_SCAN_LIMIT) {
      if (
        taskOccursOn(task, cursor) &&
        !isTaskDone(task, cursor)
      ) {
        results.push({ task, date: cursor });
      }

      cursor = addDays(cursor, 1);
      checked++;
    }

    if (cursor < today) scanTruncated = true;
  }

  results.sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  return { results, scanTruncated };
}

function renderOverdue(container) {
  const { results, scanTruncated } = getOverdueTasks();

  const section = document.createElement("section");
  section.style.marginTop = "24px";

  const heading = document.createElement("h3");
  heading.textContent =
    `逾期待辦 / Công việc quá hạn (${results.length})`;

  section.append(heading);

  if (scanTruncated) {
    const warning = emptyMessage(
      "部分非常久遠的紀錄未統計。" +
      " / Một số lịch sử quá xa chưa được thống kê."
    );
    section.append(warning);
  }

  if (!results.length) {
    section.append(
      emptyMessage(
        "沒有逾期待辦 / Không có công việc quá hạn"
      )
    );
  }

  const visible = overdueExpanded
    ? results
    : results.slice(0, 50);

  visible.forEach(({ task, date }) => {
    const row = document.createElement("div");
    row.className = "task";
    styleRow(row);

    const label = document.createElement("span");
    label.style.flex = "1";
    label.textContent =
      `${date} — ${taskName(task, date)}`;

    const done = makeButton("完成 / Xong", () => {
      setTaskDone(task, date, true);
    });

    const view = makeButton("查看 / Xem", () => {
      selectedTaskDate = date;
      renderScheduleTasks();
    });

    row.append(label, done, view);
    section.append(row);
  });

  if (results.length > 50) {
    section.append(
      makeButton(
        overdueExpanded
          ? "收起 / Thu gọn"
          : "顯示全部 / Hiện tất cả",
        () => {
          overdueExpanded = !overdueExpanded;
          renderScheduleTasks();
        }
      )
    );
  }

  container.append(section);
}

// =====================================
// 9. TASK MANAGEMENT
// =====================================

function renderScheduleTasks() {
  const container = $("scheduleTaskList");
  if (!container) return;

  container.replaceChildren();

  const toolbar = document.createElement("div");
  styleRow(toolbar);
  toolbar.style.marginBottom = "16px";

  const dateField = makeField(
    "選擇日期 / Chọn ngày",
    "date",
    selectedTaskDate
  );

  dateField.input.onchange = () => {
    if (!validDate(dateField.input.value)) return;

    selectedTaskDate = dateField.input.value;
    renderScheduleTasks();
  };

  const today = makeButton(
    "今天 / Hôm nay",
    () => {
      selectedTaskDate = todayKey();
      renderScheduleTasks();
    }
  );

  const add = makeButton(
    "新增待辦 / Thêm công việc",
    () => showTaskForm(container, selectedTaskDate),
    "primary"
  );

  toolbar.append(dateField.label, today, add);
  container.append(toolbar);

  const tasks = getTasksForDate(selectedTaskDate);

  if (!tasks.length) {
    container.append(
      emptyMessage(
        "此日期尚無待辦事項 / Ngày này chưa có công việc"
      )
    );
  }

  tasks.forEach(task => {
    container.append(
      createTaskRow(task, selectedTaskDate)
    );
  });

  const completed = tasks.filter(
    task => isTaskDone(task, selectedTaskDate)
  ).length;

  const summary = document.createElement("p");
  summary.className = "goal-summary";
  summary.textContent =
    `已完成 / Hoàn thành: ${completed} / ${tasks.length}`;

  container.append(summary);
  renderOverdue(container);
}

// =====================================
// 10. CALENDAR
// =====================================

function renderCalendar() {
  $("monthTitle").textContent =
    `${year} / ${pad(month + 1)}`;

  $("weekdays").replaceChildren();

  [
    "週日/CN", "週一/T2", "週二/T3",
    "週三/T4", "週四/T5", "週五/T6",
    "週六/T7"
  ].forEach(text => {
    const element = document.createElement("div");
    element.textContent = text;
    $("weekdays").append(element);
  });

  $("days").replaceChildren();

  const first = new Date(year, month, 1).getDay();
  const length = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((first + length) / 7) * 7;

  for (let i = 0; i < cells; i++) {
    const dt = new Date(year, month, i - first + 1);
    const key = dateKey(dt);

    const cell = document.createElement("button");
    cell.type = "button";

    cell.className =
      "day" +
      (dt.getMonth() !== month ? " muted" : "") +
      (key === selected ? " selected" : "");

    const number = document.createElement("span");
    number.className = "num";
    number.textContent = dt.getDate();

    cell.append(number);

    const events = state.events.filter(
      event => event.date === key
    );

    events.slice(0, 2).forEach(event => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent =
        `${event.time || ""} ${event.name || ""}`;
      cell.append(chip);
    });

    const tasks = getTasksForDate(key);

    if (tasks.length) {
      const chip = document.createElement("span");
      chip.className = "chip";

      const completed = tasks.filter(
        task => isTaskDone(task, key)
      ).length;

      chip.textContent =
        `待辦 ${completed}/${tasks.length}`;

      cell.append(chip);
    }

    cell.onclick = () => {
      selected = key;
      year = dt.getFullYear();
      month = dt.getMonth();
      renderCalendar();
    };

    $("days").append(cell);
  }

  renderEvents();
}

// =====================================
// 11. CALENDAR EVENTS AND DAILY TASKS
// =====================================

function renderEvents() {
  const container = $("eventList");
  container.replaceChildren();

  $("selectedTitle").textContent =
    `${selected} 行程與待辦 / Lịch và công việc`;

  const events = state.events
    .filter(event => event.date === selected)
    .sort((a, b) =>
      String(a.time || "").localeCompare(
        String(b.time || "")
      )
    );

  const eventHeading = document.createElement("h3");
  eventHeading.textContent = "行程 / Sự kiện";
  container.append(eventHeading);

  if (!events.length) {
    container.append(
      emptyMessage("尚無行程 / Chưa có sự kiện")
    );
  }

  events.forEach(event => {
    const row = document.createElement("div");
    row.className = "event";
    styleRow(row);

    const label = document.createElement("span");
    label.style.flex = "1";
    label.textContent =
      `${event.time || ""} — ${event.name || ""}`;

    const edit = makeButton(
      "編輯 / Sửa",
      () => openEventEditor(event)
    );

    const remove = makeButton("X", () => {
      if (!confirm(
        "刪除此行程？ / Xóa sự kiện này?"
      )) return;

      state.events = state.events.filter(
        item => item !== event
      );

      save();
      renderCalendar();
    });

    row.append(label, edit, remove);
    container.append(row);
  });

  const taskHeading = document.createElement("h3");
  taskHeading.textContent = "待辦事項 / Công việc";
  taskHeading.style.marginTop = "16px";
  container.append(taskHeading);

  const tasks = getTasksForDate(selected);

  if (!tasks.length) {
    container.append(
      emptyMessage("尚無待辦 / Chưa có công việc")
    );
  }

  tasks.forEach(task => {
    container.append(
      createTaskRow(task, selected)
    );
  });

  container.append(
    makeButton(
      "查看當日待辦 / Xem công việc ngày này",
      () => {
        selectedTaskDate = selected;
        navigate("tasks");
      }
    )
  );
}

// =====================================
// 12. ADD / EDIT CALENDAR EVENTS
// =====================================

let editingEvent = null;

function openEventEditor(event = null) {
  editingEvent = event;

  $("eventForm").reset();
  $("eventName").value = event?.name || "";
  $("eventDate").value = event?.date || selected;
  $("eventTime").value = event?.time || "";

  $("editor").showModal();
}

$("addEvent").onclick = () => openEventEditor();

$("cancel").onclick = () => {
  editingEvent = null;
  $("editor").close();
};

$("editor").addEventListener("close", () => {
  editingEvent = null;
});

$("eventForm").onsubmit = e => {
  e.preventDefault();

  if (!$("eventForm").reportValidity()) return;

  const name = $("eventName").value.trim();
  const date = $("eventDate").value;
  const time = $("eventTime").value;

  if (!name || !validDate(date)) {
    alert("請確認資料 / Kiểm tra thông tin.");
    return;
  }

  if (editingEvent) {
    editingEvent.name = name;
    editingEvent.date = date;
    editingEvent.time = time;
  } else {
    state.events.push({
      id: makeId(),
      name,
      date,
      time
    });
  }

  save();

  selected = date;
  year = Number(date.slice(0, 4));
  month = Number(date.slice(5, 7)) - 1;

  editingEvent = null;
  $("editor").close();
  renderCalendar();
};

$("prev").onclick = () => {
  month--;

  if (month < 0) {
    month = 11;
    year--;
  }

  selected = `${year}-${pad(month + 1)}-01`;
  renderCalendar();
};

$("next").onclick = () => {
  month++;

  if (month > 11) {
    month = 0;
    year++;
  }

  selected = `${year}-${pad(month + 1)}-01`;
  renderCalendar();
};

// =====================================
// 13. GOAL MANAGEMENT
// =====================================

function getGoals(type, key = viewing[type]) {
  return state.goalLists[type].filter(
    goal => goal.period === key
  );
}

function renderGoalPeriodPicker(manager) {
  const row = document.createElement("div");
  styleRow(row);
  row.style.margin = "14px 0";

  const type = activeGoalType;

  const field = makeField(
    "選擇時間 / Chọn thời gian",
    type === "day"
      ? "date"
      : type === "month"
        ? "month"
        : "number",
    viewing[type]
  );

  if (type === "year") {
    field.input.min = "1900";
    field.input.max = "9999";
    field.input.step = "1";
    field.input.style.width = "110px";
  }

  field.input.onchange = () => {
    const value = field.input.value;

    const patterns = {
      day: /^\d{4}-\d{2}-\d{2}$/,
      month: /^\d{4}-\d{2}$/,
      year: /^\d{4}$/
    };

    if (!patterns[type].test(value)) return;
    if (type === "day" && !validDate(value)) return;

    viewing[type] = value;
    renderGoals();
  };

  const reset = makeButton(
    "今天 / Hiện tại",
    () => {
      viewing[type] = periodKey(type);
      renderGoals();
    }
  );

  row.append(field.label, reset);
  manager.append(row);
}

function renderGoals() {
  const manager = $("goalManager");
  if (!manager) return;

  manager.replaceChildren();

  document.querySelectorAll("[data-goal-type]")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.goalType === activeGoalType
      );
    });

  const title = document.createElement("h2");
  title.textContent = goalTypes[activeGoalType];
  manager.append(title);

  renderGoalPeriodPicker(manager);

  const add = makeButton(
    "新增目標 / Thêm mục tiêu",
    () => {
      const name = prompt(
        "目標名稱 / Nhập tên mục tiêu"
      );

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
        "尚未建立目標 / Chưa có mục tiêu"
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
      save();
      refreshGoals();
    };

    const star = makeButton(
      goal.important ? "★" : "☆",
      () => {
        goal.important = !goal.important;
        save();
        refreshGoals();
      },
      "goal-star" +
        (goal.important ? " starred" : "")
    );

    const name = document.createElement("span");
    name.className =
      "goal-name" + (goal.done ? " completed" : "");
    name.textContent = goal.name;

    const edit = makeButton("編輯 / Sửa", () => {
      const value = prompt(
        "修改目標 / Sửa mục tiêu",
        goal.name
      );

      if (!value?.trim()) return;

      goal.name = value.trim();
      save();
      refreshGoals();
    });

    const remove = makeButton("X", () => {
      if (!confirm(
        "確定刪除？ / Chắc chắn xóa?"
      )) return;

      state.goalLists[activeGoalType] =
        state.goalLists[activeGoalType].filter(
          item => item !== goal
        );

      save();
      refreshGoals();
    });

    card.append(checkbox, star, name, edit, remove);
    manager.append(card);
  });

  const completed = goals.filter(
    goal => goal.done
  ).length;

  const summary = document.createElement("p");
  summary.className = "goal-summary";
  summary.textContent =
    `已完成 / Hoàn thành: ${completed} / ${goals.length}`;

  manager.append(summary);
}

document.querySelectorAll("[data-goal-type]")
  .forEach(button => {
    button.onclick = () => {
      activeGoalType = button.dataset.goalType;
      renderGoals();
    };
  });

// =====================================
// 14. IMPORTANT GOALS ON HOME
// =====================================

function renderImportantGoals() {
  const list = $("importantGoalList");
  if (!list) return;

  list.replaceChildren();

  let count = 0;

  for (const type of ["year", "month", "day"]) {
    const important = getGoals(
      type,
      periodKey(type)
    ).filter(goal => goal.important);

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

  if (!count) {
    list.append(
      emptyMessage(
        "尚無重要目標 / Chưa có mục tiêu quan trọng"
      )
    );
  }
}

// =====================================
// 15. PERFORMANCE
// =====================================

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
}

// =====================================
// 16. AUTOMATIC DATE ROLLOVER
// =====================================

let lastToday = todayKey();

function checkDateRollover() {
  const current = todayKey();
  if (current === lastToday) return;

  const previous = lastToday;
  lastToday = current;

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

setInterval(checkDateRollover, 60000);

// =====================================
// 17. INITIALIZE
// =====================================

renderCalendar();
renderTasks();
renderScheduleTasks();
refreshGoals();

showPage(location.hash.slice(1) || "home");
