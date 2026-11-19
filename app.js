
/* Cozy Life Planner - Goal Management V2
   Demo: dữ liệu lưu trong localStorage, chưa đồng bộ đám mây.
*/

const $ = id => document.getElementById(id);
const key = "cozy-planner-demo-v1";
const pad = n => String(n).padStart(2, "0");
const dateKey = d =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const makeId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random()}`;

let state;
try {
  state = JSON.parse(localStorage.getItem(key)) || {};
} catch {
  state = {};
}

state.events ||= [];
state.tasks ||= [
  { id: 1, name: "完成報告初稿 / Hoàn thành bản nháp", done: true },
  { id: 2, name: "整理下週行程 / Sắp lịch tuần sau", done: false },
  { id: 3, name: "運動 30 分鐘 / Tập thể dục 30 phút", done: false }
];
state.goals ||= {};
state.goalLists ||= { year: [], month: [], day: [] };

const now = new Date();
let year = now.getFullYear();
let month = now.getMonth();
let selected = dateKey(now);
let activeGoalType = "year";

const goalTypes = {
  year: "🌱 年度目標 / Mục tiêu năm",
  month: "🌿 月度目標 / Mục tiêu tháng",
  day: "☀️ 每日目標 / Mục tiêu ngày"
};

function save() {
  localStorage.setItem(key, JSON.stringify(state));
}

// Chuyển dữ liệu mục tiêu từ phiên bản cũ.
function migrateGoals() {
  for (const type of Object.keys(goalTypes)) {
    if (!Array.isArray(state.goalLists[type])) {
      state.goalLists[type] = [];
    }

    const old = state.goals[type + "Goal"];

    if (
      typeof old === "string" &&
      old.trim() &&
      !state.goalLists[type].some(g => g.name === old.trim())
    ) {
      state.goalLists[type].push({
        id: makeId(),
        name: old.trim(),
        progress: 0,
        important: false
      });
    }

    state.goalLists[type].forEach(g => {
      if (typeof g.important !== "boolean") g.important = false;
      if (typeof g.done !== "boolean") {
        g.done = Number(g.progress) >= 100;
      }
      if (typeof g.progress !== "number") {
        g.progress = g.done ? 100 : 0;
      }
    });
  }

  save();
}

migrateGoals();

// =============================
// CHUYỂN TRANG
// =============================

function showPage(page) {
  const pageMap = {
    home: "homePage",
    calendar: "homePage",
    tasks: "homePage",
    goals: "goalsPage",
    performance: "performancePage",
    future: "futurePage"
  };

  const target = pageMap[page] ? page : "home";

  document.querySelectorAll(".app-page").forEach(section => {
    section.hidden = section.id !== pageMap[target];
  });

  document.querySelectorAll("nav a").forEach(link => {
    link.classList.toggle(
      "active",
      link.dataset.page === target
    );
  });

  if (target === "goals") renderGoals();
  if (target === "performance") renderPerformance();

  if (target === "calendar" || target === "tasks") {
    requestAnimationFrame(() => {
      $(target)?.scrollIntoView({ behavior: "smooth" });
    });
  }
}

document.querySelectorAll("nav a[data-page]").forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    const page = link.dataset.page;
    history.replaceState(null, "", "#" + page);
    showPage(page);
  });
});

// =============================
// LỊCH TRÌNH
// =============================

function renderCalendar() {
  $("monthTitle").textContent = `${year} / ${pad(month + 1)}`;

  $("weekdays").innerHTML = [
    "週日/CN", "週一/T2", "週二/T3",
    "週三/T4", "週四/T5", "週五/T6", "週六/T7"
  ].map(x => `<div>${x}</div>`).join("");

  const first = new Date(year, month, 1).getDay();
  const length = new Date(year, month + 1, 0).getDate();
  const prev = new Date(year, month, 0).getDate();

  $("days").replaceChildren();

  const cells = Math.ceil((first + length) / 7) * 7;

  for (let i = 0; i < cells; i++) {
    const day = i - first + 1;
    const dt = new Date(year, month, day);
    const date = dateKey(dt);

    const b = document.createElement("button");
    b.className = "day" +
      (dt.getMonth() !== month ? " muted" : "") +
      (date === selected ? " selected" : "");

    const n = document.createElement("span");
    n.className = "num";
    n.textContent =
      day < 1 ? prev + day :
      day > length ? day - length : day;

    b.append(n);

    state.events
      .filter(e => e.date === date)
      .slice(0, 2)
      .forEach(e => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = `${e.time} ${e.name}`;
        b.append(chip);
      });

    b.onclick = () => {
      selected = date;
      year = dt.getFullYear();
      month = dt.getMonth();
      renderCalendar();
    };

    $("days").append(b);
  }

  renderEvents();
}

function renderEvents() {
  $("selectedTitle").textContent =
    `📅 ${selected} 行程 / Lịch trình`;

  $("eventList").replaceChildren();

  const events = state.events
    .filter(e => e.date === selected)
    .sort((a, b) => a.time.localeCompare(b.time));

  if (!events.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "尚無行程 / Chưa có lịch trình";
    $("eventList").append(p);
  }

  events.forEach(e => {
    const row = document.createElement("div");
    row.className = "event";

    const name = document.createElement("span");
    name.textContent = `${e.time} — ${e.name}`;

    const del = document.createElement("button");
    del.textContent = "✕";
    del.title = "刪除 / Xóa";

    del.onclick = () => {
      if (!confirm("刪除此行程？ / Xóa lịch này?")) return;
      state.events = state.events.filter(x => x.id !== e.id);
      save();
      renderCalendar();
    };

    row.append(name, del);
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

$("eventForm").onsubmit = e => {
  e.preventDefault();
  if (!$("eventForm").reportValidity()) return;

  state.events.push({
    id: makeId(),
    name: $("eventName").value.trim(),
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

// =============================
// CÔNG VIỆC HÔM NAY
// =============================

function renderTasks() {
  $("taskList").replaceChildren();

  state.tasks.forEach(task => {
    const row = document.createElement("div");
    row.className = "task" + (task.done ? " done" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!task.done;

    checkbox.onchange = () => {
      task.done = checkbox.checked;
      save();
      renderTasks();
    };

    const label = document.createElement("label");
    label.textContent = task.name;

    const del = document.createElement("button");
    del.textContent = "✕";

    del.onclick = () => {
      state.tasks = state.tasks.filter(x => x.id !== task.id);
      save();
      renderTasks();
    };

    row.append(checkbox, label, del);
    $("taskList").append(row);
  });
}

$("addTask").onclick = () => {
  const name = prompt("新增待辦 / Thêm việc cần làm");

  if (!name?.trim()) return;

  state.tasks.push({
    id: makeId(),
    name: name.trim(),
    done: false
  });

  save();
  renderTasks();
};

// =============================
// QUẢN LÝ MỤC TIÊU
// =============================

function getGoals(type) {
  return state.goalLists[type] || [];
}

function renderGoals() {
  const manager = $("goalManager");
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
  add.className = "primary";
  add.textContent = "＋ 新增目標 / Thêm mục tiêu";

  add.onclick = () => {
    const name = prompt("目標名稱 / Tên mục tiêu");
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
    empty.textContent =
      "尚未建立目標 / Chưa có mục tiêu nào.";
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
    star.setAttribute(
      "aria-label",
      goal.important
        ? "取消重要標記 / Bỏ đánh dấu quan trọng"
        : "標記重要 / Đánh dấu quan trọng"
    );

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
    edit.textContent = "✎";
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

    const del = document.createElement("button");
    del.textContent = "✕";
    del.title = "刪除 / Xóa";

    del.onclick = () => {
      if (!confirm("確定刪除？ / Chắc chắn xóa?")) return;

      state.goalLists[activeGoalType] =
        getGoals(activeGoalType)
          .filter(g => g.id !== goal.id);

      save();
      refreshGoals();
    };

    card.append(checkbox, star, name, edit, del);
    manager.append(card);
  });

  const total = goals.length;
  const completed = goals.filter(g => g.done).length;

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

// =============================
// MỤC TIÊU QUAN TRỌNG TRANG CHỦ
// =============================

function renderImportantGoals() {
  const list = $("importantGoalList");
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
      star.textContent = "⭐";

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

// =============================
// BIỂU ĐỒ HIỆU SUẤT MỤC TIÊU
// =============================

function goalStats(type) {
  const goals = getGoals(type);
  const total = goals.length;
  const done = goals.filter(g => g.done).length;

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
  for (const type of ["year", "month", "day"]) {
    const stats = goalStats(type);

    updateDonut(
      type + "Donut",
      type + "Pct",
      stats.pct
    );
  }

  const today = goalStats("day");

  updateDonut("donut", "todayPct", today.pct);

  $("stats").replaceChildren();

  const items = [
    ["今日目標 / Mục tiêu ngày", `${today.pct}%`],
    ["已完成 / Đã hoàn thành", `${today.done} / ${today.total}`]
  ];

  items.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "stat";

    const left = document.createElement("span");
    left.textContent = label;

    const right = document.createElement("strong");
    right.textContent = value;

    row.append(left, right);
    $("stats").append(row);
  });
}

function refreshGoals() {
  renderGoals();
  renderImportantGoals();
  renderPerformance();
}

// =============================
// KHỞI ĐỘNG
// =============================

renderCalendar();
renderTasks();
refreshGoals();

const initialPage = location.hash.slice(1) || "home";
showPage(initialPage);

window.addEventListener("hashchange", () => {
  showPage(location.hash.slice(1) || "home");
});
