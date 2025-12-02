'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '../../../../components/AppHeader'
import { api } from '../../../../../lib/api'

interface Repository {
  id: string
  title: string
  description: string | null
  prefix: string
  createdAt: string
  updatedAt: string
  counts?: {
    suites?: number
    testCases?: number
    automation?: number
  }
}

interface Project {
  id: string
  title: string
}

export default function ViewRepositoryPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const repoId = params.repoId as string

  const [project, setProject] = useState<Project | null>(null)
  const [repository, setRepository] = useState<Repository | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    fetchProject()
    fetchRepository()
  }, [projectId, repoId, router])

  const fetchProject = async () => {
    try {
      const response = await api.get(`/projects/${projectId}`)
      if (response.data?.data?.project) {
        setProject(response.data.data.project)
      }
    } catch (err: any) {
      console.error('Fetch project error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      }
    }
  }

  const fetchRepository = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await api.get(`/projects/${projectId}/repositories/${repoId}`)
      
      if (response.data?.data?.repository) {
        setRepository(response.data.data.repository)
      }
    } catch (err: any) {
      console.error('Fetch repository error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else if (err.response?.status === 404) {
        setError('Repository not found')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to fetch repository')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading repository...</p>
          </div>
        </main>
      </div>
    )
  }

  if (error || !repository) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-red-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Error</h3>
            <p className="text-gray-600 mb-6">{error || 'Repository not found'}</p>
            <Link
              href={`/projects/${projectId}`}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium inline-block"
            >
              Back to Project
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{repository.title}</h1>
              <nav className="flex items-center space-x-2 text-sm text-gray-600">
                <Link href="/projects" className="hover:text-gray-900 transition-colors">
                  Projects
                </Link>
                <span>/</span>
                {project && (
                  <>
                    <Link href={`/projects/${projectId}`} className="hover:text-gray-900 transition-colors">
                      {project.title}
                    </Link>
                    <span>/</span>
                  </>
                )}
                <Link href={`/projects/${projectId}`} className="hover:text-gray-900 transition-colors">
                  Squads
                </Link>
                <span>/</span>
                <span className="text-gray-900 font-medium">{repository.title}</span>
              </nav>
            </div>
            <Link
              href={`/projects/${projectId}`}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Project
            </Link>
          </div>
        </div>

        {/* Repository Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Repository Details</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prefix</label>
              <p className="text-sm text-gray-900 font-mono">{repository.prefix}</p>
            </div>
            
            {repository.description && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <p className="text-sm text-gray-900">{repository.description}</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Test Suites</label>
                <p className="text-2xl font-bold text-gray-900">{repository.counts?.suites || 0}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Test Cases</label>
                <p className="text-2xl font-bold text-gray-900">{repository.counts?.testCases || 0}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Automation</label>
                <p className="text-2xl font-bold text-gray-900">{repository.counts?.automation || 0}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Placeholder for future content */}
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Repository Content</h3>
          <p className="text-gray-600">
            Test suites, test cases, and other repository content will be displayed here.
          </p>
        </div>
      </main>
    </div>
  )
}

