'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '../components/AppHeader'
import { api } from '../../lib/api'

interface Stats {
  projects: number
  squads: number
  testPlans: number
  testRuns: number
  testCases: number
}

interface TestCase {
  id: string
  title: string
  automated: boolean
  priority: number
  severity: string | null
  suite: {
    id: string
    title: string
  }
  repository: {
    id: string
    title: string
  }
  project: {
    id: string
    title: string
  }
  createdAt: string
  updatedAt: string
}

interface TestRun {
  id: string
  title: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  executionDate: string | null
  startedAt: string | null
  completedAt: string | null
  environment: string | null
  buildVersion: string | null
  testPlan: {
    id: string
    title: string
  }
  repository: {
    id: string
    title: string
  } | null
  project: {
    id: string
    title: string
  }
  stats: {
    total: number
    passed: number
    failed: number
    skipped: number
    blocked: number
  }
  createdAt: string
  updatedAt: string
}

interface Project {
  id: string
  title: string
}

interface Repository {
  id: string
  title: string
  projectId: string
}

interface Suite {
  id: string
  title: string
  repositoryId: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({
    projects: 0,
    squads: 0,
    testPlans: 0,
    testRuns: 0,
    testCases: 0,
  })
  const [recentTestCases, setRecentTestCases] = useState<TestCase[]>([])
  const [isLoadingTestCases, setIsLoadingTestCases] = useState(false)
  const [recentTestRuns, setRecentTestRuns] = useState<TestRun[]>([])
  const [isLoadingTestRuns, setIsLoadingTestRuns] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    fetchStats()
    fetchRecentTestCases()
    fetchRecentTestRuns()
    setIsLoading(false)
  }, [router])

  const fetchStats = async () => {
    try {
      const response = await api.get('/projects/stats')
      if (response.data?.data) {
        setStats({
          projects: response.data.data.projects || 0,
          squads: response.data.data.squads || 0,
          testPlans: response.data.data.testPlans || 0,
          testRuns: response.data.data.testRuns || 0,
          testCases: response.data.data.testCases || 0,
        })
      }
    } catch (err: any) {
      console.error('Error fetching stats:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      }
    }
  }

  const fetchRecentTestCases = async () => {
    setIsLoadingTestCases(true)
    try {
      // Fetch first few projects
      const projectsResponse = await api.get('/projects', {
        params: { page: 1, limit: 3 },
      })

      const projects: Project[] = projectsResponse.data?.data?.projects || []

      if (projects.length === 0) {
        setIsLoadingTestCases(false)
        return
      }

      // Fetch repositories for each project
      const repositoriesPromises = projects.map((project) =>
        api.get(`/projects/${project.id}/repositories`).catch(() => ({ data: { data: { repositories: [] } } }))
      )

      const repositoriesResponses = await Promise.all(repositoriesPromises)
      const allRepositories: Repository[] = []

      repositoriesResponses.forEach((response, index) => {
        const repos = response.data?.data?.repositories || []
        repos.forEach((repo: Repository) => {
          allRepositories.push({ ...repo, projectId: projects[index].id })
        })
      })

      if (allRepositories.length === 0) {
        setIsLoadingTestCases(false)
        return
      }

      // Fetch suites for each repository (limit to first 2 per repository)
      const suitesPromises = allRepositories.slice(0, 6).map((repo) =>
        api
          .get(`/projects/${repo.projectId}/repositories/${repo.id}/suites`, {
            params: { page: 1, limit: 2 },
          })
          .catch(() => ({ data: { data: { suites: [] } } }))
      )

      const suitesResponses = await Promise.all(suitesPromises)
      const allSuites: Suite[] = []

      suitesResponses.forEach((response, index) => {
        const suites = response.data?.data?.suites || []
        suites.forEach((suite: Suite) => {
          allSuites.push({
            ...suite,
            repositoryId: allRepositories[index].id,
          })
        })
      })

      if (allSuites.length === 0) {
        setIsLoadingTestCases(false)
        return
      }

      // Fetch test cases for each suite (limit to 5 most recent per suite)
      const testCasesPromises = allSuites.slice(0, 10).map((suite) => {
        const repo = allRepositories.find((r) => r.id === suite.repositoryId)
        const project = projects.find((p) => p.id === repo?.projectId)
        if (!repo || !project) return Promise.resolve({ data: { data: { testCases: [] } } })

        return api
          .get(
            `/projects/${project.id}/repositories/${repo.id}/suites/${suite.id}/test-cases`,
            {
              params: { page: 1, limit: 5, sortBy: 'updatedAt', sortOrder: 'desc' },
            }
          )
          .then((response) => {
            const testCases = response.data?.data?.testCases || []
            return testCases.map((tc: any) => ({
              ...tc,
              suite: { id: suite.id, title: suite.title },
              repository: { id: repo.id, title: repo.title },
              project: { id: project.id, title: project.title },
            }))
          })
          .catch(() => [])
      })

      const testCasesArrays = await Promise.all(testCasesPromises)
      const allTestCases = testCasesArrays.flat()

      // Sort by updatedAt descending and take top 10
      const sortedTestCases = allTestCases
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 10)

      setRecentTestCases(sortedTestCases)
    } catch (err: any) {
      console.error('Error fetching recent test cases:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      }
    } finally {
      setIsLoadingTestCases(false)
    }
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

  const fetchRecentTestRuns = async () => {
    setIsLoadingTestRuns(true)
    try {
      // Fetch first few projects
      const projectsResponse = await api.get('/projects', {
        params: { page: 1, limit: 5 },
      })

      const projects: Project[] = projectsResponse.data?.data?.projects || []

      if (projects.length === 0) {
        setIsLoadingTestRuns(false)
        return
      }

      // Fetch test runs for each project
      const testRunsPromises = projects.map((project) =>
        api
          .get(`/projects/${project.id}/test-runs`, {
            params: { page: 1, limit: 5, sortBy: 'updatedAt', sortOrder: 'desc' },
          })
          .then((response) => {
            const testRuns = response.data?.data?.testRuns || []
            return testRuns.map((tr: any) => ({
              ...tr,
              project: { id: project.id, title: project.title },
            }))
          })
          .catch(() => [])
      )

      const testRunsArrays = await Promise.all(testRunsPromises)
      const allTestRuns = testRunsArrays.flat()

      // Sort by updatedAt descending and take top 10
      const sortedTestRuns = allTestRuns
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 10)

      setRecentTestRuns(sortedTestRuns)
    } catch (err: any) {
      console.error('Error fetching recent test runs:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      }
    } finally {
      setIsLoadingTestRuns(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'running':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'failed':
        return 'bg-red-100 text-red-700 border-red-200'
      case 'cancelled':
        return 'bg-gray-100 text-gray-700 border-gray-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <AppHeader />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back! 👋
          </h1>
          <p className="text-gray-600 text-lg">Here's an overview of your quality management system.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {/* Total Projects */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Projects</p>
                <p className="text-3xl font-bold text-gray-900">{stats.projects}</p>
                <p className="text-xs text-gray-500 font-medium mt-1">Active projects</p>
              </div>
            </div>
          </div>

          {/* Test Cases */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Test Cases</p>
                <p className="text-3xl font-bold text-gray-900">{stats.testCases.toLocaleString()}</p>
                <p className="text-xs text-gray-500 font-medium mt-1">Total test cases</p>
              </div>
            </div>
          </div>

          {/* Test Runs */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Test Runs</p>
                <p className="text-3xl font-bold text-gray-900">{stats.testRuns}</p>
                <p className="text-xs text-gray-500 font-medium mt-1">Total test runs</p>
              </div>
            </div>
          </div>

          {/* Test Plans */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Test Plans</p>
                <p className="text-3xl font-bold text-gray-900">{stats.testPlans}</p>
                <p className="text-xs text-gray-500 font-medium mt-1">Active test plans</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Test Cases */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Recent Test Cases</h3>
                <Link href="/repositories?tab=testCases" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                  View all →
                </Link>
              </div>
            </div>
            <div className="p-6">
              {isLoadingTestCases ? (
                <div className="flex items-center justify-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-200 border-t-primary-600"></div>
                </div>
              ) : recentTestCases.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 font-medium">No test cases found</p>
                  <p className="text-sm text-gray-500 mt-1">Create your first test case to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentTestCases.map((testCase) => (
                    <Link
                      key={testCase.id}
                      href={`/projects/${testCase.project.id}/repository/${testCase.repository.id}/suites/${testCase.suite.id}/test-cases`}
                      className="block p-4 rounded-lg hover:bg-gray-50 transition-colors group border border-transparent hover:border-gray-200"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors truncate">
                            {testCase.title}
                          </h4>
                          <p className="text-sm text-gray-500 mt-1 truncate">
                            {testCase.project.title} • {testCase.repository.title} • {testCase.suite.title}
                          </p>
                        </div>
                        {testCase.automated && (
                          <span className="ml-2 px-2 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200 whitespace-nowrap">
                            Automated
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full border ${getPriorityColor(
                              testCase.priority
                            )}`}
                          >
                            {getPriorityLabel(testCase.priority)}
                          </span>
                          {testCase.severity && (
                            <span className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                              {testCase.severity}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{formatDate(testCase.updatedAt)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Test Runs */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Recent Test Runs</h3>
                <Link href="/test-runs" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                  View all →
                </Link>
              </div>
            </div>
            <div className="p-6">
              {isLoadingTestRuns ? (
                <div className="flex items-center justify-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-200 border-t-primary-600"></div>
                </div>
              ) : recentTestRuns.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 font-medium">No test runs found</p>
                  <p className="text-sm text-gray-500 mt-1">Create your first test run to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentTestRuns.map((testRun) => (
                    <Link
                      key={testRun.id}
                      href={testRun.repository?.id 
                        ? `/projects/${testRun.project.id}/repositories/${testRun.repository.id}/test-run/${testRun.id}`
                        : `/projects/${testRun.project.id}/test-runs/${testRun.id}`}
                      className="block p-4 rounded-lg hover:bg-gray-50 transition-colors group border border-transparent hover:border-gray-200"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors truncate">
                            {testRun.title}
                          </h4>
                          <p className="text-sm text-gray-500 mt-1 truncate">
                            {testRun.project.title} • {testRun.testPlan.title}
                            {testRun.repository && ` • ${testRun.repository.title}`}
                          </p>
                        </div>
                        <span
                          className={`ml-2 px-3 py-1 text-xs font-semibold rounded-full border whitespace-nowrap ${getStatusColor(
                            testRun.status
                          )}`}
                        >
                          {getStatusLabel(testRun.status)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-3">
                          {testRun.stats.total > 0 && (
                            <>
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                <span className="text-xs text-gray-600">{testRun.stats.passed}</span>
                              </div>
                              {testRun.stats.failed > 0 && (
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                  <span className="text-xs text-gray-600">{testRun.stats.failed}</span>
                                </div>
                              )}
                              {testRun.stats.skipped > 0 && (
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                  <span className="text-xs text-gray-600">{testRun.stats.skipped}</span>
                                </div>
                              )}
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-600">{testRun.stats.total} total</span>
                            </>
                          )}
                          {testRun.environment && (
                            <>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-600">{testRun.environment}</span>
                            </>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{formatDate(testRun.updatedAt)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}
