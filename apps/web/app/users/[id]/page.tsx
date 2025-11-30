'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '../../../lib/api'

interface User {
  id: string
  name: string
  email: string
  role: string | null
  avatar: string | null
  jobRole: string | null
  isActive: boolean
  emailVerifiedAt: string | null
  lastLoginAt: string | null
  passwordChangedAt: string | null
  createdAt: string
  updatedAt: string
}

export default function UserDetailPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params.id as string
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    fetchUser()
  }, [userId])

  const fetchUser = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await api.get(`/users/${userId}`)
      
      if (response.data?.data?.user) {
        setUser(response.data.data.user)
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch user')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('rememberMe')
    router.push('/')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-2 text-gray-600">Loading user...</p>
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/dashboard" className="flex items-center">
                <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center mr-3">
                  <span className="text-white text-lg font-bold">Q</span>
                </div>
                <h1 className="text-xl font-bold text-gray-800">QaHub</h1>
              </Link>
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error || 'User not found'}
          </div>
          <Link
            href="/users"
            className="mt-4 inline-block text-primary-600 hover:text-primary-700"
          >
            ← Back to Users
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-6">
              <Link href="/dashboard" className="flex items-center">
                <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center mr-3">
                  <span className="text-white text-lg font-bold">Q</span>
                </div>
                <h1 className="text-xl font-bold text-gray-800">QaHub</h1>
              </Link>
              <nav className="flex space-x-4">
                <Link
                  href="/dashboard"
                  className="text-sm text-gray-600 hover:text-gray-800 px-3 py-2 rounded-md"
                >
                  Dashboard
                </Link>
                <Link
                  href="/users"
                  className="text-sm text-primary-600 font-medium px-3 py-2 rounded-md bg-primary-50"
                >
                  Users
                </Link>
                <Link
                  href="/profile"
                  className="text-sm text-gray-600 hover:text-gray-800 px-3 py-2 rounded-md"
                >
                  Profile
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/users"
            className="text-primary-600 hover:text-primary-700 mb-4 inline-block"
          >
            ← Back to Users
          </Link>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">User Details</h2>
        </div>

        {/* User Information */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start space-x-6 mb-6">
            {user.avatar ? (
              <img
                className="h-24 w-24 rounded-full"
                src={user.avatar}
                alt={user.name}
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-primary-600 flex items-center justify-center">
                <span className="text-white text-3xl font-medium">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{user.name}</h3>
              <p className="text-gray-600 mb-4">{user.email}</p>
              <div className="flex items-center space-x-4">
                <span
                  className={`px-3 py-1 text-sm font-semibold rounded-full ${
                    user.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
                {user.role && (
                  <span className="px-3 py-1 text-sm font-semibold rounded-full bg-gray-100 text-gray-800">
                    {user.role}
                  </span>
                )}
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Job Role</dt>
              <dd className="mt-1 text-sm text-gray-900">{user.jobRole || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Email Verified</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {user.emailVerifiedAt ? new Date(user.emailVerifiedAt).toLocaleDateString() : 'Not verified'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Login</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Password Changed</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {user.passwordChangedAt ? new Date(user.passwordChangedAt).toLocaleDateString() : 'Never'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Member Since</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(user.createdAt).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(user.updatedAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </div>
      </main>
    </div>
  )
}

