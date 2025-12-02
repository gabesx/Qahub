'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '../../../../../../components/AppHeader'
import { api } from '../../../../../../../lib/api'

interface TestPlanCase {
  id: string
  order: number
  testCase: {
    id: string
    title: string
    automated: boolean
    priority: number
    severity: string | null
  }
}

interface TestPlan {
  id: string
  title: string
  description: string | null
  status: 'draft' | 'active' | 'archived'
  testPlanCases: TestPlanCase[]
  _count?: {
    testPlanCases?: number
    testRuns?: number
  }
}

interface TestCase {
  id: string
  title: string
  automated: boolean
  priority: number
  severity: string | null
}

interface Project {
  id: string
  title: string
}

interface Repository {
  id: string
  title: string
}

export default function TestPlanDetailPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const repoId = params.repoId as string
  const testPlanId = params.testPlanId as string

  const [project, setProject] = useState<Project | null>(null)
  const [repository, setRepository] = useState<Repository | null>(null)
  const [testPlan, setTestPlan] = useState<TestPlan | null>(null)
  const [availableTestCases, setAvailableTestCases] = useState<TestCase[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedTestCases, setSelectedTestCases] = useState<Set<string>>(new Set())

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    fetchProject()
    fetchRepository()
    fetchTestPlan()
  }, [projectId, repoId, testPlanId, router])

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

  const fetchTestPlan = async () => {
    try {
      setIsLoading(true)
      const response = await api.get(
        `/projects/${projectId}/repositories/${repoId}/test-plans/${testPlanId}`
      )
      setTestPlan(response.data.data.testPlan)
    } catch (err: any) {
      console.error('Failed to fetch test plan:', err)
      setError(err.response?.data?.error?.message || 'Failed to fetch test plan')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAvailableTestCases = async () => {
    try {
      // Fetch all suites first, then get test cases from each suite
      const suitesResponse = await api.get(
        `/projects/${projectId}/repositories/${repoId}/suites`
      )
      const suites = suitesResponse.data.data.suites

      // Get test cases from all suites
      const allTestCases: TestCase[] = []
      for (const suite of suites) {
        try {
          const testCasesResponse = await api.get(
            `/projects/${projectId}/repositories/${repoId}/suites/${suite.id}/test-cases?limit=1000`
          )
          allTestCases.push(...testCasesResponse.data.data.testCases)
        } catch (err) {
          console.error(`Failed to fetch test cases for suite ${suite.id}:`, err)
        }
      }

      // Filter out test cases already in the plan
      const planCaseIds = new Set(testPlan?.testPlanCases.map((pc) => pc.testCase.id) || [])
      setAvailableTestCases(allTestCases.filter((tc) => !planCaseIds.has(tc.id)))
    } catch (err: any) {
      console.error('Failed to fetch available test cases:', err)
    }
  }

  const handleAddTestCases = async () => {
    if (selectedTestCases.size === 0) return

    try {
      await Promise.all(
        Array.from(selectedTestCases).map((testCaseId) =>
          api.post(
            `/projects/${projectId}/repositories/${repoId}/test-plans/${testPlanId}/test-cases`,
            { testCaseId }
          )
        )
      )
      setShowAddModal(false)
      setSelectedTestCases(new Set())
      fetchTestPlan()
    } catch (err: any) {
      console.error('Failed to add test cases:', err)
      alert(err.response?.data?.error?.message || 'Failed to add test cases')
    }
  }

  const handleRemoveTestCase = async (testCaseId: string) => {
    if (!confirm('Are you sure you want to remove this test case from the plan?')) return

    try {
      await api.delete(
        `/projects/${projectId}/repositories/${repoId}/test-plans/${testPlanId}/test-cases/${testCaseId}`
      )
      fetchTestPlan()
    } catch (err: any) {
      console.error('Failed to remove test case:', err)
      alert(err.response?.data?.error?.message || 'Failed to remove test case')
    }
  }

  const handleMoveUp = async (testCaseId: string, currentOrder: number) => {
    if (currentOrder <= 1) return

    try {
      await api.patch(
        `/projects/${projectId}/repositories/${repoId}/test-plans/${testPlanId}/test-cases/${testCaseId}/order`,
        { order: currentOrder - 1 }
      )
      fetchTestPlan()
    } catch (err: any) {
      console.error('Failed to move test case:', err)
      alert(err.response?.data?.error?.message || 'Failed to move test case')
    }
  }

  const handleMoveDown = async (testCaseId: string, currentOrder: number) => {
    const maxOrder = testPlan?.testPlanCases.length || 0
    if (currentOrder >= maxOrder) return

    try {
      await api.patch(
        `/projects/${projectId}/repositories/${repoId}/test-plans/${testPlanId}/test-cases/${testCaseId}/order`,
        { order: currentOrder + 1 }
      )
      fetchTestPlan()
    } catch (err: any) {
      console.error('Failed to move test case:', err)
      alert(err.response?.data?.error?.message || 'Failed to move test case')
    }
  }

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedTestCases)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedTestCases(newSelected)
  }

  const getPriorityColor = (priority: number) => {
    if (priority === 1) return 'bg-red-100 text-red-800'
    if (priority === 2) return 'bg-orange-100 text-orange-800'
    if (priority === 3) return 'bg-yellow-100 text-yellow-800'
    if (priority === 4) return 'bg-blue-100 text-blue-800'
    return 'bg-gray-100 text-gray-800'
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading test plan...</p>
          </div>
        </main>
      </div>
    )
  }

  if (error || !testPlan) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
            <p className="text-red-600">{error || 'Test plan not found'}</p>
            <Link
              href={`/projects/${projectId}/repository/${repoId}/test-plans`}
              className="mt-4 inline-block text-primary-600 hover:text-primary-700"
            >
              Back to Test Plans
            </Link>
          </div>
        </main>
      </div>
    )
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
              href={`/projects/${projectId}/repository/${repoId}/test-plans`}
              className="hover:text-gray-900"
            >
              Test Plans
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">{testPlan.title}</span>
          </div>
        </nav>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{testPlan.title}</h1>
              {testPlan.description && (
                <p className="text-gray-600 mt-1">{testPlan.description}</p>
              )}
              <div className="flex items-center gap-4 mt-3">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    testPlan.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : testPlan.status === 'draft'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {testPlan.status}
                </span>
                <span className="text-sm text-gray-500">
                  {testPlan.testPlanCases.length} test case{testPlan.testPlanCases.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setShowAddModal(true)
                fetchAvailableTestCases()
                setSelectedTestCases(new Set())
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              + Add Test Cases
            </button>
          </div>
        </div>

        {/* Test Cases List */}
        {testPlan.testPlanCases.length === 0 ? (
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
              Add test cases to this plan to get started
            </p>
            <button
              onClick={() => {
                setShowAddModal(true)
                fetchAvailableTestCases()
                setSelectedTestCases(new Set())
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Add Test Cases
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order
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
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {testPlan.testPlanCases.map((planCase, index) => (
                  <tr key={planCase.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleMoveUp(planCase.testCase.id, planCase.order)}
                          disabled={index === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <span className="text-sm font-medium text-gray-900">{planCase.order}</span>
                        <button
                          onClick={() => handleMoveDown(planCase.testCase.id, planCase.order)}
                          disabled={index === testPlan.testPlanCases.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {planCase.testCase.title}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(
                          planCase.testCase.priority
                        )}`}
                      >
                        P{planCase.testCase.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {planCase.testCase.severity || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {planCase.testCase.automated ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Automated
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleRemoveTestCase(planCase.testCase.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Test Cases Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Add Test Cases</h2>
                {availableTestCases.length === 0 ? (
                  <p className="text-gray-600">No available test cases to add.</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
                    {availableTestCases.map((testCase) => (
                      <label
                        key={testCase.id}
                        className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTestCases.has(testCase.id)}
                          onChange={() => toggleSelection(testCase.id)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{testCase.title}</div>
                          <div className="text-sm text-gray-500">
                            Priority {testCase.priority} •{' '}
                            {testCase.automated ? 'Automated' : 'Manual'}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={handleAddTestCases}
                    disabled={selectedTestCases.size === 0}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Selected ({selectedTestCases.size})
                  </button>
                  <button
                    onClick={() => {
                      setShowAddModal(false)
                      setSelectedTestCases(new Set())
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

