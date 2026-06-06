import { getTranslations } from 'next-intl/server'

export default async function NotFound() {
  const t = await getTranslations('preferences')

  return (
    <section className="min-h-screen flex items-center justify-center" style={{ background: '#0c0b0a' }}>
      <div className="text-center px-5">
        <span
          className="font-display uppercase text-gold-pale"
          style={{ letterSpacing: '0.32em', fontSize: '0.78rem' }}
        >
          Kameraad Haarsnijder
        </span>
        <p
          className="mt-6 font-serif font-medium text-paper"
          style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)' }}
        >
          {t('invalidToken')}
        </p>
      </div>
    </section>
  )
}
