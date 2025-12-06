'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '../../../../components/AppHeader'
import { api } from '../../../../../lib/api'

interface Project {
  id: string
  title: string
}

export default function CreateRepositoryPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    title: '',
    prefix: '',
    description: '',
    repositoryStructure: 'empty' as 'empty' | 'template',
  })

  const maxTitleLength = 100
  const maxPrefixLength = 3
  const maxDescriptionLength = 255
  const titleRemaining = maxTitleLength - formData.title.length
  const descriptionRemaining = maxDescriptionLength - formData.description.length

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    fetchProject()
  }, [projectId, router])

  const fetchProject = async () => {
    setIsLoading(true)
    setError(null)

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
      const response = await api.post(`/projects/${projectId}/repositories`, {
        title: formData.title.trim(),
        prefix: formData.prefix.trim(),
        description: formData.description.trim() || undefined,
        repositoryStructure: formData.repositoryStructure,
      })

      if (response.data?.data?.repository) {
        router.push(`/projects/${projectId}`)
      }
    } catch (err: any) {
      console.error('Create repository error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else if (err.response?.status === 403) {
        setError(err.response?.data?.error?.message || 'You do not have permission to create repositories.')
      } else if (err.response?.status === 404) {
        setError('Project not found')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to create repository')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const prefixPreview = formData.prefix ? `${formData.prefix}-123` : 'PRE-123'

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </main>
      </div>
    )
  }

  if (error && !project) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-red-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Error</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link
              href="/projects"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium inline-block"
            >
              Back to Projects
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Test Repository</h1>
              <nav className="flex items-center space-x-2 text-sm text-gray-600">
                <Link href="/projects" className="hover:text-gray-900 transition-colors">
                  Projects
                </Link>
                <span>/</span>
                {project && (
                  <>
                    <Link href={`/projects/${projectId}`} className="hover:text-gray-900 transition-colors">
                      {project.title}
                    </Link>
                    <span>/</span>
                  </>
                )}
                <Link href={`/projects/${projectId}`} className="hover:text-gray-900 transition-colors">
                  Test Squads
                </Link>
                <span>/</span>
                <span className="text-gray-900 font-medium">Create New</span>
              </nav>
            </div>
            <Link
              href={`/projects/${projectId}`}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Squads List
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit}>
              {/* Repository Details Section */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Repository Details</h2>
                </div>

                <div className="space-y-6">
                  {/* Repository Name */}
                  <div>
                    <label htmlFor="repository-title" className="block text-sm font-medium text-gray-700 mb-2">
                      Repository Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="repository-title"
                      required
                      maxLength={maxTitleLength}
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                      placeholder="Enter a descriptive name for this repository"
                    />
                    <p className="mt-1.5 text-sm text-gray-500">
                      Give your repository a clear, descriptive name (max {maxTitleLength} characters).
                    </p>
                  </div>

                  {/* Prefix */}
                  <div>
                    <label htmlFor="repository-prefix" className="block text-sm font-medium text-gray-700 mb-2">
                      Prefix <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 font-medium">#</span>
                      </div>
                      <input
                        type="text"
                        id="repository-prefix"
                        required
                        maxLength={maxPrefixLength}
                        value={formData.prefix}
                        onChange={handlePrefixChange}
                        className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition uppercase"
                        placeholder="E.G. TST"
                      />
                    </div>
                    <p className="mt-1.5 text-sm text-gray-500">
                      A short prefix for test case IDs (max {maxPrefixLength} characters, no spaces). Example: TST-123
                    </p>
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor="repository-description" className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      id="repository-description"
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

              {/* Repository Structure Section */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Repository Structure</h2>
                
                <div className="space-y-4">
                  <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="repositoryStructure"
                      value="empty"
                      checked={formData.repositoryStructure === 'empty'}
                      onChange={(e) => setFormData({ ...formData, repositoryStructure: e.target.value as 'empty' | 'template' })}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-900">Empty Repository</div>
                      <div className="text-sm text-gray-600 mt-1">
                        Start with an empty repository and create your own structure
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="repositoryStructure"
                      value="template"
                      checked={formData.repositoryStructure === 'template'}
                      onChange={(e) => setFormData({ ...formData, repositoryStructure: e.target.value as 'empty' | 'template' })}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-900">Use Template</div>
                      <div className="text-sm text-gray-600 mt-1">
                        Start with a predefined structure based on common testing practices
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <Link
                  href={`/projects/${projectId}`}
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
                      Creating...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      Create Repository
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column - Information Panels */}
          <div className="lg:col-span-1 space-y-6">
            {/* About Test Repositories */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">About Test Repositories</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">What is a Test Repository?</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    A test repository is a container for organizing your test cases, test suites, and other testing artifacts. It helps you structure and manage your testing resources efficiently.
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Key Features:</h4>
                  <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
                    <li>Organization: Group related test cases into suites and folders</li>
                    <li>Identification: Use prefixes to create unique IDs for test cases</li>
                    <li>Reusability: Create test cases once and reuse them in multiple test plans</li>
                    <li>Versioning: Track changes to test cases over time</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Prefix Preview */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Prefix Preview</h3>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  The prefix will be used to create unique identifiers for your test cases. Here's how it will look:
                </p>
                
                <div className="bg-gray-50 rounded-lg p-6 border-2 border-dashed border-gray-200">
                  <div className="text-3xl font-bold text-primary-600 text-center">
                    {prefixPreview}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Examples:</h4>
                  <ul className="text-sm text-gray-600 space-y-1.5 list-disc list-inside">
                    <li>API-101: API Authentication Test</li>
                    <li>UI-202: User Interface Navigation Test</li>
                    <li>SEC-303: Security Validation Test</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

