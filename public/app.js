// ══════════════════════════════════════
//  Flashcard TOEFL — Static SPA
// ══════════════════════════════════════
import WORDS from './words.js';
import * as Store from './store.js';

// ── Init ──
Store.syncProgress(WORDS);
const ALL = WORDS; // already sorted by lesson, word

function getLessons() {
  return [...new Set(ALL.map(c => c.lesson))].sort((a, b) => a - b);
}
function getLessonCards(lesson) { return ALL.filter(c => c.lesson === lesson); }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function qs() { return new URLSearchParams(location.hash.split('?')[1] || ''); }

// ══════════════════════════════════════
//  CSS (inline)
// ══════════════════════════════════════
const CSS = `
  body { padding: 0.5rem; max-width: 640px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; }
  nav { margin-bottom: 1rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
  nav .brand { font-weight: 700; font-size: 1.1rem; }
  nav .links { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  nav .links a { text-decoration: none; padding: 0.3rem 0.6rem; border-radius: 6px; background: #f5f5f5; border: 1px solid #ddd; font-size: 0.85rem; }
  nav .links a:hover, nav .links a.active { background: #3b82f6; color: white; }
  .card-box { border: 2px solid #ddd; border-radius: 16px; padding: 2rem 1.5rem; min-height: 220px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; user-select: none; transition: transform 0.2s; text-align: center; background: #fff; }
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
  .stat-card { text-align: center; padding: 1.2rem; border-radius: 10px; background: #fff; border: 1px solid #ddd; }
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
  .flip-card { cursor: pointer; user-select: none; transition: all 0.2s; }
  .flip-card:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  .flip-card .word-side, .flip-card .syn-side { transition: opacity 0.15s; }
  .flip-card.flipped .word-side { opacity: 0.3; }
  .flip-card .syn-side { opacity: 0; }
  .flip-card.flipped .syn-side { opacity: 1; position: relative; }
`;

// ══════════════════════════════════════
//  HTML Helpers
// ══════════════════════════════════════
function nav() {
  const hash = location.hash.split('?')[0].replace(/^#/, '/') || '/';
  const links = [
    ['/', 'Home'], ['/study', 'Belajar'], ['/pile', 'Pile'],
    ['/quiz', 'Quiz'], ['/history', 'History'],
  ];
  return `<nav>
    <span class="brand">📚 Flashcard TOEFL</span>
    <div class="links">${links.map(([href, label]) =>
      `<a href="#${href}" class="${hash === href ? 'active' : ''}">${label}</a>`
    ).join('')}</div>
  </nav>`;
}

function render(html) {
  document.getElementById('app').innerHTML = html;
}

// ══════════════════════════════════════
//  PAGES
// ══════════════════════════════════════

// ── Dashboard ──
function pageDashboard() {
  const stats = Store.getPileStats(ALL);
  // Count unique cards that have at least one unmastered direction due
  const allProgress = Store.getAllProgress();
  const now = new Date().toISOString();
  const dueCards = ALL.filter(c => {
    const k1 = allProgress[`${c.id}_kw_to_syn`];
    const k2 = allProgress[`${c.id}_syn_to_kw`];
    const hasUnmasteredDue = (k1 && k1.pile === 'unmastered' && (!k1.next_review || k1.next_review <= now)) ||
                             (k2 && k2.pile === 'unmastered' && (!k2.next_review || k2.next_review <= now));
    return hasUnmasteredDue;
  }).length;
  const pct = stats.totalCards > 0 ? Math.round((stats.mastered / stats.totalCards) * 100) : 0;
  const lessonBtns = getLessons().map(l => `<a href="#/study?lesson=${l}" class="lesson-btn">L${l}</a>`).join('');
  render(nav() + `<h2>Dashboard</h2>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-num">${stats.totalCards}</div><div class="stat-label">Total Kata</div></div>
      <div class="stat-card"><div class="stat-num">${stats.mastered}</div><div class="stat-label">Dikuasai</div></div>
      <div class="stat-card"><div class="stat-num" style="color:#f59e0b">${dueCards}</div><div class="stat-label">Perlu Review</div></div>
      <div class="stat-card"><div class="stat-num">${pct}%</div><div class="stat-label">Progress</div></div>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div style="margin-top:1.5rem">
      <a href="#/study" class="action-btn action-primary">📖 Mulai Belajar</a>
      <a href="#/quiz" class="action-btn action-secondary">🧠 Quiz</a>
    </div>
    <h3 style="margin-top:1.5rem">Per Lesson</h3>
    <div class="lesson-select">${lessonBtns}</div>`);
}

// ── Study (Flashcard) ──
let _study = { card: null, flipped: false, timer: null };

function pageStudy() {
  const p = qs();
  const lesson = p.get('lesson') || '';
  const mode = p.get('mode') || 'mixed';
  const lessons = getLessons();
  const lessonOpts = lessons.map(l => `<option value="${l}" ${lesson === String(l) ? 'selected' : ''}>Lesson ${l}</option>`).join('');

  if (_study.timer) { clearInterval(_study.timer); _study.timer = null; }

  render(nav() + `<h2>Belajar</h2>
    <div>
      <label>Filter Lesson</label>
      <select id="study-lesson" onchange="location.hash='#/study?lesson='+this.value+'&mode='+document.getElementById('study-mode').value">
        <option value="">Semua Lesson</option>${lessonOpts}
      </select>
      <label>Mode Arah</label>
      <select id="study-mode" onchange="location.hash='#/study?lesson='+document.getElementById('study-lesson').value+'&mode='+this.value">
        <option value="mixed" ${mode === 'mixed' ? 'selected' : ''}>Acak (Dua Arah)</option>
        <option value="kw_to_syn" ${mode === 'kw_to_syn' ? 'selected' : ''}>Kata → Sinonim</option>
        <option value="syn_to_kw" ${mode === 'syn_to_kw' ? 'selected' : ''}>Sinonim → Kata</option>
      </select>
    </div>
    <div id="card-container"><p style="text-align:center; color:#888">Memuat kartu...</p></div>
    <div id="card-actions" class="hidden" style="text-align:center">
      <p id="instruction" style="color:#888; font-size:0.85rem">Klik kartu untuk balik</p>
      <div class="btn-group">
        <button class="btn-wrong" id="btn-wrong" disabled>❌ Belum Hafal</button>
        <button class="btn-correct" id="btn-correct" disabled>✅ Sudah Hafal</button>
      </div>
    </div>`);

  document.getElementById('btn-wrong').onclick = () => answerStudy(false);
  document.getElementById('btn-correct').onclick = () => answerStudy(true);
  loadNextStudyCard();
}

function loadNextStudyCard() {
  const p = qs();
  const lesson = p.get('lesson') ? parseInt(p.get('lesson')) : undefined;
  const mode = p.get('mode') || 'mixed';
  const direction = mode !== 'mixed' ? mode : undefined;

  const cards = Store.getDueCards(ALL, direction, lesson, 1);
  console.log('[app] loadNextStudyCard: lesson=', lesson, 'mode=', mode, 'direction=', direction, 'found=', cards.length);
  if (cards.length === 0) {
    document.getElementById('card-container').innerHTML = '<p style="text-align:center; font-size:1.2rem; padding:2rem">🎉 Semua kartu sudah direview! Coba lagi nanti.</p>';
    document.getElementById('card-actions').classList.add('hidden');
    return;
  }

  const card = cards[0];
  const dir = direction || (Math.random() > 0.5 ? 'kw_to_syn' : 'syn_to_kw');
  console.log('[app] loadCard:', card.word, card.id, 'dir=', dir);
  _study.card = { ...card, direction: dir };
  _study.flipped = false;
  document.getElementById('card-actions').classList.remove('hidden');
  document.getElementById('btn-correct').disabled = true;
  document.getElementById('btn-wrong').disabled = true;
  renderStudyCard();
}

function renderStudyCard() {
  const c = _study.card;
  if (!c) return;
  const el = document.getElementById('card-container');

  if (!_study.flipped) {
    if (c.direction === 'kw_to_syn') {
      el.innerHTML = `<div class="card-box" id="flip-box">
        <span class="tag tag-unmastered">Kata → Sinonim</span>
        <div class="card-word">${esc(c.word)}</div>
        <div class="card-pos">${esc(c.pos || '')}</div>
        <div class="card-definition">${esc(c.definition || '')}</div>
        <p style="margin-top:1rem; color:#aaa; font-size:0.8rem">Klik untuk balik</p></div>`;
    } else {
      el.innerHTML = `<div class="card-box" id="flip-box">
        <span class="tag tag-unmastered">Sinonim → Kata</span>
        <div class="card-synonym">${esc(c.synonym || '?')}</div>
        <p style="margin-top:1rem; color:#aaa; font-size:0.8rem">Klik untuk balik</p></div>`;
    }
    document.getElementById('instruction').textContent = 'Klik kartu untuk balik';
    document.getElementById('btn-correct').disabled = true;
    document.getElementById('btn-wrong').disabled = true;
  } else {
    if (c.direction === 'kw_to_syn') {
      el.innerHTML = `<div class="card-box flash-in" id="flip-box">
        <span class="tag tag-mastered">Jawaban</span>
        <div class="card-synonym">${esc(c.synonym || '?')}</div>
        <div class="card-definition">${esc(c.definition || '')}</div>
        ${c.example1 ? `<div class="card-example">"${esc(c.example1)}"</div>` : ''}
        <p style="margin-top:1rem; color:#aaa; font-size:0.8rem">Pilih jawaban</p></div>`;
    } else {
      el.innerHTML = `<div class="card-box flash-in" id="flip-box">
        <span class="tag tag-mastered">Jawaban</span>
        <div class="card-word">${esc(c.word)}</div>
        <div class="card-pos">${esc(c.pos || '')}</div>
        <div class="card-definition">${esc(c.definition || '')}</div>
        ${c.example1 ? `<div class="card-example">"${esc(c.example1)}"</div>` : ''}
        <p style="margin-top:1rem; color:#aaa; font-size:0.8rem">Pilih jawaban</p></div>`;
    }
    document.getElementById('instruction').textContent = 'Klik kartu untuk balik, atau pilih jawaban.';
    document.getElementById('btn-correct').disabled = false;
    document.getElementById('btn-wrong').disabled = false;
  }
  document.getElementById('flip-box').onclick = () => { _study.flipped = !_study.flipped; renderStudyCard(); };
}

function answerStudy(correct) {
  if (!_study.card) return;
  console.log('[app] answerStudy:', _study.card.word, _study.card.direction, 'correct=', correct);
  Store.updateProgress(_study.card.id, _study.card.direction, correct);
  loadNextStudyCard();
}

// ── Pile ──
function pagePile() {
  console.log('[app] pagePile called');
  const stats = Store.getPileStats(ALL);
  const mastered = Store.getPileCards(ALL, 'mastered');
  const unmastered = Store.getPileCards(ALL, 'unmastered');
  console.log('[app] pile result: mastered=', mastered.length, 'unmastered=', unmastered.length);

  render(nav() + `<h2>Kelola Pile</h2>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-num" style="color:#22c55e">${mastered.length}</div><div class="stat-label">Dikuasai ✅</div></div>
      <div class="stat-card"><div class="stat-num" style="color:#ef4444">${unmastered.length}</div><div class="stat-label">Perlu Dihafal 🔴</div></div>
    </div>
    <details><summary>🟢 Dikuasai (${mastered.length} kata)</summary>
      <div>${mastered.length === 0 ? '<p style="color:#888">Belum ada</p>' : mastered.map(c =>
        `<div class="flip-card pile-mastered" onclick="this.classList.toggle('flipped')" style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; margin-bottom:0.4rem; border-radius:8px; border:1px solid #eee; background:white">
          <div style="flex:1"><div class="word-side"><strong>${esc(c.word)}</strong> <small style="color:#888">${esc(c.pos||'')}</small></div><div class="syn-side"><span style="color:#3b82f6; font-weight:600">→ ${esc(c.synonym||'-')}</span></div></div>
          <small style="color:#aaa; white-space:nowrap; margin-left:0.5rem">L${c.lesson}</small></div>`
      ).join('')}</div>
    </details>
    <details open><summary>🔴 Perlu Dihafal (${unmastered.length} kata)</summary>
      <div>${unmastered.length === 0 ? '<p style="color:#888">Semua sudah dikuasai! 🎉</p>' : unmastered.map(c =>
        `<div class="flip-card pile-unmastered" onclick="this.classList.toggle('flipped')" style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.8rem; margin-bottom:0.4rem; border-radius:8px; border:1px solid #eee; background:white">
          <div style="flex:1"><div class="word-side"><strong>${esc(c.word)}</strong> <small style="color:#888">${esc(c.pos||'')}</small></div><div class="syn-side"><span style="color:#3b82f6; font-weight:600">→ ${esc(c.synonym||'-')}</span></div></div>
          <small style="color:#aaa; white-space:nowrap; margin-left:0.5rem">L${c.lesson}</small></div>`
      ).join('')}</div>
    </details>`);
}

// ── Quiz Hub ──
function pageQuiz() {
  const lessons = getLessons();
  const lessonOpts = lessons.map(l => `<option value="${l}">Lesson ${l}</option>`).join('');
  render(nav() + `<h2>Quiz</h2>
    <p>Pilih mode quiz dan lesson:</p>
    <div style="margin-bottom:1rem"><label>Lesson</label>
      <select id="quiz-lesson"><option value="">Semua Lesson (Random)</option>${lessonOpts}</select></div>
    <div id="link-matching" class="action-btn action-primary" style="cursor:pointer">🎯 Matching — Cocokkan keyword dengan sinonim</div>
    <div id="link-mcq" class="action-btn action-secondary" style="cursor:pointer">📋 Pilihan Ganda — Pilih sinonim yang benar</div>
    <div id="link-typing" class="action-btn action-secondary" style="cursor:pointer">⌨️ Typing — Ketik sinonim langsung</div>`);

  const sel = document.getElementById('quiz-lesson');
  function updateLinks() {
    const q = sel.value ? '?lesson=' + sel.value : '';
    document.getElementById('link-matching').onclick = () => location.hash = '#/quiz/matching' + q;
    document.getElementById('link-mcq').onclick = () => location.hash = '#/quiz/mcq' + q;
    document.getElementById('link-typing').onclick = () => location.hash = '#/quiz/typing' + q;
  }
  sel.addEventListener('change', updateLinks);
  updateLinks();
}

// ── Quiz: Matching ──
let _match = {};

function pageQuizMatching() {
  const p = qs();
  const lessonStr = p.get('lesson');
  const lessonLabel = lessonStr ? 'Lesson ' + lessonStr : 'Semua Lesson';
  const lesson = lessonStr ? parseInt(lessonStr) : undefined;

  render(nav() + `<h2>🎯 Matching</h2>
    <p style="color:#888">${lessonLabel} — Klik pasangan keyword dan sinonim yang cocok.</p>
    <div id="score-bar" style="display:flex; justify-content:space-between; margin-bottom:1rem">
      <span>Benar: <strong id="correct-count">0</strong> / <strong id="total-count">0</strong></span>
      <span id="match-timer" style="color:#888; font-size:0.85rem"></span></div>
    <div id="match-grid" class="quiz-grid"></div>
    <div id="match-result" class="hidden" style="text-align:center; margin-top:1.5rem">
      <h3 id="match-msg"></h3><p id="match-score"></p>
      <div id="match-replay" class="action-btn action-primary" style="display:inline-block; width:auto; padding:0.8rem 2rem">Main Lagi</div>
      <a href="#/history" style="display:inline-block; padding:0.8rem 2rem; border-radius:8px; background:#f3f4f6; color:#333; text-decoration:none; font-weight:600; margin-left:0.5rem">Lihat History</a></div>`);

  _match = { words: [], syns: [], cards: [], selWord: null, selSyn: null, correct: 0, total: 0, startTime: Date.now(), details: [], lesson };
  document.getElementById('match-replay').onclick = startMatch;

  const timerEl = document.getElementById('match-timer');
  _match.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - _match.startTime) / 1000);
    const m = Math.floor(elapsed / 60), s = elapsed % 60;
    timerEl.textContent = m + ':' + (s < 10 ? '0' : '') + s;
  }, 1000);

  startMatch();
}

function startMatch() {
  if (_match.timerInterval) clearInterval(_match.timerInterval);
  document.getElementById('match-result').classList.add('hidden');
  _match.correct = 0; _match.selWord = null; _match.selSyn = null; _match.details = []; _match.startTime = Date.now();

  const pool = _match.lesson ? ALL.filter(c => c.lesson === _match.lesson) : ALL;
  const picked = shuffle(pool).slice(0, 6);
  _match.cards = picked;
  _match.words = picked.map(c => ({ id: c.id, text: c.word, pairId: c.id }));
  _match.syns = picked.map(c => ({ id: c.id, text: c.synonym || c.definition || '?', pairId: c.id }));
  _match.total = picked.length;
  document.getElementById('total-count').textContent = _match.total;

  _match.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - _match.startTime) / 1000);
    const m = Math.floor(elapsed / 60), s = elapsed % 60;
    document.getElementById('match-timer').textContent = m + ':' + (s < 10 ? '0' : '') + s;
  }, 1000);

  renderMatch();
}

function renderMatch() {
  const grid = document.getElementById('match-grid');
  document.getElementById('correct-count').textContent = _match.correct;
  let html = '<div style="grid-column:1/-1; text-align:center; font-weight:700; color:#888; font-size:0.85rem">KATA</div>';
  _match.words.forEach(w => {
    const cls = w.pairId === 'matched' ? 'matched' : (_match.selWord && _match.selWord.id === w.id ? 'selected' : '');
    html += `<div class="match-card ${cls}" data-type="word" data-id="${w.id}">${esc(w.text)}</div>`;
  });
  html += '<div style="grid-column:1/-1; text-align:center; font-weight:700; color:#888; font-size:0.85rem; margin-top:0.5rem">SINONIM</div>';
  _match.syns.forEach(s => {
    const cls = s.pairId === 'matched' ? 'matched' : (_match.selSyn && _match.selSyn.id === s.id ? 'selected' : '');
    html += `<div class="match-card ${cls}" data-type="syn" data-id="${s.id}">${esc(s.text)}</div>`;
  });
  grid.innerHTML = html;

  grid.querySelectorAll('.match-card').forEach(el => {
    el.onclick = () => {
      const type = el.dataset.type;
      const id = parseInt(el.dataset.id);
      if (type === 'word') {
        const w = _match.words.find(x => x.id === id);
        if (w && w.pairId !== 'matched') { _match.selWord = w; checkMatch(); renderMatch(); }
      } else {
        const s = _match.syns.find(x => x.id === id);
        if (s && s.pairId !== 'matched') { _match.selSyn = s; checkMatch(); renderMatch(); }
      }
    };
  });
}

function checkMatch() {
  if (!_match.selWord || !_match.selSyn) return;
  const card = _match.cards.find(c => c.id === _match.selWord.pairId) || {};
  const userAnswer = _match.selWord.text + ' → ' + _match.selSyn.text;
  const correctAnswer = card.word + ' → ' + (card.synonym || card.definition || '?');

  if (_match.selWord.pairId === _match.selSyn.pairId) {
    _match.correct++;
    _match.details.push({ card_id: card.id, word: card.word, synonym: card.synonym || '', direction: 'kw_to_syn', user_answer: userAnswer, correct_answer: correctAnswer, is_correct: true });
    _match.selWord.pairId = 'matched';
    _match.selSyn.pairId = 'matched';
    if (_match.correct === _match.total) setTimeout(finishMatch, 500);
  } else {
    _match.details.push({ card_id: card.id, word: card.word, synonym: card.synonym || '', direction: 'kw_to_syn', user_answer: userAnswer, correct_answer: correctAnswer, is_correct: false });
  }
  _match.selWord = null; _match.selSyn = null;
}

function finishMatch() {
  if (_match.timerInterval) clearInterval(_match.timerInterval);
  const duration = Math.floor((Date.now() - _match.startTime) / 1000);
  document.getElementById('match-result').classList.remove('hidden');
  document.getElementById('match-msg').textContent = '🎉 Matching Selesai!';
  document.getElementById('match-score').textContent = _match.correct + '/' + _match.total + ' benar (' + Math.round(_match.correct / _match.total * 100) + '%)';
  Store.saveQuizSession({ mode: 'matching', lesson: _match.lesson || null, total: _match.total, correct: _match.correct, duration, details: _match.details });
}

// ── Quiz: MCQ ──
let _mcq = {};

function pageQuizMCQ() {
  const p = qs();
  const lessonStr = p.get('lesson');
  const lessonLabel = lessonStr ? 'Lesson ' + lessonStr : 'Semua Lesson';
  const lesson = lessonStr ? parseInt(lessonStr) : undefined;

  render(nav() + `<h2>📋 Pilihan Ganda</h2>
    <p style="color:#888">${lessonLabel} — 10 soal</p>
    <div id="score-bar" style="display:flex; justify-content:space-between; margin-bottom:1rem">
      <span>Benar: <strong id="mcq-correct">0</strong> / <strong id="mcq-total">0</strong></span>
      <span id="mcq-timer" style="color:#888; font-size:0.85rem"></span></div>
    <div id="mcq-container"></div>
    <div id="mcq-done" class="hidden" style="text-align:center; margin-top:1.5rem">
      <h3 id="mcq-final-msg"></h3><p id="mcq-final-score"></p>
      <div id="mcq-replay" class="action-btn action-primary" style="display:inline-block; width:auto; padding:0.8rem 2rem">Ulangi</div>
      <a href="#/history" style="display:inline-block; padding:0.8rem 2rem; border-radius:8px; background:#f3f4f6; color:#333; text-decoration:none; font-weight:600; margin-left:0.5rem">Lihat History</a></div>`);

  _mcq = { correct: 0, total: 0, max: 10, startTime: Date.now(), details: [], lesson, currentData: null };
  document.getElementById('mcq-replay').onclick = () => pageQuizMCQ();

  const timerEl = document.getElementById('mcq-timer');
  _mcq.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - _mcq.startTime) / 1000);
    const m = Math.floor(elapsed / 60), s = elapsed % 60;
    timerEl.textContent = m + ':' + (s < 10 ? '0' : '') + s;
  }, 1000);

  loadMCQ();
}

function loadMCQ() {
  if (_mcq.total >= _mcq.max) { finishMCQ(); return; }
  const pool = _mcq.lesson ? ALL.filter(c => c.lesson === _mcq.lesson) : ALL;
  const card = pool[Math.floor(Math.random() * pool.length)];
  if (!card) { finishMCQ(); return; }

  const showWord = Math.random() > 0.5;
  _mcq.currentData = { card, showWord };
  _mcq.total++;
  document.getElementById('mcq-total').textContent = _mcq.total;

  const container = document.getElementById('mcq-container');
  if (showWord) {
    const correct = card.synonym || card.definition || '?';
    const distractors = shuffle(ALL.filter(c => c.id !== card.id && c.synonym).map(c => c.synonym)).slice(0, 3);
    const opts = shuffle([correct, ...distractors]);
    container.innerHTML = `<article>
      <h3 style="text-align:center; margin:0">${esc(card.word)} <small style="color:#888">${esc(card.pos || '')}</small></h3>
      <p style="text-align:center; color:#888; font-size:0.85rem">Pilih sinonim yang benar:</p>
      <div class="quiz-grid">${opts.map(o =>
        `<div class="quiz-option" data-chosen="${esc(o)}" data-correct="${esc(correct)}" data-word="${esc(card.word)}" data-synonym="${esc(card.synonym || '')}" data-direction="kw_to_syn">${esc(o)}</div>`
      ).join('')}</div></article>`;
  } else {
    const correct = card.word;
    const distractors = shuffle(ALL.filter(c => c.id !== card.id).map(c => c.word)).slice(0, 3);
    const opts = shuffle([correct, ...distractors]);
    container.innerHTML = `<article>
      <h3 style="text-align:center; color:#3b82f6; margin:0">${esc(card.synonym || card.definition || '?')}</h3>
      <p style="text-align:center; color:#888; font-size:0.85rem">Kata yang memiliki sinonim di atas adalah:</p>
      <div class="quiz-grid">${opts.map(o =>
        `<div class="quiz-option" data-chosen="${esc(o)}" data-correct="${esc(correct)}" data-word="${esc(card.word)}" data-synonym="${esc(card.synonym || '')}" data-direction="syn_to_kw">${esc(o)}</div>`
      ).join('')}</div></article>`;
  }

  container.querySelectorAll('.quiz-option').forEach(el => {
    el.onclick = () => checkMCQ(el);
  });
}

function checkMCQ(el) {
  const article = el.closest('article');
  if (article.querySelector('.correct, .wrong')) return;
  const grid = el.closest('.quiz-grid');
  const correct = el.dataset.correct;
  const chosen = el.dataset.chosen;
  const isCorrect = chosen === correct;

  grid.querySelectorAll('.quiz-option').forEach(o => {
    if (o.dataset.correct === correct) o.classList.add('correct');
  });
  if (isCorrect) { el.classList.add('correct'); _mcq.correct++; document.getElementById('mcq-correct').textContent = _mcq.correct; }
  else el.classList.add('wrong');

  _mcq.details.push({
    card_id: _mcq.currentData.card.id, word: _mcq.currentData.card.word, synonym: _mcq.currentData.card.synonym || '',
    direction: el.dataset.direction, user_answer: chosen, correct_answer: correct, is_correct: isCorrect,
  });
  setTimeout(loadMCQ, 1200);
}

function finishMCQ() {
  if (_mcq.timerInterval) clearInterval(_mcq.timerInterval);
  const duration = Math.floor((Date.now() - _mcq.startTime) / 1000);
  document.getElementById('mcq-container').innerHTML = '';
  document.getElementById('mcq-done').classList.remove('hidden');
  document.getElementById('mcq-final-msg').textContent = '🎉 Quiz Selesai!';
  document.getElementById('mcq-final-score').textContent = _mcq.correct + '/' + _mcq.max + ' benar (' + Math.round(_mcq.correct / _mcq.max * 100) + '%)';
  Store.saveQuizSession({ mode: 'mcq', lesson: _mcq.lesson || null, total: _mcq.max, correct: _mcq.correct, duration, details: _mcq.details });
}

// ── Quiz: Typing ──
let _type = {};

function pageQuizTyping() {
  const p = qs();
  const lessonStr = p.get('lesson');
  const lessonLabel = lessonStr ? 'Lesson ' + lessonStr : 'Semua Lesson';
  const lesson = lessonStr ? parseInt(lessonStr) : undefined;

  render(nav() + `<h2>⌨️ Typing</h2>
    <p style="color:#888">${lessonLabel} — 10 soal</p>
    <div id="score-bar" style="display:flex; justify-content:space-between; margin-bottom:1rem">
      <span>Benar: <strong id="type-correct">0</strong> / <strong id="type-total">0</strong></span>
      <span id="type-timer" style="color:#888; font-size:0.85rem"></span></div>
    <div id="type-container"></div>
    <div id="type-done" class="hidden" style="text-align:center; margin-top:1.5rem">
      <h3 id="type-final-msg"></h3><p id="type-final-score"></p>
      <div id="type-replay" class="action-btn action-primary" style="display:inline-block; width:auto; padding:0.8rem 2rem">Ulangi</div>
      <a href="#/history" style="display:inline-block; padding:0.8rem 2rem; border-radius:8px; background:#f3f4f6; color:#333; text-decoration:none; font-weight:600; margin-left:0.5rem">Lihat History</a></div>`);

  _type = { correct: 0, total: 0, max: 10, startTime: Date.now(), details: [], lesson, currentData: null, answer: '', dir: '' };
  document.getElementById('type-replay').onclick = () => pageQuizTyping();

  const timerEl = document.getElementById('type-timer');
  _type.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - _type.startTime) / 1000);
    const m = Math.floor(elapsed / 60), s = elapsed % 60;
    timerEl.textContent = m + ':' + (s < 10 ? '0' : '') + s;
  }, 1000);

  loadTyping();
}

function loadTyping() {
  if (_type.total >= _type.max) { finishTyping(); return; }
  const pool = _type.lesson ? ALL.filter(c => c.lesson === _type.lesson) : ALL;
  const card = pool[Math.floor(Math.random() * pool.length)];
  if (!card) { finishTyping(); return; }

  const isWordMode = Math.random() > 0.5;
  const prompt = isWordMode ? card.word : (card.synonym || card.definition || '?');
  _type.answer = isWordMode ? (card.synonym || '') : card.word;
  _type.dir = isWordMode ? 'kw_to_syn' : 'syn_to_kw';
  _type.currentData = card;
  _type.total++;
  document.getElementById('type-total').textContent = _type.total;

  const label = isWordMode ? 'Ketik sinonim dari:' : 'Ketik kata yang sinonimnya:';
  document.getElementById('type-container').innerHTML = `<article>
    <p style="color:#888; margin:0">${label}</p>
    <h3 style="text-align:center; margin:0.5rem 0">${esc(prompt)}</h3>
    ${card.definition ? `<p style="text-align:center; font-size:0.85rem; color:#888; margin:0">Arti: ${esc(card.definition)}</p>` : ''}
    <form id="type-form" style="margin-top:1rem">
      <input type="text" id="type-input" placeholder="Ketik jawaban..." autocomplete="off">
      <button type="submit" style="width:100%; padding:0.8rem; margin-top:0.5rem; border:none; border-radius:8px; background:#3b82f6; color:white; font-size:1rem; cursor:pointer; font-weight:600">Cek</button>
    </form>
    <div id="type-feedback" style="text-align:center; margin-top:0.5rem"></div></article>`;

  document.getElementById('type-input').focus();
  document.getElementById('type-form').onsubmit = (e) => { e.preventDefault(); checkTyping(); };
}

function checkTyping() {
  const input = document.getElementById('type-input').value.trim();
  const feedback = document.getElementById('type-feedback');
  const isCorrect = input.toLowerCase() === _type.answer.toLowerCase();
  _type.details.push({
    card_id: _type.currentData.id, word: _type.currentData.word, synonym: _type.currentData.synonym || '',
    direction: _type.dir, user_answer: input, correct_answer: _type.answer, is_correct: isCorrect,
  });
  if (isCorrect) {
    feedback.innerHTML = '<p style="color:#22c55e; font-weight:700; font-size:1.1rem">✅ Benar!</p>';
    _type.correct++;
    document.getElementById('type-correct').textContent = _type.correct;
  } else {
    feedback.innerHTML = `<p style="color:#ef4444; font-weight:700">❌ Jawaban: <strong>${esc(_type.answer)}</strong></p>`;
  }
  setTimeout(loadTyping, 1500);
}

function finishTyping() {
  if (_type.timerInterval) clearInterval(_type.timerInterval);
  const duration = Math.floor((Date.now() - _type.startTime) / 1000);
  document.getElementById('type-container').innerHTML = '';
  document.getElementById('type-done').classList.remove('hidden');
  document.getElementById('type-final-msg').textContent = '🎉 Typing Selesai!';
  document.getElementById('type-final-score').textContent = _type.correct + '/' + _type.max + ' benar (' + Math.round(_type.correct / _type.max * 100) + '%)';
  Store.saveQuizSession({ mode: 'typing', lesson: _type.lesson || null, total: _type.max, correct: _type.correct, duration, details: _type.details });
}

// ── History ──
function pageHistory() {
  render(nav() + `<h2>📊 Quiz History</h2>
    <div id="quiz-stats"><p style="color:#888">Loading stats...</p></div>
    <div id="chart-container" style="margin-bottom:1.5rem"><canvas id="scoreChart" height="200"></canvas></div>
    <h3>🔍 Kata Lemah (Perlu Diperhatikan)</h3>
    <div id="weak-cards"><p style="color:#888">Loading...</p></div>
    <h3>📊 Analisis per Lesson</h3>
    <div id="weak-by-lesson"><p style="color:#888">Loading...</p></div>
    <h3>Riwayat Sesi Quiz</h3>
    <div id="history-list"><p style="color:#888">Loading...</p></div>
    <script src="https://cdn.jsdelivr.net/npm/apexcharts"><\/script>`);

  setTimeout(renderHistory, 100);
}

function renderHistory() {
  const stats = Store.getQuizStats();
  const sessions = Store.getQuizSessions(50);
  const weakCards = Store.getWeakCards(ALL, 20);
  const weakByLesson = Store.getWeakByLesson(ALL, 50);

  // Stats cards
  document.getElementById('quiz-stats').innerHTML = `<div class="stats-grid">
    <div class="stat-card"><div class="stat-num">${stats.totalSessions}</div><div class="stat-label">Total Sesi</div></div>
    <div class="stat-card"><div class="stat-num" style="color:#3b82f6">${stats.avgScore}%</div><div class="stat-label">Rata-rata Skor</div></div>
    <div class="stat-card"><div class="stat-num" style="color:#22c55e">${stats.bestScore}%</div><div class="stat-label">Skor Tertinggi</div></div>
    <div class="stat-card"><div class="stat-num" style="color:#f59e0b">${stats.activeDays}</div><div class="stat-label">Hari Aktif (30d)</div></div></div>
    ${stats.byMode.length > 0 ? `<div style="margin-top:0.5rem; font-size:0.85rem; color:#888">${stats.byMode.map(m =>
      `<span style="margin-right:1rem"><strong>${m.quiz_mode.toUpperCase()}</strong>: ${Math.round(m.avg_score)}% (${m.sessions} sesi)</span>`
    ).join('')}</div>` : ''}`;

  // Chart
  if (stats.recentScores.length > 0 && typeof ApexCharts !== 'undefined') {
    const series = stats.recentScores.map(s => s.score);
    const chart = new ApexCharts(document.getElementById('scoreChart'), {
      chart: { type: 'line', height: 200, toolbar: { show: false } },
      series: [{ name: 'Skor', data: series }],
      xaxis: { labels: { show: true, style: { fontSize: '10px' } } },
      yaxis: { min: 0, max: 100, ticks: { stepSize: 25 } },
      stroke: { curve: 'smooth', width: 2 }, colors: ['#3b82f6'], markers: { size: 4 },
      title: { text: 'Skor per Sesi (Recent)', style: { fontSize: '14px' } },
    });
    chart.render();
  }

  // Session list
  const listEl = document.getElementById('history-list');
  if (sessions.length === 0) {
    listEl.innerHTML = '<p style="color:#888">Belum ada riwayat quiz.</p>';
  } else {
    listEl.innerHTML = sessions.map(s => {
      const date = new Date(s.created_at);
      const dateStr = date.toLocaleDateString('id-ID') + ' ' + date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const modeIcon = s.quiz_mode === 'mcq' ? '📋' : s.quiz_mode === 'matching' ? '🎯' : '⌨️';
      const scoreColor = s.score >= 80 ? '#22c55e' : s.score >= 50 ? '#f59e0b' : '#ef4444';
      const dur = Math.floor(s.duration_seconds / 60) + 'm ' + (s.duration_seconds % 60) + 's';
      return `<a href="#/history/${s.id}" style="display:block; text-decoration:none; color:inherit; margin-bottom:0.5rem">
        <article style="display:flex; justify-content:space-between; align-items:center; cursor:pointer">
          <div><strong>${modeIcon} ${s.quiz_mode.toUpperCase()}</strong> ${s.lesson ? '· Lesson ' + s.lesson : ' · Semua Lesson'}
            <br><small style="color:#888">${dateStr} · ${dur}</small></div>
          <div style="text-align:right"><div style="font-size:1.5rem; font-weight:700; color:${scoreColor}">${s.score}%</div>
            <small style="color:#888">${s.correct_answers}/${s.total_questions}</small></div>
        </article></a>`;
    }).join('');
  }

  // Weak cards
  const weakEl = document.getElementById('weak-cards');
  if (weakCards.length === 0) {
    weakEl.innerHTML = '<p style="color:#888">Belum ada data kata lemah. Minimal 2 quiz attempt per kata.</p>';
  } else {
    weakEl.innerHTML = '<div style="display:grid; gap:0.5rem">' + weakCards.map(w => {
      const rate = w.correct_rate;
      const rateColor = rate < 30 ? '#ef4444' : rate < 50 ? '#f97316' : rate < 70 ? '#f59e0b' : '#22c55e';
      return `<article style="display:flex; align-items:center; gap:0.8rem; padding:0.6rem 0.8rem">
        <div style="flex:1; min-width:0">
          <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:0.3rem">
            <strong style="font-size:1rem">${esc(w.word)}</strong>
            <span style="font-size:0.8rem; color:#888">${w.synonym ? esc(w.synonym) : ''}</span></div>
          <div style="display:flex; align-items:center; gap:0.5rem">
            <div class="progress-bar" style="flex:1; height:6px"><div class="progress-fill" style="width:${rate}%; background:${rateColor}"></div></div>
            <span style="font-size:0.8rem; font-weight:700; color:${rateColor}; white-space:nowrap">${rate}%</span></div>
          <small style="color:#888; font-size:0.75rem">${w.attempts}x quiz${w.lesson ? ' · L' + w.lesson : ''}</small></div></article>`;
    }).join('') + '</div>';
  }

  // Weak by lesson
  const weakLessonEl = document.getElementById('weak-by-lesson');
  if (weakByLesson.length === 0) {
    weakLessonEl.innerHTML = '<p style="color:#888">Belum ada data per lesson.</p>';
  } else {
    weakLessonEl.innerHTML = '<div class="stats-grid" style="grid-template-columns:1fr">' + weakByLesson.map(l => {
      const rateColor = l.avg_correct_rate < 50 ? '#ef4444' : l.avg_correct_rate < 70 ? '#f59e0b' : '#22c55e';
      return `<article style="padding:0.8rem">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem">
          <strong>Lesson ${l.lesson}</strong>
          <span style="font-size:1.2rem; font-weight:700; color:${rateColor}">${l.avg_correct_rate}%</span></div>
        <div class="progress-bar" style="height:6px"><div class="progress-fill" style="width:${l.avg_correct_rate}%; background:${rateColor}"></div></div>
        <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:#888; margin-top:0.3rem">
          <span>${l.total_words} kata diuji</span>
          <span>${l.weak_words} kata lemah (${Math.round(l.weak_words / l.total_words * 100)}%)</span></div></article>`;
    }).join('') + '</div>';
  }
}

// ── History Detail ──
function pageHistoryDetail(id) {
  const session = Store.getQuizSession(id);
  if (!session) {
    render(nav() + '<h2>📝 Detail Sesi Quiz</h2><p style="color:#ef4444">Sesi tidak ditemukan</p>');
    return;
  }
  const date = new Date(session.created_at);
  const dateStr = date.toLocaleDateString('id-ID') + ' ' + date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const dur = Math.floor(session.duration_seconds / 60) + 'm ' + (session.duration_seconds % 60) + 's';
  const scoreColor = session.score >= 80 ? '#22c55e' : session.score >= 50 ? '#f59e0b' : '#ef4444';

  render(nav() + `<h2>📝 Detail Sesi Quiz</h2>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-num" style="color:${scoreColor}">${session.score}%</div><div class="stat-label">Skor</div></div>
      <div class="stat-card"><div class="stat-num">${session.correct_answers}/${session.total_questions}</div><div class="stat-label">Benar</div></div></div>
    <p style="font-size:0.85rem; color:#888">Mode: <strong>${session.quiz_mode.toUpperCase()}</strong> · ${session.lesson ? 'Lesson ' + session.lesson : 'Semua Lesson'} · ${dateStr} · ${dur}</p>
    ${(session.details || []).map((d, i) => {
      const icon = d.is_correct ? '✅' : '❌';
      const bgColor = d.is_correct ? '#f0fdf4' : '#fef2f2';
      const borderColor = d.is_correct ? '#22c55e' : '#ef4444';
      return `<article style="border-left:4px solid ${borderColor}; background:${bgColor}; margin-bottom:0.5rem">
        <div style="display:flex; justify-content:space-between; align-items:start">
          <div><strong>${icon} ${i + 1}. ${esc(d.word)}</strong>
            <br><small style="color:#888">Sinonim: ${esc(d.synonym || '-')}</small>
            <br><small>Jawaban kamu: <strong>${esc(d.user_answer)}</strong></small>
            ${d.is_correct ? '' : `<br><small style="color:#22c55e">Jawaban benar: <strong>${esc(d.correct_answer)}</strong></small>`}</div>
          <span style="font-size:0.75rem; color:#888">${(d.direction || '').replace('_', '→')}</span></div></article>`;
    }).join('')}`);
}

// ══════════════════════════════════════
//  ROUTER
// ══════════════════════════════════════
function route() {
  // Cleanup previous timers
  if (_study.timer) { clearInterval(_study.timer); _study.timer = null; }
  if (_match.timerInterval) { clearInterval(_match.timerInterval); _match.timerInterval = null; }
  if (_mcq.timerInterval) { clearInterval(_mcq.timerInterval); _mcq.timerInterval = null; }
  if (_type.timerInterval) { clearInterval(_type.timerInterval); _type.timerInterval = null; }

  const hash = location.hash.split('?')[0] || '#/';
  const path = hash.replace('#', '');

  if (path === '/' || path === '') pageDashboard();
  else if (path === '/study') pageStudy();
  else if (path === '/pile') pagePile();
  else if (path === '/quiz') pageQuiz();
  else if (path === '/quiz/matching') pageQuizMatching();
  else if (path === '/quiz/mcq') pageQuizMCQ();
  else if (path === '/quiz/typing') pageQuizTyping();
  else if (path === '/history') pageHistory();
  else if (path.startsWith('/history/')) pageHistoryDetail(parseInt(path.split('/')[2]));
  else pageDashboard();
}

window.addEventListener('hashchange', route);
window.addEventListener('load', route);

// ══════════════════════════════════════
//  INIT
// ══════════════════════════════════════
const style = document.createElement('style');
style.textContent = CSS;
document.head.appendChild(style);
if (!location.hash) location.hash = '#/';
else route();
