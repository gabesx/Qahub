'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '../../../../../components/AppHeader'
import { api } from '../../../../../../lib/api'

interface TestPlan {
  id: string
  title: string
  description: string | null
  status: 'draft' | 'active' | 'archived'
  createdAt: string
  updatedAt: string
  _count?: {
    testPlanCases?: number
    testRuns?: number
  }
}

interface Project {
  id: string
  title: string
}

interface Repository {
  id: string
  title: string
  prefix: string
}

export default function TestPlansPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const repoId = params.repoId as string

  const [project, setProject] = useState<Project | null>(null)
  const [repository, setRepository] = useState<Repository | null>(null)
  const [testPlans, setTestPlans] = useState<TestPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<TestPlan | null>(null)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
  })
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'draft' as 'draft' | 'active' | 'archived',
  })

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    fetchProject()
    fetchRepository()
    fetchTestPlans()
  }, [projectId, repoId, router, filters])

  const fetchProject = async () => {
    try {
      const response = await api.get(`/projects/${projectId}`)
      setProject(response.data.data.project)
    } catch (err: any) {
      console.error('Failed to fetch project:', err)
    }
  }

  const fetchRepository = async () => {
    try {
      const response = await api.get(`/projects/${projectId}/repositories/${repoId}`)
      setRepository(response.data.data.repository)
    } catch (err: any) {
      console.error('Failed to fetch repository:', err)
    }
  }

  const fetchTestPlans = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (filters.search) params.append('search', filters.search)
      if (filters.status) params.append('status', filters.status)

      const response = await api.get(
        `/projects/${projectId}/repositories/${repoId}/test-plans?${params.toString()}`
      )
      setTestPlans(response.data.data.testPlans)
    } catch (err: any) {
      console.error('Failed to fetch test plans:', err)
      setError(err.response?.data?.error?.message || 'Failed to fetch test plans')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post(`/projects/${projectId}/repositories/${repoId}/test-plans`, {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        status: formData.status,
      })
      setShowCreateModal(false)
      setFormData({ title: '', description: '', status: 'draft' })
      fetchTestPlans()
    } catch (err: any) {
      console.error('Failed to create test plan:', err)
      alert(err.response?.data?.error?.message || 'Failed to create test plan')
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPlan) return

    try {
      await api.patch(
        `/projects/${projectId}/repositories/${repoId}/test-plans/${editingPlan.id}`,
        {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          status: formData.status,
        }
      )
      setEditingPlan(null)
      setFormData({ title: '', description: '', status: 'draft' })
      fetchTestPlans()
    } catch (err: any) {
      console.error('Failed to update test plan:', err)
      alert(err.response?.data?.error?.message || 'Failed to update test plan')
    }
  }

  const handleDelete = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this test plan?')) return

    try {
      await api.delete(`/projects/${projectId}/repositories/${repoId}/test-plans/${planId}`)
      fetchTestPlans()
    } catch (err: any) {
      console.error('Failed to delete test plan:', err)
      alert(err.response?.data?.error?.message || 'Failed to delete test plan')
    }
  }

  const openEditModal = (plan: TestPlan) => {
    setEditingPlan(plan)
    setFormData({
      title: plan.title,
      description: plan.description || '',
      status: plan.status,
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      case 'archived':
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
            <Link
              href={`/projects/${projectId}/repository/${repoId}`}
              className="hover:text-gray-900"
            >
              {repository?.title || 'Repository'}
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">Test Plans</span>
          </div>
        </nav>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Test Plans</h1>
              <p className="text-gray-600 mt-1">
                Organize and manage your test execution plans
              </p>
            </div>
            <button
              onClick={() => {
                setShowCreateModal(true)
                setEditingPlan(null)
                setFormData({ title: '', description: '', status: 'draft' })
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              + New Test Plan
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <input
                type="text"
                placeholder="Search test plans..."
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
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </div>

        {/* Test Plans List */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading test plans...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
            <p className="text-red-600">{error}</p>
          </div>
        ) : testPlans.length === 0 ? (
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Test Plans</h3>
            <p className="text-gray-600 mb-4">
              Get started by creating your first test plan
            </p>
            <button
              onClick={() => {
                setShowCreateModal(true)
                setEditingPlan(null)
                setFormData({ title: '', description: '', status: 'draft' })
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Create Test Plan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testPlans.map((plan) => (
              <div
                key={plan.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <Link
                      href={`/projects/${projectId}/repository/${repoId}/test-plans/${plan.id}`}
                      className="text-lg font-semibold text-gray-900 hover:text-primary-600 transition-colors"
                    >
                      {plan.title}
                    </Link>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                      plan.status
                    )}`}
                  >
                    {plan.status}
                  </span>
                </div>
                {plan.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{plan.description}</p>
                )}
                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span>{plan._count?.testPlanCases || 0} test cases</span>
                  <span>{plan._count?.testRuns || 0} test runs</span>
                </div>
                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <Link
                    href={`/projects/${projectId}/repository/${repoId}/test-plans/${plan.id}`}
                    className="flex-1 px-3 py-2 text-sm text-center bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors font-medium"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => openEditModal(plan)}
                    className="px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(plan.id)}
                    className="px-3 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {(showCreateModal || editingPlan) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {editingPlan ? 'Edit Test Plan' : 'Create Test Plan'}
                </h2>
                <form onSubmit={editingPlan ? handleEdit : handleCreate}>
                  <div className="space-y-4">
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
                        placeholder="Enter test plan title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Enter test plan description"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status *
                      </label>
                      <select
                        required
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            status: e.target.value as 'draft' | 'active' | 'archived',
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                    >
                      {editingPlan ? 'Update' : 'Create'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false)
                        setEditingPlan(null)
                        setFormData({ title: '', description: '', status: 'draft' })
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

