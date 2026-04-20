/**
 * Ask confidence bands — **single source of truth** for overlap thresholds used by
 * `components/features/ask/AskTab.tsx` (badge) and logged by `app/api/ask/route.ts`.
 *
 * **Calibration:** Research targets (High ≥0.9, etc.) are product goals — this module uses
 * draft lexical overlap. Full EN/ES/VI calibration is **Team 1** (eval + PM), not a single owner
 * after Winnie’s departure; see `docs/evaluations/winnie-ask-handoff.md` for the rubric.
 *
 * **Vietnamese:** `wordOverlapRatio` is Latin-token–biased; VI answers may get skewed bands until
 * we add VI tokenization ([Brandi] chunk/context quality + [Jasmin] UX honesty).
 */

export const ASK_CONFIDENCE_BANDS_VERSION = "2026-04-12-v2";

/** Raw overlap ≥ this ⇒ UI “high” (green) before substantive adjustments. */
export const ASK_CONFIDENCE_OVERLAP_HIGH = 0.42;

/** Raw overlap ≥ this ⇒ UI “medium” (yellow) before substantive adjustments. */
export const ASK_CONFIDENCE_OVERLAP_MEDIUM = 0.2;

/** After Spanish-surface substantive boost, overlap is floored to just above `HIGH` so the badge is green. */
export const ASK_CONFIDENCE_SPANISH_PARAPHRASE_FLOOR_TARGET = 0.43;

/** Substantive non-Spanish paraphrase: floor above `MEDIUM` so short answers are not stuck on “low” (orange). */
export const ASK_CONFIDENCE_PARAPHRASE_MIN_FLOOR = 0.22;

export type AskConfidenceLocale = "es" | "en" | "vi";

export type ProvisionalBand = "cant_determine" | "high" | "medium" | "low";

/** Tailwind classes for the Ask trust pill — single source for color consistency ([Jasmin] v1). */
export function askTrustPillClassName(band: ProvisionalBand): string {
  switch (band) {
    case "cant_determine":
      return "bg-zinc-500 text-white dark:bg-zinc-600 dark:text-white";
    case "high":
      return "bg-emerald-600 text-white dark:bg-emerald-600";
    case "medium":
      return "bg-amber-400 text-neutral-950 dark:bg-amber-400 dark:text-neutral-950";
    case "low":
      return "bg-orange-600 text-white dark:bg-orange-600";
  }
}

const OVERLAP_STOP = new Set([
  "this",
  "that",
  "with",
  "from",
  "have",
  "will",
  "your",
  "what",
  "when",
  "where",
  "which",
  "their",
  "there",
  "would",
  "could",
  "should",
  "about",
  "into",
  "than",
  "then",
  "them",
  "these",
  "those",
]);

function tokenizeForOverlap(s: string): string[] {
  const words = s.toLowerCase().match(/[a-z0-9\u00c0-\u024f]+/g) ?? [];
  return words.filter((w) => w.length >= 4 && !OVERLAP_STOP.has(w));
}

/** 0–1: share of answer tokens that appear in context (proxy only, not model confidence). */
export function wordOverlapRatio(answer: string, context: string): number {
  const aw = tokenizeForOverlap(answer);
  if (aw.length === 0) return 0;
  const cset = new Set(tokenizeForOverlap(context));
  let hit = 0;
  for (const w of aw) {
    if (cset.has(w)) hit++;
  }
  return hit / aw.length;
}

export function inferChipLocaleFromText(text: string): AskConfidenceLocale {
  const sample = text.slice(0, 8000).toLowerCase();
  if (!sample.trim()) return "en";

  // Vietnamese diacritics: omit Latin é/è… used heavily in Spanish so ES text is not scored as VI.
  const viDiac = /[àáảãạăằắẳẵặâầấẩẫậêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹđ]/i.test(
    sample,
  );
  const viWords = sample.match(
    /\b(không|có|trong|được|của|và|là|với|tôi|chúng|tài\s*liệu|văn\s+bản|giúp|xin|câu|trả|lời|cần|hạn|nộp|quyền|lợi\s*ích|thông\s*báo|vui\s*lòng|xin\s*chào|hay\s*là)\b/gi,
  );
  let viScore = 0;
  if (viDiac) viScore += 9;
  viScore += Math.min(14, (viWords?.length ?? 0) * 2);
  if (/\b(không\s+tìm|không\s+có|trong\s+tài\s*liệu)\b/i.test(sample)) viScore += 5;

  let esScore = 0;
  if (/[¿¡]/.test(sample)) esScore += 8;
  if (/[áéíóúñü]/.test(sample)) esScore += 5;
  const tail = sample.slice(Math.max(0, sample.length - 400));
  if (/[áéíóúñü¿¡]/.test(tail)) esScore += 2;
  const esWords = sample.match(
    /\b(el|la|los|las|que|qué|para|con|por|del|una|este|esta|estos|esto|solicitud|beneficio|beneficios|documento|documentación|derechos|plazo|fecha|aviso|formulario|presentar|requisitos|puedo|puede|puedes|podemos|ayudarte|ayuda|gracias|hola|usted|ustedes|como|cómo|información|informacion|saludos|bienvenido|bienvenida)\b/gi,
  );
  esScore += Math.min(14, (esWords?.length ?? 0) * 2);
  if (
    /\b(puedo|puede|puedes|ayudarte|gracias|hola|usted|cómo|como|qué|que|por favor)\b/i.test(
      sample,
    )
  ) {
    esScore += 6;
  }

  if (viScore >= 10 && viScore >= esScore) return "vi";
  if (esScore >= 8) return "es";
  return "en";
}

export function answerContainsSpanishSignals(answer: string): boolean {
  const s = answer.toLowerCase();
  if (/[áéíóúñü¿¡]/.test(s)) return true;
  return /\b(puedo|puede|puedes|podemos|puedan|ayudarte|ayuda|gracias|hola|usted|ustedes|bienvenido|bienvenida|saludos|disculpe|perdon|perdón|c[oó]mo|qu[eé]|por favor|informaci[oó]n|documento|aqui|aquí|necesita|necesitas|debo|debe|tenga|tienes|tiene)\b/.test(
    s,
  );
}

/**
 * Heuristic: answer text signals “not in document / can’t help” — drives cant pill + band
 * (EN / ES / VI). Tune with Team 1 evals.
 */
export function answerLooksLikeCantDetermine(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 12) return false;
  return (
    /couldn'?t find/.test(t) ||
    /could not find/.test(t) ||
    /can'?t find/.test(t) ||
    /cannot find/.test(t) ||
    /cannot respond/.test(t) ||
    /not find(ing)? (information )?in (the |your )?(provided )?context/.test(t) ||
    /not in (the |your )?document/.test(t) ||
    /don'?t have enough information/.test(t) ||
    /do not have enough information/.test(t) ||
    /unable to find/.test(t) ||
    /unable to determine/.test(t) ||
    /i could not find/.test(t) ||
    /\b(not\s+mentioned|not\s+specified\s+in|no\s+mention\s+of)\b/i.test(t) ||
    /\bdoes\s+not\s+mention\b/i.test(t) ||
    /\bis\s+not\s+mentioned\b/i.test(t) ||
    /\b(i\s+don'?t|i\s+do\s+not)\s+see\s+(any|a)\b/i.test(t) ||
    /\bunclear\s+from\s+the\s+document\b/i.test(t) ||
    /\bnothing\s+in\s+the\s+document\b/i.test(t) ||
    /no encontr(o|é|a|amos|aron)?\b/.test(t) ||
    /no pude encontrar/.test(t) ||
    /no puedo encontrar/.test(t) ||
    /no (puedo|puede|podemos) (encontrar|localizar|hallar)\b/.test(t) ||
    /no está en el documento/i.test(t) ||
    /no hay información/.test(t) ||
    /sin información suficiente/.test(t) ||
    /\bno\s+menciona(ndo)?\b/i.test(t) ||
    /\bno\s+(aparece|consta)\b/i.test(t) ||
    /\bno\s+se\s+indica\b/i.test(t) ||
    /\b(el\s+)?documento\s+no\s+(indica|menciona|especifica)\b/i.test(t) ||
    /\bno\s+hay\s+ning(u)?na\s+mención\b/i.test(t) ||
    /\bsin\s+menc(ió|o)n\b/i.test(t) ||
    /lo siento.*no puedo/.test(t) ||
    /no puedo ayudarte/.test(t) ||
    /không\s+tìm\s+thấy/i.test(t) ||
    /không\s+thể\s+tìm/i.test(t) ||
    /không\s+có\s+(trong\s+)?tài\s*liệu/i.test(t) ||
    /không\s+thấy\s+thông\s*tin/i.test(t) ||
    /không\s+tìm\s+được/i.test(t) ||
    /không\s+đề\s+cập/i.test(t) ||
    /không\s+nhắc\s+đến/i.test(t) ||
    /văn\s+bản\s+không\s+(nói|có\s+đề\s+cập)/i.test(t) ||
    /** Meta-refusals: “can’t tell which document / can’t continue” — not a substantive doc answer ([Jasmin] Apr 2026). */
    /không\s+thể\s+xác\s+định/i.test(t) ||
    /không\s+xác\s+định\s+được/i.test(t) ||
    /không\s+thể\s+tiếp\s+tục.*trò\s+chuyện/i.test(t) ||
    /nếu\s+bạn\s+có\s+một\s+câu\s+hỏi\s+cụ\s+thể.*văn\s*bản/i.test(t) ||
    /không\s+thể\s+hiểu\s+câu\s+hỏi/i.test(t) ||
    /** Doc-grounded “nothing stated / no info on topic” — not a green “clear affirmative” ([Jasmin] Apr 2026). */
    /không\s+có\s+thông\s+tin/i.test(t) ||
    /(there\s+is\s+)?no\s+information\s+about/i.test(t) ||
    /no\s+hay\s+información\s+sobre/i.test(t)
  );
}

/**
 * Long / structured reply — overlap vs English chunks underrates Spanish paraphrases;
 * short one-sentence Spanish answers still qualify when they have enough tokens + signals.
 */
export function answerAppearsSubstantive(answer: string): boolean {
  const t = answer.trim();
  if (t.length >= 160) {
    const punct = (t.match(/[.!?…]/g) ?? []).length;
    if (punct >= 2) return true;
    if (t.split(/\s+/).filter(Boolean).length >= 32) return true;
  }
  const words = t.split(/\s+/).filter(Boolean).length;
  if (words >= 12 && /[.!?…]\s*$/.test(t)) return true;
  if (words >= 10 && answerContainsSpanishSignals(t)) return true;
  return false;
}

/**
 * UI-only band from lexical overlap (draft cutoffs — not production confidence).
 * Must stay aligned with `ASK_CONFIDENCE_*` constants above.
 *
 * [Brandi] — RAG/chunk quality affects overlap; [Jasmin] — Spanish paraphrase floor + VI note above.
 */
export function computeAskConfidenceBand(
  answer: string,
  context: string,
): ProvisionalBand {
  if (answerLooksLikeCantDetermine(answer)) return "cant_determine";
  let o = wordOverlapRatio(answer, context);

  if (answerAppearsSubstantive(answer)) {
    const loc = inferChipLocaleFromText(answer);
    const spanishSurface =
      loc === "es" || answerContainsSpanishSignals(answer);
    if (spanishSurface && o < ASK_CONFIDENCE_OVERLAP_HIGH) {
      o = Math.max(o, ASK_CONFIDENCE_SPANISH_PARAPHRASE_FLOOR_TARGET);
    } else if (o < ASK_CONFIDENCE_OVERLAP_MEDIUM) {
      o = Math.max(o, ASK_CONFIDENCE_PARAPHRASE_MIN_FLOOR);
    }
  }

  if (o >= ASK_CONFIDENCE_OVERLAP_HIGH) return "high";
  if (o >= ASK_CONFIDENCE_OVERLAP_MEDIUM) return "medium";
  return "low";
}
