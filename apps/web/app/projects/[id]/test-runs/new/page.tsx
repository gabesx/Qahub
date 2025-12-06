'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '../../../../components/AppHeader'
import { api } from '../../../../../lib/api'

interface TestPlan {
  id: string
  title: string
  description?: string
  status: 'draft' | 'active' | 'archived'
  repository: {
    id: string
    title: string
  }
}

export default function CreateTestRunPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const [testPlans, setTestPlans] = useState<TestPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: `Test Run - ${new Date().toISOString().split('T')[0]}`,
    testPlanId: '',
    description: '',
    executionDate: new Date().toISOString().split('T')[0], // Default to today
    environment: '',
    buildVersion: '',
    assignToMe: true,
    includeAutomated: true,
  })

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    if (projectId) {
      fetchTestPlans()
    }
  }, [projectId, router])

  const fetchTestPlans = async () => {
    setIsLoading(true)
    try {
      // Fetch all repositories first
      const reposResponse = await api.get(`/projects/${projectId}/repositories`)
      const repos = reposResponse.data?.data?.repositories || []
      
      // Fetch test plans from all repositories
      const allTestPlans: TestPlan[] = []
      for (const repo of repos) {
        try {
          const response = await api.get(
            `/projects/${projectId}/repositories/${repo.id}/test-plans`,
            { params: { page: 1, limit: 100 } }
          )
          const plans = response.data?.data?.testPlans || []
          plans.forEach((plan: any) => {
            allTestPlans.push({
              ...plan,
              repository: { id: repo.id, title: repo.title },
            })
          })
        } catch (err) {
          console.error(`Error fetching test plans for repository ${repo.id}:`, err)
        }
      }
      
      // Show all test plans (draft, active, archived) and sort by title
      const sortedPlans = allTestPlans
        .sort((a, b) => a.title.localeCompare(b.title))
      
      setTestPlans(sortedPlans)
    } catch (err: any) {
      console.error('Fetch test plans error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to fetch test plans')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.testPlanId) {
      setError('Please select a test plan')
      return
    }

    if (!formData.title.trim()) {
      setError('Test run name is required')
      return
    }

    if (formData.title.length > 100) {
      setError('Test run name must be 100 characters or less')
      return
    }

    setIsSubmitting(true)

    try {
      const payload: any = {
        title: formData.title.trim(),
        testPlanId: formData.testPlanId,
        status: 'pending',
        executionDate: formData.executionDate || new Date().toISOString().split('T')[0],
        environment: formData.environment.trim() || null,
        buildVersion: formData.buildVersion.trim() || null,
      }

      // If description is provided, we can store it in the data field as JSON
      // or we can add a description field to the API later
      if (formData.description.trim()) {
        payload.data = JSON.stringify({ description: formData.description.trim() })
      }

      await api.post(`/projects/${projectId}/test-runs`, payload)

      // Redirect to project overview page
      router.push(`/projects/${projectId}`)
    } catch (err: any) {
      console.error('Create test run error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to create test run')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Test Run</h1>
              <nav className="text-sm text-gray-600">
                <Link href={`/projects/${projectId}`} className="hover:text-primary-600">
                  Projects
                </Link>
                {' > '}
                <Link href={`/projects/${projectId}`} className="hover:text-primary-600">
                  Test Runs
                </Link>
                {' > '}
                <span className="text-gray-900">Create New</span>
              </nav>
            </div>
            <Link
              href={`/projects/${projectId}`}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Test Runs
            </Link>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Test Run Details</h2>

              {/* Test Run Name */}
              <div className="mb-6">
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Test Run Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Test Run - 2025-12-04"
                  maxLength={100}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Give your test run a clear, descriptive name (max 100 characters)
                </p>
              </div>

              {/* Test Plan */}
              <div className="mb-6">
                <label htmlFor="testPlanId" className="block text-sm font-medium text-gray-700 mb-2">
                  Test Plan <span className="text-red-500">*</span>
                </label>
                {isLoading ? (
                  <div className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                    <span className="text-sm text-gray-500">Loading test plans...</span>
                  </div>
                ) : (
                  <select
                    id="testPlanId"
                    value={formData.testPlanId}
                    onChange={(e) => setFormData({ ...formData, testPlanId: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-white"
                  >
                    <option value="">-- Select a Test Plan --</option>
                    {testPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.title} ({plan.repository.title})
                      </option>
                    ))}
                  </select>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  Select the test plan that contains the test cases you want to run
                </p>
              </div>

              {/* Execution Date */}
              <div className="mb-6">
                <label htmlFor="executionDate" className="block text-sm font-medium text-gray-700 mb-2">
                  Execution Date
                </label>
                <input
                  type="date"
                  id="executionDate"
                  value={formData.executionDate}
                  onChange={(e) => setFormData({ ...formData, executionDate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Date when this test run will be executed (defaults to today)
                </p>
              </div>

              {/* Environment */}
              <div className="mb-6">
                <label htmlFor="environment" className="block text-sm font-medium text-gray-700 mb-2">
                  Environment
                </label>
                <input
                  type="text"
                  id="environment"
                  value={formData.environment}
                  onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                  placeholder="e.g., Development, Staging, Production"
                  maxLength={100}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Environment where tests will be executed (optional)
                </p>
              </div>

              {/* Build Version */}
              <div className="mb-6">
                <label htmlFor="buildVersion" className="block text-sm font-medium text-gray-700 mb-2">
                  Build Version
                </label>
                <input
                  type="text"
                  id="buildVersion"
                  value={formData.buildVersion}
                  onChange={(e) => setFormData({ ...formData, buildVersion: e.target.value })}
                  placeholder="e.g., v1.2.3, build-1234"
                  maxLength={100}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Build or version number being tested (optional)
                </p>
              </div>

              {/* Description */}
              <div className="mb-6">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description of this test run"
                  rows={4}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition resize-none"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Provide additional context or goals for this test run (optional)
                </p>
              </div>

              {/* Options */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-4">Options</h3>
                
                {/* Assign to me */}
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <div>
                    <label htmlFor="assignToMe" className="text-sm font-medium text-gray-900">
                      Assign this test run to me
                    </label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      You will be assigned as the owner of this test run
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="assignToMe"
                      checked={formData.assignToMe}
                      onChange={(e) => setFormData({ ...formData, assignToMe: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                {/* Include automated test cases */}
                <div className="flex items-center justify-between py-3">
                  <div>
                    <label htmlFor="includeAutomated" className="text-sm font-medium text-gray-900">
                      Include automated test cases
                    </label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Automatically include test cases marked as automated
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="includeAutomated"
                      checked={formData.includeAutomated}
                      onChange={(e) => setFormData({ ...formData, includeAutomated: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => router.push(`/projects/${projectId}`)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.testPlanId || !formData.title.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create Test Run
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Panel - Quick Help */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Help</h3>
              
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Creating a Test Run</h4>
                <p className="text-sm text-gray-600 mb-4">
                  A test run is an execution of a test plan. It allows you to track the progress and results of your testing efforts.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Tips</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Choose a descriptive name that includes version or sprint information</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Select a test plan that contains all the test cases you need to execute</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Add a description to provide context for other team members</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>You can start testing immediately after creating the test run</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

