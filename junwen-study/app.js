const STORE_KEY = "junwen-study-v1";
const DAY = 24 * 60 * 60 * 1000;

const state = {
  questions: [],
  progress: loadProgress(),
  tab: "practice",
  session: null,
  importText: "",
  importNote: "",
  now: Date.now(),
};

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { records: {}, favorites: {}, imported: [] };
    const data = JSON.parse(raw);
    data.records = data.records || {};
    data.favorites = data.favorites || {};
    data.imported = data.imported || [];
    return data;
  } catch {
    return { records: {}, favorites: {}, imported: [] };
  }
}

function saveProgress() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state.progress));
}

function allQuestions() {
  const byId = new Map();
  for (const q of state.questions) byId.set(q.id, q);
  for (const q of state.progress.imported) byId.set(q.id, q);
  return [...byId.values()];
}

function recordOf(id) {
  return state.progress.records[id];
}

function groups() {
  const map = new Map();
  for (const q of allQuestions()) {
    const key = `${q.subject} / ${q.chapter}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(q);
  }
  return [...map.entries()];
}

function accuracy() {
  const records = Object.values(state.progress.records);
  const answered = records.length;
  const correct = records.filter((r) => r.correct).length;
  return { answered, correct, rate: answered ? Math.round((correct / answered) * 100) : 0 };
}

function wrongQuestions() {
  return allQuestions().filter((q) => recordOf(q.id)?.wrong);
}

function dueQuestions() {
  return wrongQuestions().filter((q) => (recordOf(q.id)?.due || 0) <= state.now);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function optionLabel(index) {
  return String.fromCharCode(65 + index);
}

function render() {
  const root = document.querySelector("#app");
  root.innerHTML = state.session ? renderSession() : renderTabs();
  bind();
}

function renderTabs() {
  const titles = {
    practice: ["练习", "按章节刷原创题，不设会员"],
    mock: ["模考", "计时作答，交卷后看解析"],
    wrong: ["错题", "错题、收藏和到期复习"],
    me: ["我的", "进度存在这台设备上"],
  };
  const [title, sub] = titles[state.tab];
  return `
    <header class="top">
      <p class="kicker">军队文职 · 原创练习</p>
      <h1>${title}</h1>
      <p class="sub">${sub}</p>
    </header>
    <main class="screen">${renderTabBody()}</main>
    <nav class="nav">
      ${navButton("practice", "练习")}
      ${navButton("mock", "模考")}
      ${navButton("wrong", "错题")}
      ${navButton("me", "我的")}
    </nav>
  `;
}

function navButton(id, label) {
  return `<button data-tab="${id}" class="${state.tab === id ? "active" : ""}">${label}</button>`;
}

function renderTabBody() {
  if (state.tab === "practice") return renderPractice();
  if (state.tab === "mock") return renderMockHome();
  if (state.tab === "wrong") return renderWrong();
  return renderMe();
}

function renderPractice() {
  const blocks = groups()
    .map(([name, questions]) => {
      const done = questions.filter((q) => recordOf(q.id)).length;
      const width = Math.round((done / questions.length) * 100);
      return `
        <button class="chapter" data-start="chapter" data-key="${escapeHtml(name)}">
          <strong>${escapeHtml(name)}</strong>
          <span class="meta">${done}/${questions.length} 已做 · ${escapeHtml(questions[0].source || "原创练习")}</span>
          <div class="bar"><span style="width:${width}%"></span></div>
        </button>
      `;
    })
    .join("");
  return `<section class="card"><h2>公共科目</h2>${blocks || '<p class="empty">还没有题目</p>'}</section>`;
}

function renderMockHome() {
  const total = allQuestions().length;
  return `
    <section class="card">
      <h2>计时模考</h2>
      <p class="meta">从全部 ${total} 题里抽 10 题，限时 10 分钟。交卷前不看答案。</p>
      <button class="primary" data-start="mock" style="margin-top:12px">开始模考</button>
    </section>
  `;
}

function renderWrong() {
  const wrong = wrongQuestions();
  const due = dueQuestions();
  const favs = allQuestions().filter((q) => state.progress.favorites[q.id]);
  const list = (items, empty) =>
    items.length
      ? items
          .map(
            (q) =>
              `<button class="list-btn" data-start="one" data-id="${escapeHtml(q.id)}"><strong>${escapeHtml(q.chapter)}</strong><br>${escapeHtml(q.stem)}</button>`,
          )
          .join("")
      : `<p class="empty">${empty}</p>`;
  return `
    <section class="card">
      <div class="row"><h2>待复习</h2><span class="meta">${due.length} 题</span></div>
      ${due.length ? `<button class="primary" data-start="due">复习到期错题</button>` : `<p class="empty">现在没有到期的错题。</p>`}
    </section>
    <section class="card">
      <div class="row"><h2>错题本</h2><span class="meta">${wrong.length} 题</span></div>
      ${list(wrong, "还没有错题。做题时答错会自动进来。")}
    </section>
    <section class="card">
      <div class="row"><h2>收藏</h2><span class="meta">${favs.length} 题</span></div>
      ${list(favs, "做题时可以收藏。")}
    </section>
  `;
}

function renderMe() {
  const stats = accuracy();
  return `
    <section class="stats">
      <div class="stat"><b>${stats.answered}</b><span>已做</span></div>
      <div class="stat"><b>${stats.rate}%</b><span>正确率</span></div>
      <div class="stat"><b>${wrongQuestions().length}</b><span>错题</span></div>
    </section>
    <section class="card" style="margin-top:12px">
      <h2>导入自己的题</h2>
      <p class="meta">JSON 格式见设计稿。相同 id 会覆盖旧题，不删除做题记录。</p>
      <textarea id="import-text" placeholder='{"questions":[...]}'>${escapeHtml(state.importText)}</textarea>
      <button class="primary" id="import-btn" style="margin-top:10px">导入</button>
      <p class="meta">${escapeHtml(state.importNote)}</p>
    </section>
    <section class="card">
      <p class="meta">全部功能免费。进度只存在本机。题目为原创练习，不是历年真题。</p>
    </section>
  `;
}

function renderSession() {
  const session = state.session;
  const q = session.questions[session.index];
  const revealed = session.revealed;
  const total = session.questions.length;
  const remain = session.kind === "mock" && !session.finished ? formatTime(session.limit - elapsed(session)) : "";
  const options = q.options
    .map((text, index) => {
      let cls = "option";
      if (!revealed && session.picked === index) cls += " picked";
      if (revealed && index === q.answer) cls += " right";
      if (revealed && session.picked === index && index !== q.answer) cls += " bad";
      return `<button class="${cls}" data-pick="${index}" ${revealed ? "disabled" : ""}>${optionLabel(index)}. ${escapeHtml(text)}</button>`;
    })
    .join("");
  const fav = state.progress.favorites[q.id] ? "已收藏" : "收藏";
  const explain = revealed
    ? `<div class="explain"><span class="tag">${escapeHtml(q.source || "原创练习")}</span><p>${session.picked === q.answer ? "答对了。" : "答错了，已记入错题本。"} 正确答案是 ${optionLabel(q.answer)}。</p><p>${escapeHtml(q.explanation)}</p></div>`
    : "";
  const nextLabel = session.index + 1 === total ? "完成本组" : "下一题";
  return `
    <section class="session">
      <div class="session-top">
        <button class="ghost" id="leave">返回</button>
        <span>${session.index + 1}/${total}${remain ? " · " + remain : ""}</span>
        <span>${escapeHtml(q.chapter)}</span>
      </div>
      <p class="stem">${escapeHtml(q.stem)}</p>
      ${options}
      ${explain}
      <div class="actions">
        <button class="quiet" id="fav">${fav}</button>
        ${revealed ? `<button class="primary" id="next">${nextLabel}</button>` : `<button class="primary" id="submit">提交</button>`}
      </div>
      ${session.summary ? `<div class="explain">${session.summary}</div>` : ""}
    </section>
  `;
}

function elapsed(session) {
  return Math.floor((Date.now() - session.startedAt) / 1000);
}

function formatTime(seconds) {
  const safe = Math.max(0, seconds);
  const m = String(Math.floor(safe / 60)).padStart(2, "0");
  const s = String(safe % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function startSession(questions, kind) {
  if (!questions.length) return;
  state.session = {
    questions,
    kind,
    index: 0,
    picked: null,
    revealed: false,
    startedAt: Date.now(),
    limit: kind === "mock" ? 10 * 60 : 0,
    finished: false,
    summary: "",
    runCorrect: 0,
  };
  render();
}

function gradeCurrent() {
  const session = state.session;
  const q = session.questions[session.index];
  if (session.picked == null) return;
  const correct = session.picked === q.answer;
  const prev = recordOf(q.id) || { interval: 0, wrong: false };
  const interval = correct ? (prev.interval ? prev.interval * 2 : DAY) : 0;
  state.progress.records[q.id] = {
    choice: session.picked,
    correct,
    wrong: correct ? false : true,
    at: Date.now(),
    interval,
    due: Date.now() + interval,
  };
  if (correct) session.runCorrect += 1;
  saveProgress();
  session.revealed = true;
  render();
}

function nextQuestion() {
  const session = state.session;
  if (session.index + 1 >= session.questions.length) {
    session.finished = true;
    session.summary = `本组 ${session.runCorrect}/${session.questions.length} 题答对。错题可以在错题本里继续复习。`;
    render();
    return;
  }
  session.index += 1;
  session.picked = null;
  session.revealed = false;
  render();
}

function importQuestions(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    state.importNote = "JSON 无法解析。";
    render();
    return;
  }
  const list = Array.isArray(data) ? data : data.questions;
  if (!Array.isArray(list) || !list.length) {
    state.importNote = "没有找到 questions 数组。";
    render();
    return;
  }
  const clean = [];
  for (const q of list) {
    if (!q.id || !q.stem || !Array.isArray(q.options) || q.options.length < 2) continue;
    if (typeof q.answer !== "number" || q.answer < 0 || q.answer >= q.options.length) continue;
    clean.push({
      id: String(q.id),
      subject: q.subject || "导入",
      chapter: q.chapter || "未分类",
      stem: q.stem,
      options: q.options.map(String),
      answer: q.answer,
      explanation: q.explanation || "这是你导入的题目。",
      source: q.source || "用户导入",
    });
  }
  if (!clean.length) {
    state.importNote = "没有可导入的完整题目。";
    render();
    return;
  }
  const byId = new Map(state.progress.imported.map((q) => [q.id, q]));
  for (const q of clean) byId.set(q.id, q);
  state.progress.imported = [...byId.values()];
  saveProgress();
  state.importNote = `已导入 ${clean.length} 题。`;
  state.tab = "practice";
  render();
}

function bind() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.onclick = () => {
      state.tab = button.dataset.tab;
      render();
    };
  });
  document.querySelectorAll("[data-start]").forEach((button) => {
    button.onclick = () => {
      const kind = button.dataset.start;
      if (kind === "chapter") {
        const found = groups().find(([name]) => name === button.dataset.key);
        startSession(found ? found[1] : [], "chapter");
      } else if (kind === "mock") {
        startSession(shuffle(allQuestions()).slice(0, 10), "mock");
      } else if (kind === "due") {
        startSession(dueQuestions(), "review");
      } else if (kind === "one") {
        const q = allQuestions().find((item) => item.id === button.dataset.id);
        if (q) startSession([q], "review");
      }
    };
  });
  const leave = document.querySelector("#leave");
  if (leave) leave.onclick = () => { state.session = null; render(); };
  document.querySelectorAll("[data-pick]").forEach((button) => {
    button.onclick = () => {
      state.session.picked = Number(button.dataset.pick);
      render();
    };
  });
  const submit = document.querySelector("#submit");
  if (submit) submit.onclick = gradeCurrent;
  const next = document.querySelector("#next");
  if (next) next.onclick = nextQuestion;
  const fav = document.querySelector("#fav");
  if (fav) {
    fav.onclick = () => {
      const id = state.session.questions[state.session.index].id;
      if (state.progress.favorites[id]) delete state.progress.favorites[id];
      else state.progress.favorites[id] = true;
      saveProgress();
      render();
    };
  }
  const importBtn = document.querySelector("#import-btn");
  if (importBtn) {
    importBtn.onclick = () => {
      state.importText = document.querySelector("#import-text").value;
      importQuestions(state.importText);
    };
  }
  const area = document.querySelector("#import-text");
  if (area) area.oninput = () => { state.importText = area.value; };
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function boot() {
  try {
    const response = await fetch("./data/questions.json");
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    state.questions = data.questions;
  } catch {
    state.questions = window.JUNWEN_QUESTIONS?.questions || [];
  }
  if (!state.questions.length) throw new Error("题库为空");
  render();
  if (location.protocol.startsWith("http")) {
    setInterval(() => {
      if (state.session?.kind === "mock" && !state.session.revealed && !state.session.finished) {
        if (elapsed(state.session) >= state.session.limit) {
          state.session.picked = state.session.picked ?? -1;
          gradeCurrent();
        } else {
          render();
        }
      }
    }, 1000);
  }
}

boot().catch((error) => {
  document.querySelector("#app").innerHTML = `<main class="screen"><p class="empty">题目没有加载：${escapeHtml(error.message)}</p></main>`;
});
