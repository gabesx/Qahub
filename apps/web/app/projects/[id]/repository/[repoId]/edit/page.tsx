'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '../../../../../components/AppHeader'
import { api } from '../../../../../../lib/api'

interface Project {
  id: string
  title: string
}

interface Repository {
  id: string
  title: string
  prefix: string
  description: string | null
  createdAt: string
  updatedAt: string
  counts: {
    testSuites: number
    testCases: number
    automatedTests: number
  }
}

export default function EditRepositoryPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const repoId = params.repoId as string

  const [project, setProject] = useState<Project | null>(null)
  const [repository, setRepository] = useState<Repository | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  
  const [formData, setFormData] = useState({
    title: '',
    prefix: '',
    description: '',
  })

  const maxTitleLength = 100
  const maxPrefixLength = 3
  const maxDescriptionLength = 255
  const titleRemaining = maxTitleLength - formData.title.length
  const descriptionRemaining = maxDescriptionLength - (formData.description?.length || 0)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    fetchProject()
    fetchRepository()
  }, [projectId, repoId, router])

  const fetchProject = async () => {
    try {
      const response = await api.get(`/projects/${projectId}`)
      
      if (response.data?.data?.project) {
        setProject(response.data.data.project)
      }
    } catch (err: any) {
      console.error('Fetch project error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else if (err.response?.status === 404) {
        setError('Project not found')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to fetch project')
      }
    }
  }

  const fetchRepository = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await api.get(`/projects/${projectId}/repositories/${repoId}`)
      
      if (response.data?.data?.repository) {
        const repoData = response.data.data.repository
        setRepository(repoData)
        setFormData({
          title: repoData.title || '',
          prefix: repoData.prefix || '',
          description: repoData.description || '',
        })
      }
    } catch (err: any) {
      console.error('Fetch repository error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else if (err.response?.status === 404) {
        setError('Repository not found')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to fetch repository')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrefixChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/\s/g, '').slice(0, maxPrefixLength)
    setFormData({ ...formData, prefix: value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await api.patch(`/projects/${projectId}/repositories/${repoId}`, {
        title: formData.title.trim(),
        prefix: formData.prefix.trim().toUpperCase(),
        description: formData.description.trim() || undefined,
      })

      if (response.data?.data?.repository) {
        router.push(`/projects/${projectId}/repository/${repoId}`)
      }
    } catch (err: any) {
      console.error('Update repository error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else if (err.response?.status === 404) {
        setError('Repository not found')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to update repository')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setError(null)

    try {
      await api.delete(`/projects/${projectId}/repositories/${repoId}`)
      router.push(`/projects/${projectId}`)
    } catch (err: any) {
      console.error('Delete repository error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else if (err.response?.status === 404) {
        setError('Repository not found')
      } else if (err.response?.status === 409) {
        setError(err.response?.data?.error?.message || 'Cannot delete repository that has test suites or test cases')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to delete repository')
      }
    } finally {
      setIsDeleting(false)
      setShowDeleteModal(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <div className="flex items-center justify-center h-[calc(100vh-140px)]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading repository...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error && !repository) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <div className="flex items-center justify-center h-[calc(100vh-140px)]">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Link
              href={`/projects/${projectId}`}
              className="text-primary-600 hover:text-primary-700"
            >
              Back to Project
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb and Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Edit Repository</h1>
              <nav aria-label="breadcrumb" className="flex items-center gap-2 text-sm text-gray-600">
                <Link href="/projects" className="text-primary-600 hover:text-primary-700 transition-colors">
                  Projects
                </Link>
                <span>/</span>
                <Link href={`/projects/${projectId}`} className="text-primary-600 hover:text-primary-700 transition-colors">
                  {project?.title || 'Project'}
                </Link>
                <span>/</span>
                <Link href={`/projects/${projectId}/repositories`} className="text-primary-600 hover:text-primary-700 transition-colors">
                  Repositories
                </Link>
                <span>/</span>
                <Link href={`/projects/${projectId}/repository/${repoId}`} className="text-primary-600 hover:text-primary-700 transition-colors">
                  {repository?.title || 'Repository'}
                </Link>
                <span>/</span>
                <span className="text-gray-900 font-medium">Edit</span>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/projects/${projectId}/repository/${repoId}`}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Repository
              </Link>
              <button
                type="button"
                className="px-4 py-2 text-red-600 hover:text-red-700 border border-red-300 rounded-lg hover:bg-red-50 transition-colors font-medium flex items-center gap-2"
                onClick={() => setShowDeleteModal(true)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Repository Details */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit}>
              {/* Repository Details Section */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-primary-600" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M.5 3l.04.87a1.99 1.99 0 0 0-.342 1.311l.637 7A2 2 0 0 0 2.826 14H9.81a2 2 0 0 0 1.991-1.819l.637-7a1.99 1.99 0 0 0-.342-1.311L12.5 3H11V1.5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0-.5.5V3H.5zm1.188 1.243L2 4.5v7.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V4.5l.313-1.257H1.688zM5 3V2h6v1H5z"/>
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Repository Details</h2>
                </div>

                <div className="space-y-6">
                  {/* Repository Name */}
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                      Repository Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M.5 3l.04.87a1.99 1.99 0 0 0-.342 1.311l.637 7A2 2 0 0 0 2.826 14H9.81a2 2 0 0 0 1.991-1.819l.637-7a1.99 1.99 0 0 0-.342-1.311L12.5 3H11V1.5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0-.5.5V3H.5zm1.188 1.243L2 4.5v7.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V4.5l.313-1.257H1.688zM5 3V2h6v1H5z"/>
                        </svg>
                      </div>
                      <input
                        type="text"
                        id="title"
                        required
                        maxLength={maxTitleLength}
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                        placeholder="Enter a descriptive name for this repository"
                      />
                    </div>
                    <p className="mt-1.5 text-sm text-gray-500">
                      Give your repository a clear, descriptive name (max {maxTitleLength} characters, {titleRemaining} remaining).
                    </p>
                  </div>

                  {/* Prefix */}
                  <div>
                    <label htmlFor="prefix" className="block text-sm font-medium text-gray-700 mb-2">
                      Prefix <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M2.5 8a5.5 5.5 0 0 1 8.25-4.764.5.5 0 0 0 .5-.866A6.5 6.5 0 1 0 14.5 8a.5.5 0 0 0-1 0 5.5 5.5 0 1 1-11 0z"/>
                          <path d="M15.354 3.354a.5.5 0 0 0-.708-.708L8 9.293 5.354 6.646a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l7-7z"/>
                        </svg>
                      </div>
                      <input
                        type="text"
                        id="prefix"
                        required
                        maxLength={maxPrefixLength}
                        pattern="[^\s]+"
                        title="Please don't use whitespace"
                        style={{ textTransform: 'uppercase' }}
                        value={formData.prefix}
                        onChange={handlePrefixChange}
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition uppercase"
                        placeholder="e.g. TST"
                      />
                    </div>
                    <p className="mt-1.5 text-sm text-gray-500">
                      A short prefix for test case IDs (max {maxPrefixLength} characters, no spaces). Example: {formData.prefix || 'TST'}-123
                    </p>
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      id="description"
                      maxLength={maxDescriptionLength}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none transition"
                      placeholder="Describe the purpose of this repository"
                    />
                    <div className="mt-1.5 flex items-center justify-between">
                      <p className="text-sm text-gray-500">
                        Provide a brief description of this repository's purpose (max {maxDescriptionLength} characters).
                      </p>
                      <p className={`text-xs ${descriptionRemaining < 20 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {descriptionRemaining} characters remaining
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <Link
                  href={`/projects/${projectId}/repository/${repoId}`}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.title.trim() || !formData.prefix.trim()}
                  className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column - Repository Information and Prefix Preview */}
          <div className="lg:col-span-1 space-y-6">
            {/* Repository Information */}
            {repository && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Repository Information</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Created</span>
                    <span className="text-sm font-medium text-gray-900">{formatDate(repository.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Last Updated</span>
                    <span className="text-sm font-medium text-gray-900">{formatDate(repository.updatedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Test Suites</span>
                    <span className="px-2.5 py-1 bg-primary-600 text-white text-xs font-semibold rounded-full">
                      {repository.counts?.testSuites || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Test Cases</span>
                    <span className="px-2.5 py-1 bg-primary-600 text-white text-xs font-semibold rounded-full">
                      {repository.counts?.testCases || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-600">Automated Tests</span>
                    <span className="px-2.5 py-1 bg-green-600 text-white text-xs font-semibold rounded-full">
                      {repository.counts?.automatedTests || 0}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Prefix Preview */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Prefix Preview</h3>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                The prefix will be used to create unique identifiers for your test cases. Here's how it will look:
              </p>

              <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg">
                <h3 className="text-2xl font-bold text-primary-600">
                  <span>{formData.prefix || 'ST'}</span>-<span className="text-gray-500">123</span>
                </h3>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Repository</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete "{repository?.title}"? This action cannot be undone.
                {repository && repository.counts?.testSuites > 0 && (
                  <span className="block mt-2 text-red-600 font-medium">
                    Warning: This repository has {repository.counts.testSuites} test suite(s) and {repository.counts.testCases} test case(s).
                  </span>
                )}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
