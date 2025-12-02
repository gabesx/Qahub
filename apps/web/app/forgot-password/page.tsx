'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import Link from 'next/link'
import { getCopyrightText } from '../../lib/config'

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submittedEmail, setSubmittedEmail] = useState<string>('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  })

  // Auto-focus email field on mount
  useEffect(() => {
    if (!isSubmitted) {
      setFocus('email')
    }
  }, [setFocus, isSubmitted])

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      router.push('/dashboard')
    }
  }, [router])

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      const { api } = await import('../../lib/api')
      const email = data.email.trim().toLowerCase()
      
      // Call forgot password API endpoint
      await api.post('/auth/forgot-password', {
        email,
      })

      // Store submitted email for success message
      setSubmittedEmail(email)
      setIsSubmitted(true)
    } catch (err: unknown) {
      let errorMessage = 'An error occurred while sending the reset link'
      
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { 
          response?: { 
            status?: number
            data?: { error?: { message?: string; code?: string } } 
          } 
        }
        
        // Don't reveal if email exists or not for security
        // Always show success message even if email doesn't exist
        if (axiosError.response?.status === 404 || axiosError.response?.status === 400) {
          // Still show success to prevent email enumeration
          setSubmittedEmail(data.email.trim().toLowerCase())
          setIsSubmitted(true)
          setIsLoading(false)
          return
        }
        
        errorMessage = axiosError.response?.data?.error?.message || errorMessage
      } else if (err instanceof Error) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
      // Focus on email field after error
      setTimeout(() => setFocus('email'), 100)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f0fdf4] flex flex-col items-center justify-center px-4 py-8">
      {/* Logo and Title */}
      <div className="text-center mb-8">
        <div className="mb-4">
          <div className="w-16 h-16 mx-auto bg-primary-600 rounded-full flex items-center justify-center mb-2 shadow-md">
            <span className="text-white text-2xl font-bold" aria-hidden="true">Q</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Qa-Hub</h1>
          <p className="text-sm text-gray-600 mt-1">Quality Management System</p>
        </div>
      </div>

      {/* Forgot Password Card */}
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
        {!isSubmitted ? (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">Forgot Password?</h2>
              <p className="text-gray-600 text-sm">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" aria-hidden="true">
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
                  </div>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    {...register('email')}
                    className={`block w-full pl-10 pr-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition ${
                      errors.email ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter your email"
                    aria-invalid={errors.email ? 'true' : 'false'}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    disabled={isLoading}
                  />
                </div>
                {errors.email && (
                  <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div 
                  className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm animate-in fade-in slide-in-from-top-2 duration-200" 
                  role="alert"
                  aria-live="polite"
                >
                  <div className="flex items-start">
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
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || isSubmitting}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 flex items-center justify-center"
                aria-busy={isLoading}
              >
                {isLoading ? (
                  <>
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
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>

              {/* Back to Login Link */}
              <div className="text-center pt-2">
                <Link
                  href="/"
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-1"
                  tabIndex={isLoading ? -1 : 0}
                >
                  ← Back to Login
                </Link>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-300">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Check Your Email</h2>
            <p className="text-gray-600 text-sm mb-2">
              We've sent a password reset link to:
            </p>
            <p className="text-gray-800 font-medium mb-6 break-all">
              {submittedEmail}
            </p>
            <p className="text-gray-600 text-sm mb-6">
              Please check your inbox and click the link to reset your password. The link will expire in 1 hour.
            </p>
            <div className="space-y-3">
              <Link
                href="/"
                className="inline-block w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 px-4 rounded-lg transition duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                Back to Login
              </Link>
              <button
                type="button"
                onClick={() => {
                  setIsSubmitted(false)
                  setError(null)
                  setSubmittedEmail('')
                  setFocus('email')
                }}
                className="w-full text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-1 py-2"
              >
                Didn't receive it? Try again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Copyright Footer */}
      <div className="mt-8 text-center text-xs text-gray-600">
        <p>
          {getCopyrightText()}
        </p>
      </div>
    </div>
  )
}
