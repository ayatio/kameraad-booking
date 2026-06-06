/* eslint-disable @next/next/no-head-element */
import React from 'react'

const C = {
  ink: '#16140F',
  paper: '#F6F1E7',
  paper2: '#EDE6D6',
  gold: '#C9A24B',
  goldDeep: '#9A7B33',
  goldPale: '#E8D29F',
  smoke: '#8A857B',
  darkMuted: '#8F897C',
  fg2: '#4A453C',
  lineOnPaper: 'rgba(22,20,15,0.14)',
} as const

const F = {
  display: "'Arial Narrow', Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  body: "Helvetica, Arial, sans-serif",
} as const

export interface CardRow {
  key: string
  value: string
}

export interface EmailCta {
  label: string
  url: string
  ghost?: boolean
}

export interface EmailLayoutProps {
  lang: string
  preview?: string
  eyebrow: string
  heading: string
  body: string
  card?: CardRow[]
  ctas?: EmailCta[]
  footerAddress: string
  unsubscribeUrl?: string
  unsubscribeLabel?: string
}

export function EmailLayout({
  lang,
  preview,
  eyebrow,
  heading,
  body,
  card,
  ctas,
  footerAddress,
  unsubscribeUrl,
  unsubscribeLabel,
}: EmailLayoutProps): React.ReactElement {
  return (
    <html lang={lang}>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: C.paper2, fontFamily: F.body }}>
        {preview && (
          <div
            aria-hidden="true"
            style={{ display: 'none', maxHeight: 0, overflow: 'hidden', opacity: 0, fontSize: 1, color: C.paper2 }}
          >
            {preview + '‌'.repeat(100)}
          </div>
        )}
        {/* Outer wrapper */}
        <table role="presentation" cellPadding={0} cellSpacing={0} border={0} width="100%" style={{ backgroundColor: C.paper2 }}>
          <tbody>
            <tr>
              <td align="center" style={{ padding: '40px 16px' }}>
                {/* Email card */}
                <table role="presentation" cellPadding={0} cellSpacing={0} border={0} width="100%" style={{ maxWidth: 560, backgroundColor: C.paper }}>
                  <tbody>
                    {/* ── Header ──────────────────────────────────── */}
                    <tr>
                      <td style={{ backgroundColor: C.ink, textAlign: 'center', padding: '26px 20px' }}>
                        <span style={{
                          fontFamily: F.display,
                          textTransform: 'uppercase',
                          letterSpacing: '0.18em',
                          fontSize: 16,
                          fontWeight: 600,
                          color: C.gold,
                          display: 'inline-block',
                        }}>
                          KAMERAAD HAARSNIJDER
                        </span>
                      </td>
                    </tr>
                    {/* ── Body ────────────────────────────────────── */}
                    <tr>
                      <td style={{ backgroundColor: C.paper, padding: '40px 40px 32px' }}>
                        <p style={{
                          margin: '0 0 8px',
                          fontFamily: F.display,
                          textTransform: 'uppercase',
                          letterSpacing: '0.24em',
                          fontSize: 11,
                          color: C.goldDeep,
                          textAlign: 'center',
                        }}>
                          {eyebrow}
                        </p>
                        <h1 style={{
                          margin: '0 0 16px',
                          fontFamily: F.serif,
                          fontWeight: 400,
                          fontSize: 32,
                          lineHeight: 1.2,
                          color: C.ink,
                          textAlign: 'center',
                        }}>
                          {heading}
                        </h1>
                        <p style={{
                          margin: '0 auto 28px',
                          fontSize: 14,
                          lineHeight: 1.65,
                          color: C.fg2,
                          textAlign: 'center',
                          maxWidth: '42ch',
                          display: 'block',
                        }}>
                          {body}
                        </p>

                        {/* Appointment card */}
                        {card && card.length > 0 && (
                          <table role="presentation" cellPadding={0} cellSpacing={0} border={0} width="100%" style={{
                            border: `1px solid ${C.lineOnPaper}`,
                            borderRadius: 4,
                            marginBottom: 28,
                          }}>
                            <tbody>
                              <tr>
                                <td style={{ padding: '0 20px' }}>
                                  <table role="presentation" cellPadding={0} cellSpacing={0} border={0} width="100%">
                                    <tbody>
                                      {card.map((row, i) => (
                                        <tr key={i}>
                                          <td style={{
                                            padding: '13px 0',
                                            fontFamily: F.display,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.12em',
                                            fontSize: 11,
                                            color: C.smoke,
                                            borderBottom: i < card.length - 1 ? `1px solid ${C.lineOnPaper}` : undefined,
                                          }}>
                                            {row.key}
                                          </td>
                                          <td style={{
                                            padding: '13px 0',
                                            fontSize: 14,
                                            fontWeight: 500,
                                            color: C.ink,
                                            textAlign: 'right',
                                            borderBottom: i < card.length - 1 ? `1px solid ${C.lineOnPaper}` : undefined,
                                          }}>
                                            {row.value}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        )}

                        {/* CTAs */}
                        {ctas && ctas.map((cta, i) => (
                          <div key={i} style={{ textAlign: 'center', marginBottom: i < ctas.length - 1 ? 12 : 0 }}>
                            <a
                              href={cta.url}
                              style={{
                                display: 'inline-block',
                                fontFamily: F.display,
                                textTransform: 'uppercase',
                                letterSpacing: '0.14em',
                                fontSize: 13,
                                fontWeight: 600,
                                backgroundColor: cta.ghost ? 'transparent' : C.gold,
                                color: cta.ghost ? C.goldDeep : '#1a160c',
                                padding: '15px 34px',
                                borderRadius: 999,
                                textDecoration: 'none',
                                border: cta.ghost ? `1px solid ${C.gold}` : 'none',
                              }}
                            >
                              {cta.label}
                            </a>
                          </div>
                        ))}
                      </td>
                    </tr>
                    {/* ── Footer ──────────────────────────────────── */}
                    <tr>
                      <td style={{ backgroundColor: C.ink, textAlign: 'center', padding: '24px 20px' }}>
                        <p style={{ margin: 0, fontSize: 11, color: C.darkMuted, lineHeight: 1.7, fontFamily: F.body }}>
                          {footerAddress}
                          {unsubscribeUrl && (
                            <>
                              {' · '}
                              <a href={unsubscribeUrl} style={{ color: C.goldPale, textDecoration: 'none' }}>
                                {unsubscribeLabel ?? 'Afmelden'}
                              </a>
                            </>
                          )}
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  )
}
