'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { api } from '../../lib/api'

interface User {
  id: string
  name: string
  email: string
  role: string | null
  avatar: string | null
  isActive: boolean
}

export default function AppHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMainMenu, setShowMainMenu] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }

    const fetchUser = async () => {
      try {
        const response = await api.get('/users/me')
        if (response.data?.data?.user) {
          setUser(response.data.data.user)
        }
      } catch (error: any) {
        // Only redirect on authentication errors (401), not network errors
        // Network errors (ERR_CONNECTION_REFUSED, ERR_NETWORK) mean the server is down
        // and should be handled gracefully without redirecting
        if (error.response?.status === 401) {
          // Authentication error - redirect to login
          router.push('/')
        } else if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
          // Network error - server is likely down, just log silently
          // Don't redirect, let the user see the page even if data can't load
          console.warn('Backend server is not available. Please ensure the server is running on port 3001.')
        } else {
          // Other errors - log but don't redirect
          console.error('Error fetching user:', error)
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchUser()
  }, [router])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showUserMenu && !target.closest('[data-user-menu]')) {
        setShowUserMenu(false)
      }
      if (showMainMenu && !target.closest('[data-main-menu]')) {
        setShowMainMenu(false)
      }
    }

    if (showUserMenu || showMainMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showUserMenu, showMainMenu])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('rememberMe')
    router.push('/')
  }

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-6">
            <Link href="/dashboard" className="flex items-center group">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center mr-3 shadow-md group-hover:shadow-lg transition-shadow">
                <span className="text-white text-lg font-bold">Q</span>
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">QaHub</h1>
            </Link>
            <nav className="flex space-x-1">
              <Link
                href="/dashboard"
                className={`text-sm font-medium px-4 py-2 rounded-lg transition-all ${
                  isActive('/dashboard')
                    ? 'text-primary-700 bg-primary-50 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Dashboard
              </Link>
              <Link
                href="/projects"
                className={`text-sm font-medium px-4 py-2 rounded-lg transition-all ${
                  isActive('/projects')
                    ? 'text-primary-700 bg-primary-50 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Projects
              </Link>
              
              {/* Main Menu Dropdown */}
              <div className="relative" data-main-menu>
                <button
                  onClick={() => setShowMainMenu(!showMainMenu)}
                  className={`text-sm font-medium px-4 py-2 rounded-lg transition-all flex items-center space-x-1 ${
                    showMainMenu
                      ? 'text-primary-700 bg-primary-50 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <span>Menu</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${showMainMenu ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {showMainMenu && (
                  <div className="absolute left-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
                    <div className="py-1">
                      <button
                        onClick={() => setShowMainMenu(false)}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between group cursor-not-allowed opacity-75"
                        disabled
                        title="Coming Soon"
                      >
                        <span className="font-medium">All Project</span>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Coming Soon</span>
                      </button>
                      <button
                        onClick={() => setShowMainMenu(false)}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between group cursor-not-allowed opacity-75"
                        disabled
                        title="Coming Soon"
                      >
                        <span className="font-medium">Squad</span>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Coming Soon</span>
                      </button>
                      <button
                        onClick={() => setShowMainMenu(false)}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between group cursor-not-allowed opacity-75"
                        disabled
                        title="Coming Soon"
                      >
                        <span className="font-medium">Test Plans</span>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Coming Soon</span>
                      </button>
                      <button
                        onClick={() => setShowMainMenu(false)}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between group cursor-not-allowed opacity-75"
                        disabled
                        title="Coming Soon"
                      >
                        <span className="font-medium">Test Runs</span>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Coming Soon</span>
                      </button>
                      <button
                        onClick={() => setShowMainMenu(false)}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between group cursor-not-allowed opacity-75"
                        disabled
                        title="Coming Soon"
                      >
                        <span className="font-medium">Documents</span>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Coming Soon</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </nav>
          </div>
          <div className="flex items-center space-x-3 relative" data-user-menu>
            {/* Notifications Icon */}
            <button className="relative text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary-500 rounded-full"></span>
            </button>

            {/* User Menu Button */}
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              data-user-menu-button
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-9 h-9 rounded-full border-2 border-gray-200 ring-2 ring-white"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center border-2 border-gray-200 ring-2 ring-white shadow-sm">
                  <span className="text-white text-sm font-semibold">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
              )}
              <div className="text-left hidden sm:block">
                <div className="text-sm font-semibold text-gray-900">{user?.name || 'User'}</div>
                <div className="text-xs text-gray-500">{user?.role || 'User'}</div>
              </div>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div 
                className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 z-[101] overflow-hidden"
                data-user-menu-dropdown
              >
                  {/* User Info Block */}
                  <div className="p-5 bg-gradient-to-br from-gray-50 to-white border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                      {user?.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-16 h-16 rounded-full border-2 border-primary-200 ring-2 ring-primary-100"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center border-2 border-primary-200 ring-2 ring-primary-100 shadow-md">
                          <span className="text-white text-xl font-semibold">
                            {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-900 font-semibold truncate">{user?.name || 'User'}</div>
                        <div className="text-gray-500 text-sm truncate">{user?.email || ''}</div>
                        <div className="text-gray-500 text-sm">Role: {user?.role || 'User'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Navigation Links */}
                  <div className="py-2">
                    <Link
                      href="/profile"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center space-x-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors rounded-lg mx-2 group"
                    >
                      <div className="p-1.5 rounded-lg bg-gray-100 group-hover:bg-primary-100 transition-colors">
                        <svg className="w-4 h-4 text-gray-600 group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <span className="font-medium">View Profile</span>
                    </Link>
                  </div>

                  {/* Administrator Section */}
                  {(user?.role === 'admin' || user?.role === 'Admin') && (
                    <>
                      <div className="border-t border-gray-200 my-2"></div>
                      <div className="px-2 py-1">
                        <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2 px-4">Administrator</div>
                        <Link
                          href="/users"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center space-x-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors rounded-lg mx-2 group"
                        >
                          <div className="p-1.5 rounded-lg bg-gray-100 group-hover:bg-primary-100 transition-colors">
                            <svg className="w-4 h-4 text-gray-600 group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                          </div>
                          <span className="font-medium">Manage Users</span>
                        </Link>
                        <button
                          onClick={() => {
                            setShowUserMenu(false)
                            // TODO: Navigate to settings when implemented
                          }}
                          className="w-full flex items-center space-x-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors rounded-lg mx-2 group"
                        >
                          <div className="p-1.5 rounded-lg bg-gray-100 group-hover:bg-primary-100 transition-colors">
                            <svg className="w-4 h-4 text-gray-600 group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <span className="font-medium">Settings</span>
                        </button>
                      </div>
                    </>
                  )}

                  {/* Logout */}
                  <div className="border-t border-gray-200 mt-2"></div>
                  <button
                    onClick={() => {
                      setShowUserMenu(false)
                      handleLogout()
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors rounded-lg mx-2 mb-2 group"
                  >
                    <div className="p-1.5 rounded-lg bg-red-100 group-hover:bg-red-200 transition-colors">
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </div>
                    <span className="font-medium">Logout</span>
                  </button>
                </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

