'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import Link from 'next/link'
import AppHeader from '../components/AppHeader'
import { api } from '../../lib/api'

const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  jobRole: z.string().optional(),
  avatar: z.string().url().optional().or(z.literal('')),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type UpdateProfileFormData = z.infer<typeof updateProfileSchema>
type ChangePasswordFormData = z.infer<typeof changePasswordSchema>

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
  tenants?: Array<{
    id: string
    name: string
    slug: string
    plan: string
    status: string
    role: string
  }>
}

interface Activity {
  id: string
  title: string
  action: string
  feature: string
  modelId: string | null
  createdAt: string
  icon: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  })
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoadingActivities, setIsLoadingActivities] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false)

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors },
    reset: resetProfile,
  } = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: '',
      jobRole: '',
      avatar: '',
    },
  })

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
    reset: resetPassword,
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  })

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    fetchUser()
    fetchActivities()
  }, [])

  const fetchUser = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await api.get('/users/me')
      
      if (response.data?.data?.user) {
        const userData = response.data.data.user
        setUser(userData)
        // Reset form with user data - ensure we have valid values
        resetProfile({
          name: userData.name || '',
          jobRole: userData.jobRole || '',
        })
      } else {
        setError('User data not found in response')
      }
    } catch (err: any) {
      console.error('Error fetching user:', err)
      setError(err.response?.data?.error?.message || 'Failed to fetch user profile')
    } finally {
      setIsLoading(false)
    }
  }

  // Helper function to format dates safely
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  // Helper function to format relative time
  const formatRelativeTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      
      if (diffInSeconds < 60) return 'Just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
      if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
      if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
      if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
      return `${Math.floor(diffInSeconds / 31536000)} years ago`;
    } catch {
      return 'Unknown';
    }
  };

  const fetchActivities = async () => {
    setIsLoadingActivities(true)
    try {
      const response = await api.get('/users/me/activities')
      if (response.data?.data?.activities) {
        setActivities(response.data.data.activities)
      }
    } catch (err: any) {
      console.error('Error fetching activities:', err)
      // Don't show error to user, just log it
    } finally {
      setIsLoadingActivities(false)
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploadingAvatar(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const response = await api.post('/users/me/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      if (response.data?.data?.user) {
        setUser(response.data.data.user)
        setSuccess('Profile picture uploaded successfully')
        setTimeout(() => setSuccess(null), 3000)
        fetchActivities() // Refresh activities
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to upload profile picture')
    } finally {
      setIsUploadingAvatar(false)
      // Reset file input
      event.target.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    if (!confirm('Are you sure you want to remove your profile picture?')) {
      return
    }

    setIsRemovingAvatar(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await api.delete('/users/me/avatar')
      if (response.data?.data?.user) {
        setUser(response.data.data.user)
        setSuccess('Profile picture removed successfully')
        setTimeout(() => setSuccess(null), 3000)
        fetchActivities() // Refresh activities
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to remove profile picture')
    } finally {
      setIsRemovingAvatar(false)
    }
  }

  const onUpdateProfile = async (data: UpdateProfileFormData) => {
    setIsUpdating(true)
    setError(null)
    setSuccess(null)

    try {
      const updateData: any = {}
      if (data.name !== undefined) updateData.name = data.name || ''
      if (data.jobRole !== undefined) updateData.jobRole = data.jobRole || ''

      const response = await api.patch('/users/me', updateData)
      
      if (response.data?.data?.user) {
        setUser(response.data.data.user)
        setSuccess('Profile updated successfully')
        setTimeout(() => setSuccess(null), 3000)
        fetchActivities() // Refresh activities
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update profile')
    } finally {
      setIsUpdating(false)
    }
  }

  const onChangePassword = async (data: ChangePasswordFormData) => {
    setIsChangingPassword(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await api.post('/users/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      })
      
      setSuccess('Password changed successfully. Your current session remains active.')
      setShowPasswordForm(false)
      resetPassword()
      setTimeout(() => setSuccess(null), 5000)
      
      // Refresh activities to show the password change event
      fetchActivities()
    } catch (err: any) {
      // Check if it's a 401 error (unauthorized) - this shouldn't happen but handle it
      if (err.response?.status === 401) {
        setError('Your session expired. Please log in again.')
        // Don't automatically redirect - let user see the error
      } else {
        setError(err.response?.data?.error?.message || 'Failed to change password')
      }
    } finally {
      setIsChangingPassword(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-2 text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">My Profile</h2>
          <p className="text-gray-600">Manage your account settings and preferences</p>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
            {success}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Profile Information */}
        {user && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Profile Information</h3>
          
          {/* Profile Picture Section */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Profile Picture
            </label>
            <div className="flex items-center space-x-6">
              <div className="flex-shrink-0">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="h-24 w-24 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-full bg-primary-600 flex items-center justify-center border-2 border-gray-200">
                    <span className="text-white text-2xl font-medium">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-3">
                  <label className="cursor-pointer">
                    <span className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors inline-block">
                      {isUploadingAvatar ? 'Uploading...' : 'Upload Picture'}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={handleAvatarUpload}
                      disabled={isUploadingAvatar}
                      className="hidden"
                    />
                  </label>
                  {user.avatar && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={isRemovingAvatar}
                      className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRemovingAvatar ? 'Removing...' : 'Remove Picture'}
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  JPG, PNG, GIF or WEBP. Max size: 10MB
                </p>
              </div>
            </div>
          </div>
          
          <form onSubmit={handleSubmitProfile(onUpdateProfile)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              <input
                type="text"
                {...registerProfile('name')}
                defaultValue={user?.name || ''}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
              {profileErrors.name && (
                <p className="mt-1 text-sm text-red-600">{profileErrors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
              />
              <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Role
              </label>
              <input
                type="text"
                {...registerProfile('jobRole')}
                defaultValue={user?.jobRole || ''}
                placeholder="e.g., QA Engineer, Test Manager"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
              {profileErrors.jobRole && (
                <p className="mt-1 text-sm text-red-600">{profileErrors.jobRole.message}</p>
              )}
            </div>


            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isUpdating}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? 'Updating...' : 'Update Profile'}
              </button>
            </div>
          </form>
        </div>
        )}

        {/* Change Password */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Change Password</h3>
            <button
              onClick={() => {
                setShowPasswordForm(!showPasswordForm)
                if (showPasswordForm) {
                  resetPassword()
                  setError(null)
                }
              }}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              {showPasswordForm ? 'Cancel' : 'Change Password'}
            </button>
          </div>

          {showPasswordForm && (
            <form onSubmit={handleSubmitPassword(onChangePassword)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword.current ? 'text' : 'password'}
                    {...registerPassword('currentPassword')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => ({ ...prev, current: !prev.current }))}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword.current ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {passwordErrors.currentPassword && (
                  <p className="mt-1 text-sm text-red-600">{passwordErrors.currentPassword.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword.new ? 'text' : 'password'}
                    {...registerPassword('newPassword')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => ({ ...prev, new: !prev.new }))}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword.new ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {passwordErrors.newPassword && (
                  <p className="mt-1 text-sm text-red-600">{passwordErrors.newPassword.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword.confirm ? 'text' : 'password'}
                    {...registerPassword('confirmPassword')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => ({ ...prev, confirm: !prev.confirm }))}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword.confirm ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {passwordErrors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{passwordErrors.confirmPassword.message}</p>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isChangingPassword ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Account Information */}
        {user && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Account Information</h3>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Role</dt>
                <dd className="mt-1 text-sm text-gray-900">{user.role || 'No role assigned'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Email Verified</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {user.emailVerifiedAt ? formatDate(user.emailVerifiedAt) : 'Not verified'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last Login</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Password Changed</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {user.passwordChangedAt ? formatDate(user.passwordChangedAt) : 'Never'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Member Since</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatDate(user.createdAt)}
                </dd>
              </div>
            </dl>

            {user.tenants && user.tenants.length > 0 && (
              <div className="mt-6">
                <dt className="text-sm font-medium text-gray-500 mb-2">Tenants</dt>
                <div className="space-y-2">
                  {user.tenants.map((tenant) => (
                    <div key={tenant.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{tenant.name}</p>
                        <p className="text-xs text-gray-500">{tenant.slug} • {tenant.plan} plan</p>
                      </div>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-800">
                        {tenant.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recent Activities */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-800">Recent Activities</h3>
            </div>
            <div className="flex items-center space-x-2">
              <select className="text-sm border border-gray-300 rounded-lg px-3 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option>All Activities</option>
                <option>Profile Updates</option>
                <option>Avatar Changes</option>
              </select>
              <button
                onClick={fetchActivities}
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
                        <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Action: <span className="text-blue-600">{activity.action}</span> • Feature: <span className="text-blue-600">{activity.feature}</span>
                        </p>
                        {activity.modelId && (
                          <p className="text-xs text-gray-400 mt-1">ID: {activity.modelId}</p>
                        )}
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
          )}
        </div>
      </main>
    </div>
  )
}

