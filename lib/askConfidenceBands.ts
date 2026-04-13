/**
 * Ask confidence bands — **single source of truth** for overlap thresholds used by
 * `components/features/ask/AskTab.tsx` (badge) and logged by `app/api/ask/route.ts`.
 *
 * TODO [Winnie] — Evaluation & calibration ticket: draft lexical proxy — not Winnie’s final High ≥0.9 / Moderate / Low product thresholds
 * Placeholder — must be validated against 50 Q&A pair eval set (EN + ES) before ship
 * Multilingual accuracy target: >85% per language — EN + ES only for V1
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

export type AskConfidenceLocale = "es" | "en";

export type ProvisionalBand = "cant_determine" | "high" | "medium" | "low";

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
  let score = 0;
  if (/[áéíóúñü¿¡]/.test(sample)) score += 5;
  const tail = sample.slice(Math.max(0, sample.length - 400));
  if (/[áéíóúñü¿¡]/.test(tail)) score += 2;
  const esWords = sample.match(
    /\b(el|la|los|las|que|qué|para|con|por|del|una|este|esta|estos|esto|solicitud|beneficio|beneficios|documento|documentación|derechos|plazo|fecha|aviso|formulario|presentar|requisitos|puedo|puede|puedes|podemos|ayudarte|ayuda|gracias|hola|usted|ustedes|como|cómo|información|informacion|saludos|bienvenido|bienvenida)\b/gi,
  );
  score += Math.min(14, (esWords?.length ?? 0) * 2);
  if (
    /\b(puedo|puede|puedes|ayudarte|gracias|hola|usted|cómo|como|qué|que|por favor)\b/i.test(
      sample,
    )
  ) {
    score += 6;
  }
  return score >= 8 ? "es" : "en";
}

export function answerContainsSpanishSignals(answer: string): boolean {
  const s = answer.toLowerCase();
  if (/[áéíóúñü¿¡]/.test(s)) return true;
  return /\b(puedo|puede|puedes|podemos|puedan|ayudarte|ayuda|gracias|hola|usted|ustedes|bienvenido|bienvenida|saludos|disculpe|perdon|perdón|c[oó]mo|qu[eé]|por favor|informaci[oó]n|documento|aqui|aquí|necesita|necesitas|debo|debe|tenga|tienes|tiene)\b/.test(
    s,
  );
}

/** Heuristic only — real buckets need Winnie calibration (Research Conclusions). */
export function answerLooksLikeCantDetermine(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 16) return false;
  return (
    /couldn'?t find/.test(t) ||
    /could not find/.test(t) ||
    /can'?t find/.test(t) ||
    /cannot find/.test(t) ||
    /not find(ing)? (information )?in (the |your )?(provided )?context/.test(t) ||
    /not in (the |your )?document/.test(t) ||
    /no encontr/i.test(t) ||
    /no está en el documento/i.test(t) ||
    /don'?t have enough information/.test(t) ||
    /do not have enough information/.test(t) ||
    /unable to find/.test(t) ||
    /i could not find/.test(t)
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

// TODO [Brandi] — Data & inputs ticket: Spanish answers vs English-heavy chunks tank naive token overlap — floors below until multilingual RAG is reliable
// Placeholder until chunking pipeline is hardened and race condition in upload-form is fixed
/**
 * UI-only band from lexical overlap (draft cutoffs — not production confidence).
 * Must stay aligned with `ASK_CONFIDENCE_*` constants above.
 */
export function computeAskConfidenceBand(
  answer: string,
  context: string,
): ProvisionalBand {
  if (answerLooksLikeCantDetermine(answer)) return "cant_determine";
  let o = wordOverlapRatio(answer, context);

  if (answerAppearsSubstantive(answer)) {
    const spanishSurface =
      inferChipLocaleFromText(answer) === "es" ||
      answerContainsSpanishSignals(answer);
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
