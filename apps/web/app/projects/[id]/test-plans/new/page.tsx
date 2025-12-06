'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppHeader from '../../../../components/AppHeader'
import { api } from '../../../../../lib/api'

interface Repository {
  id: string
  title: string
  projectId: string
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

export default function CreateTestPlanPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const [repositories, setRepositories] = useState<Repository[]>([])
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<string>('')
  const [testSuites, setTestSuites] = useState<TestSuite[]>([])
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [selectedTestCases, setSelectedTestCases] = useState<Set<string>>(new Set())
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: `Test plan - ${new Date().toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/,/g, '')}`,
    description: '',
  })
  const [repository, setRepository] = useState<{ id: string; title: string; prefix: string } | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    if (projectId) {
      fetchRepositories()
    }
  }, [projectId, router])

  useEffect(() => {
    if (selectedRepositoryId && projectId) {
      fetchTestSuites()
    } else {
      setTestSuites([])
      setTestCases([])
      setSelectedTestCases(new Set())
    }
  }, [selectedRepositoryId, projectId])

  const fetchRepositories = async () => {
    setIsLoading(true)
    try {
      const response = await api.get(`/projects/${projectId}/repositories`)
      const repos = response.data?.data?.repositories || []
      setRepositories(repos)
    } catch (err: any) {
      console.error('Fetch repositories error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to fetch repositories')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTestSuites = async () => {
    if (!selectedRepositoryId || !projectId) return
    
    try {
      // Fetch repository details to get prefix
      const repoResponse = await api.get(`/projects/${projectId}/repositories/${selectedRepositoryId}`)
      if (repoResponse.data?.data?.repository) {
        setRepository(repoResponse.data.data.repository)
      }

      const response = await api.get(
        `/projects/${projectId}/repositories/${selectedRepositoryId}/suites`
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
            `/projects/${projectId}/repositories/${selectedRepositoryId}/suites/${suiteId}/test-cases`,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedRepositoryId || !projectId) {
      setError('Please select a test repository')
      return
    }

    if (!formData.title.trim()) {
      setError('Test plan name is required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Create test plan
      const createResponse = await api.post(
        `/projects/${projectId}/repositories/${selectedRepositoryId}/test-plans`,
        {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          status: 'draft',
        }
      )

      const testPlanId = createResponse.data?.data?.testPlan?.id

      if (!testPlanId) {
        throw new Error('Failed to create test plan')
      }

      // Add selected test cases to test plan
      if (selectedTestCases.size > 0) {
        const testCaseIds = Array.from(selectedTestCases)
        await api.post(
          `/projects/${projectId}/repositories/${selectedRepositoryId}/test-plans/${testPlanId}/test-cases`,
          {
            testCaseIds,
          }
        )
      }

      // Redirect to project page
      router.push(`/projects/${projectId}`)
    } catch (err: any) {
      console.error('Create test plan error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to create test plan')
      }
    } finally {
      setIsSubmitting(false)
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
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Test Plan</h1>
              <p className="text-gray-600">Create a new test plan and select test cases to include</p>
            </div>
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Back to Test Plans
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Create Test Plan Form */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Create Test Plan</h2>

              <div className="space-y-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                    placeholder="Test plan name"
                  />
                </div>

                {/* Test Repository */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Test Repository <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedRepositoryId}
                    onChange={(e) => setSelectedRepositoryId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-white"
                  >
                    <option value="">Select Repository</option>
                    {repositories.map(repo => (
                      <option key={repo.id} value={repo.id}>
                        {repo.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition resize-none"
                    placeholder="Test plan description (optional)"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Creating...
                      </>
                    ) : (
                      'Save'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/projects/${projectId}`)}
                    className="px-6 py-2.5 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Select Test Cases */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Select Test Cases</h2>
                {selectedRepositoryId && (
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
                )}
              </div>

              <div className="text-sm text-gray-600 mb-4">
                {selectedTestCases.size} test case{selectedTestCases.size !== 1 ? 's' : ''} selected
              </div>

              {!selectedRepositoryId ? (
                <div className="text-center py-12 text-gray-500">
                  <p>Please select a test repository to view test cases</p>
                </div>
              ) : testSuites.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No test suites found in this repository</p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg p-4 max-h-[600px] overflow-y-auto">
                  {renderSuiteTree(testSuites)}
                </div>
              )}

              {selectedTestCases.size > 0 && (
                <div className="mt-4 p-3 bg-primary-50 border border-primary-200 rounded-lg">
                  <p className="text-sm text-primary-700">
                    <strong>{selectedTestCases.size}</strong> test case{selectedTestCases.size !== 1 ? 's' : ''} selected
                  </p>
                </div>
              )}
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}

