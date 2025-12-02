'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '../../../../components/AppHeader'
import { api } from '../../../../../lib/api'

interface TestRun {
  id: string
  title: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  executionDate: string | null
  environment: string | null
  buildVersion: string | null
  testPlan?: {
    id: string
    title: string
  }
  createdAt: string
  updatedAt: string
  _count?: {
    results?: number
  }
}

interface Project {
  id: string
  title: string
}

interface TestPlan {
  id: string
  title: string
  repositoryId: string
}

export default function TestRunsPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [testRuns, setTestRuns] = useState<TestRun[]>([])
  const [testPlans, setTestPlans] = useState<TestPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    testPlanId: '',
    environment: '',
  })
  const [formData, setFormData] = useState({
    testPlanId: '',
    title: '',
    environment: '',
    buildVersion: '',
    executionDate: '',
  })

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    fetchProject()
    fetchTestRuns()
    fetchTestPlans()
  }, [projectId, router, filters])

  const fetchProject = async () => {
    try {
      const response = await api.get(`/projects/${projectId}`)
      setProject(response.data.data.project)
    } catch (err: any) {
      console.error('Failed to fetch project:', err)
    }
  }

  const fetchTestRuns = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (filters.search) params.append('search', filters.search)
      if (filters.status) params.append('status', filters.status)
      if (filters.testPlanId) params.append('testPlanId', filters.testPlanId)
      if (filters.environment) params.append('environment', filters.environment)

      const response = await api.get(
        `/projects/${projectId}/test-runs?${params.toString()}`
      )
      setTestRuns(response.data.data.testRuns)
    } catch (err: any) {
      console.error('Failed to fetch test runs:', err)
      setError(err.response?.data?.error?.message || 'Failed to fetch test runs')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTestPlans = async () => {
    try {
      // Fetch all repositories for this project, then get test plans
      const reposResponse = await api.get(`/projects/${projectId}/repositories`)
      const repos = reposResponse.data.data.repositories

      const allPlans: TestPlan[] = []
      for (const repo of repos) {
        try {
          const plansResponse = await api.get(
            `/projects/${projectId}/repositories/${repo.id}/test-plans?status=active`
          )
          allPlans.push(...plansResponse.data.data.testPlans)
        } catch (err) {
          console.error(`Failed to fetch test plans for repo ${repo.id}:`, err)
        }
      }
      setTestPlans(allPlans)
    } catch (err: any) {
      console.error('Failed to fetch test plans:', err)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post(`/projects/${projectId}/test-runs`, {
        testPlanId: formData.testPlanId,
        title: formData.title.trim(),
        environment: formData.environment.trim() || null,
        buildVersion: formData.buildVersion.trim() || null,
        executionDate: formData.executionDate || null,
        status: 'pending',
      })
      setShowCreateModal(false)
      setFormData({ testPlanId: '', title: '', environment: '', buildVersion: '', executionDate: '' })
      fetchTestRuns()
    } catch (err: any) {
      console.error('Failed to create test run:', err)
      alert(err.response?.data?.error?.message || 'Failed to create test run')
    }
  }

  const handleDelete = async (runId: string) => {
    if (!confirm('Are you sure you want to delete this test run?')) return

    try {
      await api.delete(`/projects/${projectId}/test-runs/${runId}`)
      fetchTestRuns()
    } catch (err: any) {
      console.error('Failed to delete test run:', err)
      alert(err.response?.data?.error?.message || 'Failed to delete test run')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'running':
        return 'bg-blue-100 text-blue-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumbs */}
        <nav className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Link href="/projects" className="hover:text-gray-900">Projects</Link>
            <span>/</span>
            <Link href={`/projects/${projectId}`} className="hover:text-gray-900">
              {project?.title || 'Project'}
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">Test Runs</span>
          </div>
        </nav>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Test Runs</h1>
              <p className="text-gray-600 mt-1">
                Execute and track your test runs
              </p>
            </div>
            <button
              onClick={() => {
                setShowCreateModal(true)
                setFormData({ testPlanId: '', title: '', environment: '', buildVersion: '', executionDate: '' })
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              + New Test Run
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <input
                type="text"
                placeholder="Search test runs..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <select
                value={filters.testPlanId}
                onChange={(e) => setFilters({ ...filters, testPlanId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Test Plans</option>
                {testPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <input
                type="text"
                placeholder="Environment"
                value={filters.environment}
                onChange={(e) => setFilters({ ...filters, environment: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Test Runs List */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading test runs...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
            <p className="text-red-600">{error}</p>
          </div>
        ) : testRuns.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <svg
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Test Runs</h3>
            <p className="text-gray-600 mb-4">
              Create a test run to start executing your test plans
            </p>
            <button
              onClick={() => {
                setShowCreateModal(true)
                setFormData({ testPlanId: '', title: '', environment: '', buildVersion: '', executionDate: '' })
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Create Test Run
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Test Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Environment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Execution Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Results
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {testRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/projects/${projectId}/test-runs/${run.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-primary-600"
                      >
                        {run.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {run.testPlan?.title || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          run.status
                        )}`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {run.environment || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {run.executionDate
                        ? new Date(run.executionDate).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {run._count?.results || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/projects/${projectId}/test-runs/${run.id}`}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => handleDelete(run.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Create Test Run</h2>
                <form onSubmit={handleCreate}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Test Plan *
                      </label>
                      <select
                        required
                        value={formData.testPlanId}
                        onChange={(e) => setFormData({ ...formData, testPlanId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">Select a test plan</option>
                        {testPlans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Enter test run title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Environment
                      </label>
                      <input
                        type="text"
                        value={formData.environment}
                        onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="e.g., Production, Staging"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Build Version
                      </label>
                      <input
                        type="text"
                        value={formData.buildVersion}
                        onChange={(e) => setFormData({ ...formData, buildVersion: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="e.g., v1.2.3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Execution Date
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.executionDate}
                        onChange={(e) => setFormData({ ...formData, executionDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false)
                        setFormData({ testPlanId: '', title: '', environment: '', buildVersion: '', executionDate: '' })
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

