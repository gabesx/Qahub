'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '../components/AppHeader'
import { api } from '../../lib/api'

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
  }
  counts: {
    testCases: number
    testRuns: number
  }
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

interface Project {
  id: string
  title: string
}

interface Repository {
  id: string
  title: string
  projectId: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function TestPlansPage() {
  const router = useRouter()
  const [testPlans, setTestPlans] = useState<TestPlan[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'active' | 'archived'>('all')
  const [openActionsDropdown, setOpenActionsDropdown] = useState<string | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [parsedTestPlans, setParsedTestPlans] = useState<any[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadResults, setUploadResults] = useState<{ created: number; updated: number; failed: number; errors: string[] }>({ created: 0, updated: 0, failed: 0, errors: [] })
  const [fileInputRef, setFileInputRef] = useState<HTMLInputElement | null>(null)
  const [showFileErrorModal, setShowFileErrorModal] = useState(false)
  const [fileErrorMessage, setFileErrorMessage] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    fetchTestPlans()
  }, [router])

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      if (pagination.page === 1) {
        fetchTestPlans()
      } else {
        setPagination(prev => ({ ...prev, page: 1 }))
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [search, statusFilter])

  useEffect(() => {
    fetchTestPlans()
  }, [pagination.page, pagination.limit])

  const fetchTestPlans = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch all projects first
      const projectsResponse = await api.get('/projects', {
        params: { page: 1, limit: 100 }, // Get all projects
      })

      const projects: Project[] = projectsResponse.data?.data?.projects || []

      if (projects.length === 0) {
        setTestPlans([])
        setPagination(prev => ({ ...prev, total: 0, totalPages: 0 }))
        setIsLoading(false)
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
        setTestPlans([])
        setPagination(prev => ({ ...prev, total: 0, totalPages: 0 }))
        setIsLoading(false)
        return
      }

      // Fetch test plans for each repository
      const testPlansPromises = allRepositories.map((repo) =>
        api
          .get(`/projects/${repo.projectId}/repositories/${repo.id}/test-plans`, {
            params: {
              page: 1,
              limit: 100, // Get all test plans from this repository
              ...(search.trim() && { search: search.trim() }),
              ...(statusFilter !== 'all' && { status: statusFilter }),
            },
          })
          .then((response) => {
            const testPlans = response.data?.data?.testPlans || []
            return testPlans.map((tp: any) => ({
              ...tp,
              project: { id: repo.projectId, title: projects.find(p => p.id === repo.projectId)?.title || '' },
              repository: { id: repo.id, title: repo.title },
            }))
          })
          .catch(() => [])
      )

      const testPlansArrays = await Promise.all(testPlansPromises)
      let allTestPlans = testPlansArrays.flat()

      // Sort by createdAt descending (newest first)
      allTestPlans = allTestPlans.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )

      // Apply pagination
      const total = allTestPlans.length
      const totalPages = Math.ceil(total / pagination.limit)
      const startIndex = (pagination.page - 1) * pagination.limit
      const endIndex = startIndex + pagination.limit
      const paginatedTestPlans = allTestPlans.slice(startIndex, endIndex)

      setTestPlans(paginatedTestPlans)
      setPagination(prev => ({
        ...prev,
        total,
        totalPages,
      }))
    } catch (err: any) {
      console.error('Fetch test plans error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to fetch test plans')
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

  // Download CSV of all test plans
  const handleDownloadCSV = () => {
    const headers = ['title', 'description', 'status', 'project_id', 'project_name', 'repository_id', 'repository_name', 'test_case_count', 'test_run_count', 'created_at', 'updated_at']
    
    let csvContent = headers.join(';') + '\n'
    
    testPlans.forEach(testPlan => {
      const row = [
        `"${(testPlan.title || '').replace(/"/g, '""')}"`,
        `"${(testPlan.description || '').replace(/"/g, '""')}"`,
        testPlan.status,
        testPlan.project.id,
        `"${(testPlan.project.title || '').replace(/"/g, '""')}"`,
        testPlan.repository.id,
        `"${(testPlan.repository.title || '').replace(/"/g, '""')}"`,
        testPlan.counts.testCases,
        testPlan.counts.testRuns,
        testPlan.createdAt,
        testPlan.updatedAt,
      ]
      csvContent += row.join(';') + '\n'
    })
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `test-plans-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Download CSV template
  const handleDownloadCSVTemplate = () => {
    const headers = ['title', 'description', 'status', 'project_id', 'repository_id', 'test_case_ids']
    
    const exampleRows = [
      [
        'Example Test Plan 1',
        'This is a sample test plan description',
        'draft',
        '1',
        '1',
        '1,2,3'
      ],
      [
        'Example Test Plan 2',
        'Another example test plan',
        'active',
        '1',
        '1',
        '4,5,6'
      ]
    ]
    
    let csvContent = headers.join(';') + '\n'
    exampleRows.forEach(row => {
      const escapedRow = row.map(val => {
        const str = String(val || '')
        if (str.includes(';') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      })
      csvContent += escapedRow.join(';') + '\n'
    })
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'test-plans-template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Parse CSV file
  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    
    // Find the header row
    let headerIndex = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes('title') && (lines[i].toLowerCase().includes('project') || lines[i].toLowerCase().includes('repository'))) {
        headerIndex = i
        break
      }
    }
    
    if (headerIndex === -1) {
      throw new Error('Could not find CSV header row. Please ensure the CSV contains a header row with "title" column.')
    }
    
    // Parse header - detect delimiter (semicolon for CSV, tab for TSV)
    const headerLine = lines[headerIndex]
    const delimiter = headerLine.includes('\t') ? '\t' : ';'
    const headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''))
    
    const titleIdx = headers.indexOf('title')
    const descriptionIdx = headers.indexOf('description')
    const statusIdx = headers.indexOf('status')
    const projectIdIdx = headers.indexOf('project_id')
    const repositoryIdIdx = headers.indexOf('repository_id')
    const testCaseIdsIdx = headers.indexOf('test_case_ids')
    
    if (titleIdx === -1) {
      throw new Error('Title column not found in CSV. Please ensure the CSV contains a "title" column.')
    }
    
    const testPlans: any[] = []
    
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line.trim()) continue
      
      // Parse CSV line handling quoted fields
      const values: string[] = []
      let currentValue = ''
      let insideQuotes = false
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j]
        const nextChar = line[j + 1]
        
        if (char === '"') {
          if (insideQuotes && nextChar === '"') {
            currentValue += '"'
            j++ // Skip next quote
          } else {
            insideQuotes = !insideQuotes
          }
        } else if (char === delimiter && !insideQuotes) {
          values.push(currentValue)
          currentValue = ''
        } else {
          currentValue += char
        }
      }
      values.push(currentValue) // Add last value
      
      const trimmedValues = values.map(v => v.trim().replace(/^"|"$/g, ''))
      
      const title = trimmedValues[titleIdx]?.trim()
      if (!title) continue // Skip rows without title
      
      const description = trimmedValues[descriptionIdx]?.trim() || null
      const status = (trimmedValues[statusIdx]?.trim() || 'draft').toLowerCase()
      const projectId = trimmedValues[projectIdIdx]?.trim()
      const repositoryId = trimmedValues[repositoryIdIdx]?.trim()
      const testCaseIds = trimmedValues[testCaseIdsIdx]?.trim() ? trimmedValues[testCaseIdsIdx].split(',').map(id => id.trim()).filter(id => id) : []
      
      if (!projectId || !repositoryId) {
        throw new Error(`Row ${i + 1}: project_id and repository_id are required`)
      }
      
      testPlans.push({
        title,
        description: description || null,
        status: ['draft', 'active', 'archived'].includes(status) ? status : 'draft',
        projectId,
        repositoryId,
        testCaseIds,
      })
    }
    
    return testPlans
  }

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate file type
    const validExtensions = ['.csv', '.tsv']
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!validExtensions.includes(fileExtension)) {
      setFileErrorMessage(`Invalid file type. Please upload a ${validExtensions.join(' or ')} file.`)
      setShowFileErrorModal(true)
      if (fileInputRef) fileInputRef.value = ''
      return
    }
    
    setUploadedFile(file)
    setError(null)
    
    try {
      const text = await file.text()
      const parsed = parseCSV(text)
      setParsedTestPlans(parsed)
    } catch (err: any) {
      console.error('Parse CSV error:', err)
      setFileErrorMessage(err.message || 'Failed to parse CSV file. Please check the file format.')
      setShowFileErrorModal(true)
      setUploadedFile(null)
      setParsedTestPlans([])
      if (fileInputRef) fileInputRef.value = ''
    }
  }

  // Handle bulk import
  const handleBulkImport = async () => {
    if (parsedTestPlans.length === 0) {
      setError('No test plans to import')
      return
    }
    
    setIsUploading(true)
    setUploadProgress(0)
    setUploadResults({ created: 0, updated: 0, failed: 0, errors: [] })
    setError(null)
    
    const results = { created: 0, updated: 0, failed: 0, errors: [] as string[] }
    
    for (let i = 0; i < parsedTestPlans.length; i++) {
      const testPlan = parsedTestPlans[i]
      setUploadProgress(Math.round(((i + 1) / parsedTestPlans.length) * 100))
      
      try {
        // Check if test plan already exists (by title in same repository)
        const existingResponse = await api.get(
          `/projects/${testPlan.projectId}/repositories/${testPlan.repositoryId}/test-plans`,
          { params: { search: testPlan.title, limit: 1 } }
        )
        
        const existing = existingResponse.data?.data?.testPlans?.find(
          (tp: any) => tp.title.toLowerCase() === testPlan.title.toLowerCase()
        )
        
        if (existing) {
          // Update existing test plan
          await api.patch(
            `/projects/${testPlan.projectId}/repositories/${testPlan.repositoryId}/test-plans/${existing.id}`,
            {
              title: testPlan.title,
              description: testPlan.description,
              status: testPlan.status,
            }
          )
          
          // Update test cases if provided
          if (testPlan.testCaseIds && testPlan.testCaseIds.length > 0) {
            // Remove existing test cases
            const currentTestCases = existing.counts?.testCases || 0
            if (currentTestCases > 0) {
              // Get current test cases and remove them
              const testPlanDetail = await api.get(
                `/projects/${testPlan.projectId}/repositories/${testPlan.repositoryId}/test-plans/${existing.id}`
              )
              const currentCases = testPlanDetail.data?.data?.testPlan?.testCases || []
              for (const tc of currentCases) {
                try {
                  await api.delete(
                    `/projects/${testPlan.projectId}/repositories/${testPlan.repositoryId}/test-plans/${existing.id}/test-cases/${tc.id}`
                  )
                } catch (err) {
                  // Ignore errors when removing
                }
              }
            }
            
            // Add new test cases
            await api.post(
              `/projects/${testPlan.projectId}/repositories/${testPlan.repositoryId}/test-plans/${existing.id}/test-cases`,
              { testCaseIds: testPlan.testCaseIds }
            )
          }
          
          results.updated++
        } else {
          // Create new test plan
          const createResponse = await api.post(
            `/projects/${testPlan.projectId}/repositories/${testPlan.repositoryId}/test-plans`,
            {
              title: testPlan.title,
              description: testPlan.description,
              status: testPlan.status,
            }
          )
          
          const testPlanId = createResponse.data?.data?.testPlan?.id
          
          // Add test cases if provided
          if (testPlan.testCaseIds && testPlan.testCaseIds.length > 0 && testPlanId) {
            await api.post(
              `/projects/${testPlan.projectId}/repositories/${testPlan.repositoryId}/test-plans/${testPlanId}/test-cases`,
              { testCaseIds: testPlan.testCaseIds }
            )
          }
          
          results.created++
        }
      } catch (err: any) {
        console.error(`Error importing test plan "${testPlan.title}":`, err)
        const errorMsg = err.response?.data?.error?.message || 'Unknown error'
        results.failed++
        results.errors.push(`Row ${i + 1} (${testPlan.title}): ${errorMsg}`)
      }
    }
    
    setUploadResults(results)
    setIsUploading(false)
    setUploadProgress(100)
    
    // Refresh test plans list
    await fetchTestPlans()
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'draft':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'archived':
        return 'bg-gray-100 text-gray-700 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1)
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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Test Plans</h1>
              <p className="text-gray-600">Create test plans by adding test suites that will be tested</p>
            </div>
            <div className="mt-4 sm:mt-0 flex items-center gap-4">
              <Link
                href="/test-plans/new"
                className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all font-semibold flex items-center gap-2 shadow-md hover:shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Test Plan
              </Link>
              <button
                onClick={handleDownloadCSV}
                className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold flex items-center gap-2 shadow-md hover:shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download CSV
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold flex items-center gap-2 shadow-md hover:shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload CSV
              </button>
              <button
                onClick={handleDownloadCSVTemplate}
                className="px-4 py-2.5 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CSV Template
              </button>
              {/* Search Bar */}
              <div className="relative flex-1 sm:flex-initial sm:w-80">
                <input
                  type="text"
                  placeholder="Search test plans..."
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

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'draft' | 'active' | 'archived')}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-white"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Test Plans List */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading test plans...</p>
          </div>
        ) : testPlans.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="w-24 h-24 rounded-full border-4 border-gray-200 flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Test Plans Found</h3>
              <p className="text-gray-600 mb-6 max-w-md">
                {search || statusFilter !== 'all'
                  ? 'No test plans match your search criteria. Try adjusting your filters.'
                  : 'Create your first test plan to start organizing your test cases.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Test Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {testPlans.map((testPlan) => (
                <div
                  key={testPlan.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative"
                >
                  {/* Actions Menu */}
                  <div className="absolute top-4 right-4" data-actions-dropdown>
                    <button
                      onClick={() => setOpenActionsDropdown(openActionsDropdown === testPlan.id ? null : testPlan.id)}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                    {openActionsDropdown === testPlan.id && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10 py-1">
                        <Link
                          href={`/projects/${testPlan.project.id}/repository/${testPlan.repository.id}`}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => setOpenActionsDropdown(null)}
                        >
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            View Repository
                          </div>
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Test Plan Title and Description */}
                  <div className="mb-4 pr-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{testPlan.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {testPlan.description || 'No description'}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div className="mb-4">
                    <span
                      className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(
                        testPlan.status
                      )}`}
                    >
                      {getStatusLabel(testPlan.status)}
                    </span>
                  </div>

                  {/* Statistics */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-500">Test Cases</p>
                        <p className="text-sm font-semibold text-gray-900">{testPlan.counts.testCases}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-500">Test Runs</p>
                        <p className="text-sm font-semibold text-gray-900">{testPlan.counts.testRuns}</p>
                      </div>
                    </div>
                  </div>

                  {/* Project/Repository Info */}
                  <div className="mb-6 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Project</p>
                    <p className="text-sm font-medium text-gray-900">{testPlan.project.title}</p>
                    <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                      <span>Repository: {testPlan.repository.title}</span>
                      {testPlan.createdBy && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Created by {testPlan.createdBy.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Open Test Plan Button */}
                  <Link
                    href={`/projects/${testPlan.project.id}/repositories/${testPlan.repository.id}/test-plans/${testPlan.id}`}
                    className="block w-full bg-primary-600 text-white text-center py-2.5 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <span>Open Test Plan</span>
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

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => !isUploading && setShowUploadModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Upload Test Plans</h2>
                {!isUploading && (
                  <button
                    onClick={() => {
                      setShowUploadModal(false)
                      setUploadedFile(null)
                      setParsedTestPlans([])
                      setUploadResults({ created: 0, updated: 0, failed: 0, errors: [] })
                      setError(null)
                      if (fileInputRef) fileInputRef.value = ''
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="p-6 space-y-6">
              {!isUploading && parsedTestPlans.length === 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select CSV File
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-500 transition-colors">
                    <input
                      ref={(el) => {
                        setFileInputRef(el)
                        return el
                      }}
                      type="file"
                      accept=".csv,.tsv"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label htmlFor="csv-upload" className="cursor-pointer">
                      <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="text-primary-600 font-medium">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">CSV or TSV files only</p>
                    </label>
                  </div>
                  {uploadedFile && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <strong>File:</strong> {uploadedFile.name}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {isUploading && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Uploading...</span>
                      <span className="text-sm text-gray-500">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}

              {!isUploading && parsedTestPlans.length > 0 && (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <strong>{parsedTestPlans.length}</strong> test plan{parsedTestPlans.length !== 1 ? 's' : ''} ready to import
                    </p>
                  </div>

                  {uploadResults.created > 0 || uploadResults.updated > 0 || uploadResults.failed > 0 ? (
                    <div className="space-y-2">
                      {uploadResults.created > 0 && (
                        <p className="text-sm text-green-700">
                          ✓ Created: {uploadResults.created}
                        </p>
                      )}
                      {uploadResults.updated > 0 && (
                        <p className="text-sm text-blue-700">
                          ✓ Updated: {uploadResults.updated}
                        </p>
                      )}
                      {uploadResults.failed > 0 && (
                        <p className="text-sm text-red-700">
                          ✗ Failed: {uploadResults.failed}
                        </p>
                      )}
                      {uploadResults.errors.length > 0 && (
                        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg max-h-40 overflow-y-auto">
                          <p className="text-xs font-medium text-red-700 mb-1">Errors:</p>
                          {uploadResults.errors.map((error, idx) => (
                            <p key={idx} className="text-xs text-red-600">{error}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <button
                        onClick={handleBulkImport}
                        className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Import Test Plans
                      </button>
                      <button
                        onClick={() => {
                          setUploadedFile(null)
                          setParsedTestPlans([])
                          setUploadResults({ created: 0, updated: 0, failed: 0, errors: [] })
                          if (fileInputRef) fileInputRef.value = ''
                        }}
                        className="px-6 py-2.5 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* File Error Modal */}
      {showFileErrorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={() => setShowFileErrorModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-red-600">File Error</h2>
                <button
                  onClick={() => setShowFileErrorModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">{fileErrorMessage}</p>
              <button
                onClick={() => setShowFileErrorModal(false)}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

