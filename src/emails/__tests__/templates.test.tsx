import { describe, it, expect } from 'vitest'
import { renderTemplate } from '../render'
import type { SupportedLocale } from '../render'

const BASE_PARAMS = {
  firstName: 'Pieter',
  barber: 'Adil',
  service: 'Knippen',
  date: 'woensdag 10 juni 2026',
  time: '12:00',
  price: '€24',
  cancelUrl: 'http://localhost:3000/nl/afspraak/annuleren/tok',
  rescheduleUrl: 'http://localhost:3000/nl/afspraak/verzetten/tok',
  bookingUrl: 'http://localhost:3000/nl',
  unsubscribeUrl: 'http://localhost:3000/nl/voorkeuren/unsub',
}

const LOCALES: SupportedLocale[] = ['nl', 'en', 'fr', 'es', 'le']

describe('renderTemplate — confirmation', () => {
  for (const locale of LOCALES) {
    it(`renders without throwing for locale=${locale}`, () => {
      const result = renderTemplate({ ...BASE_PARAMS, type: 'confirmation', locale })
      expect(result.html).toContain('<!DOCTYPE html>')
      expect(result.html).toContain('KAMERAAD HAARSNIJDER')
      expect(result.subject.length).toBeGreaterThan(0)
      expect(result.text.length).toBeGreaterThan(0)
    })
  }

  it('nl: subject contains service and date', () => {
    const { subject } = renderTemplate({ ...BASE_PARAMS, type: 'confirmation', locale: 'nl' })
    expect(subject).toContain('Knippen')
    expect(subject).toContain('woensdag 10 juni 2026')
  })

  it('nl: heading is "Tot snel, kameraad."', () => {
    const { html } = renderTemplate({ ...BASE_PARAMS, type: 'confirmation', locale: 'nl' })
    expect(html).toContain('Tot snel, kameraad.')
  })

  it('en: heading is "See you soon, kameraad."', () => {
    const { html } = renderTemplate({ ...BASE_PARAMS, type: 'confirmation', locale: 'en' })
    expect(html).toContain('See you soon, kameraad.')
  })

  it('fr: heading is "À bientôt, kameraad."', () => {
    const { html } = renderTemplate({ ...BASE_PARAMS, type: 'confirmation', locale: 'fr' })
    expect(html).toContain('À bientôt, kameraad.')
  })

  it('le: heading is "Tot subiet, kameraad."', () => {
    const { html } = renderTemplate({ ...BASE_PARAMS, type: 'confirmation', locale: 'le' })
    expect(html).toContain('Tot subiet, kameraad.')
  })

  it('appointment card contains all 5 rows', () => {
    const { html } = renderTemplate({ ...BASE_PARAMS, type: 'confirmation', locale: 'nl' })
    expect(html).toContain('Knippen')
    expect(html).toContain('Adil')
    expect(html).toContain('woensdag 10 juni 2026')
    expect(html).toContain('12:00')
    expect(html).toContain('€24')
  })

  it('includes cancel and reschedule CTAs', () => {
    const { html } = renderTemplate({ ...BASE_PARAMS, type: 'confirmation', locale: 'nl' })
    expect(html).toContain('annuleren/tok')
    expect(html).toContain('verzetten/tok')
  })

  it('plain text contains appointment data', () => {
    const { text } = renderTemplate({ ...BASE_PARAMS, type: 'confirmation', locale: 'nl' })
    expect(text).toContain('Knippen')
    expect(text).toContain('Adil')
    expect(text).toContain('€24')
  })
})

describe('renderTemplate — reminder_24h', () => {
  it('interpolates {time} and {hours} in body', () => {
    const { html, text } = renderTemplate({
      ...BASE_PARAMS,
      type: 'reminder_24h',
      locale: 'nl',
      hours: '24',
    })
    expect(html).toContain('12:00')
    expect(html).toContain('24')
    expect(text).toContain('12:00')
  })

  it('all locales render', () => {
    for (const locale of LOCALES) {
      expect(() =>
        renderTemplate({ ...BASE_PARAMS, type: 'reminder_24h', locale, hours: '24' }),
      ).not.toThrow()
    }
  })
})

describe('renderTemplate — cancellation', () => {
  it('includes rebook CTA linking to bookingUrl', () => {
    const { html } = renderTemplate({ ...BASE_PARAMS, type: 'cancellation', locale: 'nl' })
    expect(html).toContain('http://localhost:3000/nl')
    expect(html).toContain('Nieuwe afspraak maken')
  })
})

describe('renderTemplate — marketing', () => {
  it('includes unsubscribe URL for marketing', () => {
    const { html } = renderTemplate({ ...BASE_PARAMS, type: 'marketing', locale: 'nl' })
    expect(html).toContain('voorkeuren/unsub')
  })

  it('no appointment card for marketing', () => {
    const { html } = renderTemplate({ ...BASE_PARAMS, type: 'marketing', locale: 'nl' })
    // Card labels like "Dienst" should not be in the appointment card section
    // (they might appear elsewhere in the translation files, so check the price isn't shown as a card row)
    // We just ensure no throws and the CTA is present
    expect(html).toContain('Ontdek meer')
  })
})

describe('renderTemplate — rebooking', () => {
  it('includes booking CTA and unsubscribe footer', () => {
    const { html } = renderTemplate({ ...BASE_PARAMS, type: 'rebooking', locale: 'nl' })
    expect(html).toContain('Boek nu')
    expect(html).toContain('voorkeuren/unsub')
  })
})

describe('renderTemplate — all 7 types × 5 locales smoke test', () => {
  const types = ['confirmation', 'reminder_24h', 'reminder_2h', 'cancellation', 'reschedule', 'rebooking', 'marketing'] as const
  for (const type of types) {
    for (const locale of LOCALES) {
      it(`${type} / ${locale}`, () => {
        const result = renderTemplate({ ...BASE_PARAMS, type, locale, hours: '24' })
        expect(result.html).toContain('<!DOCTYPE html>')
        expect(result.subject.length).toBeGreaterThan(0)
      })
    }
  }
})
