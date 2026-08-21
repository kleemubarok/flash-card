import { Database } from "bun:sqlite";
import path from "path";

// Use DB_PATH env var if set (Docker), otherwise use default path
const DB_PATH = process.env.DB_PATH || path.resolve(import.meta.dir, "..", "flashcards.db");

let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.run("PRAGMA journal_mode = WAL");
    _db.run("PRAGMA foreign_keys = ON");
  }
  return _db;
}

// ── Card Types ──
export interface Card {
  id: number;
  lesson: number;
  word: string;
  pos: string | null;
  synonym: string | null;
  definition: string | null;
  example1: string | null;
  example2: string | null;
}

export interface StudyProgress {
  id: number;
  card_id: number;
  direction: "kw_to_syn" | "syn_to_kw";
  pile: "mastered" | "unmastered";
  interval: number;
  ease_factor: number;
  repetitions: number;
  next_review: string | null;
  last_reviewed: string | null;
}

// ── Card Queries ──
export function getAllCards(): Card[] {
  return getDb().query("SELECT * FROM cards ORDER BY lesson, word").all() as Card[];
}

export function getCardsByLesson(lesson: number): Card[] {
  return getDb().query("SELECT * FROM cards WHERE lesson = ? ORDER BY word").all(lesson) as Card[];
}

export function getCard(id: number): Card | undefined {
  return getDb().query("SELECT * FROM cards WHERE id = ?").get(id) as Card | undefined;
}

export function getLessons(): number[] {
  const rows = getDb().query("SELECT DISTINCT lesson FROM cards ORDER BY lesson").all() as { lesson: number }[];
  return rows.map((r) => r.lesson);
}

export function searchCards(q: string): Card[] {
  return getDb().query("SELECT * FROM cards WHERE word LIKE ? OR synonym LIKE ? ORDER BY lesson, word").all(`%${q}%`, `%${q}%`) as Card[];
}

export function createCard(data: Omit<Card, "id">): number {
  const stmt = getDb().prepare(
    "INSERT INTO cards (lesson, word, pos, synonym, definition, example1, example2) VALUES (?,?,?,?,?,?,?)"
  );
  const info = stmt.run(data.lesson, data.word, data.pos, data.synonym, data.definition, data.example1, data.example2);
  const cardId = info.lastInsertRowid as number;

  // Create study progress for both directions
  const now = new Date().toISOString();
  getDb().run("INSERT INTO study_progress (card_id, direction, pile, next_review) VALUES (?,?,?,?)", [cardId, "kw_to_syn", "unmastered", now]);
  getDb().run("INSERT INTO study_progress (card_id, direction, pile, next_review) VALUES (?,?,?,?)", [cardId, "syn_to_kw", "unmastered", now]);

  return cardId;
}

export function updateCard(id: number, data: Partial<Omit<Card, "id">>): void {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, val] of Object.entries(data)) {
    fields.push(`${key} = ?`);
    values.push(val);
  }
  values.push(id);
  getDb().run(`UPDATE cards SET ${fields.join(", ")} WHERE id = ?`, values);
}

export function deleteCard(id: number): void {
  getDb().run("DELETE FROM cards WHERE id = ?", [id]);
}

// ── Study Progress Queries ──
export function getProgress(cardId: number): StudyProgress[] {
  return getDb().query("SELECT * FROM study_progress WHERE card_id = ?").all(cardId) as StudyProgress[];
}

export function getCardsForReview(direction?: "kw_to_syn" | "syn_to_kw", limit = 20, lesson?: number): Array<Card & StudyProgress> {
  const now = new Date().toISOString();
  let sql = `
    SELECT c.*, sp.*
    FROM cards c
    JOIN study_progress sp ON sp.card_id = c.id
    WHERE sp.pile = 'unmastered' AND (sp.next_review IS NULL OR sp.next_review <= ?)
  `;
  const params: (string | number)[] = [now];
  if (direction) {
    sql += " AND sp.direction = ?";
    params.push(direction);
  }
  if (lesson) {
    sql += " AND c.lesson = ?";
    params.push(lesson);
  }
  sql += " ORDER BY RANDOM() LIMIT ?";
  params.push(limit);
  return getDb().query(sql).all(...params) as Array<Card & StudyProgress>;
}

export function getDueCardsCount(): number {
  const now = new Date().toISOString();
  const row = getDb().query("SELECT COUNT(*) as cnt FROM study_progress WHERE pile = 'unmastered' AND (next_review IS NULL OR next_review <= ?)").get(now) as { cnt: number };
  return row.cnt;
}

export function getPileStats() {
  const mastered = getDb().query("SELECT COUNT(*) as cnt FROM study_progress WHERE pile = 'mastered'").get() as { cnt: number };
  const unmastered = getDb().query("SELECT COUNT(*) as cnt FROM study_progress WHERE pile = 'unmastered'").get() as { cnt: number };
  const totalCards = getDb().query("SELECT COUNT(*) as cnt FROM cards").get() as { cnt: number };
  return {
    totalCards: totalCards.cnt,
    masteredDirections: mastered.cnt,
    unmasteredDirections: unmastered.cnt,
    // A card is fully mastered if both directions are mastered
    fullyMastered: getDb().query(`
      SELECT COUNT(*) as cnt FROM cards c
      WHERE NOT EXISTS (SELECT 1 FROM study_progress sp WHERE sp.card_id = c.id AND sp.pile = 'unmastered')
    `).get() as { cnt: number },
  };
}

export function updateProgress(cardId: number, direction: string, correct: boolean): void {
  const prog = getDb().query(
    "SELECT * FROM study_progress WHERE card_id = ? AND direction = ?"
  ).get(cardId, direction) as StudyProgress | undefined;

  if (!prog) return;

  const now = new Date().toISOString();

  if (correct) {
    // SM-2 algorithm
    const newReps = prog.repetitions + 1;
    let newInterval: number;
    let newEase = prog.ease_factor;

    if (newReps === 1) {
      newInterval = 1;
    } else if (newReps === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(prog.interval * prog.ease_factor);
    }

    // Update ease factor (quality 5 = perfect recall)
    newEase = Math.max(1.3, newEase + (0.1 - (5 - 5) * (0.08 + (5 - 5) * 0.02)));

    // If interval >= 14 days, mark as mastered
    const newPile = newInterval >= 14 ? "mastered" : "unmastered";

    // Schedule next review
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + newInterval);

    getDb().run(
      `UPDATE study_progress 
       SET repetitions = ?, interval = ?, ease_factor = ?, 
           pile = ?, next_review = ?, last_reviewed = ?
       WHERE card_id = ? AND direction = ?`,
      [newReps, newInterval, newEase, newPile, nextReview.toISOString(), now, cardId, direction]
    );
  } else {
    // Reset on wrong answer
    getDb().run(
      `UPDATE study_progress 
       SET repetitions = 0, interval = 1, ease_factor = MAX(1.3, ease_factor - 0.2),
           pile = 'unmastered', next_review = ?, last_reviewed = ?
       WHERE card_id = ? AND direction = ?`,
      [now, now, cardId, direction]
    );
  }
}

export function getPileCards(pile: "mastered" | "unmastered"): Array<Card & StudyProgress> {
  return getDb().query(`
    SELECT c.*, sp.*
    FROM cards c
    JOIN study_progress sp ON sp.card_id = c.id
    WHERE sp.pile = ?
    ORDER BY c.lesson, c.word
  `).all(pile) as Array<Card & StudyProgress>;
}

// ── Quiz Helpers ──
export function getRandomCards(n: number, excludeId?: number): Card[] {
  let sql = "SELECT * FROM cards";
  const params: (string | number)[] = [];
  if (excludeId) {
    sql += " WHERE id != ?";
    params.push(excludeId);
  }
  sql += " ORDER BY RANDOM() LIMIT ?";
  params.push(n);
  return getDb().query(sql).all(...params) as Card[];
}

export function getRandomSynonymDistractors(correctSynonym: string, n: number): string[] {
  const rows = getDb().query(
    "SELECT DISTINCT synonym FROM cards WHERE synonym != ? AND synonym IS NOT NULL AND synonym != '' ORDER BY RANDOM() LIMIT ?"
  ).all(correctSynonym, n) as { synonym: string }[];
  return rows.map((r) => r.synonym);
}

export function getRandomWordDistractors(correctWord: string, n: number): string[] {
  const rows = getDb().query(
    "SELECT DISTINCT word FROM cards WHERE word != ? ORDER BY RANDOM() LIMIT ?"
  ).all(correctWord, n) as { word: string }[];
  return rows.map((r) => r.word);
}

// ── Smart Distractors (TOEFL-style) ──

/** Extract the last 3-5 chars as suffix for similarity matching */
function getSuffix(word: string): string {
  const w = word.toLowerCase();
  // Try common suffixes from longest to shortest
  for (const len of [5, 4, 3]) {
    if (w.length >= len) return w.slice(-len);
  }
  return w.slice(-2);
}

/** Find words with similar suffix (same ending) from a set of lessons */
export function getSuffixDistractors(correctWord: string, lesson: number, n: number): string[] {
  const suffix = getSuffix(correctWord);
  if (suffix.length < 3) return [];
  const rows = getDb().query(
    `SELECT word FROM cards WHERE word != ? AND LOWER(word) != ? AND lesson = ? AND LOWER(word) LIKE ? ORDER BY RANDOM() LIMIT ?`
  ).all(correctWord, correctWord.toLowerCase(), lesson, `%${suffix}%`, n) as { word: string }[];
  return rows.map((r) => r.word);
}

/** Smart MCQ distractors: 1 from same suffix group + 1 from same lesson + 1 from previous lessons */
export function getSmartDistractors(
  correctWord: string,
  correctSynonym: string,
  lesson: number
): { suffixWord: string; sameLessonWord: string; prevLessonWord: string; suffixSynonym: string; sameLessonSynonym: string; prevLessonSynonym: string } {
  const db = getDb();

  // 1. Suffix-matching word from same lesson
  const suffix = getSuffix(correctWord);
  let suffixRow = db.query(
    `SELECT word, synonym FROM cards WHERE word != ? AND lesson = ? AND LOWER(word) LIKE ? ORDER BY RANDOM() LIMIT 1`
  ).get(correctWord, lesson, `%${suffix}%`) as { word: string; synonym: string } | null;

  // Fallback: suffix from any lesson
  if (!suffixRow) {
    suffixRow = db.query(
      `SELECT word, synonym FROM cards WHERE word != ? AND LOWER(word) LIKE ? ORDER BY RANDOM() LIMIT 1`
    ).get(correctWord, `%${suffix}%`) as { word: string; synonym: string } | null;
  }

  // 2. Random word from same lesson
  const sameLessonRow = db.query(
    `SELECT word, synonym FROM cards WHERE word != ? AND lesson = ? ORDER BY RANDOM() LIMIT 1`
  ).get(correctWord, lesson) as { word: string; synonym: string } | null;

  // 3. Random word from previous lessons (1 to lesson-1)
  let prevLessonRow: { word: string; synonym: string } | null = null;
  if (lesson > 1) {
    prevLessonRow = db.query(
      `SELECT word, synonym FROM cards WHERE lesson < ? AND lesson > 0 ORDER BY RANDOM() LIMIT 1`
    ).get(lesson) as { word: string; synonym: string } | null;
  }

  return {
    suffixWord: suffixRow?.word || correctWord,
    sameLessonWord: sameLessonRow?.word || correctWord,
    prevLessonWord: prevLessonRow?.word || correctWord,
    suffixSynonym: suffixRow?.synonym || correctSynonym,
    sameLessonSynonym: sameLessonRow?.synonym || correctSynonym,
    prevLessonSynonym: prevLessonRow?.synonym || correctSynonym,
  };
}

/** Get cards for quiz from a specific lesson */
export function getQuizCards(lesson: number | undefined, count: number): Card[] {
  if (lesson) {
    return getDb().query(
      `SELECT * FROM cards WHERE lesson = ? ORDER BY RANDOM() LIMIT ?`
    ).all(lesson, count) as Card[];
  }
  return getRandomCards(count);
}

/** Get synonym for a card (smart: use card's synonym if available, else find one) */
export function getCardSynonym(card: Card): string {
  return card.synonym || card.definition || card.word;
}

/** Get MCQ options: correct synonym + 3 smart distractors */
export function getMCQOptions(
  card: Card,
  lesson: number | undefined
): { correct: string; options: string[] } {
  const correct = card.synonym || card.definition || '?';

  if (!lesson) {
    // No lesson filter: random synonyms from all
    const distractors = getRandomSynonymDistractors(correct, 3);
    const options = [correct, ...distractors];
    shuffleArray(options);
    return { correct, options };
  }

  // Smart distractors for lesson mode
  const smart = getSmartDistractors(card.word, correct, lesson);
  const distractors = [
    smart.suffixSynonym,   // suffix-matching
    smart.sameLessonSynonym, // same lesson
    smart.prevLessonSynonym, // previous lessons
  ].filter((s) => s && s !== correct && s !== '?');

  // Fill up to 3 if needed
  while (distractors.length < 3) {
    const extra = getRandomSynonymDistractors(correct, 1);
    if (extra.length > 0 && !distractors.includes(extra[0]!)) {
      distractors.push(extra[0]!);
    } else break;
  }

  const options = [correct, ...distractors.slice(0, 3)];
  shuffleArray(options);
  return { correct, options };
}

/** Get word-mode MCQ options: correct word + 3 smart distractors */
export function getMCQWordOptions(
  card: Card,
  lesson: number | undefined
): { correct: string; options: string[] } {
  if (!lesson) {
    const distractors = getRandomWordDistractors(card.word, 3);
    const options = [card.word, ...distractors];
    shuffleArray(options);
    return { correct: card.word, options };
  }

  const smart = getSmartDistractors(card.word, card.synonym || '', lesson);
  const distractors = [
    smart.suffixWord,
    smart.sameLessonWord,
    smart.prevLessonWord,
  ].filter((w) => w && w !== card.word);

  while (distractors.length < 3) {
    const extra = getRandomWordDistractors(card.word, 1);
    if (extra.length > 0 && !distractors.includes(extra[0]!)) {
      distractors.push(extra[0]!);
    } else break;
  }

  const options = [card.word, ...distractors.slice(0, 3)];
  shuffleArray(options);
  return { correct: card.word, options };
}

function shuffleArray(arr: unknown[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ── Quiz History ──
export interface QuizSession {
  id: number;
  quiz_mode: string;
  lesson: number | null;
  total_questions: number;
  correct_answers: number;
  score: number;
  duration_seconds: number;
  created_at: string;
}

export interface QuizDetail {
  id: number;
  session_id: number;
  card_id: number;
  word: string;
  synonym: string | null;
  direction: string;
  user_answer: string;
  correct_answer: string;
  is_correct: number;
  created_at: string;
}

export function saveQuizSession(
  mode: string,
  lesson: number | null,
  total: number,
  correct: number,
  duration: number
): number {
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;
  const now = new Date().toISOString();
  const info = getDb().prepare(
    "INSERT INTO quiz_sessions (quiz_mode, lesson, total_questions, correct_answers, score, duration_seconds, created_at) VALUES (?,?,?,?,?,?,?)"
  ).run(mode, lesson, total, correct, score, duration, now);
  return info.lastInsertRowid as number;
}

export function saveQuizDetail(
  sessionId: number,
  cardId: number,
  word: string,
  synonym: string,
  direction: string,
  userAnswer: string,
  correctAnswer: string,
  isCorrect: boolean
): void {
  const now = new Date().toISOString();
  getDb().prepare(
    "INSERT INTO quiz_details (session_id, card_id, word, synonym, direction, user_answer, correct_answer, is_correct, created_at) VALUES (?,?,?,?,?,?,?,?,?)"
  ).run(sessionId, cardId, word, synonym, direction, userAnswer, correctAnswer, isCorrect ? 1 : 0, now);
}

export function getQuizSessions(limit = 50): QuizSession[] {
  return getDb().query(
    "SELECT * FROM quiz_sessions ORDER BY created_at DESC LIMIT ?"
  ).all(limit) as QuizSession[];
}

export function getQuizSessionDetail(sessionId: number): {
  session: QuizSession;
  details: QuizDetail[];
} | null {
  const session = getDb().query(
    "SELECT * FROM quiz_sessions WHERE id = ?"
  ).get(sessionId) as QuizSession | undefined;
  if (!session) return null;
  const details = getDb().query(
    "SELECT * FROM quiz_details WHERE session_id = ? ORDER BY id"
  ).all(sessionId) as QuizDetail[];
  return { session, details };
}

export function getQuizStats() {
  const totalSessions = getDb().query(
    "SELECT COUNT(*) as cnt FROM quiz_sessions"
  ).get() as { cnt: number };
  const avgScore = getDb().query(
    "SELECT COALESCE(AVG(score), 0) as avg_score FROM quiz_sessions"
  ).get() as { avg_score: number };
  const bestScore = getDb().query(
    "SELECT COALESCE(MAX(score), 0) as best_score FROM quiz_sessions"
  ).get() as { best_score: number };
  const totalQuestions = getDb().query(
    "SELECT COALESCE(SUM(total_questions), 0) as total FROM quiz_sessions"
  ).get() as { total: number };
  const totalCorrect = getDb().query(
    "SELECT COALESCE(SUM(correct_answers), 0) as total FROM quiz_sessions"
  ).get() as { total: number };
  const byMode = getDb().query(
    `SELECT quiz_mode, COUNT(*) as sessions, COALESCE(AVG(score),0) as avg_score
     FROM quiz_sessions GROUP BY quiz_mode`
  ).all() as Array<{ quiz_mode: string; sessions: number; avg_score: number }>;
  const byLesson = getDb().query(
    `SELECT lesson, COUNT(*) as sessions, COALESCE(AVG(score),0) as avg_score
     FROM quiz_sessions WHERE lesson IS NOT NULL GROUP BY lesson ORDER BY lesson`
  ).all() as Array<{ lesson: number; sessions: number; avg_score: number }>;
  const recentScores = getDb().query(
    `SELECT created_at, score, quiz_mode FROM quiz_sessions ORDER BY created_at DESC LIMIT 20`
  ).all() as Array<{ created_at: string; score: number; quiz_mode: string }>;
  const streak = getDb().query(
    `SELECT COUNT(DISTINCT date(created_at)) as days FROM quiz_sessions
     WHERE created_at >= date('now', '-30 days')`
  ).get() as { days: number };

  return {
    totalSessions: totalSessions.cnt,
    avgScore: Math.round(avgScore.avg_score),
    bestScore: bestScore.best_score,
    totalQuestions: totalQuestions.total,
    totalCorrect: totalCorrect.total,
    byMode,
    byLesson,
    recentScores: recentScores.reverse(),
    activeDays: streak.days,
  };
}

export function getLessonWeakCards(lesson: number, limit = 10): Array<{ word: string; correct_rate: number; attempts: number }> {
  const rows = getDb().query(
    `SELECT qd.word, 
            COUNT(*) as attempts,
            ROUND(100.0 * SUM(qd.is_correct) / COUNT(*), 1) as correct_rate
     FROM quiz_details qd
     JOIN quiz_sessions qs ON qs.id = qd.session_id
     WHERE qs.lesson = ?
     GROUP BY qd.word
     HAVING attempts >= 2
     ORDER BY correct_rate ASC, attempts DESC
     LIMIT ?`
  ).all(lesson, limit) as Array<{ word: string; attempts: number; correct_rate: number }>;
  return rows;
}

export function getGlobalWeakCards(limit = 20): Array<{ word: string; synonym: string; lesson: number; correct_rate: number; attempts: number }> {
  const rows = getDb().query(
    `SELECT qd.word, qd.synonym, qs.lesson,
            COUNT(*) as attempts,
            ROUND(100.0 * SUM(qd.is_correct) / COUNT(*), 1) as correct_rate
     FROM quiz_details qd
     JOIN quiz_sessions qs ON qs.id = qd.session_id
     GROUP BY qd.word
     HAVING attempts >= 2
     ORDER BY correct_rate ASC, attempts DESC
     LIMIT ?`
  ).all(limit) as Array<{ word: string; synonym: string; lesson: number; attempts: number; correct_rate: number }>;
  return rows;
}

export function getWeakByLesson(limit = 50): Array<{ lesson: number; total_words: number; weak_words: number; avg_correct_rate: number }> {
  const rows = getDb().query(
    `SELECT qs.lesson,
            COUNT(DISTINCT qd.word) as total_words,
            SUM(CASE WHEN sub.correct_rate < 70 THEN 1 ELSE 0 END) as weak_words,
            ROUND(AVG(sub.correct_rate), 1) as avg_correct_rate
     FROM quiz_details qd
     JOIN quiz_sessions qs ON qs.id = qd.session_id
     JOIN (
       SELECT word, ROUND(100.0 * SUM(is_correct) / COUNT(*), 1) as correct_rate
       FROM quiz_details
       GROUP BY word
     ) sub ON sub.word = qd.word
     WHERE qs.lesson IS NOT NULL
     GROUP BY qs.lesson
     ORDER BY avg_correct_rate ASC
     LIMIT ?`
  ).all(limit) as Array<{ lesson: number; total_words: number; weak_words: number; avg_correct_rate: number }>;
  return rows;
}
