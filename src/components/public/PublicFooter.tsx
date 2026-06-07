import Image from 'next/image'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

// FR-100: footer = address + privacy-policy link ONLY. NO social links
// (FA §10 + §12 explicitly exclude socials, overriding the gate-a kit).
export async function PublicFooter({ locale }: { locale: string }) {
  const t = await getTranslations('home')

  return (
    <footer className="pub-footer">
      <div className="pub-footer-inner">
        <Link href={`/${locale}`} aria-label="Kameraad Haarsnijder — home">
          <Image
            src="/img/logo-gold.png"
            alt="Kameraad Haarsnijder"
            width={298}
            height={133}
            style={{ height: 38, width: 'auto' }}
          />
        </Link>

        {/* -- PROVISIONAL: address unconfirmed (client data pending) -- */}
        <address className="km-small not-italic" style={{ color: '#c8c1b2' }}>
          {t('footer.address')}
        </address>

        <Link
          href={`/${locale}/privacy`}
          className="font-display text-[0.74rem] uppercase tracking-[0.14em] text-gold-pale transition-colors hover:text-white"
        >
          {t('footer.privacy')}
        </Link>

        <span className="km-small" style={{ color: '#8f897c' }}>
          {t('footer.copyright')}
        </span>
      </div>
    </footer>
  )
}
