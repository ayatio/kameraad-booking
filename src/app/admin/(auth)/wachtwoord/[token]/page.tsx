import { getTranslations } from 'next-intl/server'
import { SetPasswordForm } from './SetPasswordForm'
import { AuthShell } from '../../AuthShell'

export const dynamic = 'force-dynamic'

// The token is only validated on submit (the set-password SQL checks expiry +
// single-use atomically), so a stale/invalid link reveals nothing here.
export default async function SetPasswordPage({ params }: { params: { token: string } }) {
  const t = await getTranslations({ locale: 'nl', namespace: 'admin' })
  return (
    <AuthShell title={t('password.title')} subtitle={t('password.subtitle')}>
      <SetPasswordForm token={params.token} />
    </AuthShell>
  )
}
