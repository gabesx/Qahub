'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '../components/AppHeader'
import { api } from '../../lib/api'

interface Document {
  id: string
  title: string
  content: string | null
  version: number
  viewsCount: number
  likesCount: number
  starsCount: number
  project: {
    id: string
    title: string
  }
  parent: {
    id: string
    title: string
  } | null
  counts: {
    children: number
    versions: number
    comments: number
    engagements: number
  }
  createdBy: {
    id: string
    name: string
    email: string
  } | null
  lastEditedBy: {
    id: string
    name: string
    email: string
  } | null
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

export default function DocumentsPage() {
  const router = useRouter()
  const [documents, setDocuments] = useState<Document[]>([])
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
    fetchDocuments()
  }, [router])

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      if (pagination.page === 1) {
        fetchDocuments()
      } else {
        setPagination(prev => ({ ...prev, page: 1 }))
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    fetchDocuments()
  }, [pagination.page, pagination.limit])

  const fetchDocuments = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch all projects first
      const projectsResponse = await api.get('/projects', {
        params: { page: 1, limit: 100 }, // Get all projects
      })

      const projects: Project[] = projectsResponse.data?.data?.projects || []

      if (projects.length === 0) {
        setDocuments([])
        setPagination(prev => ({ ...prev, total: 0, totalPages: 0 }))
        setIsLoading(false)
        return
      }

      // Fetch documents for each project
      const documentsPromises = projects.map((project) =>
        api
          .get(`/projects/${project.id}/documents`, {
            params: {
              page: 1,
              limit: 100, // Get all documents from this project
              ...(search.trim() && { search: search.trim() }),
              sortBy: 'updatedAt',
              sortOrder: 'desc',
            },
          })
          .then((response) => {
            const documents = response.data?.data?.documents || []
            return documents.map((doc: any) => ({
              ...doc,
              project: { id: project.id, title: project.title },
            }))
          })
          .catch(() => [])
      )

      const documentsArrays = await Promise.all(documentsPromises)
      let allDocuments = documentsArrays.flat()

      // Sort by updatedAt descending
      allDocuments = allDocuments.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )

      // Apply pagination
      const total = allDocuments.length
      const totalPages = Math.ceil(total / pagination.limit)
      const startIndex = (pagination.page - 1) * pagination.limit
      const endIndex = startIndex + pagination.limit
      const paginatedDocuments = allDocuments.slice(startIndex, endIndex)

      setDocuments(paginatedDocuments)
      setPagination(prev => ({
        ...prev,
        total,
        totalPages,
      }))
    } catch (err: any) {
      console.error('Fetch documents error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to fetch documents')
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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Documents</h1>
              <p className="text-gray-600">Manage your project documentation and knowledge base</p>
            </div>
            <div className="mt-4 sm:mt-0 flex items-center gap-4">
              {/* Search Bar */}
              <div className="relative flex-1 sm:flex-initial sm:w-80">
                <input
                  type="text"
                  placeholder="Search documents..."
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

        {/* Documents List */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="w-24 h-24 rounded-full border-4 border-gray-200 flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Documents Found</h3>
              <p className="text-gray-600 mb-6 max-w-md">
                {search
                  ? 'No documents match your search criteria. Try adjusting your search terms.'
                  : 'Create your first document to start building your knowledge base.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Documents Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative"
                >
                  {/* Actions Menu */}
                  <div className="absolute top-4 right-4" data-actions-dropdown>
                    <button
                      onClick={() => setOpenActionsDropdown(openActionsDropdown === document.id ? null : document.id)}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                    {openActionsDropdown === document.id && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10 py-1">
                        <Link
                          href={`/projects/${document.project.id}/documents/${document.id}`}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => setOpenActionsDropdown(null)}
                        >
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View Document
                          </div>
                        </Link>
                        <Link
                          href={`/projects/${document.project.id}`}
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

                  {/* Document Title */}
                  <div className="mb-4 pr-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{document.title}</h3>
                    <p className="text-sm text-gray-500">
                      {document.project.title}
                      {document.parent && ` • ${document.parent.title}`}
                    </p>
                  </div>

                  {/* Version Badge */}
                  <div className="mb-4">
                    <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full border bg-blue-100 text-blue-700 border-blue-200">
                      v{document.version}
                    </span>
                  </div>

                  {/* Statistics */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-500">Views</p>
                        <p className="text-sm font-semibold text-gray-900">{document.viewsCount}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h10m-7 4h7" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-500">Comments</p>
                        <p className="text-sm font-semibold text-gray-900">{document.counts.comments}</p>
                      </div>
                    </div>

                    {document.likesCount > 0 && (
                      <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        <div>
                          <p className="text-xs text-gray-500">Likes</p>
                          <p className="text-sm font-semibold text-gray-900">{document.likesCount}</p>
                        </div>
                      </div>
                    )}

                    {document.starsCount > 0 && (
                      <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                        <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                        <div>
                          <p className="text-xs text-gray-500">Stars</p>
                          <p className="text-sm font-semibold text-gray-900">{document.starsCount}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Author and Date Info */}
                  <div className="mb-6 pt-4 border-t border-gray-100">
                    {document.lastEditedBy && (
                      <p className="text-xs text-gray-500 mb-1">Last edited by</p>
                    )}
                    {document.lastEditedBy && (
                      <p className="text-sm font-medium text-gray-900">{document.lastEditedBy.name}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">{formatDate(document.updatedAt)}</p>
                  </div>

                  {/* Open Document Button */}
                  <Link
                    href={`/projects/${document.project.id}/documents/${document.id}`}
                    className="block w-full bg-primary-600 text-white text-center py-2.5 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <span>View Document</span>
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

