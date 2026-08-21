import { Hono } from "hono";
import {
  getAllCards, getCard, getCardsByLesson, getLessons, searchCards,
  createCard, updateCard, deleteCard,
  getCardsForReview, updateProgress, getPileStats, getPileCards,
  getRandomCards, getRandomSynonymDistractors, getRandomWordDistractors,
  getDueCardsCount, getProgress,
  getQuizCards, getMCQOptions, getMCQWordOptions,
} from "./db";

const app = new Hono();

// ── Shared HTML Head/CSS ──
const CSS = `
  body { padding: 0.5rem; max-width: 640px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; }
  nav { margin-bottom: 1rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
  nav .brand { font-weight: 700; font-size: 1.1rem; }
  nav .links { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  nav .links a { text-decoration: none; padding: 0.3rem 0.6rem; border-radius: 6px; background: var(--pico-card-background-color, #f5f5f5); border: 1px solid var(--pico-muted-border-color, #ddd); font-size: 0.85rem; }
  nav .links a:hover { background: var(--pico-primary, #3b82f6); color: white; }
  .card-box {
    border: 2px solid var(--pico-muted-border-color, #ddd);
    border-radius: 16px;
    padding: 2rem 1.5rem;
    min-height: 220px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    cursor: pointer; user-select: none;
    transition: transform 0.2s;
    text-align: center;
    background: var(--pico-card-background-color, #fff);
  }
  .card-box:active { transform: scale(0.97); }
  .card-word { font-size: 2rem; font-weight: 700; margin: 0.5rem 0; }
  .card-pos { font-size: 0.9rem; color: #888; margin-bottom: 0.3rem; }
  .card-synonym { font-size: 1.5rem; color: #3b82f6; font-weight: 600; margin: 0.5rem 0; }
  .card-definition { font-size: 1rem; color: #555; margin-top: 0.5rem; }
  .card-example { font-size: 0.85rem; font-style: italic; color: #888; margin-top: 0.8rem; max-width: 90%; }
  .btn-group { display: flex; gap: 0.5rem; margin-top: 1rem; width: 100%; }
  .btn-group button { flex: 1; padding: 0.8rem; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; }
  .btn-wrong { background: #ef4444; color: white; }
  .btn-correct { background: #22c55e; color: white; }
  .btn-group button:disabled { opacity: 0.4; cursor: not-allowed; }
  .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; }
  .stat-card { text-align: center; padding: 1.2rem; border-radius: 10px; background: var(--pico-card-background-color, #fff); border: 1px solid var(--pico-muted-border-color, #ddd); }
  .stat-num { font-size: 2.2rem; font-weight: 700; line-height: 1.2; }
  .stat-label { font-size: 0.8rem; color: #888; margin-top: 0.2rem; }
  .tag { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
  .tag-mastered { background: #22c55e; color: white; }
  .tag-unmastered { background: #ef4444; color: white; }
  .hidden { display: none !important; }
  .flash-in { animation: flashIn 0.3s ease; }
  @keyframes flashIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  .lesson-select { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 1rem 0; }
  .lesson-btn { padding: 0.35rem 0.65rem; border: 1px solid #ddd; border-radius: 6px; background: #fff; cursor: pointer; font-size: 0.8rem; text-decoration: none; color: #333; }
  .lesson-btn:hover { background: #3b82f6; color: white; border-color: #3b82f6; }
  .progress-bar { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; margin-top: 0.5rem; }
  .progress-fill { height: 100%; background: #3b82f6; border-radius: 4px; transition: width 0.5s; }
  .quiz-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
  .quiz-option { padding: 1rem; border: 2px solid #ddd; border-radius: 10px; text-align: center; cursor: pointer; font-size: 1rem; background: #fff; transition: all 0.15s; }
  .quiz-option:active { transform: scale(0.95); }
  .quiz-option.correct { background: #22c55e; color: white; border-color: #22c55e; }
  .quiz-option.wrong { background: #ef4444; color: white; border-color: #ef4444; }
  .quiz-option.selected { border-color: #3b82f6; background: #3b82f6; color: white; }
  .pile-mastered { border-left: 4px solid #22c55e; padding: 0.5rem 0.8rem; margin-bottom: 0.3rem; border-radius: 0 6px 6px 0; background: #f0fdf4; }
  .pile-unmastered { border-left: 4px solid #ef4444; padding: 0.5rem 0.8rem; margin-bottom: 0.3rem; border-radius: 0 6px 6px 0; background: #fef2f2; }
  .match-card { padding: 0.8rem; border: 2px solid #ddd; border-radius: 10px; text-align: center; cursor: pointer; font-size: 0.9rem; min-height: 55px; display: flex; align-items: center; justify-content: center; background: #fff; transition: all 0.15s; }
  .match-card:active { transform: scale(0.95); }
  .match-card.matched { background: #22c55e; color: white; border-color: #22c55e; pointer-events: none; }
  .match-card.selected { border-color: #3b82f6; background: #3b82f6; color: white; }
  details { margin: 0.5rem 0; }
  details summary { cursor: pointer; padding: 0.5rem; font-weight: 600; }
  article { padding: 0.8rem; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 0.5rem; }
  .action-btn { display: block; width: 100%; padding: 1rem; border: none; border-radius: 10px; font-size: 1.1rem; font-weight: 600; cursor: pointer; text-align: center; text-decoration: none; margin-bottom: 0.5rem; }
  .action-primary { background: #3b82f6; color: white; }
  .action-secondary { background: #f3f4f6; color: #333; border: 1px solid #ddd; }
  input[type="text"], input[type="number"], input[type="search"], textarea, select {
    width: 100%; padding: 0.6rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.95rem; margin-bottom: 0.5rem; box-sizing: border-box;
  }
  label { font-size: 0.85rem; font-weight: 500; margin-bottom: 0.1rem; display: block; }
`;

function head(title: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — TOEFL Flashcard</title>
  <style>${CSS}</style>
</head>
<body>`;
}

const FOOTER = `</body></html>`;

function nav(): string {
  return `<nav>
  <span class="brand">📚 Flashcard TOEFL</span>
  <div class="links">
    <a href="/">Home</a>
    <a href="/study">Belajar</a>
    <a href="/pile">Pile</a>
    <a href="/quiz">Quiz</a>
    <a href="/manage">Kelola</a>
  </div>
</nav>`;
}

// ════════════════════════════════════════
//  PAGES
// ════════════════════════════════════════

// ── Dashboard ──
app.get("/", (c) => {
  const stats = getPileStats();
  const due = getDueCardsCount();
  const pct = stats.totalCards > 0 ? Math.round((stats.fullyMastered.cnt / stats.totalCards) * 100) : 0;
  const lessons = getLessons();
  const lessonBtns = lessons.map(l => `<a href="/study?lesson=${l}" class="lesson-btn">L${l}</a>`).join("");

  return c.html(head("Dashboard") + nav() + `
    <h2>Dashboard</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-num">${stats.totalCards}</div>
        <div class="stat-label">Total Kata</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${stats.fullyMastered.cnt}</div>
        <div class="stat-label">Dikuasai</div>
      </div>
      <div class="stat-card">
        <div class="stat-num" style="color:#f59e0b">${Math.floor(due / 2)}</div>
        <div class="stat-label">Perlu Review</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${pct}%</div>
        <div class="stat-label">Progress</div>
      </div>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width:${pct}%"></div>
    </div>
    <div style="margin-top:1.5rem">
      <a href="/study" class="action-btn action-primary">📖 Mulai Belajar</a>
      <a href="/quiz" class="action-btn action-secondary">🧠 Quiz</a>
    </div>
    <h3 style="margin-top:1.5rem">Per Lesson</h3>
    <div class="lesson-select">${lessonBtns}</div>
    ${FOOTER}
  `);
});

// ── Study (Flashcard) ──
app.get("/study", (c) => {
  const lesson = c.req.query("lesson") || "";
  const mode = c.req.query("mode") || "mixed";
  const lessons = getLessons();
  const lessonOpts = lessons.map(l =>
    `<option value="${l}" ${lesson === String(l) ? "selected" : ""}>Lesson ${l}</option>`
  ).join("");

  return c.html(head("Belajar") + nav() + `
    <h2>Belajar</h2>
    <form method="GET" action="/study">
      <label>Filter Lesson</label>
      <select name="lesson" onchange="this.form.submit()">
        <option value="">Semua Lesson</option>
        ${lessonOpts}
      </select>
      <label>Mode Arah</label>
      <select name="mode" onchange="this.form.submit()">
        <option value="mixed" ${mode === "mixed" ? "selected" : ""}>Acak (Dua Arah)</option>
        <option value="kw_to_syn" ${mode === "kw_to_syn" ? "selected" : ""}>Kata → Sinonim</option>
        <option value="syn_to_kw" ${mode === "syn_to_kw" ? "selected" : ""}>Sinonim → Kata</option>
      </select>
    </form>

    <div id="card-container">
      <p style="text-align:center; color:#888">Tekan tombol untuk mulai...</p>
    </div>

    <div id="card-actions" class="hidden" style="text-align:center">
      <p id="instruction" style="color:#888; font-size:0.85rem">Klik kartu untuk balik</p>
      <div class="btn-group">
        <button class="btn-wrong" onclick="answer(false)" id="btn-wrong">❌ Belum Hafal</button>
        <button class="btn-correct" onclick="answer(true)" id="btn-correct">✅ Sudah Hafal</button>
      </div>
    </div>

    <script>
      var currentCard = null;
      var isFlipped = false;

      function getParam(name) {
        return new URLSearchParams(window.location.search).get(name) || "";
      }

      async function loadCard() {
        var lesson = getParam("lesson");
        var direction = getParam("mode");
        var url = "/api/next-card?lesson=" + lesson + "&direction=" + direction;
        var res = await fetch(url);
        var data = await res.json();

        if (!data.card) {
          document.getElementById("card-container").innerHTML =
            '<p style="text-align:center; font-size:1.2rem; padding:2rem">🎉 Semua kartu sudah direview! Coba lagi nanti.</p>';
          document.getElementById("card-actions").classList.add("hidden");
          return;
        }

        currentCard = data.card;
        isFlipped = false;
        document.getElementById("card-actions").classList.remove("hidden");
        document.getElementById("btn-correct").disabled = true;
        document.getElementById("btn-wrong").disabled = true;
        renderCard();
      }

      function renderCard() {
        var c = currentCard;
        if (!c) return;
        var el = document.getElementById("card-container");

        if (!isFlipped) {
          if (c.direction === "kw_to_syn") {
            el.innerHTML = '<div class="card-box" onclick="flipCard()">' +
              '<span class="tag tag-unmastered">Kata → Sinonim</span>' +
              '<div class="card-word">' + esc(c.word) + '</div>' +
              '<div class="card-pos">' + esc(c.pos || '') + '</div>' +
              '<div class="card-definition">' + esc(c.definition || '') + '</div>' +
              '<p style="margin-top:1rem; color:#aaa; font-size:0.8rem">Klik untuk balik</p>' +
              '</div>';
          } else {
            el.innerHTML = '<div class="card-box" onclick="flipCard()">' +
              '<span class="tag tag-unmastered">Sinonim → Kata</span>' +
              '<div class="card-synonym">' + esc(c.synonym || '?') + '</div>' +
              '<p style="margin-top:1rem; color:#aaa; font-size:0.8rem">Klik untuk balik</p>' +
              '</div>';
          }
          document.getElementById("instruction").textContent = "Klik kartu untuk balik";
          document.getElementById("btn-correct").disabled = true;
          document.getElementById("btn-wrong").disabled = true;
        } else {
          if (c.direction === "kw_to_syn") {
            el.innerHTML = '<div class="card-box flash-in">' +
              '<span class="tag tag-mastered">Jawaban</span>' +
              '<div class="card-synonym">' + esc(c.synonym || '?') + '</div>' +
              '<div class="card-definition">' + esc(c.definition || '') + '</div>' +
              (c.example1 ? '<div class="card-example">"' + esc(c.example1) + '"</div>' : '') +
              '</div>';
          } else {
            el.innerHTML = '<div class="card-box flash-in">' +
              '<span class="tag tag-mastered">Jawaban</span>' +
              '<div class="card-word">' + esc(c.word) + '</div>' +
              '<div class="card-pos">' + esc(c.pos || '') + '</div>' +
              '<div class="card-definition">' + esc(c.definition || '') + '</div>' +
              (c.example1 ? '<div class="card-example">"' + esc(c.example1) + '"</div>' : '') +
              '</div>';
          }
          document.getElementById("instruction").textContent = "Apakah kamu bisa menjawab?";
          document.getElementById("btn-correct").disabled = false;
          document.getElementById("btn-wrong").disabled = false;
        }
      }

      function esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

      function flipCard() {
        if (isFlipped) return;
        isFlipped = true;
        renderCard();
      }

      async function answer(correct) {
        if (!currentCard) return;
        await fetch("/api/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            card_id: currentCard.id,
            direction: currentCard.direction,
            correct: correct
          })
        });
        loadCard();
      }

      loadCard();
    </script>
    ${FOOTER}
  `);
});

// ── Pile ──
app.get("/pile", (c) => {
  const stats = getPileStats();
  const total = stats.totalCards;
  const mastered = stats.fullyMastered.cnt;
  const unmastered = total - mastered;

  return c.html(head("Pile") + nav() + `
    <h2>Kelola Pile</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-num" style="color:#22c55e">${mastered}</div>
        <div class="stat-label">Dikuasai ✅</div>
      </div>
      <div class="stat-card">
        <div class="stat-num" style="color:#ef4444">${unmastered}</div>
        <div class="stat-label">Perlu Dihafal 🔴</div>
      </div>
    </div>

    <details>
      <summary>🟢 Dikuasai (${mastered} kata)</summary>
      <div id="mastered-list"><p style="color:#888">Loading...</p></div>
    </details>

    <details>
      <summary>🔴 Perlu Dihafal (${unmastered} kata)</summary>
      <div id="unmastered-list"><p style="color:#888">Loading...</p></div>
    </details>

    <script>
      async function loadPiles() {
        var mRes = await fetch("/api/pile/mastered");
        var uRes = await fetch("/api/pile/unmastered");
        var mastered = await mRes.json();
        var unmastered = await uRes.json();

        document.getElementById("mastered-list").innerHTML = mastered.length === 0
          ? '<p style="color:#888">Belum ada</p>'
          : mastered.map(function(c) {
              return '<div class="pile-mastered"><strong>' + c.word + '</strong> <small>' + (c.pos||'') + '</small> → <em>' + (c.synonym||'-') + '</em> <small style="color:#aaa">Lesson ' + c.lesson + '</small></div>';
            }).join("");

        document.getElementById("unmastered-list").innerHTML = unmastered.length === 0
          ? '<p style="color:#888">Semua sudah dikuasai! 🎉</p>'
          : unmastered.map(function(c) {
              return '<div class="pile-unmastered"><strong>' + c.word + '</strong> <small>' + (c.pos||'') + '</small> → <em>' + (c.synonym||'-') + '</em> <small style="color:#aaa">Lesson ' + c.lesson + '</small></div>';
            }).join("");
      }
      loadPiles();
    </script>
    ${FOOTER}
  `);
});

// ── Quiz Hub ──
app.get("/quiz", (c) => {
  const lessons = getLessons();
  const lessonOpts = lessons.map(l => '<option value="' + l + '">Lesson ' + l + '</option>').join("");
  return c.html(head("Quiz") + nav() + `
    <h2>Quiz</h2>
    <p>Pilih mode quiz dan lesson:</p>
    <div style="margin-bottom:1rem">
      <label>Lesson</label>
      <select id="quiz-lesson">
        <option value="">Semua Lesson (Random)</option>
        ${lessonOpts}
      </select>
    </div>
    <a id="link-matching" href="/quiz/matching" class="action-btn action-primary">🎯 Matching — Cocokkan keyword dengan sinonim</a>
    <a id="link-mcq" href="/quiz/mcq" class="action-btn action-secondary">📋 Pilihan Ganda — Pilih sinonim yang benar</a>
    <a id="link-typing" href="/quiz/typing" class="action-btn action-secondary">⌨️ Typing — Ketik sinonim langsung</a>
    <script>
      var sel = document.getElementById("quiz-lesson");
      function updateLinks() {
        var q = sel.value ? "?lesson=" + sel.value : "";
        document.getElementById("link-matching").href = "/quiz/matching" + q;
        document.getElementById("link-mcq").href = "/quiz/mcq" + q;
        document.getElementById("link-typing").href = "/quiz/typing" + q;
      }
      sel.addEventListener("change", updateLinks);
    </script>
    ${FOOTER}
  `);
});

// ── Quiz: Matching ──
app.get("/quiz/matching", (c) => {
  const lessonStr = c.req.query("lesson");
  const lessonLabel = lessonStr ? "Lesson " + lessonStr : "Semua Lesson";
  const apiLesson = lessonStr ? "&lesson=" + lessonStr : "";
  return c.html(head("Quiz: Matching") + nav() + `
    <h2>🎯 Matching</h2>
    <p style="color:#888">${lessonLabel} — Klik pasangan keyword dan sinonim yang cocok.</p>
    <div id="score-bar" style="display:flex; justify-content:space-between; margin-bottom:1rem">
      <span>Benar: <strong id="correct-count">0</strong></span>
      <span>Sisa: <strong id="remaining">0</strong></span>
    </div>
    <div id="match-grid" class="quiz-grid"></div>
    <div id="match-result" class="hidden" style="text-align:center; margin-top:1.5rem">
      <h3 id="match-msg"></h3>
      <button onclick="startMatch()" style="padding:0.8rem 2rem; border:none; border-radius:8px; background:#3b82f6; color:white; font-size:1rem; cursor:pointer; font-weight:600">Main Lagi</button>
    </div>

    <script>
      var matchWords = [], matchSynonyms = [];
      var selectedWord = null, selectedSyn = null;
      var correct = 0, total = 0;
      var API = "/api/quiz/matching?count=6" + "${apiLesson}";

      async function startMatch() {
        document.getElementById("match-result").classList.add("hidden");
        correct = 0;
        selectedWord = null;
        selectedSyn = null;

        var res = await fetch(API);
        var data = await res.json();
        matchWords = data.cards.map(function(c) { return { id: c.id, text: c.word, pairId: c.id }; });
        matchSynonyms = data.cards.map(function(c) { return { id: c.id, text: c.synonym || c.definition || "?", pairId: c.id }; });
        total = data.cards.length;
        shuffle(matchWords);
        shuffle(matchSynonyms);
        renderMatch();
      }

      function renderMatch() {
        var grid = document.getElementById("match-grid");
        var remaining = total - correct;
        document.getElementById("correct-count").textContent = correct;
        document.getElementById("remaining").textContent = remaining;

        var html = '<div style="grid-column:1/-1; text-align:center; font-weight:700; color:#888; font-size:0.85rem">KATA</div>';
        matchWords.forEach(function(w) {
          var cls = w.pairId === "matched" ? "matched" : (selectedWord && selectedWord.id === w.id ? "selected" : "");
          html += '<div class="match-card ' + cls + '" onclick="selectWord(' + w.id + ')">' + w.text + '</div>';
        });
        html += '<div style="grid-column:1/-1; text-align:center; font-weight:700; color:#888; font-size:0.85rem; margin-top:0.5rem">SINONIM</div>';
        matchSynonyms.forEach(function(s) {
          var cls = s.pairId === "matched" ? "matched" : (selectedSyn && selectedSyn.id === s.id ? "selected" : "");
          html += '<div class="match-card ' + cls + '" onclick="selectSyn(' + s.id + ')">' + s.text + '</div>';
        });
        grid.innerHTML = html;
      }

      function selectWord(id) {
        var w = matchWords.find(function(x) { return x.id == id; });
        if (!w || w.pairId === "matched") return;
        selectedWord = w;
        checkMatch();
        renderMatch();
      }

      function selectSyn(id) {
        var s = matchSynonyms.find(function(x) { return x.id == id; });
        if (!s || s.pairId === "matched") return;
        selectedSyn = s;
        checkMatch();
        renderMatch();
      }

      function checkMatch() {
        if (!selectedWord || !selectedSyn) return;
        if (selectedWord.pairId === selectedSyn.pairId) {
          correct++;
          selectedWord.pairId = "matched";
          selectedSyn.pairId = "matched";
          if (correct === total) {
            setTimeout(function() {
              document.getElementById("match-result").classList.remove("hidden");
              document.getElementById("match-msg").textContent = "🎉 Semua benar! " + correct + "/" + total;
            }, 300);
          }
        }
        selectedWord = null;
        selectedSyn = null;
        renderMatch();
      }

      function shuffle(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
        }
      }

      startMatch();
    </script>
    ${FOOTER}
  `);
});

// ── Quiz: Multiple Choice ──
app.get("/quiz/mcq", (c) => {
  const lessonStr = c.req.query("lesson");
  const lessonLabel = lessonStr ? "Lesson " + lessonStr : "Semua Lesson";
  const apiLesson = lessonStr ? "?lesson=" + lessonStr : "";
  return c.html(head("Quiz: Pilihan Ganda") + nav() + `
    <h2>📋 Pilihan Ganda</h2>
    <p style="color:#888">${lessonLabel}</p>
    <div id="score-bar" style="display:flex; justify-content:space-between; margin-bottom:1rem">
      <span>Benar: <strong id="mcq-correct">0</strong></span>
      <span>Total: <strong id="mcq-total">0</strong></span>
    </div>
    <div id="mcq-container"></div>

    <script>
      var mcqCorrect = 0, mcqTotal = 0;
      var API = "/api/quiz/mcq" + "${apiLesson}";

      async function loadMCQ() {
        var res = await fetch(API);
        var data = await res.json();
        mcqTotal++;
        document.getElementById("mcq-total").textContent = mcqTotal;

        var container = document.getElementById("mcq-container");
        var showWord = Math.random() > 0.5;

        if (showWord) {
          var opts = data.options || [data.card.synonym].concat(data.distractors || []);
          container.innerHTML = '<article>' +
            '<h3 style="text-align:center; margin:0">' + esc(data.card.word) + ' <small style="color:#888">' + (data.card.pos||'') + '</small></h3>' +
            '<p style="text-align:center; color:#888; font-size:0.85rem">Pilih sinonim yang benar:</p>' +
            '<div class="quiz-grid">' + opts.map(function(o) {
              return '<div class="quiz-option" onclick="checkMCQ(this,\'' + jsEsc(o) + '\',\'' + jsEsc(data.correct||data.card.synonym||'') + '\')">' + o + '</div>';
            }).join("") + '</div>' +
            (data.card.definition ? '<p style="text-align:center; font-size:0.85rem; color:#888; margin-top:0.5rem">Arti: ' + data.card.definition + '</p>' : '') +
            '</article>';
        } else {
          var wOpts = data.wordOptions || [data.card.word].concat(data.distractorWords || []);
          container.innerHTML = '<article>' +
            '<h3 style="text-align:center; color:#3b82f6; margin:0">' + (data.card.synonym || data.card.definition || '?') + '</h3>' +
            '<p style="text-align:center; color:#888; font-size:0.85rem">Kata yang memiliki sinonim di atas adalah:</p>' +
            '<div class="quiz-grid">' + wOpts.map(function(o) {
              return '<div class="quiz-option" onclick="checkMCQ(this,\'' + jsEsc(o) + '\',\'' + jsEsc(data.correctWord||data.card.word) + '\')">' + o + '</div>';
            }).join("") + '</div>' +
            '</article>';
        }
      }

      function checkMCQ(el, chosen, correctAnswer) {
        var article = el.closest("article");
        if (article.querySelector(".correct, .wrong")) return;
        var options = el.closest(".quiz-grid").querySelectorAll(".quiz-option");
        options.forEach(function(o) {
          if (o.textContent.trim() === correctAnswer) o.classList.add("correct");
        });
        if (chosen === correctAnswer) {
          el.classList.add("correct");
          mcqCorrect++;
          document.getElementById("mcq-correct").textContent = mcqCorrect;
        } else {
          el.classList.add("wrong");
        }
        setTimeout(loadMCQ, 1200);
      }

      function esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
      function jsEsc(s) { return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'"); }
      function shuffleArr(a) { for (var i = a.length-1; i>0; i--) { var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } }

      loadMCQ();
    </script>
    ${FOOTER}
  `);
});

// ── Quiz: Typing ──
app.get("/quiz/typing", (c) => {
  const lessonStr = c.req.query("lesson");
  const lessonLabel = lessonStr ? "Lesson " + lessonStr : "Semua Lesson";
  const apiLesson = lessonStr ? "?lesson=" + lessonStr : "";
  return c.html(head("Quiz: Typing") + nav() + `
    <h2>⌨️ Typing</h2>
    <p style="color:#888">${lessonLabel}</p>
    <div id="score-bar" style="display:flex; justify-content:space-between; margin-bottom:1rem">
      <span>Benar: <strong id="type-correct">0</strong></span>
      <span>Total: <strong id="type-total">0</strong></span>
    </div>
    <div id="type-container"></div>

    <script>
      var typeCorrect = 0, typeTotal = 0;
      var API = "/api/quiz/typing" + "${apiLesson}";

      async function loadTyping() {
        var res = await fetch(API);
        var data = await res.json();
        typeTotal++;
        document.getElementById("type-total").textContent = typeTotal;

        var isWordMode = Math.random() > 0.5;
        var prompt = isWordMode ? data.card.word : (data.card.synonym || data.card.definition || "?");
        var answer = isWordMode ? (data.card.synonym || "") : data.card.word;
        var label = isWordMode ? "Ketik sinonim dari:" : "Ketik kata yang sinonimnya:";

        document.getElementById("type-container").innerHTML = '<article>' +
          '<p style="color:#888; margin:0">' + label + '</p>' +
          '<h3 style="text-align:center; margin:0.5rem 0">' + prompt + '</h3>' +
          (data.card.definition ? '<p style="text-align:center; font-size:0.85rem; color:#888; margin:0">Arti: ' + data.card.definition + '</p>' : '') +
          '<form id="type-form" onsubmit="checkTyping(event, \'' + answer.toLowerCase().replace(/'/g, "\\'") + '\')" style="margin-top:1rem">' +
          '<input type="text" id="type-input" placeholder="Ketik jawaban..." autocomplete="off" autofocus style="font-size:1.1rem; padding:0.8rem">' +
          '<button type="submit" style="width:100%; padding:0.8rem; margin-top:0.5rem; border:none; border-radius:8px; background:#3b82f6; color:white; font-size:1rem; cursor:pointer; font-weight:600">Cek</button>' +
          '</form>' +
          '<div id="type-feedback" style="text-align:center; margin-top:0.5rem"></div>' +
          '</article>';
        document.getElementById("type-input").focus();
      }

      function checkTyping(e, correct) {
        e.preventDefault();
        var input = document.getElementById("type-input").value.trim().toLowerCase();
        var feedback = document.getElementById("type-feedback");
        if (input === correct) {
          feedback.innerHTML = '<p style="color:#22c55e; font-weight:700; font-size:1.1rem">✅ Benar!</p>';
          typeCorrect++;
          document.getElementById("type-correct").textContent = typeCorrect;
        } else {
          feedback.innerHTML = '<p style="color:#ef4444; font-weight:700">❌ Jawaban: <strong>' + correct + '</strong></p>';
        }
        setTimeout(loadTyping, 1500);
      }

      loadTyping();
    </script>
    ${FOOTER}
  `);
});

// ── Manage Cards ──
app.get("/manage", (c) => {
  return c.html(head("Kelola Kartu") + nav() + `
    <h2>Kelola Kartu</h2>
    <input type="search" id="search" placeholder="Cari kata..." oninput="searchCards()">

    <details>
      <summary>➕ Tambah Kartu Baru</summary>
      <form id="add-form" onsubmit="addCard(event)">
        <label>Lesson</label>
        <input type="number" name="lesson" required min="1" max="30" value="1">
        <label>Word</label>
        <input type="text" name="word" required>
        <label>Part of Speech</label>
        <select name="pos">
          <option value="n.">n.</option>
          <option value="v.">v.</option>
          <option value="adj.">adj.</option>
          <option value="adv.">adv.</option>
        </select>
        <label>Synonym</label>
        <input type="text" name="synonym">
        <label>Definition</label>
        <textarea name="definition" rows="2"></textarea>
        <label>Example 1</label>
        <textarea name="example1" rows="2"></textarea>
        <label>Example 2</label>
        <textarea name="example2" rows="2"></textarea>
        <button type="submit" style="width:100%; padding:0.8rem; margin-top:0.5rem; border:none; border-radius:8px; background:#3b82f6; color:white; font-size:1rem; cursor:pointer; font-weight:600">Tambah</button>
      </form>
    </details>

    <div id="card-list" style="margin-top:1rem">
      <p style="color:#888">Loading...</p>
    </div>

    <script>
      var allCards = [];

      async function loadCards() {
        var res = await fetch("/api/cards");
        allCards = await res.json();
        renderCards(allCards);
      }

      function searchCards() {
        var q = document.getElementById("search").value.toLowerCase();
        var filtered = allCards.filter(function(c) {
          return c.word.toLowerCase().indexOf(q) >= 0 || (c.synonym||"").toLowerCase().indexOf(q) >= 0;
        });
        renderCards(filtered);
      }

      function renderCards(cards) {
        document.getElementById("card-list").innerHTML = cards.length === 0
          ? '<p style="color:#888">Tidak ditemukan</p>'
          : cards.slice(0, 200).map(function(c) {
              return '<article style="display:flex; justify-content:space-between; align-items:start">' +
                '<div>' +
                '<strong>' + c.word + '</strong> <small>' + (c.pos||'') + '</small> → <em>' + (c.synonym||'-') + '</em>' +
                '<br><small style="color:#888">Lesson ' + c.lesson + ' · ' + (c.definition||'') + '</small>' +
                '</div>' +
                '<button onclick="deleteCard(' + c.id + ')" style="border:1px solid #ddd; background:white; border-radius:6px; padding:0.3rem 0.6rem; cursor:pointer; font-size:0.8rem">🗑</button>' +
                '</article>';
            }).join("");
      }

      async function addCard(e) {
        e.preventDefault();
        var form = e.target;
        var fd = new FormData(form);
        var data = {};
        fd.forEach(function(v, k) { data[k] = v; });
        data.lesson = parseInt(data.lesson);
        await fetch("/api/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
        form.reset();
        loadCards();
      }

      async function deleteCard(id) {
        if (!confirm("Hapus kartu ini?")) return;
        await fetch("/api/cards/" + id, { method: "DELETE" });
        loadCards();
      }

      loadCards();
    </script>
    ${FOOTER}
  `);
});

// ════════════════════════════════════════
//  API ROUTES
// ════════════════════════════════════════

app.get("/api/cards", (c) => c.json(getAllCards()));
app.get("/api/cards/:id", (c) => {
  const card = getCard(parseInt(c.req.param("id")));
  return card ? c.json(card) : c.json({ error: "Not found" }, 404);
});
app.post("/api/cards", async (c) => {
  const body = await c.req.json();
  const id = createCard(body);
  return c.json({ id }, 201);
});
app.put("/api/cards/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();
  updateCard(id, body);
  return c.json({ ok: true });
});
app.delete("/api/cards/:id", (c) => {
  deleteCard(parseInt(c.req.param("id")));
  return c.json({ ok: true });
});

app.get("/api/next-card", (c) => {
  const directionParam = c.req.query("direction");
  const lessonStr = c.req.query("lesson");
  const lesson = lessonStr ? parseInt(lessonStr) : undefined;
  // "mixed" or empty = no direction filter (both directions)
  const direction = (directionParam && directionParam !== "mixed")
    ? (directionParam as "kw_to_syn" | "syn_to_kw")
    : undefined;
  const cards = getCardsForReview(direction, 1, lesson);
  if (cards.length === 0) return c.json({ card: null });
  return c.json({ card: cards[0] });
});

app.post("/api/answer", async (c) => {
  const { card_id, direction, correct } = await c.req.json();
  updateProgress(card_id, direction, correct);
  return c.json({ ok: true });
});

app.get("/api/pile/:pile", (c) => {
  const pile = c.req.param("pile") as "mastered" | "unmastered";
  return c.json(getPileCards(pile));
});

app.get("/api/stats", (c) => c.json(getPileStats()));

// ── Quiz API ──
app.get("/api/quiz/matching", (c) => {
  const count = parseInt(c.req.query("count") || "6");
  const lessonStr = c.req.query("lesson");
  const lesson = lessonStr ? parseInt(lessonStr) : undefined;
  return c.json({ cards: getQuizCards(lesson, count) });
});

app.get("/api/quiz/mcq", (c) => {
  const lessonStr = c.req.query("lesson");
  const lesson = lessonStr ? parseInt(lessonStr) : undefined;
  const cards = getQuizCards(lesson, 1);
  if (cards.length === 0) return c.json({ error: "No cards" }, 404);
  const card = cards[0];
  const mcqData = getMCQOptions(card, lesson);
  const wordData = getMCQWordOptions(card, lesson);
  return c.json({
    card,
    correct: mcqData.correct,
    options: mcqData.options,
    correctWord: wordData.correct,
    wordOptions: wordData.options,
  });
});

app.get("/api/quiz/typing", (c) => {
  const lessonStr = c.req.query("lesson");
  const lesson = lessonStr ? parseInt(lessonStr) : undefined;
  const cards = getQuizCards(lesson, 1);
  if (cards.length === 0) return c.json({ error: "No cards" }, 404);
  return c.json({ card: cards[0] });
});

// ── Start ──
const port = 3000;
console.log(`🚀 Flashcard TOEFL running at http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
