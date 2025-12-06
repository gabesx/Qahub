'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '../../../../../../components/AppHeader'
import { api } from '../../../../../../../lib/api'
import { formatTimeAgo } from '../../../../utils/formatTimeAgo'

interface TestPlan {
  id: string
  title: string
  description: string | null
  status: 'draft' | 'active' | 'archived'
  project: {
    id: string
    title: string
  }
  repository: {
    id: string
    title: string
    prefix: string
  }
  counts: {
    testCases: number
    testRuns: number
  }
  testCases: Array<{
    id: string
    title: string
    automated: boolean
    priority: number
    severity: string
    order: number
  }>
  createdBy: {
    id: string
    name: string
    email: string
  } | null
  updatedBy: {
    id: string
    name: string
    email: string
  } | null
  createdAt: string
  updatedAt: string
}

interface TestSuite {
  id: string
  title: string
  parentId: string | null
  children?: TestSuite[]
  counts?: {
    testCases: number
    children: number
  }
}

interface TestCase {
  id: string
  title: string
  jiraKey: string | null
  suiteId: string
}

export default function TestPlanDetailPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const repoId = params.repoId as string
  const testPlanId = params.testPlanId as string

  const [testPlan, setTestPlan] = useState<TestPlan | null>(null)
  const [testSuites, setTestSuites] = useState<TestSuite[]>([])
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [selectedTestCases, setSelectedTestCases] = useState<Set<string>>(new Set())
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'draft' as 'draft' | 'active' | 'archived',
  })
  const [repository, setRepository] = useState<{ id: string; title: string; prefix: string } | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    fetchTestPlan()
    fetchTestSuites()
  }, [projectId, repoId, testPlanId, router])

  const fetchTestPlan = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await api.get(
        `/projects/${projectId}/repositories/${repoId}/test-plans/${testPlanId}`
      )

      const testPlanData = response.data?.data?.testPlan
      if (testPlanData) {
        setTestPlan(testPlanData)
        setFormData({
          title: testPlanData.title,
          description: testPlanData.description || '',
          status: testPlanData.status || 'draft',
        })
        // Set initially selected test cases
        setSelectedTestCases(new Set(testPlanData.testCases.map((tc: any) => tc.id)))
        
        // Fetch repository details to get prefix
        try {
          const repoResponse = await api.get(`/projects/${projectId}/repositories/${repoId}`)
          if (repoResponse.data?.data?.repository) {
            setRepository(repoResponse.data.data.repository)
          }
        } catch (err) {
          console.error('Error fetching repository:', err)
        }
      } else {
        setError('Test plan not found')
      }
    } catch (err: any) {
      console.error('Fetch test plan error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else if (err.response?.status === 404) {
        setError('Test plan not found')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to fetch test plan')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTestSuites = async () => {
    try {
      const response = await api.get(
        `/projects/${projectId}/repositories/${repoId}/suites`,
        { params: { page: 1, limit: 1000 } }
      )
      const suites = response.data?.data?.suites || []
      
      // Build tree structure
      const suiteMap = new Map<string, TestSuite>()
      const rootSuites: TestSuite[] = []
      
      suites.forEach((suite: any) => {
        suiteMap.set(suite.id, {
          id: suite.id,
          title: suite.title,
          parentId: suite.parentId,
          children: [],
          counts: suite.counts,
        })
      })
      
      suites.forEach((suite: any) => {
        const suiteNode = suiteMap.get(suite.id)!
        if (suite.parentId) {
          const parent = suiteMap.get(suite.parentId)
          if (parent) {
            if (!parent.children) parent.children = []
            parent.children.push(suiteNode)
          } else {
            rootSuites.push(suiteNode)
          }
        } else {
          rootSuites.push(suiteNode)
        }
      })
      
      setTestSuites(rootSuites)
      // Start with all suites collapsed for better performance
      setExpandedSuites(new Set())
      
      // Fetch test cases after suites are loaded
      const allTestCases: TestCase[] = []
      
      const fetchSuiteCases = async (suiteId: string) => {
        try {
          const response = await api.get(
            `/projects/${projectId}/repositories/${repoId}/suites/${suiteId}/test-cases`,
            { params: { limit: 1000, includeDeleted: false } }
          )
          const cases = response.data?.data?.testCases || []
          cases.forEach((tc: any) => {
            allTestCases.push({
              id: tc.id,
              title: tc.title,
              jiraKey: tc.jiraKey,
              suiteId: suiteId,
            })
          })
        } catch (err) {
          console.error(`Error fetching test cases for suite ${suiteId}:`, err)
        }
      }
      
      const fetchRecursive = async (suite: TestSuite) => {
        await fetchSuiteCases(suite.id)
        if (suite.children) {
          for (const child of suite.children) {
            await fetchRecursive(child)
          }
        }
      }
      
      // Fetch test cases from all suites
      for (const suite of rootSuites) {
        await fetchRecursive(suite)
      }
      
      setTestCases(allTestCases)
    } catch (err: any) {
      console.error('Fetch test suites error:', err)
      setError(err.response?.data?.error?.message || 'Failed to fetch test suites')
    }
  }

  const toggleSuiteExpansion = (suiteId: string) => {
    setExpandedSuites(prev => {
      const newSet = new Set(prev)
      if (newSet.has(suiteId)) {
        newSet.delete(suiteId)
      } else {
        newSet.add(suiteId)
      }
      return newSet
    })
  }

  const toggleTestCaseSelection = (testCaseId: string) => {
    setSelectedTestCases(prev => {
      const newSet = new Set(prev)
      if (newSet.has(testCaseId)) {
        newSet.delete(testCaseId)
      } else {
        newSet.add(testCaseId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    setSelectedTestCases(new Set(testCases.map(tc => tc.id)))
  }

  const handleDeselectAll = () => {
    setSelectedTestCases(new Set())
  }

  const handleExpandAll = () => {
    const allSuiteIds = new Set<string>()
    const collectSuiteIds = (suites: TestSuite[]) => {
      suites.forEach(suite => {
        allSuiteIds.add(suite.id)
        if (suite.children && suite.children.length > 0) {
          collectSuiteIds(suite.children)
        }
      })
    }
    collectSuiteIds(testSuites)
    setExpandedSuites(allSuiteIds)
  }

  const handleCollapseAll = () => {
    setExpandedSuites(new Set())
  }

  const getTestCasesForSuite = (suiteId: string): TestCase[] => {
    return testCases.filter(tc => tc.suiteId === suiteId)
  }

  const getAllTestCasesForSuiteAndChildren = (suite: TestSuite): TestCase[] => {
    let cases = getTestCasesForSuite(suite.id)
    if (suite.children) {
      suite.children.forEach(child => {
        cases = cases.concat(getAllTestCasesForSuiteAndChildren(child))
      })
    }
    return cases
  }

  const handleSuiteCheckbox = (suite: TestSuite, checked: boolean) => {
    const suiteCases = getAllTestCasesForSuiteAndChildren(suite)
    setSelectedTestCases(prev => {
      const newSet = new Set(prev)
      if (checked) {
        suiteCases.forEach(tc => newSet.add(tc.id))
      } else {
        suiteCases.forEach(tc => newSet.delete(tc.id))
      }
      return newSet
    })
  }

  const isSuiteFullySelected = (suite: TestSuite): boolean => {
    const suiteCases = getAllTestCasesForSuiteAndChildren(suite)
    if (suiteCases.length === 0) return false
    return suiteCases.every(tc => selectedTestCases.has(tc.id))
  }

  const isSuitePartiallySelected = (suite: TestSuite): boolean => {
    const suiteCases = getAllTestCasesForSuiteAndChildren(suite)
    if (suiteCases.length === 0) return false
    const selectedCount = suiteCases.filter(tc => selectedTestCases.has(tc.id)).length
    return selectedCount > 0 && selectedCount < suiteCases.length
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      setError('Test plan name is required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Update test plan details
      await api.patch(
        `/projects/${projectId}/repositories/${repoId}/test-plans/${testPlanId}`,
        {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          status: formData.status,
        }
      )

      // Get current test case IDs from the test plan
      const currentTestCaseIds = testPlan?.testCases.map(tc => tc.id) || []
      const newTestCaseIds = Array.from(selectedTestCases)
      
      // Find test cases to add and remove
      const toAdd = newTestCaseIds.filter(id => !currentTestCaseIds.includes(id))
      const toRemove = currentTestCaseIds.filter(id => !newTestCaseIds.includes(id))

      // Remove test cases
      for (const testCaseId of toRemove) {
        try {
          await api.delete(
            `/projects/${projectId}/repositories/${repoId}/test-plans/${testPlanId}/test-cases/${testCaseId}`
          )
        } catch (err) {
          console.error(`Error removing test case ${testCaseId}:`, err)
        }
      }

      // Add new test cases
      if (toAdd.length > 0) {
        await api.post(
          `/projects/${projectId}/repositories/${repoId}/test-plans/${testPlanId}/test-cases`,
          {
            testCaseIds: toAdd,
          }
        )
      }

      // Refresh test plan data
      await fetchTestPlan()
      
      // Show success modal
      setShowSuccessModal(true)
    } catch (err: any) {
      console.error('Update test plan error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to update test plan')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setError(null)

    try {
      await api.delete(
        `/projects/${projectId}/repositories/${repoId}/test-plans/${testPlanId}`
      )
      
      // Redirect to project page
      router.push(`/projects/${projectId}`)
    } catch (err: any) {
      console.error('Delete test plan error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else if (err.response?.status === 409) {
        setError(err.response?.data?.error?.message || 'Cannot delete test plan that has test runs')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to delete test plan')
      }
    } finally {
      setIsDeleting(false)
      setShowDeleteModal(false)
    }
  }

  const renderSuiteTree = (suites: TestSuite[], level: number = 0): JSX.Element[] => {
    return suites.map(suite => {
      const suiteCases = getAllTestCasesForSuiteAndChildren(suite)
      const hasChildren = suite.children && suite.children.length > 0
      const hasTestCases = getTestCasesForSuite(suite.id).length > 0
      const isExpanded = expandedSuites.has(suite.id)
      const isFullySelected = isSuiteFullySelected(suite)
      const isPartiallySelected = isSuitePartiallySelected(suite)

      return (
        <div key={suite.id} className="mb-1">
          <div
            className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-50 rounded"
            style={{ paddingLeft: `${level * 20 + 8}px` }}
          >
            {(hasChildren || hasTestCases) && (
              <button
                type="button"
                onClick={() => toggleSuiteExpansion(suite.id)}
                className="text-gray-400 hover:text-gray-600 p-0.5 flex-shrink-0"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                <svg
                  className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
            {!hasChildren && !hasTestCases && <div className="w-4 h-4 flex-shrink-0" />}
            <input
              type="checkbox"
              checked={isFullySelected}
              ref={(el) => {
                if (el) {
                  el.indeterminate = isPartiallySelected
                }
              }}
              onChange={(e) => handleSuiteCheckbox(suite, e.target.checked)}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 flex-shrink-0"
            />
            <span className="text-sm font-medium text-gray-700 flex-1 truncate" title={suite.title}>
              {suite.title}
            </span>
            {suiteCases.length > 0 && (
              <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                ({suiteCases.length})
              </span>
            )}
          </div>
          {/* Show child suites if expanded */}
          {hasChildren && isExpanded && (
            <div className="ml-4">
              {renderSuiteTree(suite.children!, level + 1)}
            </div>
          )}
          {/* Show test cases for this suite if expanded */}
          {hasTestCases && isExpanded && (
            <div className="ml-8" style={{ paddingLeft: `${level * 20}px` }}>
              {getTestCasesForSuite(suite.id).map(testCase => {
                const prefixId = testCase.jiraKey || `${repository?.prefix || 'ST'}-${testCase.id}`
                return (
                  <label
                    key={testCase.id}
                    className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTestCases.has(testCase.id)}
                      onChange={() => toggleTestCaseSelection(testCase.id)}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 flex-shrink-0"
                    />
                    <span className="text-sm text-gray-600 flex-1 truncate" title={testCase.title}>
                      <span className="text-primary-600 font-medium">{prefixId}</span>: {testCase.title}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      )
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading test plan...</p>
          </div>
        </main>
      </div>
    )
  }

  if (error && !testPlan) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-24 h-24 rounded-full border-4 border-red-200 flex items-center justify-center mb-6 mx-auto">
              <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Error</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link
              href={`/projects/${projectId}/repositories/${repoId}`}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium inline-block"
            >
              Back to Repository
            </Link>
          </div>
        </main>
      </div>
    )
  }

  if (!testPlan) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Edit Test Plan → {testPlan.title}
              </h1>
              <p className="text-gray-600">Edit test plan details and manage test cases</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/projects/${projectId}?tab=testPlans`}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Test Plans
              </Link>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Test Plan Details */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Test Plan Details</h2>
            <form onSubmit={handleUpdate}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="repository" className="block text-sm font-medium text-gray-700 mb-2">
                    Test Repository
                  </label>
                  <input
                    type="text"
                    id="repository"
                    value={testPlan.repository.title}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition resize-none"
                  />
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'draft' | 'active' | 'archived' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-white"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Updating...</span>
                      </>
                    ) : (
                      'Update'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/projects/${projectId}`)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>

            {/* Change Log */}
            {testPlan.updatedBy && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Change Log</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Updated by</span>
                    <span className="font-medium text-gray-900">{testPlan.updatedBy.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">When</span>
                    <span className="text-gray-900">{formatTimeAgo(testPlan.updatedAt)}</span>
                  </div>
                  {testPlan.createdBy && (
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100">
                      <span className="text-gray-600">Created by</span>
                      <span className="font-medium text-gray-900">{testPlan.createdBy.name}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Select Test Cases */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Select Test Cases</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Deselect All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="text-sm text-gray-600 hover:text-gray-700 font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  Expand All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="text-sm text-gray-600 hover:text-gray-700 font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  Collapse All
                </button>
              </div>
            </div>

            <div className="text-sm text-gray-600 mb-4">
              {selectedTestCases.size} test case{selectedTestCases.size !== 1 ? 's' : ''} selected
            </div>

            <div className="border border-gray-200 rounded-lg p-4 max-h-[600px] overflow-y-auto">
              {testSuites.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No test suites found</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {renderSuiteTree(testSuites)}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">Delete Test Plan</h3>
                  <p className="text-sm text-gray-600 mt-1">This action cannot be undone.</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-700 mb-2">
                  Are you sure you want to delete <span className="font-semibold text-gray-900">{testPlan.title}</span>?
                </p>
                <p className="text-xs text-gray-500">
                  This will permanently delete the test plan. Test cases will not be deleted, only their association with this test plan.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false)
                    setError(null)
                  }}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    'Delete Test Plan'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">Test Plan Updated</h3>
                  <p className="text-sm text-gray-600 mt-1">Your changes have been saved successfully.</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-700 mb-2">
                  Test plan <span className="font-semibold text-gray-900">{testPlan?.title}</span> has been updated.
                </p>
                <p className="text-xs text-gray-500">
                  The test plan details and test case selections have been saved. You will be redirected to the project page.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowSuccessModal(false)
                    router.push(`/projects/${projectId}`)
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
