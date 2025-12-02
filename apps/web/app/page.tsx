// Server Component - Wrapper that uses client component for interactivity
import { getCopyrightText } from '../lib/config'
import LoginHeader from './components/LoginHeader'
import LoginForm from './components/LoginForm'

export default function LoginPage() {
  const copyrightText = getCopyrightText()

  return (
    <div className="min-h-screen bg-[#f0fdf4] flex flex-col items-center justify-center px-4 py-8">
      <LoginHeader />
      <LoginForm copyrightText={copyrightText} />
    </div>
  )
}
