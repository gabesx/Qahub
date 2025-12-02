'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '../../components/AppHeader'
import { api } from '../../../lib/api'

export default function CreateProjectPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    createDefaultRepository: true,
    addTeamMembersAfter: false,
  })

  const maxTitleLength = 100
  const maxDescriptionLength = 255
  const titleRemaining = maxTitleLength - formData.title.length
  const descriptionRemaining = maxDescriptionLength - formData.description.length

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await api.post('/projects', {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
      })

      if (response.data?.data?.project) {
        const projectId = response.data.data.project.id

        // If createDefaultRepository is enabled, create a default repository
        // Note: Repository endpoint will be implemented later
        // For now, we'll skip this feature
        if (formData.createDefaultRepository) {
          // TODO: Implement repository creation when endpoint is available
          console.log('Default repository creation will be implemented when repository endpoint is available')
        }

        // Redirect to projects page or project detail page
        if (formData.addTeamMembersAfter) {
          // TODO: Redirect to team members page when implemented
          router.push(`/projects/${projectId}`)
        } else {
          router.push('/projects')
        }
      }
    } catch (err: any) {
      console.error('Create project error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else if (err.response?.status === 403) {
        setError(err.response?.data?.error?.message || 'You do not have permission to create projects. Please contact your administrator.')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to create project')
      }
    } finally {
      setIsSubmitting(false)
    }
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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Project</h1>
              <nav className="flex items-center space-x-2 text-sm text-gray-600">
                <Link href="/projects" className="hover:text-gray-900 transition-colors">
                  Projects
                </Link>
                <span>/</span>
                <span className="text-gray-900 font-medium">Create</span>
              </nav>
            </div>
            <Link
              href="/projects"
              className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Projects
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit}>
              {/* Project Details Section */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Project Details</h2>
                </div>

                <div className="space-y-6">
                  {/* Project Name */}
                  <div>
                    <label htmlFor="project-title" className="block text-sm font-medium text-gray-700 mb-2">
                      Project Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        id="project-title"
                        required
                        maxLength={maxTitleLength}
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                        placeholder="Enter a descriptive name for your project"
                      />
                    </div>
                    <p className="mt-1.5 text-sm text-gray-500">
                      Give your project a clear, descriptive name (max {maxTitleLength} characters)
                    </p>
                    {titleRemaining < 20 && (
                      <p className="mt-1 text-xs text-gray-400">{titleRemaining} characters remaining</p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor="project-description" className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      id="project-description"
                      maxLength={maxDescriptionLength}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none transition"
                      placeholder="Describe the purpose and goals of this project"
                    />
                    <div className="mt-1.5 flex items-center justify-between">
                      <p className="text-sm text-gray-500">
                        Provide a brief description of your project's purpose (max {maxDescriptionLength} characters)
                      </p>
                      <p className={`text-xs ${descriptionRemaining < 20 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {descriptionRemaining} characters remaining
                      </p>
                    </div>
                  </div>

                  {/* Project Settings */}
                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Project Settings</h3>
                    
                    <div className="space-y-4">
                      {/* Create default test repository */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <label htmlFor="create-repository" className="text-sm font-medium text-gray-900 cursor-pointer">
                              Create default test repository
                            </label>
                          </div>
                          <p className="mt-1 text-sm text-gray-500">
                            Automatically create a default repository for storing test cases
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, createDefaultRepository: !formData.createDefaultRepository })}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                            formData.createDefaultRepository ? 'bg-primary-600' : 'bg-gray-200'
                          }`}
                          role="switch"
                          aria-checked={formData.createDefaultRepository}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              formData.createDefaultRepository ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Add team members after creation */}
                      <div className="flex items-start justify-between opacity-50">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <label htmlFor="add-team-members" className="text-sm font-medium text-gray-900 cursor-not-allowed">
                              Add team members after creation
                            </label>
                          </div>
                          <p className="mt-1 text-sm text-gray-500">
                            You'll be prompted to add team members after creating the project
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled
                          className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-not-allowed rounded-full border-2 border-transparent bg-gray-200 transition-colors duration-200 ease-in-out"
                          role="switch"
                          aria-checked={false}
                          aria-disabled={true}
                        >
                          <span className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out translate-x-0" />
                        </button>
                      </div>
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

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <Link
                  href="/projects"
                  className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.title.trim()}
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create Project
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Getting Started</h2>
              </div>

              <div className="space-y-6">
                {/* What is a Project? */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">What is a Project?</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    A project is the top-level container for all your testing resources. It helps you organize test repositories, test plans, and test runs for a specific product or initiative.
                  </p>
                </div>

                {/* After Creating a Project */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">After Creating a Project:</h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Create test repositories to store your test cases</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Organize test cases into test suites</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Create test plans to define what to test</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Execute test runs to track testing progress</span>
                    </li>
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

