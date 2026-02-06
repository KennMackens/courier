import { useState, FormEvent } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { Mail, Lock, User as UserIcon, AlertCircle } from 'lucide-react'

type TabType = 'signin' | 'signup'

export function AuthScreen() {
  const { signIn, signUp, signInWithGoogle } = useAuth()

  const [activeTab, setActiveTab] = useState<TabType>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (activeTab === 'signin') {
        await signIn(email, password)
      } else {
        if (!displayName.trim()) {
          throw new Error('Please enter your name')
        }
        await signUp(email, password, displayName.trim())
      }
    } catch (err: any) {
      // Firebase error codes
      const errorCode = err.code
      let errorMessage = 'An error occurred. Please try again.'

      if (errorCode === 'auth/invalid-email') {
        errorMessage = 'Invalid email address'
      } else if (errorCode === 'auth/user-not-found') {
        errorMessage = 'No account found with this email. Try signing up instead.'
      } else if (errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential') {
        errorMessage = 'Incorrect password'
      } else if (errorCode === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists. Try signing in instead.'
      } else if (errorCode === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters'
      } else if (errorCode === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.'
      } else if (errorCode === 'auth/invalid-login-credentials') {
        errorMessage = 'Invalid email or password'
      } else if (errorCode === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.'
      } else if (err.message) {
        errorMessage = err.message
      }

      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setLoading(true)

    try {
      await signInWithGoogle()
    } catch (err: any) {
      let errorMessage = 'Failed to sign in with Google'

      if (err.code === 'auth/popup-blocked') {
        errorMessage = 'Popup was blocked. Please allow popups for this site.'
      } else if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in was cancelled'
      } else if (err.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.'
      }

      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-1 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo/Branding */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-slate-12">Courier</h1>
          <p className="text-sm text-slate-11">
            Sign in to access your meeting recordings
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-slate-2 border border-slate-6 rounded-lg shadow-lg overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-6">
            <button
              onClick={() => {
                setActiveTab('signin')
                setError(null)
              }}
              className={cn(
                'flex-1 py-3 text-base font-semibold transition-colors',
                activeTab === 'signin'
                  ? 'text-slate-12 bg-slate-3 border-b-2 border-jade-9'
                  : 'text-slate-10 hover:text-slate-11 hover:bg-slate-2'
              )}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setActiveTab('signup')
                setError(null)
              }}
              className={cn(
                'flex-1 py-3 text-base font-semibold transition-colors',
                activeTab === 'signup'
                  ? 'text-slate-12 bg-slate-3 border-b-2 border-jade-9'
                  : 'text-slate-10 hover:text-slate-11 hover:bg-slate-2'
              )}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <div className="p-6 space-y-4">
            {error && (
              <Alert variant="destructive" className="text-sm">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Display Name (Sign Up only) */}
              {activeTab === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Name</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-9" />
                    <Input
                      id="displayName"
                      type="text"
                      placeholder="Your name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      disabled={loading}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-10" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-10" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="pl-10"
                    required
                    minLength={6}
                  />
                </div>
                {activeTab === 'signup' && (
                  <p className="text-xs text-slate-10">
                    Must be at least 6 characters
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    {activeTab === 'signin' ? 'Signing in...' : 'Creating account...'}
                  </>
                ) : (
                  activeTab === 'signin' ? 'Sign In' : 'Create Account'
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-6" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-slate-2 text-slate-10">Or continue with</span>
              </div>
            </div>

            {/* Google Sign In */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </Button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-10">
          By signing in, you agree to our Terms of Service and Privacy Policy.
          <br />
          All recordings stay local on your device.
        </p>
      </div>
    </div>
  )
}
