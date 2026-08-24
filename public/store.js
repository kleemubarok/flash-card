// ── localStorage Store for Flashcard TOEFL ──
// Keys: toefl_progress, toefl_quiz_sessions

const PROGRESS_KEY = 'toefl_progress';
const QUIZ_KEY = 'toefl_quiz_sessions';

function _read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}
function _write(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// ══════════════════════════════════════
//  Study Progress
// ══════════════════════════════════════

export function getAllProgress() {
  const data = _read(PROGRESS_KEY, {});
  const keys = Object.keys(data);
  const masteredCount = keys.filter(k => data[k].pile === 'mastered').length;
  console.log('[store] getAllProgress:', keys.length, 'entries,', masteredCount, 'mastered');
  return data;
}

export function getCardProgress(cardId, direction) {
  const all = getAllProgress();
  return all[`${cardId}_${direction}`] || null;
}

/** Ensure every card has progress entries for both directions. */
export function syncProgress(allCards) {
  const all = getAllProgress();
  let changed = false;
  for (const card of allCards) {
    for (const dir of ['kw_to_syn', 'syn_to_kw']) {
      const key = `${card.id}_${dir}`;
      if (!all[key]) {
        all[key] = {
          pile: 'unmastered',
          repetitions: 0,
          interval: 1,
          ease_factor: 2.5,
          next_review: new Date().toISOString(),
          last_reviewed: null,
        };
        changed = true;
      }
    }
  }
  if (changed) _write(PROGRESS_KEY, all);
}

/** Mark answer: correct = adaptive repetition, wrong = reset. */
export function updateProgress(cardId, direction, correct) {
  const all = getAllProgress();
  const key = `${cardId}_${direction}`;
  const prog = all[key];
  console.log('[store] updateProgress', key, 'correct=', correct, 'before=', JSON.stringify(prog));
  if (!prog) return;

  const now = new Date().toISOString();

  if (correct) {
    const newReps = prog.repetitions + 1;
    let newInterval;
    let newEase = prog.ease_factor;

    if (newReps === 1) newInterval = 5;
    else if (newReps === 2) newInterval = 30;
    else newInterval = Math.round(prog.interval * prog.ease_factor);

    newEase = Math.max(1.3, newEase + 0.1);
    const newPile = newReps >= 3 ? 'mastered' : 'unmastered';
    const nextReview = new Date();
    nextReview.setMinutes(nextReview.getMinutes() + newInterval);

    all[key] = {
      ...prog,
      repetitions: newReps,
      interval: newInterval,
      ease_factor: newEase,
      pile: newPile,
      next_review: nextReview.toISOString(),
      last_reviewed: now,
    };
  } else {
    all[key] = {
      ...prog,
      repetitions: 0,
      interval: 1,
      ease_factor: Math.max(1.3, prog.ease_factor - 0.2),
      pile: 'unmastered',
      next_review: now,
      last_reviewed: now,
    };
  }
  console.log('[store] updateProgress AFTER', key, '=', JSON.stringify(all[key]));
  _write(PROGRESS_KEY, all);
}

/** Get pile stats: { totalCards, mastered, unmastered } */
export function getPileStats(allCards) {
  const all = getAllProgress();
  let mastered = 0;
  let unmastered = 0;
  for (const card of allCards) {
    const k1 = all[`${card.id}_kw_to_syn`];
    const k2 = all[`${card.id}_syn_to_kw`];
    const isMastered = (k1 && k1.pile === 'mastered') || (k2 && k2.pile === 'mastered');
    if (isMastered) mastered++;
    else unmastered++;
  }
  console.log('[store] getPileStats:', { mastered, unmastered, totalCards: allCards.length });
  return { totalCards: allCards.length, mastered, unmastered };
}

/** Get cards due for review (next_review <= now, pile = unmastered) */
export function getDueCards(allCards, direction, lesson, limit = 20) {
  const all = getAllProgress();
  const now = new Date().toISOString();
  let pool = allCards.filter(c => {
    if (lesson && c.lesson !== lesson) return false;
    const dirs = direction ? [direction] : ['kw_to_syn', 'syn_to_kw'];
    return dirs.some(d => {
      const p = all[`${c.id}_${d}`];
      return p && p.pile === 'unmastered' && (!p.next_review || p.next_review <= now);
    });
  });
  // shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, limit);
}

/** Get due count */
export function getDueCount(allCards) {
  const all = getAllProgress();
  const now = new Date().toISOString();
  let count = 0;
  for (const card of allCards) {
    for (const d of ['kw_to_syn', 'syn_to_kw']) {
      const p = all[`${card.id}_${d}`];
      if (p && p.pile === 'unmastered' && (!p.next_review || p.next_review <= now)) count++;
    }
  }
  return count;
}

/** Get pile cards (mastered or unmastered) */
export function getPileCards(allCards, pile) {
  const all = getAllProgress();
  const result = allCards.filter(c => {
    const k1 = all[`${c.id}_kw_to_syn`];
    const k2 = all[`${c.id}_syn_to_kw`];
    const isMastered = (k1 && k1.pile === 'mastered') || (k2 && k2.pile === 'mastered');
    return pile === 'mastered' ? isMastered : !isMastered;
  });
  console.log('[store] getPileCards', pile, ':', result.length, 'cards');
  return result;
}

// ══════════════════════════════════════
//  Quiz History
// ══════════════════════════════════════

let _quizIdCounter = _read('toefl_quiz_id_counter', 1);

export function getQuizSessions(limit = 50) {
  return _read(QUIZ_KEY, []).slice(0, limit);
}

export function getQuizSession(id) {
  return _read(QUIZ_KEY, []).find(s => s.id === id) || null;
}

export function saveQuizSession({ mode, lesson, total, correct, duration, details }) {
  const sessions = _read(QUIZ_KEY, []);
  const session = {
    id: _quizIdCounter++,
    quiz_mode: mode,
    lesson: lesson || null,
    total_questions: total,
    correct_answers: correct,
    score: total > 0 ? Math.round((correct / total) * 100) : 0,
    duration_seconds: duration || 0,
    created_at: new Date().toISOString(),
    details: details || [],
  };
  sessions.unshift(session);
  // Keep max 200 sessions
  if (sessions.length > 200) sessions.length = 200;
  _write(QUIZ_KEY, sessions);
  _write('toefl_quiz_id_counter', _quizIdCounter);
  return session.id;
}

/** Quiz stats for history page */
export function getQuizStats() {
  const sessions = _read(QUIZ_KEY, []);
  if (sessions.length === 0) {
    return { totalSessions: 0, avgScore: 0, bestScore: 0, activeDays: 0, byMode: [], recentScores: [] };
  }
  const totalSessions = sessions.length;
  const avgScore = Math.round(sessions.reduce((s, x) => s + x.score, 0) / totalSessions);
  const bestScore = Math.max(...sessions.map(s => s.score));
  const recentScores = sessions.slice(0, 20).reverse().map(s => ({ score: s.score, quiz_mode: s.quiz_mode, created_at: s.created_at }));

  // by mode
  const modeMap = {};
  for (const s of sessions) {
    if (!modeMap[s.quiz_mode]) modeMap[s.quiz_mode] = { sessions: 0, totalScore: 0 };
    modeMap[s.quiz_mode].sessions++;
    modeMap[s.quiz_mode].totalScore += s.score;
  }
  const byMode = Object.entries(modeMap).map(([m, v]) => ({
    quiz_mode: m, sessions: v.sessions, avg_score: Math.round(v.totalScore / v.sessions),
  }));

  // active days (30d)
  const thirtyDaysAgo = Date.now() - 30 * 86400000;
  const daysSet = new Set();
  for (const s of sessions) {
    if (new Date(s.created_at).getTime() >= thirtyDaysAgo) {
      daysSet.add(new Date(s.created_at).toISOString().slice(0, 10));
    }
  }

  return { totalSessions, avgScore, bestScore, activeDays: daysSet.size, byMode, recentScores };
}

/** Weak cards: words with >= 2 quiz attempts and lowest correct rate */
export function getWeakCards(allCards, limit = 20) {
  const sessions = _read(QUIZ_KEY, []);
  const wordStats = {};
  for (const s of sessions) {
    for (const d of (s.details || [])) {
      const key = d.word;
      if (!wordStats[key]) wordStats[key] = { word: d.word, synonym: d.synonym || '', attempts: 0, correct: 0 };
      wordStats[key].attempts++;
      if (d.is_correct) wordStats[key].correct++;
    }
  }
  return Object.values(wordStats)
    .filter(w => w.attempts >= 2)
    .map(w => {
      const card = allCards.find(c => c.word === w.word);
      return { ...w, lesson: card ? card.lesson : null, correct_rate: Math.round(100 * w.correct / w.attempts) };
    })
    .sort((a, b) => a.correct_rate - b.correct_rate || b.attempts - a.attempts)
    .slice(0, limit);
}

/** Weak by lesson */
export function getWeakByLesson(allCards, limit = 50) {
  const sessions = _read(QUIZ_KEY, []);
  const lessonStats = {};
  for (const s of sessions) {
    if (!s.lesson) continue;
    for (const d of (s.details || [])) {
      const key = `${s.lesson}_${d.word}`;
      if (!lessonStats[key]) lessonStats[key] = { lesson: s.lesson, word: d.word, attempts: 0, correct: 0 };
      lessonStats[key].attempts++;
      if (d.is_correct) lessonStats[key].correct++;
    }
  }
  // Group by lesson
  const byLesson = {};
  for (const ws of Object.values(lessonStats)) {
    if (!byLesson[ws.lesson]) byLesson[ws.lesson] = { total_words: 0, weak_words: 0, totalRate: 0, count: 0 };
    const rate = Math.round(100 * ws.correct / ws.attempts);
    byLesson[ws.lesson].total_words++;
    if (rate < 70) byLesson[ws.lesson].weak_words++;
    byLesson[ws.lesson].totalRate += rate;
    byLesson[ws.lesson].count++;
  }
  return Object.entries(byLesson)
    .map(([l, v]) => ({
      lesson: parseInt(l),
      total_words: v.total_words,
      weak_words: v.weak_words,
      avg_correct_rate: Math.round(v.totalRate / v.count),
    }))
    .sort((a, b) => a.avg_correct_rate - b.avg_correct_rate)
    .slice(0, limit);
}
