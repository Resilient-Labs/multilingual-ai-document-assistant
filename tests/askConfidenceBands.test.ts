import { describe, expect, it } from 'vitest'
import {
  answerLooksLikeCantDetermine,
  askTrustPillClassName,
  computeAskConfidenceBand,
  inferChipLocaleFromText,
} from '@/lib/askConfidenceBands'

describe('inferChipLocaleFromText', () => {
  it('scores Spanish before Vietnamese for common ES questions (é in qué)', () => {
    expect(
      inferChipLocaleFromText(
        '¿Qué documentos necesito para la solicitud?',
      ),
    ).toBe('es')
  })

  it('still detects Vietnamese when diacritics are VI-specific', () => {
    expect(
      inferChipLocaleFromText(
        'Tôi không thể tìm thấy thông tin trong tài liệu này.',
      ),
    ).toBe('vi')
  })
})

describe('answerLooksLikeCantDetermine', () => {
  it('detects Spanish “not found” phrasing (screenshot parity)', () => {
    expect(
      answerLooksLikeCantDetermine(
        'Lo siento, pero no puedo ayudarte con eso. No pude encontrar información relacionada con tu pregunta en el documento.',
      ),
    ).toBe(true)
  })

  it('detects Vietnamese “not found” phrasing', () => {
    expect(
      answerLooksLikeCantDetermine(
        'Tôi không thể tìm thấy thông tin về các tài liệu cần thiết để nộp đơn trong văn bản được cung cấp.',
      ),
    ).toBe(true)
  })

  it('detects English refusal phrasing', () => {
    expect(answerLooksLikeCantDetermine('I cannot respond to that.')).toBe(
      true,
    )
  })

  it('detects Vietnamese meta-refusal (“can’t determine which text”) — trust pill parity', () => {
    expect(
      answerLooksLikeCantDetermine(
        'Tôi không thể tiếp tục cuộc trò chuyện này vì tôi không thể xác định được bạn đang nói về văn bản nào. Nếu bạn có một câu hỏi cụ thể về văn bản được cung cấp, tôi sẵn sàng giúp đỡ.',
      ),
    ).toBe(true)
  })

  it('detects Vietnamese “cannot understand question” phrasing', () => {
    expect(
      answerLooksLikeCantDetermine(
        'Tôi không thể hiểu câu hỏi của bạn. Bạn muốn hỏi gì về tài liệu?',
      ),
    ).toBe(true)
  })

  it('detects Vietnamese “no information on topic” (deadline-style negative)', () => {
    expect(
      answerLooksLikeCantDetermine(
        'Không có thông tin về thời hạn nào trong thông báo này.',
      ),
    ).toBe(true)
  })

  it('detects English “not mentioned / no mention” phrasing', () => {
    expect(
      answerLooksLikeCantDetermine(
        'The notice does not mention any appeal deadline; nothing in the document specifies a date.',
      ),
    ).toBe(true)
  })

  it('detects Spanish “documento no menciona” phrasing', () => {
    expect(
      answerLooksLikeCantDetermine(
        'El documento no menciona ningún plazo de apelación en este aviso.',
      ),
    ).toBe(true)
  })

  it('detects Vietnamese “không đề cập” phrasing', () => {
    expect(
      answerLooksLikeCantDetermine(
        'Trong thông báo này không đề cập đến hạn nộp đơn khiếu nại.',
      ),
    ).toBe(true)
  })

  it('does not flag a normal affirmative deadline answer', () => {
    expect(
      answerLooksLikeCantDetermine(
        'The notice says you must file your appeal by March 15, 2025. That is the only deadline stated in the document.',
      ),
    ).toBe(false)
  })
})

describe('computeAskConfidenceBand + askTrustPillClassName', () => {
  it('returns cant_determine when prose signals not-in-document (ES)', () => {
    expect(
      computeAskConfidenceBand(
        'No pude encontrar esa información en el documento proporcionado.',
        'foo bar baz qux wux yuz unrelated context',
      ),
    ).toBe('cant_determine')
  })

  it('returns cant_determine for Vietnamese “no information” line even with chunk overlap', () => {
    expect(
      computeAskConfidenceBand(
        'Không có thông tin về thời hạn nào trong thông báo này.',
        'thông báo thời hạn nộp đơn hạn chót deadline notice text',
      ),
    ).toBe('cant_determine')
  })

  it('maps each band to stable pill classes', () => {
    expect(askTrustPillClassName('high')).toContain('emerald')
    expect(askTrustPillClassName('medium')).toContain('amber')
    expect(askTrustPillClassName('low')).toContain('orange')
    expect(askTrustPillClassName('cant_determine')).toContain('zinc')
  })
})
