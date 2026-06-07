import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { auth } from '@/auth'
import { LoginForm } from './LoginForm'
import { AuthShell } from '../AuthShell'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) redirect('/admin')
  const t = await getTranslations({ locale: 'nl', namespace: 'admin' })

  return (
    <AuthShell title={t('login.title')} subtitle={t('login.subtitle')}>
      <LoginForm />
    </AuthShell>
  )
}
