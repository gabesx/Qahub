'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '../components/AppHeader'
import { TestCaseDetailModal } from '../projects/[id]/components/TestCaseDetailModal'
import { api } from '../../lib/api'

interface Repository {
  id: string
  title: string
  description: string | null
  prefix: string
  project: {
    id: string
    title: string
  }
  counts?: {
    suites?: number
    testCases?: number
  }
}

interface TestSuite {
  id: string
  title: string
  repositoryId: string
  repository: {
    id: string
    title: string
    prefix: string
  }
  project: {
    id: string
    title: string
  }
  counts?: {
    testCases: number
  }
}

interface TestCase {
  id: string
  title: string
  description: string | null
  automated: boolean
  priority: number
  severity: string
  jiraKey?: string | null
  suiteId: string
  suite: {
    id: string
    title: string
  }
  repository: {
    id: string
    title: string
    prefix: string
  }
  project: {
    id: string
    title: string
  }
  updatedAt: string
}

interface Project {
  id: string
  title: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function RepositoriesPage() {
  const router = useRouter()
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  
  // Modal state
  const [isTestCaseModalOpen, setIsTestCaseModalOpen] = useState(false)
  const [isLoadingTestCaseDetail, setIsLoadingTestCaseDetail] = useState(false)
  const [modalTestCase, setModalTestCase] = useState<any>(null)
  const [modalRepository, setModalRepository] = useState<Repository | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    fetchData()
  }, [router])

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      if (pagination.page === 1) {
        fetchData()
      } else {
        setPagination(prev => ({ ...prev, page: 1 }))
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    fetchData()
  }, [pagination.page, pagination.limit])

  const fetchData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch all projects first
      const projectsResponse = await api.get('/projects', {
        params: { page: 1, limit: 100 },
      })

      const projects: Project[] = projectsResponse.data?.data?.projects || []

      if (projects.length === 0) {
        setTestCases([])
        setPagination(prev => ({ ...prev, total: 0, totalPages: 0 }))
        setIsLoading(false)
        return
      }

      await fetchTestCases(projects)
    } catch (err: any) {
      console.error('Fetch data error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to fetch data')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTestCases = async (projects: Project[]) => {
    const allTestCases: TestCase[] = []

    // Fetch repositories, suites, and test cases for each project
    for (const project of projects) {
      try {
        const reposResponse = await api.get(`/projects/${project.id}/repositories`, {
          params: { page: 1, limit: 100 },
        })
        const repos = reposResponse.data?.data?.repositories || []

        for (const repo of repos) {
          try {
            const suitesResponse = await api.get(
              `/projects/${project.id}/repositories/${repo.id}/suites`,
              { params: { page: 1, limit: 1000 } }
            )
            const suites = suitesResponse.data?.data?.suites || []

            for (const suite of suites) {
              try {
                const testCasesResponse = await api.get(
                  `/projects/${project.id}/repositories/${repo.id}/suites/${suite.id}/test-cases`,
                  { params: { page: 1, limit: 1000, includeDeleted: false } }
                )
                const testCases = testCasesResponse.data?.data?.testCases || []
                testCases.forEach((tc: any) => {
                  allTestCases.push({
                    ...tc,
                    suiteId: suite.id,
                    suite: { id: suite.id, title: suite.title },
                    repository: { id: repo.id, title: repo.title, prefix: repo.prefix },
                    project: { id: project.id, title: project.title },
                  })
                })
              } catch (err) {
                console.error(`Error fetching test cases for suite ${suite.id}:`, err)
              }
            }
          } catch (err) {
            console.error(`Error fetching suites for repository ${repo.id}:`, err)
          }
        }
      } catch (err) {
        console.error(`Error fetching repositories for project ${project.id}:`, err)
      }
    }

    // Apply search filter
    let filteredCases = allTestCases
    if (search.trim()) {
      const searchLower = search.toLowerCase()
      filteredCases = allTestCases.filter(
        (tc) =>
          tc.title.toLowerCase().includes(searchLower) ||
          tc.description?.toLowerCase().includes(searchLower) ||
          tc.suite.title.toLowerCase().includes(searchLower) ||
          tc.repository.title.toLowerCase().includes(searchLower) ||
          tc.project.title.toLowerCase().includes(searchLower)
      )
    }

    // Sort by updatedAt descending
    filteredCases = filteredCases.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )

    // Apply pagination
    const total = filteredCases.length
    const totalPages = Math.ceil(total / pagination.limit)
    const startIndex = (pagination.page - 1) * pagination.limit
    const endIndex = startIndex + pagination.limit
    const paginatedCases = filteredCases.slice(startIndex, endIndex)

    setTestCases(paginatedCases)
    setPagination(prev => ({
      ...prev,
      total,
      totalPages,
    }))
  }

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePageSizeChange = (newLimit: number) => {
    setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInDays === 0) {
      return 'Today'
    } else if (diffInDays === 1) {
      return 'Yesterday'
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      })
    }
  }

  const getPriorityColor = (priority: number) => {
    if (priority <= 1) return 'bg-red-100 text-red-700 border-red-200'
    if (priority <= 2) return 'bg-orange-100 text-orange-700 border-orange-200'
    if (priority <= 3) return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    return 'bg-blue-100 text-blue-700 border-blue-200'
  }

  const getPriorityLabel = (priority: number) => {
    if (priority <= 1) return 'Critical'
    if (priority <= 2) return 'High'
    if (priority <= 3) return 'Medium'
    return 'Low'
  }

  const openTestCaseModal = async (testCase: TestCase) => {
    setIsTestCaseModalOpen(true)
    setIsLoadingTestCaseDetail(true)
    setModalTestCase(null)
    setModalRepository({
      id: testCase.repository.id,
      title: testCase.repository.title,
      description: null,
      prefix: testCase.repository.prefix,
      project: testCase.project,
    })

    try {
      const response = await api.get(
        `/projects/${testCase.project.id}/repositories/${testCase.repository.id}/suites/${testCase.suiteId}/test-cases/${testCase.id}`
      )

      if (response.data?.data?.testCase) {
        setModalTestCase(response.data.data.testCase)
      }
    } catch (err: any) {
      console.error('Fetch test case detail error:', err)
      setError(err.response?.data?.error?.message || 'Failed to fetch test case details')
    } finally {
      setIsLoadingTestCaseDetail(false)
    }
  }

  const closeTestCaseModal = () => {
    setIsTestCaseModalOpen(false)
    setModalTestCase(null)
    setModalRepository(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">All Repositories</h1>
          <p className="text-gray-600">View all repositories, test suites, and test cases across all projects</p>
        </div>


        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search test cases..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2.5 pl-10 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        ) : (
          <>
            {/* Test Cases */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {testCases.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-gray-600">No test cases found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Prefix
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Title
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Project
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Repository
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Suite
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Priority
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Updated
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {testCases.map((testCase) => (
                          <tr 
                            key={testCase.id} 
                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => openTestCaseModal(testCase)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-medium text-primary-600">
                                {testCase.repository.prefix}-{testCase.id}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-medium text-gray-900">
                                {testCase.title}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {testCase.project.title}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {testCase.repository.title}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {testCase.suite.title}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getPriorityColor(
                                  testCase.priority
                                )}`}
                              >
                                {getPriorityLabel(testCase.priority)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {testCase.automated ? (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full border bg-emerald-100 text-emerald-700 border-emerald-200">
                                  Automated
                                </span>
                              ) : (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full border bg-gray-100 text-gray-700 border-gray-200">
                                  Manual
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(testCase.updatedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            {/* Pagination */}
            {(pagination.totalPages > 1 || pagination.total > 0) && (
              <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <p className="text-sm text-gray-700">
                    Showing{' '}
                    <span className="font-medium">
                      {(pagination.page - 1) * pagination.limit + 1}
                    </span>{' '}
                    to{' '}
                    <span className="font-medium">
                      {Math.min(pagination.page * pagination.limit, pagination.total)}
                    </span>{' '}
                    of <span className="font-medium">{pagination.total}</span> results
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Show:</label>
                    <select
                      value={pagination.limit}
                      onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                      className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    >
                      <option value={20}>20</option>
                      <option value={40}>40</option>
                      <option value={60}>60</option>
                    </select>
                  </div>
                </div>
                {pagination.totalPages > 1 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                        let pageNum: number
                        if (pagination.totalPages <= 7) {
                          pageNum = i + 1
                        } else if (pagination.page <= 4) {
                          pageNum = i + 1
                        } else if (pagination.page >= pagination.totalPages - 3) {
                          pageNum = pagination.totalPages - 6 + i
                        } else {
                          pageNum = pagination.page - 3 + i
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                              pagination.page === pageNum
                                ? 'bg-primary-600 text-white'
                                : 'border border-gray-300 text-gray-700 hover:bg-gray-50 bg-white'
                            }`}
                          >
                            {pageNum}
                          </button>
                        )
                      })}
                    </div>
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Test Case Detail Modal */}
      <TestCaseDetailModal
        isOpen={isTestCaseModalOpen}
        onClose={closeTestCaseModal}
        isLoading={isLoadingTestCaseDetail}
        testCase={modalTestCase}
        repository={modalRepository}
      />
    </div>
  )
}

