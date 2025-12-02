'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '../../components/AppHeader'
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
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [activities, setActivities] = useState<any[]>([])
  const [isLoadingActivities, setIsLoadingActivities] = useState(false)
  const [activitiesPage, setActivitiesPage] = useState(1)
  const [activitiesLimit, setActivitiesLimit] = useState(5)
  const [activitiesTotal, setActivitiesTotal] = useState(0)
  const [activitiesTotalPages, setActivitiesTotalPages] = useState(0)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
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

  const [predefinedRole, setPredefinedRole] = useState('')

  // Handle predefined role selection
  const handlePredefinedRoleChange = (role: string) => {
    if (role) {
      setPredefinedRole(role)
    }
    
    // Configure permissions based on selected role
    switch (role) {
      case 'admin':
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
    }
  }

  // Fetch user data
  const fetchUser = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await api.get(`/users/${userId}`)
      
      if (response.data?.data?.user) {
        const userData = response.data.data.user
        setUser(userData)
        setFormData({
          name: userData.name,
          email: userData.email,
          password: '',
        })
        const userRole = userData.role || ''
        setPredefinedRole(userRole)
        // Auto-configure permissions based on role
        if (userRole) {
          handlePredefinedRoleChange(userRole)
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch user')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch current user
  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/users/me')
      if (response.data?.data?.user) {
        setCurrentUser(response.data.data.user)
      }
    } catch (err) {
      console.error('Error fetching current user:', err)
    }
  }

  // Helper function to format relative time
  const formatRelativeTime = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
      
      if (diffInSeconds < 60) return 'Just now'
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
      if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`
      if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} weeks ago`
      if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`
      return `${Math.floor(diffInSeconds / 31536000)} years ago`
    } catch {
      return 'Unknown'
    }
  }

  // Format activity for display with detailed information
  const formatActivity = (activity: any) => {
    const action = activity.action
    const feature = activity.modelType || 'user'
    let title = ''
    let icon = 'circle'
    let details: string[] = []
    let changedFields: string[] = []

    // Extract details from oldValues and newValues
    const oldValues = activity.oldValues || {}
    const newValues = activity.newValues || {}

    // Determine title, icon, and details based on action and feature
    if (feature === 'user' && action === 'created') {
      title = 'Created user'
      icon = 'circle'
      if (newValues.name || newValues.email) {
        details.push(`User: ${newValues.name || newValues.email || 'Unknown'}`)
      }
    } else if (feature === 'user_profile' && action === 'uploaded_avatar') {
      title = 'Updated profile photo'
      icon = 'user-gear'
    } else if (feature === 'user_profile' && action === 'removed_avatar') {
      title = 'Removed profile photo'
      icon = 'user-gear'
    } else if (feature === 'user' && action === 'updated') {
      title = 'Updated user'
      icon = 'circle'
      
      // Show which user was updated
      if (newValues.name || oldValues.name) {
        const userName = newValues.name || oldValues.name
        details.push(`User: ${userName}`)
      } else if (newValues.email || oldValues.email) {
        const userEmail = newValues.email || oldValues.email
        details.push(`User: ${userEmail}`)
      }

      // Show what changed
      if (oldValues.name && newValues.name && oldValues.name !== newValues.name) {
        changedFields.push(`Name: "${oldValues.name}" → "${newValues.name}"`)
      }
      if (oldValues.email && newValues.email && oldValues.email !== newValues.email) {
        changedFields.push(`Email: "${oldValues.email}" → "${newValues.email}"`)
      }
      if (oldValues.role && newValues.role && oldValues.role !== newValues.role) {
        changedFields.push(`Role: "${oldValues.role}" → "${newValues.role}"`)
      }
      if (oldValues.jobRole !== undefined && newValues.jobRole !== undefined && oldValues.jobRole !== newValues.jobRole) {
        changedFields.push(`Job Role: "${oldValues.jobRole || 'None'}" → "${newValues.jobRole || 'None'}"`)
      }
      if (oldValues.isActive !== undefined && newValues.isActive !== undefined && oldValues.isActive !== newValues.isActive) {
        changedFields.push(`Status: ${oldValues.isActive ? 'Active' : 'Inactive'} → ${newValues.isActive ? 'Active' : 'Inactive'}`)
      }
    } else if (feature === 'user' && action === 'deactivated_user') {
      title = 'User deactivated'
      icon = 'circle'
      // Show user details from oldValues/newValues
      if (newValues.name || oldValues.name) {
        const userName = newValues.name || oldValues.name
        const userEmail = newValues.email || oldValues.email
        if (userEmail) {
          details.push(`User: ${userName} (${userEmail})`)
        } else {
          details.push(`User: ${userName}`)
        }
      } else if (newValues.email || oldValues.email) {
        details.push(`User: ${newValues.email || oldValues.email}`)
      } else if (activity.modelId) {
        details.push(`User ID: ${activity.modelId}`)
      }
      if (oldValues.isActive !== undefined) {
        details.push('Status changed from Active to Inactive')
      }
    } else if (feature === 'user' && action === 'activated_user') {
      title = 'User activated'
      icon = 'circle'
      // Show user details from oldValues/newValues
      if (newValues.name || oldValues.name) {
        const userName = newValues.name || oldValues.name
        const userEmail = newValues.email || oldValues.email
        if (userEmail) {
          details.push(`User: ${userName} (${userEmail})`)
        } else {
          details.push(`User: ${userName}`)
        }
      } else if (newValues.email || oldValues.email) {
        details.push(`User: ${newValues.email || oldValues.email}`)
      } else if (activity.modelId) {
        details.push(`User ID: ${activity.modelId}`)
      }
      if (oldValues.isActive !== undefined) {
        details.push('Status changed from Inactive to Active')
      }
    } else {
      title = `${action} ${feature}`
    }

    return {
      ...activity,
      title,
      icon,
      details,
      changedFields,
    }
  }

  // Fetch user details by ID (for activity details)
  const fetchUserById = async (userId: string): Promise<{ name?: string; email?: string } | null> => {
    try {
      const response = await api.get(`/users/${userId}`)
      if (response.data?.data?.user) {
        return {
          name: response.data.data.user.name,
          email: response.data.data.user.email,
        }
      }
    } catch (err) {
      console.error('Error fetching user details:', err)
    }
    return null
  }

  // Fetch activities for the user
  const fetchActivities = async (page?: number, limit?: number) => {
    const pageNum = page ?? activitiesPage
    const limitNum = limit ?? activitiesLimit
    setIsLoadingActivities(true)
    try {
      const response = await api.get(`/users/${userId}/activities`, {
        params: {
          page: pageNum,
          limit: limitNum,
        },
      })
      if (response.data?.data) {
        let formattedActivities = response.data.data.activities.map(formatActivity)
        
        // Note: User details are now extracted from oldValues/newValues in formatActivity
        // Only fetch if details are missing (fallback)
        formattedActivities = await Promise.all(
          formattedActivities.map(async (activity: any) => {
            // If it's a deactivate/activate action and we don't have user details, fetch them
            if (
              (activity.action === 'deactivated_user' || activity.action === 'activated_user') &&
              activity.modelId &&
              (!activity.details || activity.details.length === 0 || activity.details[0].startsWith('User ID:'))
            ) {
              const userDetails = await fetchUserById(activity.modelId)
              if (userDetails) {
                const userInfo = userDetails.name 
                  ? `${userDetails.name} (${userDetails.email})`
                  : userDetails.email || 'Unknown user'
                activity.details = [`User: ${userInfo}`]
              }
            }
            return activity
          })
        )
        
        setActivities(formattedActivities)
        if (response.data.data.pagination) {
          setActivitiesTotal(response.data.data.pagination.total)
          setActivitiesTotalPages(response.data.data.pagination.totalPages)
          setActivitiesPage(pageNum)
          setActivitiesLimit(limitNum)
        }
      }
    } catch (err: any) {
      console.error('Error fetching activities:', err)
      // Don't show error to user, just log it
    } finally {
      setIsLoadingActivities(false)
    }
  }

  // Handle page size change
  const handlePageSizeChange = (newLimit: number) => {
    setActivitiesLimit(newLimit)
    setActivitiesPage(1) // Reset to first page when changing page size
    fetchActivities(1, newLimit)
  }

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setActivitiesPage(newPage)
    fetchActivities(newPage, activitiesLimit)
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    fetchCurrentUser()
    fetchUser()
    fetchActivities(1, 5) // Initial load: page 1, limit 5
  }, [userId])

  // Toggle permission
  const togglePermission = (category: string, permission: string) => {
    setPermissions(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [permission]: !prev[category][permission],
      },
    }))
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
    if (user) {
      setPredefinedRole(user.role || '')
      handlePredefinedRoleChange(user.role || '')
    }
  }

  // Count selected permissions
  const selectedPermissionsCount = Object.values(permissions).reduce((total, cat) => {
    return total + Object.values(cat).filter(val => val === true).length
  }, 0)

  // Generate random password
  const generatePassword = () => {
    const length = 12
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    setFormData(prev => ({ ...prev, password }))
  }


  // Handle save
  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // Update user profile
      const updateData: any = {}
      if (formData.name !== user?.name) {
        updateData.name = formData.name
      }
      if (formData.email !== user?.email) {
        updateData.email = formData.email
      }
      if (predefinedRole !== user?.role) {
        updateData.role = predefinedRole || null
      }

      if (Object.keys(updateData).length > 0) {
        await api.patch(`/users/${userId}`, updateData)
      }

      // Update password if provided
      if (formData.password && formData.password.length >= 6) {
        // TODO: Add endpoint to update user password by admin
        // For now, we'll need to add this endpoint
        console.log('Password update would be handled here')
      }

      // Convert permissions to permission names array
      const permissionNames: string[] = []
      
      // Content Management permissions
      if (permissions.projects?.addEdit) permissionNames.push('projects.add_edit')
      if (permissions.projects?.delete) permissionNames.push('projects.delete')
      if (permissions.repositories?.addEdit) permissionNames.push('repositories.add_edit')
      if (permissions.repositories?.delete) permissionNames.push('repositories.delete')
      if (permissions.testSuites?.addEdit) permissionNames.push('test_suites.add_edit')
      if (permissions.testSuites?.delete) permissionNames.push('test_suites.delete')
      if (permissions.testCases?.addEdit) permissionNames.push('test_cases.add_edit')
      if (permissions.testCases?.delete) permissionNames.push('test_cases.delete')
      if (permissions.testPlans?.addEdit) permissionNames.push('test_plans.add_edit')
      if (permissions.testPlans?.delete) permissionNames.push('test_plans.delete')
      if (permissions.testRuns?.addEdit) permissionNames.push('test_runs.add_edit')
      if (permissions.testRuns?.delete) permissionNames.push('test_runs.delete')
      if (permissions.documents?.addEdit) permissionNames.push('documents.add_edit')
      if (permissions.documents?.delete) permissionNames.push('documents.delete')
      
      // System Administration permissions
      if (permissions.userManagement?.manage) permissionNames.push('user_management.manage')
      if (permissions.systemSettings?.access) permissionNames.push('system_settings.access')
      if (permissions.systemSettings?.manageMenu) permissionNames.push('system_settings.manage_menu')

      // Update permissions via API
      if (permissionNames.length > 0 || Object.keys(permissions).length > 0) {
        try {
          await api.post(`/users/${userId}/permissions`, {
            permissions: permissionNames,
          })
        } catch (permErr: any) {
          console.error('Failed to update permissions:', permErr)
          // Don't fail the whole update if permissions fail
        }
      }

      setSuccess('User updated successfully')
      setTimeout(async () => {
        await fetchUser() // Refresh user data
        await fetchActivities(activitiesPage, activitiesLimit) // Refresh activities with current pagination
        setSuccess(null)
      }, 2000)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update user')
    } finally {
      setIsSaving(false)
    }
  }

  // Open confirmation modal
  const openConfirmModal = () => {
    // Check if trying to deactivate self - use string comparison for reliability
    const isSelf = currentUser?.id && userId ? String(currentUser.id) === String(userId) : false
    
    if (isSelf && user?.isActive) {
      setError('You cannot deactivate your own account')
      setTimeout(() => setError(null), 5000)
      return
    }

    // Double-check: prevent if button is disabled
    if (isCurrentUser && user?.isActive) {
      setError('You cannot deactivate your own account')
      setTimeout(() => setError(null), 5000)
      return
    }

    setShowConfirmModal(true)
  }

  // Handle deactivate/activate confirmation
  const handleDeactivate = async () => {
    setIsDeactivating(true)
    setShowConfirmModal(false)
    setError(null)

    try {
      if (user?.isActive) {
        await api.post(`/users/${userId}/deactivate`)
      } else {
        await api.post(`/users/${userId}/activate`)
      }
      await fetchUser() // Refresh user data
      await fetchActivities(activitiesPage, activitiesLimit) // Refresh activities with current pagination
      setSuccess(`User ${user?.isActive ? 'deactivated' : 'activated'} successfully`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || 'Failed to update user status'
      setError(errorMessage)
      setTimeout(() => setError(null), 5000)
    } finally {
      setIsDeactivating(false)
    }
  }

  // Check if current user is viewing their own profile
  const isCurrentUser = currentUser?.id === userId

  // Get user initials
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

  if (error && !user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
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

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="mb-4">
          <nav className="text-sm text-gray-600">
            <Link href="/users" className="hover:text-primary-600">Users</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">Edit User</span>
          </nav>
        </div>

        {/* Header Section */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-4">
            {user.avatar ? (
              <img
                className="h-16 w-16 rounded-full object-cover border-2 border-gray-200"
                src={user.avatar.startsWith('http') || user.avatar.startsWith('/') ? user.avatar : `/uploads/avatars/${user.avatar}`}
                alt={user.name}
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center border-2 border-gray-200">
                <span className="text-white text-xl font-semibold">
                  {getInitials(user.name)}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Edit User</h1>
              <p className="text-gray-600">
                {user.name} ({user.email})
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={(e) => {
                // Prevent click if disabled
                if (isCurrentUser && user?.isActive) {
                  e.preventDefault()
                  e.stopPropagation()
                  setError('You cannot deactivate your own account')
                  setTimeout(() => setError(null), 5000)
                  return
                }
                openConfirmModal()
              }}
              disabled={(isCurrentUser && user?.isActive) || isDeactivating}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isCurrentUser && user?.isActive
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50 pointer-events-none'
                  : user?.isActive
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
              title={isCurrentUser && user?.isActive ? 'You cannot deactivate your own account' : ''}
            >
              {isDeactivating ? 'Processing...' : user?.isActive ? 'Deactivate' : 'Activate'}
            </button>
            <Link
              href="/users"
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Back to Users
            </Link>
          </div>
        </div>

        {/* User Profile Summary */}
        <div className="flex items-center gap-6 mb-6 pb-4 border-b border-gray-200">
          <div>
            <span className="text-sm text-gray-500">Status</span>
            <div>
              <span
                className={`px-3 py-1 text-sm font-semibold rounded-full ${
                  user.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {user.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <div>
            <span className="text-sm text-gray-500">User ID</span>
            <div className="text-sm font-medium text-gray-900">#{user.id}</div>
          </div>
          <div>
            <span className="text-sm text-gray-500">Created</span>
            <div className="text-sm font-medium text-gray-900">{formatDate(user.createdAt)}</div>
          </div>
          <div>
            <span className="text-sm text-gray-500">Current Role</span>
            <div>
              {user.role ? (
                <span className="px-3 py-1 text-sm font-semibold rounded-full bg-primary-100 text-primary-800">
                  {user.role}
                </span>
              ) : (
                <span className="text-sm text-gray-500">No role</span>
              )}
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: User Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">User Information</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  disabled={!permissions.userManagement?.manage}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none ${
                    !permissions.userManagement?.manage ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
                  }`}
                />
              </div>

              <div>
                <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="edit-email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  disabled={!permissions.userManagement?.manage}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none ${
                    !permissions.userManagement?.manage ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
                  }`}
                />
              </div>

              <div>
                <label htmlFor="edit-password" className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="edit-password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    disabled={!permissions.userManagement?.manage}
                    className={`w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none ${
                      !permissions.userManagement?.manage ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
                    }`}
                    placeholder="Leave empty to keep current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <svg
                      className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      {showPassword ? (
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
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Minimum 6 characters. Leave empty to keep current password.
                </p>
              </div>

              {/* Quick Actions */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h3>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="px-4 py-2 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors font-medium text-sm"
                  >
                    Generate New Password
                  </button>

                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Role & Permissions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Role & Permissions</h2>
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
              <label htmlFor="edit-predefinedRole" className="block text-sm font-medium text-gray-700 mb-2">
                Predefined Role
              </label>
              <select
                id="edit-predefinedRole"
                value={predefinedRole}
                onChange={(e) => handlePredefinedRoleChange(e.target.value)}
                disabled={!permissions.userManagement?.manage}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white ${
                  !permissions.userManagement?.manage ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
                }`}
              >
                <option value="">Choose a role template...</option>
                <option value="admin">Admin - Full system access</option>
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
                    <div key={item} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                      <span className="text-sm font-medium text-gray-700 capitalize">{item.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={permissions[item]?.addEdit || false}
                                onChange={() => togglePermission(item, 'addEdit')}
                                disabled={!permissions.userManagement?.manage}
                                className={`w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 ${
                                  !permissions.userManagement?.manage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                }`}
                              />
                              <span className={`text-xs ${!permissions.userManagement?.manage ? 'text-gray-400' : 'text-gray-600'}`}>Add & Edit</span>
                            </label>
                            <label className={`flex items-center gap-2 ${permissions.userManagement?.manage ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                              <input
                                type="checkbox"
                                checked={permissions[item]?.delete || false}
                                onChange={() => togglePermission(item, 'delete')}
                                disabled={!permissions.userManagement?.manage}
                                className={`w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 ${
                                  !permissions.userManagement?.manage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                }`}
                              />
                                <span className={`text-xs ${!permissions.userManagement?.manage ? 'text-gray-400' : 'text-gray-600'}`}>Delete</span>
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
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                    <span className="text-sm font-medium text-gray-700">User Management</span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions.userManagement?.manage || false}
                        onChange={() => togglePermission('userManagement', 'manage')}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 cursor-pointer"
                      />
                      <span className="text-xs text-gray-600">Manage Users</span>
                    </label>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                    <span className="text-sm font-medium text-gray-700">System Settings</span>
                    <div className="flex gap-4">
                      <label className={`flex items-center gap-2 ${permissions.userManagement?.manage ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                        <input
                          type="checkbox"
                          checked={permissions.systemSettings?.access || false}
                          onChange={() => togglePermission('systemSettings', 'access')}
                          disabled={!permissions.userManagement?.manage}
                          className={`w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 ${
                            !permissions.userManagement?.manage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        />
                        <span className={`text-xs ${!permissions.userManagement?.manage ? 'text-gray-400' : 'text-gray-600'}`}>Access Settings</span>
                      </label>
                      <label className={`flex items-center gap-2 ${permissions.userManagement?.manage ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                        <input
                          type="checkbox"
                          checked={permissions.systemSettings?.manageMenu || false}
                          onChange={() => togglePermission('systemSettings', 'manageMenu')}
                          disabled={!permissions.userManagement?.manage}
                          className={`w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 ${
                            !permissions.userManagement?.manage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        />
                        <span className={`text-xs ${!permissions.userManagement?.manage ? 'text-gray-400' : 'text-gray-600'}`}>Manage Menu Visibility</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-800">
                Recent Activities {user?.name && `(${user.name})`}
              </h3>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600">Show:</label>
                <select
                  value={activitiesLimit}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  disabled={isLoadingActivities}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <button
                onClick={() => fetchActivities(activitiesPage, activitiesLimit)}
                disabled={isLoadingActivities}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {isLoadingActivities ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="mt-2 text-sm text-gray-500">Loading activities...</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No activities yet</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {activities.map((activity, index) => (
                  <div key={activity.id} className="flex items-start space-x-4 relative">
                    {/* Timeline line */}
                    {index < activities.length - 1 && (
                      <div className="absolute left-5 top-12 w-0.5 h-full bg-gray-200"></div>
                    )}
                  
                  {/* Icon */}
                  <div className="relative z-10 flex-shrink-0">
                    {activity.icon === 'user-gear' ? (
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{activity.title || `${activity.action} ${activity.modelType || 'user'}`}</p>
                        
                        {/* Show user details */}
                        {activity.details && activity.details.length > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            {activity.details.map((detail: string, idx: number) => (
                              <p key={idx} className="text-xs font-medium text-gray-700">
                                {detail}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Show changed fields for updates */}
                        {activity.changedFields && activity.changedFields.length > 0 && (
                          <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                            <p className="text-xs font-semibold text-gray-600 mb-1">Changes:</p>
                            <ul className="space-y-0.5">
                              {activity.changedFields.map((field: string, idx: number) => (
                                <li key={idx} className="text-xs text-gray-600">
                                  • {field}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Metadata */}
                        <div className="mt-1.5 flex items-center space-x-2 text-xs text-gray-500">
                          <span>Action: <span className="text-blue-600">{activity.action}</span></span>
                          <span>•</span>
                          <span>Feature: <span className="text-blue-600">{activity.modelType || 'user'}</span></span>
                          {activity.modelId && (
                            <>
                              <span>•</span>
                              <span>ID: <span className="text-gray-400">{activity.modelId}</span></span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        <p className="text-xs text-gray-500 whitespace-nowrap">
                          {formatRelativeTime(activity.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                ))}
              </div>

              {/* Pagination */}
              {activitiesTotalPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      Showing {((activitiesPage - 1) * activitiesLimit) + 1} to {Math.min(activitiesPage * activitiesLimit, activitiesTotal)} of {activitiesTotal} activities
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePageChange(activitiesPage - 1)}
                      disabled={activitiesPage === 1 || isLoadingActivities}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(activitiesTotalPages, 7) }, (_, i) => {
                        let pageNum: number
                        if (activitiesTotalPages <= 7) {
                          pageNum = i + 1
                        } else if (activitiesPage <= 4) {
                          pageNum = i + 1
                        } else if (activitiesPage >= activitiesTotalPages - 3) {
                          pageNum = activitiesTotalPages - 6 + i
                        } else {
                          pageNum = activitiesPage - 3 + i
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            disabled={isLoadingActivities}
                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                              activitiesPage === pageNum
                                ? 'bg-primary-600 text-white'
                                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {pageNum}
                          </button>
                        )
                      })}
                    </div>
                    <button
                      onClick={() => handlePageChange(activitiesPage + 1)}
                      disabled={activitiesPage === activitiesTotalPages || isLoadingActivities}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Changes will be saved immediately and may affect user access.
          </p>
          <div className="flex gap-3">
            <Link
              href="/users"
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </Link>
            <button
              onClick={handleSave}
              disabled={isSaving || !permissions.userManagement?.manage}
              className={`px-4 py-2 bg-primary-600 text-white rounded-lg transition-colors font-medium ${
                !permissions.userManagement?.manage 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
              title={!permissions.userManagement?.manage ? 'User Management permission is required to save changes' : ''}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </main>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  user?.isActive ? 'bg-yellow-100' : 'bg-green-100'
                }`}>
                  {user?.isActive ? (
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  {user?.isActive ? 'Deactivate User' : 'Activate User'}
                </h2>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={isDeactivating}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Are you sure you want to <span className="font-semibold">{user?.isActive ? 'deactivate' : 'activate'}</span> this user?
              </p>
              {user && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex items-center space-x-3">
                    {user.avatar ? (
                      <img
                        className="h-10 w-10 rounded-full object-cover"
                        src={user.avatar.startsWith('http') || user.avatar.startsWith('/') ? user.avatar : `/uploads/avatars/${user.avatar}`}
                        alt={user.name}
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                        <span className="text-white text-sm font-semibold">
                          {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                </div>
              )}
              {user?.isActive && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-yellow-800">
                    <span className="font-semibold">Note:</span> Deactivated users will not be able to access the system until they are reactivated.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isDeactivating}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                disabled={isDeactivating}
                className={`px-4 py-2 rounded-lg font-medium transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                  user?.isActive
                    ? 'bg-yellow-500 hover:bg-yellow-600'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {isDeactivating ? (
                  <span className="flex items-center space-x-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Processing...</span>
                  </span>
                ) : (
                  user?.isActive ? 'Deactivate User' : 'Activate User'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
