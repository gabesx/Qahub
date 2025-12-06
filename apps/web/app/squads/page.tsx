'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '../components/AppHeader'
import { api } from '../../lib/api'

interface Squad {
  id: string
  title: string
  description: string | null
  prefix: string
  project: {
    id: string
    title: string
  }
  counts: {
    suites: number
    testCases: number
    automation: number
  }
  createdAt: string
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

export default function SquadsPage() {
  const router = useRouter()
  const [squads, setSquads] = useState<Squad[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [openActionsDropdown, setOpenActionsDropdown] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    fetchSquads()
  }, [router])

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      if (pagination.page === 1) {
        fetchSquads()
      } else {
        setPagination(prev => ({ ...prev, page: 1 }))
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    fetchSquads()
  }, [pagination.page, pagination.limit])

  const fetchSquads = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch all projects first
      const projectsResponse = await api.get('/projects', {
        params: { page: 1, limit: 100 }, // Get all projects
      })

      const projects: Project[] = projectsResponse.data?.data?.projects || []

      if (projects.length === 0) {
        setSquads([])
        setPagination(prev => ({ ...prev, total: 0, totalPages: 0 }))
        setIsLoading(false)
        return
      }

      // Fetch repositories (squads) for each project
      const squadsPromises = projects.map((project) =>
        api
          .get(`/projects/${project.id}/repositories`, {
            params: {
              page: 1,
              limit: 100, // Get all repositories from this project
              ...(search.trim() && { search: search.trim() }),
            },
          })
          .then((response) => {
            const repositories = response.data?.data?.repositories || []
            return repositories.map((repo: any) => ({
              ...repo,
              project: { id: project.id, title: project.title },
            }))
          })
          .catch(() => [])
      )

      const squadsArrays = await Promise.all(squadsPromises)
      let allSquads = squadsArrays.flat()

      // Filter by search if needed (client-side for now)
      if (search.trim()) {
        const searchLower = search.trim().toLowerCase()
        allSquads = allSquads.filter(
          (squad) =>
            squad.title.toLowerCase().includes(searchLower) ||
            squad.description?.toLowerCase().includes(searchLower) ||
            squad.project.title.toLowerCase().includes(searchLower)
        )
      }

      // Sort by updatedAt descending
      allSquads = allSquads.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )

      // Apply pagination
      const total = allSquads.length
      const totalPages = Math.ceil(total / pagination.limit)
      const startIndex = (pagination.page - 1) * pagination.limit
      const endIndex = startIndex + pagination.limit
      const paginatedSquads = allSquads.slice(startIndex, endIndex)

      setSquads(paginatedSquads)
      setPagination(prev => ({
        ...prev,
        total,
        totalPages,
      }))
    } catch (err: any) {
      console.error('Fetch squads error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to fetch squads')
      }
    } finally {
      setIsLoading(false)
    }
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('[data-actions-dropdown]')) {
        setOpenActionsDropdown(null)
      }
    }

    if (openActionsDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openActionsDropdown])

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Squads</h1>
              <p className="text-gray-600">Manage your test squads (repositories) and test suites</p>
            </div>
            <div className="mt-4 sm:mt-0 flex items-center gap-4">
              {/* Search Bar */}
              <div className="relative flex-1 sm:flex-initial sm:w-80">
                <input
                  type="text"
                  placeholder="Search squads..."
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
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Squads List */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading squads...</p>
          </div>
        ) : squads.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="w-24 h-24 rounded-full border-4 border-gray-200 flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Squads Found</h3>
              <p className="text-gray-600 mb-6 max-w-md">
                {search
                  ? 'No squads match your search criteria. Try adjusting your search terms.'
                  : 'Create your first squad (repository) in a project to get started.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Squads Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {squads.map((squad) => (
                <div
                  key={squad.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative"
                >
                  {/* Actions Menu */}
                  <div className="absolute top-4 right-4" data-actions-dropdown>
                    <button
                      onClick={() => setOpenActionsDropdown(openActionsDropdown === squad.id ? null : squad.id)}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                    {openActionsDropdown === squad.id && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10 py-1">
                        <Link
                          href={`/projects/${squad.project.id}/repository/${squad.id}`}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => setOpenActionsDropdown(null)}
                        >
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View Squad
                          </div>
                        </Link>
                        <Link
                          href={`/projects/${squad.project.id}`}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => setOpenActionsDropdown(null)}
                        >
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            View Project
                          </div>
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Squad Title and Description */}
                  <div className="mb-4 pr-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{squad.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {squad.description || 'No description'}
                    </p>
                  </div>

                  {/* Project Badge */}
                  <div className="mb-4">
                    <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full border bg-blue-100 text-blue-700 border-blue-200">
                      {squad.project.title}
                    </span>
                  </div>

                  {/* Statistics */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-500">Test Suites</p>
                        <p className="text-sm font-semibold text-gray-900">{squad.counts.suites || 0}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-500">Test Cases</p>
                        <p className="text-sm font-semibold text-gray-900">{squad.counts.testCases || 0}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-500">Automation</p>
                        <p className="text-sm font-semibold text-gray-900">{squad.counts.automation || 0}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Last Updated */}
                  <div className="mb-6 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500">{formatDate(squad.updatedAt)}</p>
                  </div>

                  {/* Open Squad Button */}
                  <Link
                    href={`/projects/${squad.project.id}/repository/${squad.id}`}
                    className="block w-full bg-primary-600 text-white text-center py-2.5 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <span>Open Squad</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {(pagination.totalPages > 1 || pagination.total > 0) && (
              <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
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
    </div>
  )
}

