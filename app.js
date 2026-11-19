
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

try {
  state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
} catch {
  state = {};
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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error(error);
    alert("資料儲存失敗 / Không thể lưu dữ liệu.");
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

  if (target === "tasks") renderScheduleTasks();
  if (target === "goals") renderGoals();

  if (target === "home") {
    renderCalendar();
    renderTasks();
    renderImportantGoals();
    renderPerformance();
  }

  if (target === "performance") {
    renderPerformance();
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
// 4. LỊCH TRÌNH
// ==========================================

function renderCalendar() {
  $("monthTitle").textContent =
    `${year} / ${pad(month + 1)}`;

  $("weekdays").replaceChildren();

  [
    "週日/CN", "週一/T2", "週二/T3",
    "週三/T4", "週四/T5", "週五/T6",
    "週六/T7"
  ].forEach(day => {
    const element = document.createElement("div");
    element.textContent = day;
    $("weekdays").append(element);
  });

  const first = new Date(year, month, 1).getDay();
  const length = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((first + length) / 7) * 7;

  $("days").replaceChildren();

  for (let i = 0; i < cells; i++) {
    const dt = new Date(year, month, i - first + 1);
    const date = dateKey(dt);

    const button = document.createElement("button");
    button.type = "button";

    button.className =
      "day" +
      (dt.getMonth() !== month ? " muted" : "") +
      (date === selected ? " selected" : "");

    const number = document.createElement("span");
    number.className = "num";
    number.textContent = dt.getDate();

    button.append(number);

    state.events
      .filter(event => event.date === date)
      .slice(0, 2)
      .forEach(event => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent =
          `${event.time || ""} ${event.name || ""}`;
        button.append(chip);
      });

    button.onclick = () => {
      selected = date;
      year = dt.getFullYear();
      month = dt.getMonth();
      renderCalendar();
    };

    $("days").append(button);
  }

  renderEvents();
}

function renderEvents() {
  $("selectedTitle").textContent =
    `${selected} 行程 / Lịch trình`;

  $("eventList").replaceChildren();

  const events = state.events
    .filter(event => event.date === selected)
    .sort((a, b) =>
      String(a.time || "").localeCompare(String(b.time || ""))
    );

  if (!events.length) {
    $("eventList").append(
      emptyMessage("尚無行程 / Chưa có lịch trình")
    );
  }

  events.forEach(event => {
    const row = document.createElement("div");
    row.className = "event";

    const label = document.createElement("span");
    label.textContent =
      `${event.time || ""} — ${event.name || ""}`;

    const remove = makeButton("X", () => {
      if (!confirm("刪除此行程？ / Xóa lịch này?")) return;

      state.events = state.events.filter(
        item => item !== event
      );

      save();
      renderCalendar();
    });

    row.append(label, remove);
    $("eventList").append(row);
  });
}

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

$("addEvent").onclick = () => {
  $("eventForm").reset();
  $("eventDate").value = selected;
  $("editor").showModal();
};

$("cancel").onclick = () => $("editor").close();

$("eventForm").onsubmit = event => {
  event.preventDefault();

  if (!$("eventForm").reportValidity()) return;

  const name = $("eventName").value.trim();
  if (!name) return;

  state.events.push({
    id: makeId(),
    name,
    date: $("eventDate").value,
    time: $("eventTime").value
  });

  save();

  selected = $("eventDate").value;
  year = Number(selected.slice(0, 4));
  month = Number(selected.slice(5, 7)) - 1;

  $("editor").close();
  renderCalendar();
};

// ==========================================
// 5. QUẢN LÝ CÔNG VIỆC THEO NGÀY
// ==========================================

const repeatLabels = {
  none: "不重複 / Không lặp lại",
  daily: "每天 / Hằng ngày",
  weekly: "每週 / Hằng tuần",
  monthly: "每月 / Hằng tháng",
  yearly: "每年 / Hằng năm"
};

function taskOccursOn(task, key) {
  if (!task.date || key < task.date) return false;

  const repeat = task.repeat || "none";

  if (repeat === "none") {
    return task.date === key;
  }

  if (repeat === "daily") {
    return true;
  }

  const start = parseDate(task.date);
  const current = parseDate(key);

  if (repeat === "weekly") {
    return start.getDay() === current.getDay();
  }

  if (repeat === "monthly") {
    return start.getDate() === current.getDate();
  }

  if (repeat === "yearly") {
    return (
      start.getDate() === current.getDate() &&
      start.getMonth() === current.getMonth()
    );
  }

  return false;
}

function getTasksForDate(key) {
  return state.tasks
    .filter(task => taskOccursOn(task, key))
    .sort((a, b) => {
      if (a.important !== b.important) {
        return a.important ? -1 : 1;
      }

      return 0;
    });
}

function isTaskDone(task, key) {
  return !!task.completions?.[key];
}

function setTaskDone(task, key, done) {
  if (!task.completions) {
    task.completions = {};
  }

  if (done) {
    task.completions[key] = true;
  } else {
    delete task.completions[key];
  }

  save();
  renderTasks();
  renderScheduleTasks();
}

function createTaskRow(task, key) {
  const done = isTaskDone(task, key);

  const row = document.createElement("div");
  row.className = "task" + (done ? " done" : "");

  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.gap = "10px";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = done;

  checkbox.onchange = () => {
    setTaskDone(task, key, checkbox.checked);
  };

  const label = document.createElement("label");
  label.textContent = task.name;
  label.style.flex = "1";

  if (done) {
    label.style.textDecoration = "line-through";
    label.style.opacity = "0.6";
  }

  const star = makeButton(
    task.important ? "★" : "☆",
    () => {
      task.important = !task.important;
      save();
      renderTasks();
      renderScheduleTasks();
    },
    "goal-star" + (task.important ? " starred" : "")
  );

  star.title = "重要事項 / Công việc quan trọng";

  const remove = makeButton("X", () => {
    const question =
      task.repeat === "none"
        ? "刪除此工作？ / Xóa công việc này?"
        : "刪除整個重複工作？ / Xóa toàn bộ công việc lặp lại?";

    if (!confirm(question)) return;

    state.tasks = state.tasks.filter(
      item => item !== task
    );

    save();
    renderTasks();
    renderScheduleTasks();
  });

  row.append(checkbox, label, star, remove);

  return row;
}

function renderTasks() {
  const container = $("taskList");
  container.replaceChildren();

  const key = todayKey();
  const tasks = getTasksForDate(key);

  if (!tasks.length) {
    container.append(
      emptyMessage("今日尚無待辦事項 / Hôm nay chưa có công việc")
    );
  }

  tasks.forEach(task => {
    container.append(createTaskRow(task, key));
  });
}

// ==========================================
// 6. FORM THÊM CÔNG VIỆC
// ==========================================

function showTaskForm(container, defaultDate) {
  const form = document.createElement("form");

  form.style.display = "grid";
  form.style.gap = "12px";
  form.style.margin = "16px 0";
  form.style.padding = "16px";
  form.style.border = "1px solid #eadfd5";
  form.style.borderRadius = "12px";

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "工作名稱 / Tên công việc";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.required = true;
  nameInput.maxLength = 150;
  nameInput.placeholder = "輸入工作名稱 / Nhập tên công việc";
  nameInput.style.display = "block";
  nameInput.style.width = "100%";

  nameLabel.append(nameInput);

  const dateLabel = document.createElement("label");
  dateLabel.textContent = "開始日期 / Ngày bắt đầu";

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.required = true;
  dateInput.value = defaultDate;
  dateInput.style.display = "block";

  dateLabel.append(dateInput);

  const repeatLabel = document.createElement("label");
  repeatLabel.textContent = "重複設定 / Lặp lại";

  const repeatSelect = document.createElement("select");
  repeatSelect.style.display = "block";

  for (const [value, text] of Object.entries(repeatLabels)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    repeatSelect.append(option);
  }

  repeatLabel.append(repeatSelect);

  const importantLabel = document.createElement("label");

  const importantInput = document.createElement("input");
  importantInput.type = "checkbox";

  importantLabel.append(
    importantInput,
    document.createTextNode(
      " ★ 重要事項 / Công việc quan trọng"
    )
  );

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "10px";

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
    nameLabel,
    dateLabel,
    repeatLabel,
    importantLabel,
    actions
  );

  form.onsubmit = event => {
    event.preventDefault();

    const name = nameInput.value.trim();
    if (!name || !dateInput.value) return;

    state.tasks.push({
      id: makeId(),
      name,
      date: dateInput.value,
      repeat: repeatSelect.value,
      important: importantInput.checked,
      completions: {}
    });

    save();
    form.remove();

    renderTasks();
    renderScheduleTasks();
  };

  container.append(form);
  nameInput.focus();
}

function addTask() {
  const container = $("scheduleTaskList");

  // Khi thêm từ Trang chủ, chuyển đến quản lý
  // công việc để nhập thông tin đầy đủ.
  if (location.hash !== "#tasks") {
    selectedTaskDate = todayKey();
    navigate("tasks");

    requestAnimationFrame(() => {
      showTaskForm(container, todayKey());
    });
  } else {
    showTaskForm(container, selectedTaskDate);
  }
}

$("addTask").onclick = addTask;

// ==========================================
// 7. DANH SÁCH CÔNG VIỆC TRONG LỊCH TRÌNH
// ==========================================

function renderScheduleTasks() {
  const container = $("scheduleTaskList");
  if (!container) return;

  container.replaceChildren();

  const toolbar = document.createElement("div");
  toolbar.style.display = "flex";
  toolbar.style.flexWrap = "wrap";
  toolbar.style.alignItems = "center";
  toolbar.style.gap = "10px";
  toolbar.style.marginBottom = "16px";

  const dateLabel = document.createElement("label");
  dateLabel.textContent = "選擇日期 / Chọn ngày: ";

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = selectedTaskDate;

  dateInput.onchange = () => {
    if (!dateInput.value) return;

    selectedTaskDate = dateInput.value;
    renderScheduleTasks();
  };

  dateLabel.append(dateInput);

  const reset = makeButton("今天 / Hôm nay", () => {
    selectedTaskDate = todayKey();
    renderScheduleTasks();
  });

  const add = makeButton(
    "新增待辦 / Thêm công việc",
    () => showTaskForm(container, selectedTaskDate),
    "primary"
  );

  toolbar.append(dateLabel, reset, add);
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
}

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

  const reset = makeButton(
    "今天 / Hiện tại",
    () => {
      viewing[activeGoalType] = periodKey(activeGoalType);
      renderGoals();
    }
  );

  label.append(input);
  row.append(label, reset);
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
  manager.append(title);

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
      save();
      refreshGoals();
    });

    const remove = makeButton("X", () => {
      if (!confirm("確定刪除？ / Chắc chắn xóa?")) return;

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
// 12. KHỞI ĐỘNG
// ==========================================

renderCalendar();
renderTasks();
renderScheduleTasks();
refreshGoals();

showPage(location.hash.slice(1) || "home");
