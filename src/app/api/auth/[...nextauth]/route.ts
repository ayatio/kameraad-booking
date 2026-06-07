// NextAuth v5 route handler — re-exports the GET/POST handlers from src/auth.ts.
import { handlers } from '@/auth'

export const { GET, POST } = handlers
