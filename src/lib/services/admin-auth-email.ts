// Builds the admin set-password link for invite (FR-041) and reset (FR-042).
// Framework-free; does NOT send anything — the actual Resend send is wired in a
// later delegation. The caller emails `buildSetPasswordLink(token)` to the user.

const BASE_URL = process.env.APP_BASE_URL ?? 'http://localhost:3000'

export type SetPasswordEmailType = 'invite' | 'reset'

// Admin set-password page (NL-only admin, v1): /admin/wachtwoord/{token}.
export function buildSetPasswordLink(token: string): string {
  return `${BASE_URL}/admin/wachtwoord/${token}`
}

// Convenience bundle for the future email layer: the link plus the flow type so
// the right subject/body can be chosen.
export function buildSetPasswordEmail(opts: {
  token: string
  type: SetPasswordEmailType
}): { type: SetPasswordEmailType; link: string } {
  return { type: opts.type, link: buildSetPasswordLink(opts.token) }
}
