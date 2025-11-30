'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import Link from 'next/link'

// Constants
const REDIRECT_DELAY = 300
const FOCUS_DELAY = 100

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
})

type LoginFormData = z.infer<typeof loginSchema>

interface LoginFormProps {
  copyrightText: string
}

// SVG Icons as constants
const EmailIcon = () => (
  <svg
    className="h-5 w-5 text-gray-400"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
)

const LockIcon = () => (
  <svg
    className="h-5 w-5 text-gray-400"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
)

const EyeIcon = ({ show }: { show: boolean }) => (
  <svg
    className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    {show ? (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.736m0 0L21 21"
      />
    ) : (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    )}
  </svg>
)

const ErrorIcon = () => (
  <svg
    className="h-5 w-5 text-red-400 mr-2 flex-shrink-0 mt-0.5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
)

const LoadingSpinner = () => (
  <svg
    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
)

export default function LoginForm({ copyrightText }: LoginFormProps) {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
    getValues,
    setValue,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    shouldUnregister: false,
  })

  // Helper function to update URL without causing navigation
  const updateURL = useCallback((params: Record<string, string | null>) => {
    const url = new URL(window.location.href)
    Object.entries(params).forEach(([key, value]) => {
      if (value === null) {
        url.searchParams.delete(key)
      } else {
        url.searchParams.set(key, value)
      }
    })
    window.history.replaceState({}, '', url.toString())
  }, [])

  // Helper function to extract error message
  const extractErrorMessage = useCallback((err: unknown): string => {
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosError = err as { response?: { data?: { error?: { message?: string } } } }
      return axiosError.response?.data?.error?.message || 'An error occurred during login'
    }
    if (err instanceof Error) {
      return err.message
    }
    return 'An error occurred during login'
  }, [])

  // Initialize component: check auth, load errors, and focus email field
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      router.push('/dashboard')
      return
    }

    // Check for error message in URL query params
    const urlParams = new URLSearchParams(window.location.search)
    const errorParam = urlParams.get('error')
    if (errorParam) {
      setError(decodeURIComponent(errorParam))
      updateURL({ error: null })
    }

    // Check for error in localStorage
    const storedError = localStorage.getItem('loginError')
    if (storedError) {
      setError(storedError)
      localStorage.removeItem('loginError')
    }

    // Auto-focus email field
    setFocus('email')
  }, [router, setFocus, updateURL])

  // Handle successful login
  const handleLoginSuccess = useCallback(
    async (token: string, user: unknown, rememberMe: boolean) => {
      localStorage.setItem('token', token)
      
      if (user) {
        localStorage.setItem('user', JSON.stringify(user))
      }
      
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true')
      } else {
        localStorage.removeItem('rememberMe')
      }

      setError(null)
      localStorage.removeItem('loginError')

      // Small delay for better UX before redirect
      await new Promise(resolve => setTimeout(resolve, REDIRECT_DELAY))
      router.push('/dashboard')
    },
    [router]
  )

  // Handle login error
  const handleLoginError = useCallback(
    (errorMessage: string, emailToPreserve: string, rememberMe: boolean) => {
      setError(errorMessage)
      
      // Preserve form values
      if (emailToPreserve) {
        setValue('email', emailToPreserve, { shouldValidate: false, shouldDirty: false })
      }
      if (rememberMe !== undefined) {
        setValue('rememberMe', rememberMe, { shouldValidate: false })
      }
      
      // Persist error message
      localStorage.setItem('loginError', errorMessage)
      updateURL({ error: encodeURIComponent(errorMessage) })
      
      // Focus on email field after error
      setTimeout(() => {
        setFocus('email')
        // Double-check email is preserved
        if (emailToPreserve && !getValues('email')) {
          setValue('email', emailToPreserve, { shouldValidate: false })
        }
      }, FOCUS_DELAY)
    },
    [setValue, setFocus, getValues, updateURL]
  )

  // Form submission handler
  const onSubmit = useCallback(
    async (data: LoginFormData) => {
      setIsLoading(true)
      setError(null)
      
      const emailToPreserve = data.email.trim()
      const rememberMe = data.rememberMe || false
      
      // Clear previous error messages
      localStorage.removeItem('loginError')
      updateURL({ error: null })

      try {
        const { api } = await import('../../lib/api')
        const response = await api.post('/auth/login', {
          email: emailToPreserve.toLowerCase(),
          password: data.password,
          rememberMe,
        })

        const token = response.data?.data?.token
        if (!token) {
          throw new Error('No token received from server')
        }

        await handleLoginSuccess(token, response.data?.data?.user, rememberMe)
      } catch (err: unknown) {
        const errorMessage = extractErrorMessage(err)
        handleLoginError(errorMessage, emailToPreserve, rememberMe)
      } finally {
        setIsLoading(false)
      }
    },
    [handleLoginSuccess, handleLoginError, extractErrorMessage, updateURL]
  )

  // Toggle password visibility
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev)
  }, [])

  // Memoize disabled state
  const isFormDisabled = useMemo(() => isLoading || isSubmitting, [isLoading, isSubmitting])

  // Memoize input class names
  const emailInputClasses = useMemo(
    () =>
      `block w-full pl-10 pr-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition ${
        errors.email ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
      }`,
    [errors.email]
  )

  const passwordInputClasses = useMemo(
    () =>
      `block w-full pl-10 pr-10 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition ${
        errors.password ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
      }`,
    [errors.password]
  )

  return (
    <>
      {/* Login Card */}
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Welcome Back</h2>
          <p className="text-gray-600 text-sm">Please sign in to continue.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" aria-hidden="true">
                <EmailIcon />
              </div>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                className={emailInputClasses}
                placeholder="Enter your email"
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={errors.email ? 'email-error' : undefined}
                disabled={isFormDisabled}
              />
            </div>
            {errors.email && (
              <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" aria-hidden="true">
                <LockIcon />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                {...register('password')}
                className={passwordInputClasses}
                placeholder="Enter your password"
                aria-invalid={errors.password ? 'true' : 'false'}
                aria-describedby={errors.password ? 'password-error' : undefined}
                disabled={isFormDisabled}
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute inset-y-0 right-0 pr-3 flex items-center focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={isFormDisabled}
              >
                <EyeIcon show={showPassword} />
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="mt-1 text-sm text-red-600" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Remember Me and Forgot Password */}
          <div className="flex items-center justify-between">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                {...register('rememberMe')}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 cursor-pointer"
                disabled={isFormDisabled}
              />
              <span className="ml-2 text-sm text-gray-700">Remember me</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-1"
              tabIndex={isFormDisabled ? -1 : 0}
            >
              Forgot Password?
            </Link>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm animate-in fade-in slide-in-from-top-2 duration-200"
              role="alert"
              aria-live="polite"
            >
              <div className="flex items-start">
                <ErrorIcon />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={isFormDisabled}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 flex items-center justify-center"
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <LoadingSpinner />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>

      {/* Copyright Footer */}
      <div className="mt-8 text-center text-xs text-gray-600">
        <p>{copyrightText}</p>
      </div>
    </>
  )
}

