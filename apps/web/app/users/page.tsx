'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import AppHeader from '../components/AppHeader'
import { api } from '../../lib/api'

interface User {
  id: string
  name: string
  email: string
  role: string | null
  avatar: string | null
  jobRole: string | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface Stats {
  total: number
  active: number
  inactive: number
}

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0 })
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Modal states
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Add user form state
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    jobRole: '',
    predefinedRole: '',
  })

  // Permissions state
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({
    projects: { addEdit: false, delete: false },
    repositories: { addEdit: false, delete: false },
    testSuites: { addEdit: false, delete: false },
    testCases: { addEdit: false, delete: false },
    testPlans: { addEdit: false, delete: false },
    testRuns: { addEdit: false, delete: false },
    documents: { addEdit: false, delete: false },
    userManagement: { manage: false },
    systemSettings: { access: false, manageMenu: false },
  })
  
  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Check authentication and admin status
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/')
        return
      }

      try {
        const response = await api.get('/auth/verify')
        const user = response.data?.data?.user
        
        if (!user) {
          setError('User data not found. Please try logging in again.')
          setIsAdmin(false)
          return
        }
        
        const userRole = user.role
        console.log('User role from verify:', userRole)
        
        if (userRole !== 'admin') {
          setError(`Access denied. Your role is "${userRole || 'none'}". Only administrators can access this page.`)
          setIsAdmin(false)
          return
        }
        
        setIsAdmin(true)
        setIsLoading(false)
      } catch (err: any) {
        console.error('Auth verification error:', err)
        console.error('Error details:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
          code: err.code
        })
        
        if (err.response?.status === 401 || err.response?.status === 403) {
          // Clear token and redirect to login
          localStorage.removeItem('token')
          router.push('/')
        } else if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
          setError('Network error. Please check your connection and try again.')
          setIsAdmin(false)
        } else {
          // Show more specific error message
          const errorMessage = err.response?.data?.error?.message || 
                              err.message || 
                              'Failed to verify access. Please try logging in again.'
          setError(errorMessage)
          setIsAdmin(false)
        }
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router])

  // Fetch users with current filters
  useEffect(() => {
    if (!isAdmin) return

    const fetchUsers = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const params: any = {
          page: pagination.page,
          limit: pagination.limit,
          sortBy,
          sortOrder,
        }

        if (search.trim()) {
          params.search = search.trim()
        }

        if (statusFilter !== 'all') {
          params.isActive = statusFilter === 'active'
        }

        if (roleFilter !== 'all') {
          params.role = roleFilter
        }

        const response = await api.get('/users', { params })
        
        if (response.data?.data) {
          setUsers(response.data.data.users || [])
          setStats(response.data.data.stats || { total: 0, active: 0, inactive: 0 })
          setPagination(prev => ({
            ...prev,
            total: response.data.data.pagination?.total || 0,
            totalPages: response.data.data.pagination?.totalPages || 0,
          }))
        }
      } catch (err: any) {
        console.error('Fetch users error:', err)
        if (err.response?.status === 403) {
          setError('Access denied. Only administrators can access this page.')
          setIsAdmin(false)
          setTimeout(() => router.push('/dashboard'), 2000)
        } else if (err.response?.status === 401) {
          localStorage.removeItem('token')
          router.push('/')
        } else {
          setError(err.response?.data?.error?.message || 'Failed to fetch users')
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsers()
  }, [isAdmin, pagination.page, pagination.limit, search, statusFilter, roleFilter, sortBy, sortOrder, router])

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePageSizeChange = (newLimit: number) => {
    setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleApplyFilters = () => {
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handleClearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setRoleFilter('all')
    setSortBy('createdAt')
    setSortOrder('desc')
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  // Handle Add User
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    // Validate password match
    if (newUser.password !== newUser.confirmPassword) {
      setError('Passwords do not match')
      setIsSubmitting(false)
      return
    }

    // Validate password length (matching mockup requirement)
    if (newUser.password.length < 6) {
      setError('Password must be at least 6 characters long')
      setIsSubmitting(false)
      return
    }

    try {
      const response = await api.post('/users/register', {
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        jobRole: newUser.jobRole || undefined,
      })

      if (response.data?.data?.user) {
        // TODO: Assign role and permissions when backend endpoints are ready
        // For now, user is created without role/permissions
        
        // Close modal and reset form
        setShowAddUserModal(false)
        setNewUser({ name: '', email: '', password: '', confirmPassword: '', jobRole: '', predefinedRole: '' })
        setPermissions({
          projects: { addEdit: false, delete: false },
          repositories: { addEdit: false, delete: false },
          testSuites: { addEdit: false, delete: false },
          testCases: { addEdit: false, delete: false },
          testPlans: { addEdit: false, delete: false },
          testRuns: { addEdit: false, delete: false },
          documents: { addEdit: false, delete: false },
          userManagement: { manage: false },
          systemSettings: { access: false, manageMenu: false },
        })
        setError(null)
        
        // Refresh user list by resetting to page 1
        setPagination(prev => ({ ...prev, page: 1 }))
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create user')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle permission toggle
  const togglePermission = (category: string, permission: string) => {
    setPermissions(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [permission]: !prev[category][permission],
      },
    }))
  }

  // Handle predefined role selection
  const handlePredefinedRoleChange = (role: string) => {
    setNewUser(prev => ({ ...prev, predefinedRole: role }))
    
    // Configure permissions based on selected role
    switch (role) {
      case 'admin':
        // Admin: Check all checkboxes
        setPermissions({
          projects: { addEdit: true, delete: true },
          repositories: { addEdit: true, delete: true },
          testSuites: { addEdit: true, delete: true },
          testCases: { addEdit: true, delete: true },
          testPlans: { addEdit: true, delete: true },
          testRuns: { addEdit: true, delete: true },
          documents: { addEdit: true, delete: true },
          userManagement: { manage: true },
          systemSettings: { access: true, manageMenu: true },
        })
        break
        
      case 'manager':
        // Manager: Check all but NOT "Manage Users"
        setPermissions({
          projects: { addEdit: true, delete: true },
          repositories: { addEdit: true, delete: true },
          testSuites: { addEdit: true, delete: true },
          testCases: { addEdit: true, delete: true },
          testPlans: { addEdit: true, delete: true },
          testRuns: { addEdit: true, delete: true },
          documents: { addEdit: true, delete: true },
          userManagement: { manage: false },
          systemSettings: { access: true, manageMenu: true },
        })
        break
        
      case 'tester':
        // Tester: Check all "Add & Edit" checkboxes AND "Delete" for Test Suites, Test Cases, Test Plans, Test Runs, Documents
        setPermissions({
          projects: { addEdit: true, delete: false },
          repositories: { addEdit: true, delete: false },
          testSuites: { addEdit: true, delete: true },
          testCases: { addEdit: true, delete: true },
          testPlans: { addEdit: true, delete: true },
          testRuns: { addEdit: true, delete: true },
          documents: { addEdit: true, delete: true },
          userManagement: { manage: false },
          systemSettings: { access: false, manageMenu: false },
        })
        break
        
      case 'developer':
        // Developer: Check only Documents "Add & Edit" and "Delete"
        setPermissions({
          projects: { addEdit: false, delete: false },
          repositories: { addEdit: false, delete: false },
          testSuites: { addEdit: false, delete: false },
          testCases: { addEdit: false, delete: false },
          testPlans: { addEdit: false, delete: false },
          testRuns: { addEdit: false, delete: false },
          documents: { addEdit: true, delete: true },
          userManagement: { manage: false },
          systemSettings: { access: false, manageMenu: false },
        })
        break
        
      case 'guest':
        // Guest: Only can view. Not add/Edit (all unchecked)
        setPermissions({
          projects: { addEdit: false, delete: false },
          repositories: { addEdit: false, delete: false },
          testSuites: { addEdit: false, delete: false },
          testCases: { addEdit: false, delete: false },
          testPlans: { addEdit: false, delete: false },
          testRuns: { addEdit: false, delete: false },
          documents: { addEdit: false, delete: false },
          userManagement: { manage: false },
          systemSettings: { access: false, manageMenu: false },
        })
        break
        
      default:
        // Reset to all unchecked if no role or empty
        resetPermissions()
    }
  }

  // Toggle all permissions
  const toggleAllPermissions = () => {
    const allSelected = Object.values(permissions).every(cat => 
      Object.values(cat).every(val => val === true)
    )
    
    setPermissions({
      projects: { addEdit: !allSelected, delete: !allSelected },
      repositories: { addEdit: !allSelected, delete: !allSelected },
      testSuites: { addEdit: !allSelected, delete: !allSelected },
      testCases: { addEdit: !allSelected, delete: !allSelected },
      testPlans: { addEdit: !allSelected, delete: !allSelected },
      testRuns: { addEdit: !allSelected, delete: !allSelected },
      documents: { addEdit: !allSelected, delete: !allSelected },
      userManagement: { manage: !allSelected },
      systemSettings: { access: !allSelected, manageMenu: !allSelected },
    })
  }

  // Reset permissions
  const resetPermissions = () => {
    setPermissions({
      projects: { addEdit: false, delete: false },
      repositories: { addEdit: false, delete: false },
      testSuites: { addEdit: false, delete: false },
      testCases: { addEdit: false, delete: false },
      testPlans: { addEdit: false, delete: false },
      testRuns: { addEdit: false, delete: false },
      documents: { addEdit: false, delete: false },
      userManagement: { manage: false },
      systemSettings: { access: false, manageMenu: false },
    })
    setNewUser(prev => ({ ...prev, predefinedRole: '' }))
  }

  // Count selected permissions
  const selectedPermissionsCount = Object.values(permissions).reduce((total, cat) => {
    return total + Object.values(cat).filter(val => val === true).length
  }, 0)


  // Get unique roles from users
  const availableRoles = useMemo(() => {
    const roles = new Set<string>()
    users.forEach(user => {
      if (user.role) {
        roles.add(user.role)
      }
    })
    return Array.from(roles).sort()
  }, [users])

  // Mask email for privacy
  const maskEmail = (email: string): string => {
    const [localPart, domain] = email.split('@')
    if (localPart.length <= 2) {
      return `${localPart[0]}***@${domain}`
    }
    const visibleStart = localPart[0]
    const visibleEnd = localPart[localPart.length - 1]
    return `${visibleStart}***${visibleEnd}@${domain}`
  }

  // Get user initials for avatar
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  if (!isAdmin && !error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-2 text-gray-600">Verifying access...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Title and Stats */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
              <p className="text-gray-600">Manage user access, roles, and permissions</p>
            </div>
            <div className="flex items-center gap-4 mt-4 sm:mt-0">
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-sm text-gray-500">Total</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">{stats.active}</div>
                <div className="text-sm text-gray-500">Active</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-red-600">{stats.inactive}</div>
                <div className="text-sm text-gray-500">Inactive</div>
              </div>
              <button
                onClick={() => setShowAddUserModal(true)}
                className="ml-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                Add User
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="space-y-4">
            {/* Search Bar */}
            <div>
              <input
                type="text"
                placeholder="Search by name, email, or role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
              />
            </div>

            {/* Filter Row */}
            <div className="flex flex-wrap gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
              >
                <option value="all">All Roles</option>
                {availableRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>

              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-')
                  setSortBy(field)
                  setSortOrder(order as 'asc' | 'desc')
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
              >
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="email-asc">Email (A-Z)</option>
                <option value="email-desc">Email (Z-A)</option>
              </select>

              <div className="flex gap-2 ml-auto">
                <button
                  onClick={handleApplyFilters}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  Apply Filters
                </button>
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="mt-4 text-gray-600">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="text-lg font-medium">No users found</p>
              <p className="text-sm mt-2">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        See Detail
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {user.avatar ? (
                              <img
                                className="h-10 w-10 rounded-full object-cover"
                                src={user.avatar.startsWith('http') || user.avatar.startsWith('/') ? user.avatar : `/uploads/avatars/${user.avatar}`}
                                alt={user.name}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.style.display = 'none'
                                  const parent = target.parentElement
                                  if (parent) {
                                    const fallback = document.createElement('div')
                                    fallback.className = 'h-10 w-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center border-2 border-primary-200'
                                    fallback.textContent = getInitials(user.name)
                                    parent.appendChild(fallback)
                                  }
                                }}
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center border-2 border-primary-200">
                                <span className="text-white text-sm font-semibold">
                                  {getInitials(user.name)}
                                </span>
                              </div>
                            )}
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900">{user.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.role ? (
                            <span className="px-3 py-1 inline-flex text-xs font-medium rounded-full bg-primary-100 text-primary-800">
                              {user.role}
                            </span>
                          ) : (
                            <span className="px-3 py-1 inline-flex text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                              No role
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600 font-mono">
                            {maskEmail(user.email)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 inline-flex text-xs font-medium rounded-full ${
                              user.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => router.push(`/users/${user.id}`)}
                            className="text-primary-600 hover:text-primary-800 font-medium transition-colors"
                          >
                            See Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {(pagination.totalPages > 1 || pagination.total > 0) && (
                <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row items-center justify-between border-t border-gray-200 gap-4">
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-gray-700">
                      Showing{' '}
                      <span className="font-medium">
                        {(pagination.page - 1) * pagination.limit + 1}
                      </span>{' '}
                      to{' '}
                      <span className="font-medium">
                        {Math.min(pagination.page * pagination.limit, pagination.total)}
                      </span>{' '}
                      of <span className="font-medium">{pagination.total}</span> results
                    </p>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Show:</label>
                      <select
                        value={pagination.limit}
                        onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                        className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      >
                        <option value={10}>10</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>
                  {pagination.totalPages > 1 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page === 1}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                          let pageNum: number
                          if (pagination.totalPages <= 7) {
                            pageNum = i + 1
                          } else if (pagination.page <= 4) {
                            pageNum = i + 1
                          } else if (pagination.page >= pagination.totalPages - 3) {
                            pageNum = pagination.totalPages - 6 + i
                          } else {
                            pageNum = pagination.page - 3 + i
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                                pagination.page === pageNum
                                  ? 'bg-primary-600 text-white'
                                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50 bg-white'
                              }`}
                            >
                              {pageNum}
                            </button>
                          )
                        })}
                      </div>
                      <button
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page === pagination.totalPages}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Create user</h2>
              <button
                onClick={() => {
                  setShowAddUserModal(false)
                  setNewUser({ name: '', email: '', password: '', confirmPassword: '', jobRole: '', predefinedRole: '' })
                  resetPermissions()
                  setError(null)
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content - Two Columns */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-x divide-gray-200">
                {/* Left Column: User Details */}
                <div className="p-6">
                  <form onSubmit={handleAddUser} className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                        Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        required
                        value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        placeholder="Enter full name"
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        id="email"
                        required
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        placeholder="user@example.com"
                      />
                    </div>

                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                        Password *
                      </label>
                      <input
                        type="password"
                        id="password"
                        required
                        minLength={6}
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        placeholder="Enter password"
                      />
                      <p className="mt-1 text-xs text-gray-500">Password must be at least 6 characters long.</p>
                    </div>

                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm Password *
                      </label>
                      <input
                        type="password"
                        id="confirmPassword"
                        required
                        minLength={6}
                        value={newUser.confirmPassword}
                        onChange={(e) => setNewUser({ ...newUser, confirmPassword: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                        placeholder="Confirm password"
                      />
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                        {error}
                      </div>
                    )}

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddUserModal(false)
                          setNewUser({ name: '', email: '', password: '', confirmPassword: '', jobRole: '', predefinedRole: '' })
                          resetPermissions()
                          setError(null)
                        }}
                        className="flex-1 px-4 py-2 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? 'Creating...' : 'Create User'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Right Column: Role & Permissions */}
                <div className="p-6 bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Role & Permissions</h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={resetPermissions}
                        className="px-3 py-1.5 text-sm border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={toggleAllPermissions}
                        className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        Toggle All
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mb-6">{selectedPermissionsCount} permissions selected</p>

                  {/* Predefined Role */}
                  <div className="mb-6">
                    <label htmlFor="predefinedRole" className="block text-sm font-medium text-gray-700 mb-2">
                      Predefined Role
                    </label>
                    <select
                      id="predefinedRole"
                      value={newUser.predefinedRole}
                      onChange={(e) => handlePredefinedRoleChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
                    >
                      <option value="">Choose a role template...</option>
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="tester">Tester</option>
                      <option value="developer">Developer</option>
                      <option value="guest">Guest</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Selecting a role will automatically configure permissions. You can customize them below.
                    </p>
                  </div>

                  {/* Custom Permissions */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Custom Permissions</label>
                    
                    {/* Content Management */}
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-blue-600 mb-3">Content Management</h4>
                      <div className="space-y-3">
                        {['projects', 'repositories', 'testSuites', 'testCases', 'testPlans', 'testRuns', 'documents'].map((item) => (
                          <div key={item} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                            <span className="text-sm font-medium text-gray-700 capitalize">{item.replace(/([A-Z])/g, ' $1').trim()}</span>
                            <div className="flex gap-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={permissions[item]?.addEdit || false}
                                  onChange={() => togglePermission(item, 'addEdit')}
                                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                />
                                <span className="text-xs text-gray-600">Add & Edit</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={permissions[item]?.delete || false}
                                  onChange={() => togglePermission(item, 'delete')}
                                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                />
                                <span className="text-xs text-gray-600">Delete</span>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* System Administration */}
                    <div>
                      <h4 className="text-sm font-semibold text-yellow-600 mb-3">System Administration</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                          <span className="text-sm font-medium text-gray-700">User Management</span>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={permissions.userManagement?.manage || false}
                              onChange={() => togglePermission('userManagement', 'manage')}
                              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                            />
                            <span className="text-xs text-gray-600">Manage Users</span>
                          </label>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                          <span className="text-sm font-medium text-gray-700">System Settings</span>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={permissions.systemSettings?.access || false}
                                onChange={() => togglePermission('systemSettings', 'access')}
                                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                              />
                              <span className="text-xs text-gray-600">Access Settings</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={permissions.systemSettings?.manageMenu || false}
                                onChange={() => togglePermission('systemSettings', 'manageMenu')}
                                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                              />
                              <span className="text-xs text-gray-600">Manage Menu Visibility</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
