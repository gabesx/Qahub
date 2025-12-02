'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '../../../../../components/AppHeader'
import { api } from '../../../../../../lib/api'

interface Suite {
  id: string
  title: string
  parentId: string | null
  order: number | null
  createdAt: string
  updatedAt: string
  children?: Suite[]
  testCaseCount?: number
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

export default function TestSuitesPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const repoId = params.repoId as string

  const [project, setProject] = useState<Project | null>(null)
  const [repository, setRepository] = useState<Repository | null>(null)
  const [suites, setSuites] = useState<Suite[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingSuite, setEditingSuite] = useState<Suite | null>(null)
  const [parentSuites, setParentSuites] = useState<Suite[]>([])
  const [formData, setFormData] = useState({
    title: '',
    parentId: '',
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
    fetchSuites()
  }, [projectId, repoId, router])

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

  const fetchSuites = async () => {
    try {
      setIsLoading(true)
      const response = await api.get(`/projects/${projectId}/repositories/${repoId}/suites`)
      const flatSuites = response.data.data.suites
      
      // Build hierarchical structure
      const suiteMap = new Map<string, Suite>()
      const rootSuites: Suite[] = []

      // First pass: create map and add test case counts
      flatSuites.forEach((suite: Suite) => {
        suiteMap.set(suite.id, { ...suite, children: [] })
      })

      // Second pass: build tree
      flatSuites.forEach((suite: Suite) => {
        const suiteWithChildren = suiteMap.get(suite.id)!
        if (suite.parentId && suiteMap.has(suite.parentId)) {
          const parent = suiteMap.get(suite.parentId)!
          if (!parent.children) parent.children = []
          parent.children.push(suiteWithChildren)
        } else {
          rootSuites.push(suiteWithChildren)
        }
      })

      // Sort by order
      const sortByOrder = (suites: Suite[]): Suite[] => {
        return suites
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map(suite => ({
            ...suite,
            children: suite.children ? sortByOrder(suite.children) : undefined,
          }))
      }

      setSuites(sortByOrder(rootSuites))
      setParentSuites(flatSuites) // For dropdown
    } catch (err: any) {
      console.error('Failed to fetch suites:', err)
      setError(err.response?.data?.error?.message || 'Failed to fetch test suites')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post(`/projects/${projectId}/repositories/${repoId}/suites`, {
        title: formData.title.trim(),
        parentId: formData.parentId || null,
        order: formData.order ? parseInt(formData.order) : null,
      })
      setShowCreateModal(false)
      setFormData({ title: '', parentId: '', order: '' })
      fetchSuites()
    } catch (err: any) {
      console.error('Failed to create suite:', err)
      alert(err.response?.data?.error?.message || 'Failed to create test suite')
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSuite) return

    try {
      await api.patch(
        `/projects/${projectId}/repositories/${repoId}/suites/${editingSuite.id}`,
        {
          title: formData.title.trim(),
          parentId: formData.parentId || null,
          order: formData.order ? parseInt(formData.order) : null,
        }
      )
      setEditingSuite(null)
      setFormData({ title: '', parentId: '', order: '' })
      fetchSuites()
    } catch (err: any) {
      console.error('Failed to update suite:', err)
      alert(err.response?.data?.error?.message || 'Failed to update test suite')
    }
  }

  const handleDelete = async (suiteId: string) => {
    if (!confirm('Are you sure you want to delete this test suite?')) return

    try {
      await api.delete(`/projects/${projectId}/repositories/${repoId}/suites/${suiteId}`)
      fetchSuites()
    } catch (err: any) {
      console.error('Failed to delete suite:', err)
      alert(err.response?.data?.error?.message || 'Failed to delete test suite')
    }
  }

  const openEditModal = (suite: Suite) => {
    setEditingSuite(suite)
    setFormData({
      title: suite.title,
      parentId: suite.parentId || '',
      order: suite.order?.toString() || '',
    })
  }

  const renderSuiteTree = (suite: Suite, level: number = 0): JSX.Element => {
    const indent = level * 24
    return (
      <div key={suite.id} className="border-b border-gray-200">
        <div
          className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 transition-colors"
          style={{ paddingLeft: `${16 + indent}px` }}
        >
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-2">
              {suite.children && suite.children.length > 0 && (
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
              <Link
                href={`/projects/${projectId}/repository/${repoId}/suites/${suite.id}/test-cases`}
                className="font-medium text-gray-900 hover:text-primary-600 transition-colors"
              >
                {suite.title}
              </Link>
            </div>
            {suite.testCaseCount !== undefined && (
              <span className="text-sm text-gray-500">
                {suite.testCaseCount} test case{suite.testCaseCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openEditModal(suite)}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Edit
            </button>
            <button
              onClick={() => handleDelete(suite.id)}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Delete
            </button>
          </div>
        </div>
        {suite.children && suite.children.length > 0 && (
          <div>
            {suite.children.map((child) => renderSuiteTree(child, level + 1))}
          </div>
        )}
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
            <span className="text-gray-900 font-medium">Test Suites</span>
          </div>
        </nav>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Test Suites</h1>
              <p className="text-gray-600 mt-1">
                Organize your test cases into hierarchical suites
              </p>
            </div>
            <button
              onClick={() => {
                setShowCreateModal(true)
                setEditingSuite(null)
                setFormData({ title: '', parentId: '', order: '' })
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              + New Suite
            </button>
          </div>
        </div>

        {/* Suites List */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading test suites...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
            <p className="text-red-600">{error}</p>
          </div>
        ) : suites.length === 0 ? (
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Test Suites</h3>
            <p className="text-gray-600 mb-4">
              Get started by creating your first test suite
            </p>
            <button
              onClick={() => {
                setShowCreateModal(true)
                setEditingSuite(null)
                setFormData({ title: '', parentId: '', order: '' })
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Create Test Suite
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {suites.map((suite) => renderSuiteTree(suite))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {(showCreateModal || editingSuite) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {editingSuite ? 'Edit Test Suite' : 'Create Test Suite'}
                </h2>
                <form onSubmit={editingSuite ? handleEdit : handleCreate}>
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
                        placeholder="Enter suite title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Parent Suite
                      </label>
                      <select
                        value={formData.parentId}
                        onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">None (Root Suite)</option>
                        {parentSuites
                          .filter((s) => !editingSuite || s.id !== editingSuite.id)
                          .map((suite) => (
                            <option key={suite.id} value={suite.id}>
                              {suite.title}
                            </option>
                          ))}
                      </select>
                    </div>
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
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                    >
                      {editingSuite ? 'Update' : 'Create'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false)
                        setEditingSuite(null)
                        setFormData({ title: '', parentId: '', order: '' })
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

