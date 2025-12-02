'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '../../../../../../../components/AppHeader'
import { api } from '../../../../../../../../lib/api'

interface TestCase {
  id: string
  title: string
  description: string | null
  automated: boolean
  priority: number
  severity: string | null
  regression: boolean
  labels: string | null
  order: number | null
  createdAt: string
  updatedAt: string
  version: number
}

interface Suite {
  id: string
  title: string
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

export default function TestCasesPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const repoId = params.repoId as string
  const suiteId = params.suiteId as string

  const [project, setProject] = useState<Project | null>(null)
  const [repository, setRepository] = useState<Repository | null>(null)
  const [suite, setSuite] = useState<Suite | null>(null)
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null)
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState({
    search: '',
    automated: '',
    priority: '',
    severity: '',
    regression: '',
  })
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    automated: false,
    priority: 2,
    severity: 'Moderate',
    regression: true,
    labels: '',
    order: '',
  })

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    fetchProject()
    fetchRepository()
    fetchSuite()
    fetchTestCases()
  }, [projectId, repoId, suiteId, router, filters])

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

  const fetchSuite = async () => {
    try {
      const response = await api.get(
        `/projects/${projectId}/repositories/${repoId}/suites/${suiteId}`
      )
      setSuite(response.data.data.suite)
    } catch (err: any) {
      console.error('Failed to fetch suite:', err)
    }
  }

  const fetchTestCases = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (filters.search) params.append('search', filters.search)
      if (filters.automated) params.append('automated', filters.automated)
      if (filters.priority) params.append('priority', filters.priority)
      if (filters.severity) params.append('severity', filters.severity)
      if (filters.regression) params.append('regression', filters.regression)

      const response = await api.get(
        `/projects/${projectId}/repositories/${repoId}/suites/${suiteId}/test-cases?${params.toString()}`
      )
      setTestCases(response.data.data.testCases)
    } catch (err: any) {
      console.error('Failed to fetch test cases:', err)
      setError(err.response?.data?.error?.message || 'Failed to fetch test cases')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post(
        `/projects/${projectId}/repositories/${repoId}/suites/${suiteId}/test-cases`,
        {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          automated: formData.automated,
          priority: formData.priority,
          severity: formData.severity,
          regression: formData.regression,
          labels: formData.labels.trim() || null,
          order: formData.order ? parseInt(formData.order) : null,
        }
      )
      setShowCreateModal(false)
      setFormData({
        title: '',
        description: '',
        automated: false,
        priority: 2,
        severity: 'Moderate',
        regression: true,
        labels: '',
        order: '',
      })
      fetchTestCases()
    } catch (err: any) {
      console.error('Failed to create test case:', err)
      alert(err.response?.data?.error?.message || 'Failed to create test case')
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTestCase) return

    try {
      await api.patch(
        `/projects/${projectId}/repositories/${repoId}/suites/${suiteId}/test-cases/${editingTestCase.id}`,
        {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          automated: formData.automated,
          priority: formData.priority,
          severity: formData.severity,
          regression: formData.regression,
          labels: formData.labels.trim() || null,
          order: formData.order ? parseInt(formData.order) : null,
          version: editingTestCase.version, // Optimistic locking
        }
      )
      setEditingTestCase(null)
      setFormData({
        title: '',
        description: '',
        automated: false,
        priority: 2,
        severity: 'Moderate',
        regression: true,
        labels: '',
        order: '',
      })
      fetchTestCases()
    } catch (err: any) {
      console.error('Failed to update test case:', err)
      if (err.response?.status === 409) {
        alert('Test case was modified by another user. Please refresh and try again.')
        fetchTestCases()
      } else {
        alert(err.response?.data?.error?.message || 'Failed to update test case')
      }
    }
  }

  const handleDelete = async (testCaseId: string) => {
    if (!confirm('Are you sure you want to delete this test case?')) return

    try {
      await api.delete(
        `/projects/${projectId}/repositories/${repoId}/suites/${suiteId}/test-cases/${testCaseId}`
      )
      fetchTestCases()
    } catch (err: any) {
      console.error('Failed to delete test case:', err)
      alert(err.response?.data?.error?.message || 'Failed to delete test case')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedCases.size === 0) return
    if (!confirm(`Are you sure you want to delete ${selectedCases.size} test case(s)?`)) return

    try {
      await Promise.all(
        Array.from(selectedCases).map((id) =>
          api.delete(
            `/projects/${projectId}/repositories/${repoId}/suites/${suiteId}/test-cases/${id}`
          )
        )
      )
      setSelectedCases(new Set())
      fetchTestCases()
    } catch (err: any) {
      console.error('Failed to delete test cases:', err)
      alert('Failed to delete some test cases')
    }
  }

  const openEditModal = (testCase: TestCase) => {
    setEditingTestCase(testCase)
    setFormData({
      title: testCase.title,
      description: testCase.description || '',
      automated: testCase.automated,
      priority: testCase.priority,
      severity: testCase.severity || 'Moderate',
      regression: testCase.regression,
      labels: testCase.labels || '',
      order: testCase.order?.toString() || '',
    })
  }

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedCases)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedCases(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedCases.size === testCases.length) {
      setSelectedCases(new Set())
    } else {
      setSelectedCases(new Set(testCases.map((tc) => tc.id)))
    }
  }

  const getPriorityColor = (priority: number) => {
    if (priority === 1) return 'bg-red-100 text-red-800'
    if (priority === 2) return 'bg-orange-100 text-orange-800'
    if (priority === 3) return 'bg-yellow-100 text-yellow-800'
    if (priority === 4) return 'bg-blue-100 text-blue-800'
    return 'bg-gray-100 text-gray-800'
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
            <Link
              href={`/projects/${projectId}/repository/${repoId}/suites`}
              className="hover:text-gray-900"
            >
              Test Suites
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">{suite?.title || 'Suite'}</span>
          </div>
        </nav>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Test Cases</h1>
              <p className="text-gray-600 mt-1">
                {suite?.title} - Manage and organize your test cases
              </p>
            </div>
            <div className="flex gap-3">
              {selectedCases.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Delete Selected ({selectedCases.size})
                </button>
              )}
              <button
                onClick={() => {
                  setShowCreateModal(true)
                  setEditingTestCase(null)
                  setFormData({
                    title: '',
                    description: '',
                    automated: false,
                    priority: 2,
                    severity: 'Moderate',
                    regression: true,
                    labels: '',
                    order: '',
                  })
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                + New Test Case
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <input
                type="text"
                placeholder="Search test cases..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <select
                value={filters.automated}
                onChange={(e) => setFilters({ ...filters, automated: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Automation</option>
                <option value="true">Automated</option>
                <option value="false">Manual</option>
              </select>
            </div>
            <div>
              <select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Priorities</option>
                <option value="1">Priority 1</option>
                <option value="2">Priority 2</option>
                <option value="3">Priority 3</option>
                <option value="4">Priority 4</option>
                <option value="5">Priority 5</option>
              </select>
            </div>
            <div>
              <select
                value={filters.severity}
                onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Severities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Moderate">Moderate</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div>
              <select
                value={filters.regression}
                onChange={(e) => setFilters({ ...filters, regression: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Regression</option>
                <option value="true">Regression</option>
                <option value="false">Non-Regression</option>
              </select>
            </div>
          </div>
        </div>

        {/* Test Cases List */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading test cases...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
            <p className="text-red-600">{error}</p>
          </div>
        ) : testCases.length === 0 ? (
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Test Cases</h3>
            <p className="text-gray-600 mb-4">
              Get started by creating your first test case
            </p>
            <button
              onClick={() => {
                setShowCreateModal(true)
                setEditingTestCase(null)
                setFormData({
                  title: '',
                  description: '',
                  automated: false,
                  priority: 2,
                  severity: 'Moderate',
                  regression: true,
                  labels: '',
                  order: '',
                })
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Create Test Case
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedCases.size === testCases.length && testCases.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Regression
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {testCases.map((testCase) => (
                  <tr key={testCase.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedCases.has(testCase.id)}
                        onChange={() => toggleSelection(testCase.id)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{testCase.title}</div>
                      {testCase.description && (
                        <div className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {testCase.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(
                          testCase.priority
                        )}`}
                      >
                        P{testCase.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {testCase.severity || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {testCase.automated ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Automated
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {testCase.regression ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          Regression
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                          Non-Regression
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => openEditModal(testCase)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(testCase.id)}
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

        {/* Create/Edit Modal */}
        {(showCreateModal || editingTestCase) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {editingTestCase ? 'Edit Test Case' : 'Create Test Case'}
                </h2>
                <form onSubmit={editingTestCase ? handleEdit : handleCreate}>
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
                        placeholder="Enter test case title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Enter test case description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Priority *
                        </label>
                        <select
                          required
                          value={formData.priority}
                          onChange={(e) =>
                            setFormData({ ...formData, priority: parseInt(e.target.value) })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          <option value={1}>Priority 1 (Critical)</option>
                          <option value={2}>Priority 2 (High)</option>
                          <option value={3}>Priority 3 (Medium)</option>
                          <option value={4}>Priority 4 (Low)</option>
                          <option value={5}>Priority 5 (Very Low)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Severity
                        </label>
                        <select
                          value={formData.severity}
                          onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          <option value="Critical">Critical</option>
                          <option value="High">High</option>
                          <option value="Moderate">Moderate</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Order
                        </label>
                        <input
                          type="number"
                          value={formData.order}
                          onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="Display order (optional)"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Labels
                        </label>
                        <input
                          type="text"
                          value={formData.labels}
                          onChange={(e) => setFormData({ ...formData, labels: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="Comma-separated labels"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.automated}
                          onChange={(e) =>
                            setFormData({ ...formData, automated: e.target.checked })
                          }
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Automated</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.regression}
                          onChange={(e) =>
                            setFormData({ ...formData, regression: e.target.checked })
                          }
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Regression</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                    >
                      {editingTestCase ? 'Update' : 'Create'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false)
                        setEditingTestCase(null)
                        setFormData({
                          title: '',
                          description: '',
                          automated: false,
                          priority: 2,
                          severity: 'Moderate',
                          regression: true,
                          labels: '',
                          order: '',
                        })
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

