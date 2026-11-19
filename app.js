
/* Cozy Life Planner — mục tiêu theo ngày/tháng/năm thực tế */

const $ = id => document.getElementById(id);
const STORAGE_KEY = "cozy-planner-demo-v1";

const pad = n => String(n).padStart(2, "0");

const dateKey = d =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const monthKey = d => dateKey(d).slice(0, 7);
const yearKey = d => String(d.getFullYear());

const makeId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random()}`;

const today = () => new Date();

const periodKey = (type, d = today()) =>
  type === "day"
    ? dateKey(d)
    : type === "month"
      ? monthKey(d)
      : yearKey(d);

// ====================================
// 1. DỮ LIỆU
// ====================================

let state;

try {
  state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
} catch {
  state = {};
}

if (!state || typeof state !== "object" || Array.isArray(state)) {
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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error(error);
    alert("資料儲存失敗 / Không thể lưu dữ liệu.");
  }
}

const initialDate = today();

let year = initialDate.getFullYear();
let month = initialDate.getMonth();
let selected = dateKey(initialDate);

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

// ====================================
// 2. CHUYỂN DỮ LIỆU MỤC TIÊU CŨ
// ====================================

function migrateGoals() {
  const migrationDate = today();

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
        goal.period = periodKey(type, migrationDate);
      }

      goal.progress = goal.done ? 100 : 0;
    }
  }

  state.goalPeriodMigrationV1 = true;
  save();
}

migrateGoals();

// ====================================
// 3. ĐIỀU HƯỚNG 5 MỤC LỚN
// ====================================

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

  document.querySelectorAll(".app-page").forEach(element => {
    element.hidden = element.id !== pageMap[target];
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
  link.addEventListener("click", event => {
    event.preventDefault();
    navigate(link.dataset.page);
  });
});

document.querySelectorAll("[data-schedule-section]").forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
    navigate(link.dataset.scheduleSection);
  });
});

document.querySelectorAll("[data-back-schedule]").forEach(button => {
  button.addEventListener("click", () => navigate("calendar"));
});

window.addEventListener("hashchange", () => {
  showPage(location.hash.slice(1) || "home");
});

// ====================================
// 4. LỊCH TRÌNH
// ====================================

function renderCalendar() {
  $("monthTitle").textContent = `${year} / ${pad(month + 1)}`;

  $("weekdays").replaceChildren();

  [
    "週日/CN",
    "週一/T2",
    "週二/T3",
    "週三/T4",
    "週四/T5",
    "週五/T6",
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
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "尚無行程 / Chưa có lịch trình";
    $("eventList").append(empty);
  }

  events.forEach(event => {
    const row = document.createElement("div");
    row.className = "event";

    const label = document.createElement("span");
    label.textContent =
      `${event.time || ""} — ${event.name || ""}`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "X";
    remove.title = "刪除 / Xóa";

    remove.onclick = () => {
      if (!confirm("刪除此行程？ / Xóa lịch này?")) return;

      state.events = state.events.filter(item => item !== event);

      save();
      renderCalendar();
    };

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

// ====================================
// 5. VIỆC CẦN LÀM
// ====================================

function createTaskRow(task) {
  const row = document.createElement("div");
  row.className = "task" + (task.done ? " done" : "");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = !!task.done;

  checkbox.onchange = () => {
    task.done = checkbox.checked;
    save();
    renderTasks();
    renderScheduleTasks();
  };

  const label = document.createElement("label");
  label.textContent = task.name;

  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "X";
  remove.title = "刪除 / Xóa";

  remove.onclick = () => {
    if (!confirm("刪除此工作？ / Xóa công việc này?")) return;

    state.tasks = state.tasks.filter(item => item !== task);

    save();
    renderTasks();
    renderScheduleTasks();
  };

  row.append(checkbox, label, remove);
  return row;
}

function renderTasks() {
  $("taskList").replaceChildren();

  state.tasks.forEach(task => {
    $("taskList").append(createTaskRow(task));
  });
}

function renderScheduleTasks() {
  const container = $("scheduleTaskList");
  if (!container) return;

  container.replaceChildren();

  const add = document.createElement("button");
  add.type = "button";
  add.className = "primary";
  add.textContent = "新增待辦 / Thêm công việc";
  add.style.marginBottom = "15px";
  add.onclick = addTask;

  container.append(add);

  if (!state.tasks.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent =
      "尚無待辦事項 / Chưa có công việc";

    container.append(empty);
  }

  state.tasks.forEach(task => {
    container.append(createTaskRow(task));
  });
}

function addTask() {
  const name = prompt("新增待辦事項 / Nhập tên công việc");
  if (!name?.trim()) return;

  state.tasks.push({
    id: makeId(),
    name: name.trim(),
    done: false
  });

  save();
  renderTasks();
  renderScheduleTasks();
}

$("addTask").onclick = addTask;

// ====================================
// 6. MỤC TIÊU THEO NGÀY / THÁNG / NĂM
// ====================================

function getGoals(type, key = viewing[type]) {
  return state.goalLists[type].filter(
    goal => goal.period === key
  );
}

function makeButton(label, onClick, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;

  if (className) button.className = className;

  button.onclick = onClick;
  return button;
}

function renderGoalPeriodPicker(manager) {
  const row = document.createElement("div");
  row.className = "goal-period-picker";

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

  input.setAttribute(
    "aria-label",
    "Chọn ngày, tháng hoặc năm"
  );

  input.onchange = () => {
    const value = input.value;

    if (
      activeGoalType === "year" &&
      !/^\d{4}$/.test(value)
    ) {
      input.value = viewing[activeGoalType];
      return;
    }

    if (
      activeGoalType === "month" &&
      !/^\d{4}-\d{2}$/.test(value)
    ) return;

    if (
      activeGoalType === "day" &&
      !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) return;

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
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent =
      "尚未建立目標 / Chưa có mục tiêu cho thời gian này.";

    manager.append(empty);
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

  const summary = document.createElement("p");
  summary.className = "goal-summary";

  summary.textContent =
    `已完成 / Hoàn thành: ${
      goals.filter(goal => goal.done).length
    } / ${goals.length}`;

  manager.append(summary);
}

document.querySelectorAll("[data-goal-type]").forEach(button => {
  button.onclick = () => {
    activeGoalType = button.dataset.goalType;
    renderGoals();
  };
});

// ====================================
// 7. MỤC TIÊU QUAN TRỌNG TRANG CHỦ
// ====================================

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
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent =
      "尚無重要目標 / Chưa có mục tiêu quan trọng.";

    list.append(empty);
  }
}

// ====================================
// 8. BIỂU ĐỒ HIỆU SUẤT
// ====================================

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
    const stats = goalStats(type);

    updateDonut(
      type + "Donut",
      type + "Pct",
      stats.pct
    );
  }

  const todayStats = goalStats("day");

  updateDonut(
    "donut",
    "todayPct",
    todayStats.pct
  );

  const stats = $("stats");
  if (!stats) return;

  stats.replaceChildren();

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
    stats.append(row);
  });
}

function refreshGoals() {
  renderGoals();
  renderImportantGoals();
  renderPerformance();
}

// ====================================
// 9. TỰ ĐỘNG CHUYỂN NGÀY MỚI
// ====================================

let lastToday = periodKey("day");

function checkDateRollover() {
  const current = periodKey("day");

  if (current === lastToday) return;

  const previous = lastToday;
  lastToday = current;

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

  if (selected === previous) {
    selected = current;
    year = Number(current.slice(0, 4));
    month = Number(current.slice(5, 7)) - 1;
  }

  renderCalendar();
  refreshGoals();
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) checkDateRollover();
});

window.addEventListener("focus", checkDateRollover);

setInterval(checkDateRollover, 60 * 1000);

// ====================================
// 10. KHỞI ĐỘNG
// ====================================

renderCalendar();
renderTasks();
renderScheduleTasks();
refreshGoals();

showPage(location.hash.slice(1) || "home");
