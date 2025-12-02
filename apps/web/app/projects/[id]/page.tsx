'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '../../components/AppHeader'
import { api } from '../../../lib/api'

interface Project {
  id: string
  title: string
  description: string | null
  createdBy: string | null
  updatedBy: string | null
  creator: {
    id: string
    name: string
    email: string
    avatar: string | null
  } | null
  updater: {
    id: string
    name: string
    email: string
    avatar: string | null
  } | null
  createdAt: string
  updatedAt: string
  counts: {
    repositories: number
    testPlans: number
    testRuns: number
    documents: number
  }
}

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

type TabType = 'squads' | 'testSuites' | 'testCases' | 'automation' | 'testPlans' | 'testRuns'

export default function ViewProjectPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('squads')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    fetchProject()
    fetchRepositories()
  }, [projectId, router])

  const fetchProject = async () => {
    setIsLoading(true)
    setError(null)

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
      } else if (err.response?.status === 404) {
        setError('Project not found')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to fetch project')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const fetchRepositories = async () => {
    setIsLoadingRepos(true)
    try {
      const response = await api.get(`/projects/${projectId}/repositories`)
      
      if (response.data?.data?.repositories) {
        setRepositories(response.data.data.repositories)
      }
    } catch (err: any) {
      console.error('Fetch repositories error:', err)
      // If endpoint doesn't exist yet, use empty array
      if (err.response?.status === 404) {
        setRepositories([])
      }
    } finally {
      setIsLoadingRepos(false)
    }
  }

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) {
      return `${diffInSeconds} second${diffInSeconds !== 1 ? 's' : ''} ago`
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`
    } else {
      const days = Math.floor(diffInSeconds / 86400)
      return `${days} day${days !== 1 ? 's' : ''} ago`
    }
  }

  const getTabStats = (tab: TabType): number => {
    if (!project) return 0
    switch (tab) {
      case 'squads':
        return project.counts.repositories
      case 'testPlans':
        return project.counts.testPlans
      case 'testRuns':
        return project.counts.testRuns
      case 'testSuites':
      case 'testCases':
      case 'automation':
        return 0 // TODO: Add these counts when API supports them
      default:
        return 0
    }
  }

  const filteredRepositories = repositories.filter(repo =>
    repo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading project...</p>
          </div>
        </main>
      </div>
    )
  }

  if (error || !project) {
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
            <p className="text-gray-600 mb-6">{error || 'Project not found'}</p>
            <Link
              href="/projects"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium inline-block"
            >
              Back to Projects
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      {/* Top Bar */}
      <div className="bg-gray-800 h-1"></div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Project Header */}
        <div className="bg-white border-b border-gray-200 py-4 mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-medium text-gray-900">
              Dashboard of project: <span className="font-semibold">{project.title}</span>
            </h1>
            <Link
              href={`/projects/${projectId}/edit`}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Link>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {/* Squads Tab */}
          <button
            onClick={() => setActiveTab('squads')}
            className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
              activeTab === 'squads'
                ? 'border-primary-600 bg-primary-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="mb-2">
              <svg className={`w-6 h-6 ${activeTab === 'squads' ? 'text-primary-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
              </svg>
            </div>
            <div className="text-sm font-medium text-gray-700 mb-1">Squads</div>
            <div className={`text-lg font-bold ${activeTab === 'squads' ? 'text-primary-600' : 'text-gray-900'}`}>
              {getTabStats('squads')}
            </div>
          </button>

          {/* Test Suites Tab */}
          <button
            onClick={() => setActiveTab('testSuites')}
            className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
              activeTab === 'testSuites'
                ? 'border-primary-600 bg-primary-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="mb-2">
              <svg className={`w-6 h-6 ${activeTab === 'testSuites' ? 'text-primary-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-sm font-medium text-gray-700 mb-1">Test Suites</div>
            <div className={`text-lg font-bold ${activeTab === 'testSuites' ? 'text-primary-600' : 'text-gray-900'}`}>
              {getTabStats('testSuites')}
            </div>
          </button>

          {/* Test Cases Tab */}
          <button
            onClick={() => setActiveTab('testCases')}
            className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
              activeTab === 'testCases'
                ? 'border-primary-600 bg-primary-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="mb-2">
              <svg className={`w-6 h-6 ${activeTab === 'testCases' ? 'text-primary-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div className="text-sm font-medium text-gray-700 mb-1">Test Cases</div>
            <div className={`text-lg font-bold ${activeTab === 'testCases' ? 'text-primary-600' : 'text-gray-900'}`}>
              {getTabStats('testCases')}
            </div>
          </button>

          {/* Automation Tab */}
          <button
            onClick={() => setActiveTab('automation')}
            className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
              activeTab === 'automation'
                ? 'border-primary-600 bg-primary-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="mb-2">
              <svg className={`w-6 h-6 ${activeTab === 'automation' ? 'text-primary-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="text-sm font-medium text-gray-700 mb-1">Automation</div>
            <div className={`text-lg font-bold ${activeTab === 'automation' ? 'text-primary-600' : 'text-gray-900'}`}>
              {getTabStats('automation')}%
            </div>
          </button>

          {/* Test Plans Tab */}
          <button
            onClick={() => setActiveTab('testPlans')}
            className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
              activeTab === 'testPlans'
                ? 'border-primary-600 bg-primary-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="mb-2">
              <svg className={`w-6 h-6 ${activeTab === 'testPlans' ? 'text-primary-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-sm font-medium text-gray-700 mb-1">Test Plans</div>
            <div className={`text-lg font-bold ${activeTab === 'testPlans' ? 'text-primary-600' : 'text-gray-900'}`}>
              {getTabStats('testPlans')}
            </div>
          </button>

          {/* Test Runs Tab */}
          <button
            onClick={() => setActiveTab('testRuns')}
            className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
              activeTab === 'testRuns'
                ? 'border-primary-600 bg-primary-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="mb-2">
              <svg className={`w-6 h-6 ${activeTab === 'testRuns' ? 'text-primary-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-sm font-medium text-gray-700 mb-1">Test Runs</div>
            <div className={`text-lg font-bold ${activeTab === 'testRuns' ? 'text-primary-600' : 'text-gray-900'}`}>
              {getTabStats('testRuns')}
            </div>
          </button>
        </div>

        {/* Main Content Area - Squads Section */}
        {activeTab === 'squads' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
              <h2 className="text-2xl font-bold text-gray-900">Squads</h2>
              <div className="flex items-center gap-4">
                <Link
                  href={`/projects/${projectId}/repositories/new`}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add New
                </Link>
                <div className="relative flex-1 sm:flex-initial sm:w-80">
                  <input
                    type="text"
                    placeholder="Search repositories"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 pl-10 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                  />
                  <svg
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Squads List */}
            {isLoadingRepos ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                <p className="mt-4 text-gray-600">Loading squads...</p>
              </div>
            ) : filteredRepositories.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Squads Found</h3>
                <p className="text-gray-600 mb-4">
                  {searchQuery ? 'No squads match your search.' : 'Create your first squad to get started.'}
                </p>
                {!searchQuery && (
                  <Link
                    href={`/projects/${projectId}/repositories/new`}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium inline-block"
                  >
                    Add New Squad
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRepositories.map((repo) => (
                  <Link
                    key={repo.id}
                    href={`/projects/${projectId}/repository/${repo.id}`}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white flex flex-col cursor-pointer"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-gray-900 truncate">{repo.title}</h3>
                        <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{repo.description || 'No description'}</p>
                      </div>
                    </div>

                    {/* Automation Coverage */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-gray-700">Automation Coverage</span>
                        <span className="text-xs text-gray-600">{repo.counts?.automation || 0}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            (repo.counts?.automation || 0) > 0 ? 'bg-red-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${repo.counts?.automation || 0}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Statistics */}
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-xs font-medium">{repo.counts?.suites || 0}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <span className="text-xs font-medium">{repo.counts?.testCases || 0}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span className="text-xs font-medium">{repo.counts?.automation || 0}</span>
                      </div>
                    </div>

                    {/* Last Updated */}
                    <div className="text-xs text-gray-500 mt-auto">
                      {formatTimeAgo(repo.updatedAt)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Placeholder for other tabs */}
        {activeTab !== 'squads' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Coming Soon</h3>
            <p className="text-gray-600">
              The {activeTab === 'testSuites' ? 'Test Suites' : activeTab === 'testCases' ? 'Test Cases' : activeTab === 'automation' ? 'Automation' : activeTab === 'testPlans' ? 'Test Plans' : 'Test Runs'} section is under development.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
