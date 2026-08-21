import { Database } from "bun:sqlite";
import path from "path";

// Use absolute path to ensure it works with --watch
const DB_PATH = path.resolve(import.meta.dir, "..", "flashcards.db");

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
  const values: unknown[] = [];
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
  const params: unknown[] = [now];
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
  const params: unknown[] = [];
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
    if (extra.length > 0 && !distractors.includes(extra[0])) {
      distractors.push(extra[0]);
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
    if (extra.length > 0 && !distractors.includes(extra[0])) {
      distractors.push(extra[0]);
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
