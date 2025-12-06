import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Repository, PaginationState } from '../types'
import { formatTimeAgo } from '../utils/formatTimeAgo'

interface SquadsTabProps {
  projectId: string
  repositories: Repository[]
  isLoading: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  openRepoMenu: string | null
  onOpenRepoMenu: (repoId: string | null) => void
  hoveredStat: { repoId: string; stat: string } | null
  onHoveredStatChange: (stat: { repoId: string; stat: string } | null) => void
  onImportTestCases: (repo: Repository) => void
  onDeleteRepository: (repo: Repository) => void
}

export function SquadsTab({
  projectId,
  repositories,
  isLoading,
  searchQuery,
  onSearchChange,
  openRepoMenu,
  onOpenRepoMenu,
  hoveredStat,
  onHoveredStatChange,
  onImportTestCases,
  onDeleteRepository,
}: SquadsTabProps) {
  const router = useRouter()

  const filteredRepositories = repositories.filter(repo =>
    repo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
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
              onChange={(e) => onSearchChange(e.target.value)}
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
      {isLoading ? (
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
            <div
              key={repo.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white flex flex-col relative"
            >
              {/* Three-dot Menu Button */}
              <div className="absolute top-4 right-4 z-10" data-repo-menu={repo.id}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenRepoMenu(openRepoMenu === repo.id ? null : repo.id)
                  }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Repository Options"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {openRepoMenu === repo.id && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20 overflow-hidden">
                    <div className="py-1">
                      <Link
                        href={`/projects/${projectId}/repository/${repo.id}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenRepoMenu(null)
                        }}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View Repository
                      </Link>
                      <Link
                        href={`/projects/${projectId}/repository/${repo.id}/edit`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenRepoMenu(null)
                        }}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit Repository
                      </Link>
                    </div>
                    <div className="border-t border-gray-200"></div>
                    <div className="py-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenRepoMenu(null)
                          onImportTestCases(repo)
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Import Test Cases
                      </button>
                    </div>
                    <div className="border-t border-gray-200"></div>
                    <div className="py-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenRepoMenu(null)
                          onDeleteRepository(repo)
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Repository
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div
                onClick={() => router.push(`/projects/${projectId}/repository/${repo.id}`)}
                className="flex flex-col cursor-pointer"
              >
                <div className="flex items-center gap-3 mb-3 pr-12">
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
                  <div className="relative">
                    <div
                      className="flex items-center gap-1.5 text-gray-600 cursor-pointer"
                      onMouseEnter={() => onHoveredStatChange({ repoId: repo.id, stat: 'suites' })}
                      onMouseLeave={() => onHoveredStatChange(null)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-xs font-medium">{repo.counts?.suites || 0}</span>
                    </div>
                    {hoveredStat?.repoId === repo.id && hoveredStat?.stat === 'suites' && (
                      <div className="absolute left-0 bottom-full mb-2 z-20 bg-black text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                        <div className="absolute -bottom-1 left-4 w-2 h-2 bg-black transform rotate-45"></div>
                        Test Suites
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <div
                      className="flex items-center gap-1.5 text-gray-600 cursor-pointer"
                      onMouseEnter={() => onHoveredStatChange({ repoId: repo.id, stat: 'testCases' })}
                      onMouseLeave={() => onHoveredStatChange(null)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      <span className="text-xs font-medium">{repo.counts?.testCases || 0}</span>
                    </div>
                    {hoveredStat?.repoId === repo.id && hoveredStat?.stat === 'testCases' && (
                      <div className="absolute left-0 bottom-full mb-2 z-20 bg-black text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                        <div className="absolute -bottom-1 left-4 w-2 h-2 bg-black transform rotate-45"></div>
                        Test Cases
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <div
                      className="flex items-center gap-1.5 text-gray-600 cursor-pointer"
                      onMouseEnter={() => onHoveredStatChange({ repoId: repo.id, stat: 'automation' })}
                      onMouseLeave={() => onHoveredStatChange(null)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span className="text-xs font-medium">{repo.counts?.automated || 0}</span>
                    </div>
                    {hoveredStat?.repoId === repo.id && hoveredStat?.stat === 'automation' && (
                      <div className="absolute left-0 bottom-full mb-2 z-20 bg-black text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                        <div className="absolute -bottom-1 left-4 w-2 h-2 bg-black transform rotate-45"></div>
                        Automated Test Cases
                      </div>
                    )}
                  </div>
                </div>

                {/* Last Updated */}
                <div className="text-xs text-gray-500 mt-auto">
                  {formatTimeAgo(repo.updatedAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

