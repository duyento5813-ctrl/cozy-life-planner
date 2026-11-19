
/*
  Cozy Life Planner
  Version 4 - Minimal Interface

  5 mục lớn:
  1. Trang chủ
  2. Lịch trình
  3. Thu chi
  4. Hiệu suất
  5. Cài đặt

  Chỉ sử dụng ngôi sao để đánh dấu mục tiêu quan trọng.
  Dữ liệu được lưu trong localStorage.
*/

const $ = id => document.getElementById(id);

const STORAGE_KEY = "cozy-planner-demo-v1";

const pad = n => String(n).padStart(2, "0");

function dateKey(date) {
  return (
    date.getFullYear() + "-" +
    pad(date.getMonth() + 1) + "-" +
    pad(date.getDate())
  );
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random()}`;
}

let state;

try {
  state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
} catch {
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

for (const type of ["year", "month", "day"]) {
  if (!Array.isArray(state.goalLists[type])) {
    state.goalLists[type] = [];
  }
}

const now = new Date();

let year = now.getFullYear();
let month = now.getMonth();
let selected = dateKey(now);

let activeGoalType = "year";

const goalTypes = {
  year: "年度目標 / Mục tiêu năm",
  month: "月度目標 / Mục tiêu tháng",
  day: "每日目標 / Mục tiêu ngày"
};

function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch (error) {
    console.error("Lỗi lưu dữ liệu:", error);
    alert("資料儲存失敗 / Không thể lưu dữ liệu.");
  }
}

// ====================================
// CHUYỂN ĐỔI DỮ LIỆU CŨ
// ====================================

function migrateGoals() {
  for (const type of ["year", "month", "day"]) {
    const oldValue = state.goals[type + "Goal"];

    if (
      typeof oldValue === "string" &&
      oldValue.trim() &&
      !state.goalLists[type].some(
        goal => goal.name === oldValue.trim()
      )
    ) {
      state.goalLists[type].push({
        id: makeId(),
        name: oldValue.trim(),
        done: false,
        progress: 0,
        important: false
      });
    }

    state.goalLists[type].forEach(goal => {
      if (!goal.id) goal.id = makeId();

      if (typeof goal.important !== "boolean") {
        goal.important = false;
      }

      if (typeof goal.done !== "boolean") {
        goal.done = Number(goal.progress) >= 100;
      }

      goal.progress = goal.done ? 100 : 0;
    });
  }

  save();
}

migrateGoals();

// ====================================
// ĐIỀU HƯỚNG
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

function hideScheduleDetails() {
  $("scheduleTasks").hidden = true;
  $("goalsPage").hidden = true;
}

function showPage(page) {
  const target = pageMap[page] ? page : "home";

  document.querySelectorAll(".app-page").forEach(element => {
    element.hidden = element.id !== pageMap[target];
  });

  document.querySelectorAll("nav a[data-page]").forEach(link => {
    const navPage = link.dataset.page;

    const active =
      navPage === target ||
      (
        navPage === "calendar" &&
        ["tasks", "goals"].includes(target)
      );

    link.classList.toggle("active", active);
  });

  hideScheduleDetails();

  if (target === "tasks") {
    $("scheduleTasks").hidden = false;
    renderScheduleTasks();
  }

  if (target === "goals") {
    $("goalsPage").hidden = false;
    renderGoals();
  }

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

// ====================================
// LỊCH TRÌNH
// ====================================

function renderCalendar() {
  $("monthTitle").textContent = `${year} / ${pad(month + 1)}`;

  $("weekdays").replaceChildren();

  [
    "週日/CN", "週一/T2", "週二/T3",
    "週三/T4", "週四/T5", "週五/T6", "週六/T7"
  ].forEach(day => {
    const element = document.createElement("div");
    element.textContent = day;
    $("weekdays").append(element);
  });

  const first = new Date(year, month, 1).getDay();
  const length = new Date(year, month + 1, 0).getDate();
  const prevLength = new Date(year, month, 0).getDate();
  const cells = Math.ceil((first + length) / 7) * 7;

  $("days").replaceChildren();

  for (let i = 0; i < cells; i++) {
    const day = i - first + 1;
    const dt = new Date(year, month, day);
    const date = dateKey(dt);

    const button = document.createElement("button");
    button.type = "button";

    button.className =
      "day" +
      (dt.getMonth() !== month ? " muted" : "") +
      (date === selected ? " selected" : "");

    const number = document.createElement("span");
    number.className = "num";

    number.textContent =
      day < 1 ? prevLength + day :
      day > length ? day - length : day;

    button.append(number);

    state.events
      .filter(event => event.date === date)
      .slice(0, 2)
      .forEach(event => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = `${event.time} ${event.name}`;
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
      String(a.time).localeCompare(String(b.time))
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

    const name = document.createElement("span");
    name.textContent = `${event.time} — ${event.name}`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "X";
    remove.title = "刪除 / Xóa";

    remove.onclick = () => {
      if (!confirm("刪除此行程？ / Xóa lịch này?")) return;

      state.events = state.events.filter(
        item => item.id !== event.id
      );

      save();
      renderCalendar();
    };

    row.append(name, remove);
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
// VIỆC CẦN LÀM
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

    state.tasks = state.tasks.filter(
      item => item.id !== task.id
    );

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
  add.textContent = "＋ 新增待辦 / Thêm công việc";
  add.style.marginBottom = "15px";
  add.onclick = addTask;

  container.append(add);

  if (!state.tasks.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "尚無待辦事項 / Chưa có công việc.";
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
// QUẢN LÝ MỤC TIÊU
// ====================================

function getGoals(type) {
  return state.goalLists[type] || [];
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

  const add = document.createElement("button");
  add.type = "button";
  add.className = "primary";
  add.textContent = "＋ 新增目標 / Thêm mục tiêu";

  add.onclick = () => {
    const name = prompt("目標名稱 / Nhập tên mục tiêu");
    if (!name?.trim()) return;

    state.goalLists[activeGoalType].push({
      id: makeId(),
      name: name.trim(),
      done: false,
      progress: 0,
      important: false
    });

    save();
    refreshGoals();
  };

  manager.append(add);

  const goals = getGoals(activeGoalType);

  if (!goals.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "尚未建立目標 / Chưa có mục tiêu.";
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

    const star = document.createElement("button");
    star.type = "button";
    star.className = "goal-star" +
      (goal.important ? " starred" : "");

    star.textContent = goal.important ? "★" : "☆";
    star.title = "重要目標 / Mục tiêu quan trọng";

    star.onclick = () => {
      goal.important = !goal.important;
      save();
      refreshGoals();
    };

    const name = document.createElement("span");
    name.className = "goal-name" +
      (goal.done ? " completed" : "");
    name.textContent = goal.name;

    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Sửa";
    edit.title = "修改 / Sửa";

    edit.onclick = () => {
      const value = prompt(
        "修改目標 / Sửa mục tiêu",
        goal.name
      );

      if (!value?.trim()) return;

      goal.name = value.trim();
      save();
      refreshGoals();
    };

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "X";
    remove.title = "刪除 / Xóa";

    remove.onclick = () => {
      if (!confirm("確定刪除？ / Chắc chắn xóa?")) return;

      state.goalLists[activeGoalType] =
        getGoals(activeGoalType).filter(
          item => item.id !== goal.id
        );

      save();
      refreshGoals();
    };

    card.append(checkbox, star, name, edit, remove);
    manager.append(card);
  });

  const total = goals.length;
  const completed = goals.filter(goal => goal.done).length;

  const summary = document.createElement("p");
  summary.className = "goal-summary";
  summary.textContent =
    `已完成 / Hoàn thành: ${completed} / ${total}`;

  manager.append(summary);
}

document.querySelectorAll("[data-goal-type]").forEach(button => {
  button.onclick = () => {
    activeGoalType = button.dataset.goalType;
    renderGoals();
  };
});

// ====================================
// MỤC TIÊU QUAN TRỌNG TRANG CHỦ
// ====================================

function renderImportantGoals() {
  const list = $("importantGoalList");
  if (!list) return;

  list.replaceChildren();

  let count = 0;

  for (const type of ["year", "month", "day"]) {
    const important = getGoals(type)
      .filter(goal => goal.important);

    if (!important.length) continue;

    count++;

    const heading = document.createElement("h3");
    heading.className = "important-heading";
    heading.textContent = goalTypes[type];
    list.append(heading);

    important.forEach(goal => {
      const row = document.createElement("div");
      row.className = "important-goal" +
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
// HIỆU SUẤT MỤC TIÊU
// ====================================

function goalStats(type) {
  const goals = getGoals(type);
  const total = goals.length;
  const done = goals.filter(goal => goal.done).length;

  return {
    total,
    done,
    pct: total ? Math.round(done / total * 100) : 0
  };
}

function updateDonut(donutId, textId, pct) {
  const donut = $(donutId);
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

  const today = goalStats("day");
  updateDonut("donut", "todayPct", today.pct);

  const stats = $("stats");
  stats.replaceChildren();

  [
    ["今日目標 / Mục tiêu ngày", today.pct + "%"],
    ["已完成 / Đã hoàn thành",
      today.done + " / " + today.total]
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
// KHỞI ĐỘNG
// ====================================

renderCalendar();
renderTasks();
renderScheduleTasks();
refreshGoals();

showPage(location.hash.slice(1) || "home");
