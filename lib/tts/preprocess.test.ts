import { describe, expect, it } from 'vitest'
import { preprocessTextForTts } from '@/lib/tts/preprocess'

// ---------------------------------------------------------------------------
// 1. Text Cleaning
// ---------------------------------------------------------------------------

describe('Text Cleaning', () => {
  it('strips HTML tags', () => {
    expect(preprocessTextForTts('<p>Hello   world!</p>', 'en')).toBe('Hello world!')
  })

  it('collapses extra whitespace', () => {
    expect(preprocessTextForTts('Hello   world', 'en')).toBe('Hello world')
  })

  it('converts em dash to spaced hyphen', () => {
    expect(preprocessTextForTts('Hello \u2014 world', 'en')).toBe('Hello - world')
  })

  it('converts en dash to spaced hyphen', () => {
    expect(preprocessTextForTts('pages 10\u201320', 'en')).toBe('pages ten - twenty')
  })

  it('converts curly double quotes to straight quotes', () => {
    expect(preprocessTextForTts('\u201CHello\u201D', 'en')).toBe('"Hello"')
  })

  it('converts curly single quotes to straight apostrophes', () => {
    expect(preprocessTextForTts("it\u2019s fine", 'en')).toBe("it's fine")
  })

  it('converts ellipsis character to three dots', () => {
    expect(preprocessTextForTts('Wait\u2026', 'en')).toBe('Wait...')
  })

  it('trims leading and trailing whitespace', () => {
    expect(preprocessTextForTts('  hello  ', 'en')).toBe('hello')
  })

  it('strips nested HTML tags', () => {
    expect(preprocessTextForTts('<div><span>text</span></div>', 'en')).toBe('text')
  })
})

// ---------------------------------------------------------------------------
// 2. Numbers
// ---------------------------------------------------------------------------

describe('Numbers — Cardinal', () => {
  it('converts a three-digit number', () => {
    expect(preprocessTextForTts('123', 'en')).toBe('one hundred twenty-three')
  })

  it('converts a single digit', () => {
    expect(preprocessTextForTts('7', 'en')).toBe('seven')
  })

  it('converts a large number', () => {
    expect(preprocessTextForTts('1000', 'en')).toBe('one thousand')
  })

  it('converts number inline with text', () => {
    expect(preprocessTextForTts('I have 3 cats', 'en')).toBe('I have three cats')
  })
})

describe('Numbers — Decimal', () => {
  it('converts a decimal number', () => {
    expect(preprocessTextForTts('3.14', 'en')).toBe('three point one four')
  })

  it('converts a decimal with multiple fractional digits', () => {
    expect(preprocessTextForTts('2.718', 'en')).toBe('two point seven one eight')
  })
})

describe('Numbers — Currency', () => {
  it('converts dollars and cents', () => {
    expect(preprocessTextForTts('$45.50', 'en')).toBe('forty-five dollars and fifty cents')
  })

  it('converts whole dollars', () => {
    expect(preprocessTextForTts('$10', 'en')).toBe('ten dollars')
  })

  it('converts one dollar singular', () => {
    expect(preprocessTextForTts('$1', 'en')).toBe('one dollar')
  })

  it('converts large currency amount', () => {
    expect(preprocessTextForTts('$1,200', 'en')).toBe('one thousand two hundred dollars')
  })
})

describe('Numbers — Date', () => {
  it('converts a date in MM/DD/YYYY format', () => {
    expect(preprocessTextForTts('04/02/2026', 'en')).toBe('April second, twenty twenty-six')
  })

  it('converts January first', () => {
    expect(preprocessTextForTts('01/01/2000', 'en')).toBe('January first, two thousand')
  })
})

describe('Numbers — Phone', () => {
  it('converts a phone number digit by digit', () => {
    expect(preprocessTextForTts('856-555-1234', 'en')).toBe(
      'eight five six five five five one two three four',
    )
  })

  it('converts a phone number with dots', () => {
    expect(preprocessTextForTts('800.555.0199', 'en')).toBe(
      'eight zero zero five five five zero one nine nine',
    )
  })
})

describe('Numbers — Non-English still normalizes', () => {
  it('converts numbers in Spanish text', () => {
    expect(preprocessTextForTts('Tengo 3 gatos', 'es')).toBe('Tengo three gatos')
  })

  it('converts numbers in Vietnamese text', () => {
    expect(preprocessTextForTts('Tôi có 5 con mèo', 'vi')).toBe('Tôi có five con mèo')
  })
})

// ---------------------------------------------------------------------------
// 3. Legal Terms  (English only)
// ---------------------------------------------------------------------------

describe('Legal Terms', () => {
  it('expands case citation v.', () => {
    expect(preprocessTextForTts('Brown v. Board of Education', 'en')).toBe(
      'Brown versus Board of Education',
    )
  })

  it('expands section symbol followed by a number', () => {
    // § 5 → "section five" (number normalization runs before legal, so digit is already words)
    expect(preprocessTextForTts('See § 5', 'en')).toBe('See section five')
  })

  it('expands et al.', () => {
    expect(preprocessTextForTts('Smith et al. found', 'en')).toBe('Smith and others found')
  })

  it('expands e.g.', () => {
    expect(preprocessTextForTts('e.g. apples', 'en')).toBe('for example apples')
  })

  it('expands i.e.', () => {
    expect(preprocessTextForTts('i.e. the rule', 'en')).toBe('that is the rule')
  })

  it('skips legal expansion for non-English', () => {
    expect(preprocessTextForTts('Smith v. Jones', 'es')).toBe('Smith v. Jones')
  })
})

// ---------------------------------------------------------------------------
// 4. Medical Terms  (English only)
// ---------------------------------------------------------------------------

describe('Medical Terms', () => {
  it('expands mg to milligrams', () => {
    expect(preprocessTextForTts('Take five mg daily', 'en')).toBe('Take five milligrams daily')
  })

  it('expands BP to blood pressure', () => {
    expect(preprocessTextForTts('Check BP', 'en')).toBe('Check blood pressure')
  })

  it('expands mL to milliliters', () => {
    expect(preprocessTextForTts('ten mL', 'en')).toBe('ten milliliters')
  })

  it('expands ICU', () => {
    expect(preprocessTextForTts('Admitted to ICU', 'en')).toBe('Admitted to intensive care unit')
  })

  it('expands Rx', () => {
    expect(preprocessTextForTts('Rx needed', 'en')).toBe('prescription needed')
  })

  it('skips medical expansion for non-English', () => {
    expect(preprocessTextForTts('Check BP please', 'es')).toBe('Check BP please')
  })
})

// ---------------------------------------------------------------------------
// 5. Abbreviations  (English only)
// ---------------------------------------------------------------------------

describe('Abbreviations', () => {
  it('expands Dr. followed by a name', () => {
    expect(preprocessTextForTts('Dr. Smith', 'en')).toBe('Doctor Smith')
  })

  it('does NOT expand Dr. not followed by a capitalized name', () => {
    expect(preprocessTextForTts('See a Dr. for help', 'en')).toBe('See a Dr. for help')
  })

  it('expands Mr. followed by a name', () => {
    expect(preprocessTextForTts('Mr. Johnson', 'en')).toBe('Mister Johnson')
  })

  it('expands Mrs. followed by a name', () => {
    expect(preprocessTextForTts('Mrs. Davis', 'en')).toBe('Missus Davis')
  })

  it('expands Prof. followed by a name', () => {
    expect(preprocessTextForTts('Prof. Lee', 'en')).toBe('Professor Lee')
  })

  it('expands etc.', () => {
    expect(preprocessTextForTts('apples, oranges, etc.', 'en')).toBe('apples, oranges, et cetera')
  })

  it('skips abbreviation expansion for non-English', () => {
    expect(preprocessTextForTts('Dr. Smith es bueno', 'es')).toBe('Dr. Smith es bueno')
  })
})

// ---------------------------------------------------------------------------
// 6. Acronyms  (English only)
// ---------------------------------------------------------------------------

describe('Acronyms — Spelled', () => {
  it('spells out FBI', () => {
    expect(preprocessTextForTts('FBI case', 'en')).toBe('F B I case')
  })

  it('spells out CIA', () => {
    expect(preprocessTextForTts('CIA report', 'en')).toBe('C I A report')
  })

  it('spells out DNA', () => {
    expect(preprocessTextForTts('DNA test', 'en')).toBe('D N A test')
  })
})

describe('Acronyms — Pronounced', () => {
  it('renders NASA as spoken word', () => {
    expect(preprocessTextForTts('NASA launch', 'en')).toBe('nassa launch')
  })

  it('renders NATO as spoken word', () => {
    expect(preprocessTextForTts('NATO summit', 'en')).toBe('nato summit')
  })
})

describe('Acronyms — Fallback', () => {
  it('spells out unknown ALL-CAPS tokens letter by letter', () => {
    expect(preprocessTextForTts('ACME product', 'en')).toBe('A C M E product')
  })
})

describe('Acronyms — Non-English skipped', () => {
  it('does not expand acronyms for non-English', () => {
    expect(preprocessTextForTts('FBI informe', 'es')).toBe('FBI informe')
  })
})

// ---------------------------------------------------------------------------
// 7. Names  (English only)
// ---------------------------------------------------------------------------

describe('Names', () => {
  it('replaces Sean with Shawn', () => {
    expect(preprocessTextForTts('My name is Sean', 'en')).toBe('My name is Shawn')
  })

  it('replaces Nguyen with Win', () => {
    expect(preprocessTextForTts('Nguyen is here', 'en')).toBe('Win is here')
  })

  it('replaces Jose with Hozay', () => {
    expect(preprocessTextForTts('Jose arrived', 'en')).toBe('Hozay arrived')
  })

  it('replaces Siobhan with Shivawn', () => {
    expect(preprocessTextForTts('Call Siobhan', 'en')).toBe('Call Shivawn')
  })

  it('does not replace partial word matches (Seanville stays intact)', () => {
    expect(preprocessTextForTts('Seanville', 'en')).toBe('Seanville')
  })

  it('skips name overrides for non-English', () => {
    expect(preprocessTextForTts('Me llamo Sean', 'es')).toBe('Me llamo Sean')
  })
})

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe('Edge Cases', () => {
  it('returns empty string for empty input', () => {
    expect(preprocessTextForTts('', 'en')).toBe('')
  })

  it('returns clean text unchanged', () => {
    expect(preprocessTextForTts('Hello world', 'en')).toBe('Hello world')
  })

  it('handles auto language as English', () => {
    expect(preprocessTextForTts('Dr. Smith', 'auto')).toBe('Doctor Smith')
  })

  it('handles en-US locale as English', () => {
    expect(preprocessTextForTts('Dr. Smith', 'en-US')).toBe('Doctor Smith')
  })

  it('is idempotent — running twice produces the same result', () => {
    const once = preprocessTextForTts('Dr. Smith has three cats', 'en')
    const twice = preprocessTextForTts(once, 'en')
    expect(twice).toBe(once)
  })

  it('handles text with only whitespace', () => {
    expect(preprocessTextForTts('   ', 'en')).toBe('')
  })

  it('handles mixed HTML and numbers', () => {
    expect(preprocessTextForTts('<b>$10</b>', 'en')).toBe('ten dollars')
  })
})
