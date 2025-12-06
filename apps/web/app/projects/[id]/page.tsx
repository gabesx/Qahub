'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '../../components/AppHeader'
import { api } from '../../../lib/api'

// Import types
import { Project, Repository, TabType, PaginationState } from './types'

// Import hooks
import {
  useProject,
  useRepositories,
  useTestPlans,
  useTestSuites,
  useTestCases,
  useAutomatedTestCases,
  useTestRuns,
  useTestSuitesForImport,
  useTestCaseDetail,
} from './hooks'

// Import components
import {
  SquadsTab,
  TestPlansTab,
  TestSuitesTab,
  TestCasesTab,
  AutomationTab,
  TestRunsTab,
  ComingSoonPlaceholder,
  DeleteProjectModal,
  DeleteRepositoryModal,
  DeleteTestPlanModal,
  DeleteTestRunModal,
  ImportTestCasesModal,
  TestCaseDetailModal,
} from './components'

// Import utilities
import { parseCSV } from './utils/parseCSV'
import { formatTimeAgo } from './utils/formatTimeAgo'

export default function ViewProjectPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const projectId = params.id as string

  // Use hooks for data fetching
  const { project, isLoading: isLoadingProject, error: projectError, refetch: refetchProject } = useProject(projectId)
  const { repositories, isLoading: isLoadingRepos, refetch: refetchRepositories } = useRepositories(projectId)
  const { testPlans, isLoading: isLoadingTestPlans, refetch: refetchTestPlans } = useTestPlans(projectId, repositories)
  const { testSuites: allTestSuites, isLoading: isLoadingAllTestSuites, refetch: refetchAllTestSuites } = useTestSuites(projectId, repositories)
  const { testCases: allTestCases, isLoading: isLoadingAllTestCases, refetch: refetchAllTestCases } = useTestCases(projectId, repositories)
  const { testCases: automatedTestCases, isLoading: isLoadingAutomatedTestCases, refetch: refetchAutomatedTestCases } = useAutomatedTestCases(projectId, repositories)
  const { testRuns, isLoading: isLoadingTestRuns, refetch: refetchTestRuns } = useTestRuns(projectId)
  const { testSuites: testSuitesForImport, isLoading: isLoadingSuites, fetchTestSuites: fetchTestSuitesForImport } = useTestSuitesForImport(projectId)
  const { testCase: modalTestCaseData, isLoading: isLoadingModalTestCase, error: testCaseError, fetchTestCaseDetail, clearTestCase } = useTestCaseDetail(projectId)

  // UI State - Initialize from URL parameter if present
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const tabParam = searchParams?.get('tab')
    if (tabParam && ['squads', 'testPlans', 'testSuites', 'testCases', 'automation', 'testRuns'].includes(tabParam)) {
      return tabParam as TabType
    }
    return 'squads'
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredStat, setHoveredStat] = useState<{ repoId: string; stat: string } | null>(null)
  const [openRepoMenu, setOpenRepoMenu] = useState<string | null>(null)
  const [openTestPlanMenu, setOpenTestPlanMenu] = useState<string | null>(null)
  const [openTestRunMenu, setOpenTestRunMenu] = useState<string | null>(null)

  // Modal States
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteRepoModal, setShowDeleteRepoModal] = useState(false)
  const [repoToDelete, setRepoToDelete] = useState<Repository | null>(null)
  const [isDeletingRepo, setIsDeletingRepo] = useState(false)
  const [showDeleteTestPlanModal, setShowDeleteTestPlanModal] = useState(false)
  const [testPlanToDelete, setTestPlanToDelete] = useState<any | null>(null)
  const [isDeletingTestPlan, setIsDeletingTestPlan] = useState(false)
  const [showDeleteTestRunModal, setShowDeleteTestRunModal] = useState(false)
  const [testRunToDelete, setTestRunToDelete] = useState<any | null>(null)
  const [isDeletingTestRun, setIsDeletingTestRun] = useState(false)
  const [showImportTestCasesModal, setShowImportTestCasesModal] = useState(false)
  const [selectedRepoForImport, setSelectedRepoForImport] = useState<Repository | null>(null)
  const [isTestCaseModalOpen, setIsTestCaseModalOpen] = useState(false)
  const [modalTestCaseRepository, setModalTestCaseRepository] = useState<Repository | null>(null)
  const [modalTestCaseId, setModalTestCaseId] = useState<string | null>(null)
  const [modalTestCaseRepoId, setModalTestCaseRepoId] = useState<string | null>(null)
  const [modalTestCaseSuiteId, setModalTestCaseSuiteId] = useState<string | null>(null)

  // Upload State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [parsedTestCases, setParsedTestCases] = useState<any[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [uploadResults, setUploadResults] = useState<{ success: number; failed: number; created: number; updated: number; errors: string[] }>({ success: 0, failed: 0, created: 0, updated: 0, errors: [] })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Pagination States
  const [testCasesPagination, setTestCasesPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [testPlansPagination, setTestPlansPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [allTestSuitesPagination, setAllTestSuitesPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [automatedTestCasesPagination, setAutomatedTestCasesPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [testRunsPagination, setTestRunsPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  // Download state
  const [isDownloadingTestPlan, setIsDownloadingTestPlan] = useState<string | null>(null)

  // Error state
  const [error, setError] = useState<string | null>(null)

  // Update pagination totals when data changes
  useEffect(() => {
    setTestCasesPagination(prev => ({
      ...prev,
      total: allTestCases.length,
      totalPages: prev.limit === -1 ? 1 : Math.ceil(allTestCases.length / prev.limit),
    }))
  }, [allTestCases.length])

  useEffect(() => {
    setTestPlansPagination(prev => ({
      ...prev,
      total: testPlans.length,
      totalPages: prev.limit === -1 ? 1 : Math.ceil(testPlans.length / prev.limit),
    }))
  }, [testPlans.length])

  useEffect(() => {
    setAllTestSuitesPagination(prev => ({
      ...prev,
      total: allTestSuites.length,
      totalPages: prev.limit === -1 ? 1 : Math.ceil(allTestSuites.length / prev.limit),
    }))
  }, [allTestSuites.length])

  useEffect(() => {
    setAutomatedTestCasesPagination(prev => ({
      ...prev,
      total: automatedTestCases.length,
      totalPages: prev.limit === -1 ? 1 : Math.ceil(automatedTestCases.length / prev.limit),
    }))
  }, [automatedTestCases.length])

  useEffect(() => {
    setTestRunsPagination(prev => ({
      ...prev,
      total: testRuns.length,
      totalPages: prev.limit === -1 ? 1 : Math.ceil(testRuns.length / prev.limit),
    }))
  }, [testRuns.length])

  // Fetch data when tabs change
  useEffect(() => {
    if (activeTab === 'testPlans' && repositories.length > 0) {
      refetchTestPlans()
    }
  }, [activeTab, repositories.length, refetchTestPlans])

  useEffect(() => {
    if (activeTab === 'testSuites' && repositories.length > 0) {
      refetchAllTestSuites()
    }
  }, [activeTab, repositories.length, refetchAllTestSuites])

  useEffect(() => {
    if (activeTab === 'testCases' && repositories.length > 0) {
      refetchAllTestCases()
    }
  }, [activeTab, repositories.length, refetchAllTestCases])

  useEffect(() => {
    if (activeTab === 'automation' && repositories.length > 0) {
      refetchAutomatedTestCases()
    }
  }, [activeTab, repositories.length, refetchAutomatedTestCases])

  useEffect(() => {
    if (activeTab === 'testRuns') {
      refetchTestRuns()
    }
  }, [activeTab, refetchTestRuns])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('[data-repo-menu]')) {
        setOpenRepoMenu(null)
      }
      if (!target.closest('[data-test-plan-menu]')) {
        setOpenTestPlanMenu(null)
      }
      if (!target.closest('[data-test-run-menu]')) {
        setOpenTestRunMenu(null)
      }
    }

    if (openRepoMenu || openTestPlanMenu || openTestRunMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openRepoMenu, openTestPlanMenu, openTestRunMenu])

  // Handlers
  const handleDeleteProject = async () => {
    setIsDeleting(true)
    setError(null)

    try {
      await api.delete(`/projects/${projectId}`)
      router.push('/projects')
    } catch (err: any) {
      console.error('Delete project error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to delete project')
      }
    } finally {
      setIsDeleting(false)
      setShowDeleteModal(false)
    }
  }

  const handleDeleteRepository = async () => {
    if (!repoToDelete) return

    setIsDeletingRepo(true)
    setError(null)

    try {
      await api.delete(`/projects/${projectId}/repositories/${repoToDelete.id}`)
      setShowDeleteRepoModal(false)
      setRepoToDelete(null)
      await refetchRepositories()
    } catch (err: any) {
      console.error('Delete repository error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to delete repository')
      }
    } finally {
      setIsDeletingRepo(false)
    }
  }

  const handleDeleteTestPlan = async () => {
    if (!testPlanToDelete) return

    setIsDeletingTestPlan(true)
    setError(null)

    try {
      await api.delete(
        `/projects/${projectId}/repositories/${testPlanToDelete.repository.id}/test-plans/${testPlanToDelete.id}`
      )
      
      await refetchTestPlans()
      setShowDeleteTestPlanModal(false)
      setTestPlanToDelete(null)
    } catch (err: any) {
      console.error('Delete test plan error:', err)
      if (err.response?.status === 409) {
        setError(err.response?.data?.error?.message || 'Cannot delete test plan that has test runs')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to delete test plan. Please try again.')
      }
    } finally {
      setIsDeletingTestPlan(false)
    }
  }

  const handleDeleteTestRun = async () => {
    if (!testRunToDelete) return

    setIsDeletingTestRun(true)
    setError(null)

    try {
      await api.delete(`/projects/${projectId}/test-runs/${testRunToDelete.id}`)
      
      await refetchTestRuns()
      setShowDeleteTestRunModal(false)
      setTestRunToDelete(null)
    } catch (err: any) {
      console.error('Delete test run error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to delete test run. Please try again.')
      }
    } finally {
      setIsDeletingTestRun(false)
    }
  }

  const handleDownloadTestPlan = async (testPlan: any) => {
    setIsDownloadingTestPlan(testPlan.id)
    try {
      // Fetch test plan details with test cases
      const response = await api.get(
        `/projects/${projectId}/repositories/${testPlan.repository.id}/test-plans/${testPlan.id}`
      )
      
      const testPlanData = response.data?.data?.testPlan
      if (!testPlanData || !testPlanData.testCases || testPlanData.testCases.length === 0) {
        alert('No test cases found in this test plan')
        return
      }

      // Get repository prefix
      const repo = repositories.find(r => r.id === testPlan.repository.id)
      const prefix = repo?.prefix || 'ST'

      // Get all suites for the repository (once)
      const suitesResponse = await api.get(
        `/projects/${projectId}/repositories/${testPlan.repository.id}/suites`,
        { params: { page: 1, limit: 1000 } }
      )
      const suites = suitesResponse.data?.data?.suites || []

      // Fetch full details for each test case
      const testCasesWithDetails: any[] = []
      const testCaseIds = testPlanData.testCases.map((tc: any) => tc.id)
      
      // Fetch all test cases from all suites in parallel
      const allTestCasesMap = new Map<string, any>()
      for (const suite of suites) {
        try {
          const testCasesResponse = await api.get(
            `/projects/${projectId}/repositories/${testPlan.repository.id}/suites/${suite.id}/test-cases`,
            { params: { page: 1, limit: 1000, includeDeleted: false } }
          )
          const testCases = testCasesResponse.data?.data?.testCases || []
          testCases.forEach((tc: any) => {
            if (testCaseIds.includes(tc.id)) {
              allTestCasesMap.set(tc.id, tc)
            }
          })
        } catch (err) {
          console.error(`Error fetching test cases from suite ${suite.id}:`, err)
        }
      }

      // Match test cases from test plan with full details
      for (const tc of testPlanData.testCases) {
        const fullDetails = allTestCasesMap.get(tc.id)
        if (fullDetails) {
          testCasesWithDetails.push({
            ...fullDetails,
            order: tc.order, // Preserve order from test plan
          })
        } else {
          // Fallback to basic data if we can't find full details
          testCasesWithDetails.push({
            ...tc,
            description: tc.description || '',
            labels: tc.labels || '',
            epicLink: tc.epicLink || '',
            platform: tc.platform || '',
            regression: tc.regression || false,
            linkedIssue: tc.linkedIssue || '',
            data: tc.data || {},
            createdBy: tc.createdBy || null,
          })
        }
      }

      // Prepare CSV data with headers
      const headers = [
        'prefix ID',
        'title',
        'description',
        'labels',
        'epic',
        'test data',
        'platform',
        'priority',
        'regression',
        'epic link',
        'linked issue',
        'created by',
        'data'
      ]

      const rows = testCasesWithDetails
        .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
        .map((tc: any) => {
          // Get prefix ID
          const prefixId = tc.jiraKey || `${prefix}-${tc.id}`
          
          // Parse platform
          let platformStr = ''
          if (tc.platform) {
            try {
              const platforms = JSON.parse(tc.platform)
              platformStr = Array.isArray(platforms) ? platforms.join(', ') : tc.platform
            } catch {
              platformStr = tc.platform
            }
          }

          // Priority label
          const priorityLabel = tc.priority === 1 ? 'Low' : tc.priority === 2 ? 'Medium' : tc.priority === 3 ? 'High' : 'Critical'

          // Regression
          const regression = tc.regression ? 'Yes' : 'No'

          // Created by
          const createdBy = tc.createdBy?.name || ''

          // Data field - construct JSON with scenarios, precond_type, preconditions
          let dataField = ''
          if (tc.data) {
            try {
              const dataObj = typeof tc.data === 'string' ? JSON.parse(tc.data) : tc.data
              const dataJson = {
                scenarios: dataObj.bddScenarios || dataObj.scenarios || '',
                precond_type: dataObj.precond_type || 'free_text',
                preconditions: dataObj.preconditions || ''
              }
              dataField = JSON.stringify(dataJson)
            } catch {
              // If data is already a string or invalid, use as is
              dataField = typeof tc.data === 'string' ? tc.data : JSON.stringify(tc.data || {})
            }
          }

          return [
            prefixId,
            tc.title || '',
            tc.description || '',
            tc.labels || '',
            tc.epicLink || '',
            '', // test data - seems to be part of data field
            platformStr,
            priorityLabel,
            regression,
            tc.epicLink || '',
            tc.linkedIssue || '',
            createdBy,
            dataField
          ]
        })

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map((row: any[]) => row.map(cell => {
          const cellStr = String(cell || '')
          // Escape quotes and wrap in quotes
          return `"${cellStr.replace(/"/g, '""')}"`
        }).join(','))
      ].join('\n')

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `${testPlan.title.replace(/[^a-z0-9]/gi, '_')}_test_cases.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('Download test plan error:', err)
      alert('Failed to download test plan. Please try again.')
    } finally {
      setIsDownloadingTestPlan(null)
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const validExtensions = ['.csv', '.tsv', '.tcv']
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!validExtensions.includes(fileExtension)) {
      setError('Invalid file type. Please select a CSV, TSV, or TCV file.')
      return
    }

    try {
      const text = await file.text()
      const parsed = parseCSV(text)
      setUploadedFile(file)
      setParsedTestCases(parsed)
      setError(null)
    } catch (err: any) {
      console.error('Parse CSV error:', err)
      setError(err.message || 'Failed to parse CSV file. Please check the file format.')
      setUploadedFile(null)
      setParsedTestCases([])
    }
  }

  const handleBulkImport = async (repoId: string, suiteId: string) => {
    if (parsedTestCases.length === 0) return
    
    setIsUploading(true)
    setUploadProgress({ current: 0, total: parsedTestCases.length })
    setUploadResults({ success: 0, failed: 0, created: 0, updated: 0, errors: [] })
    setError(null)
    
    // Check if suite exists, create it if it doesn't
    let targetSuiteId = suiteId
    try {
      const suiteCheckResponse = await api.get(
        `/projects/${projectId}/repositories/${repoId}/suites/${suiteId}`
      )
      if (!suiteCheckResponse.data?.data?.suite) {
        // Suite doesn't exist, try to find it or create a new one
        const suite = testSuitesForImport.find(s => s.id === suiteId)
        if (suite) {
          targetSuiteId = suite.id
        } else {
          // Create a new suite with a default name
          try {
            const createResponse = await api.post(
              `/projects/${projectId}/repositories/${repoId}/suites`,
              {
                title: `Imported Suite ${new Date().toLocaleDateString()}`,
                parentId: null,
              }
            )
            if (createResponse.data?.data?.suite) {
              targetSuiteId = createResponse.data.data.suite.id
              // Refresh suites list
              await fetchTestSuitesForImport(repoId)
            }
          } catch (createErr) {
            console.error('Failed to create suite:', createErr)
            setError('Failed to create test suite. Please create one manually.')
            setIsUploading(false)
            return
          }
        }
      }
    } catch (err: any) {
      // Suite might not exist (404), try to create it
      if (err.response?.status === 404) {
        try {
          const suite = testSuitesForImport.find(s => s.id === suiteId)
          if (suite) {
            // Suite exists in our list but API returned 404, use it anyway
            targetSuiteId = suite.id
          } else {
            // Create a new suite
            const createResponse = await api.post(
              `/projects/${projectId}/repositories/${repoId}/suites`,
              {
                title: `Imported Suite ${new Date().toLocaleDateString()}`,
                parentId: null,
              }
            )
            if (createResponse.data?.data?.suite) {
              targetSuiteId = createResponse.data.data.suite.id
              // Refresh suites list
              await fetchTestSuitesForImport(repoId)
    }
  }
        } catch (createErr) {
          console.error('Failed to create suite:', createErr)
          setError('Test suite not found and failed to create a new one. Please create a test suite first.')
          setIsUploading(false)
          return
        }
      } else {
        console.warn('Failed to check suite existence:', err)
        // Continue anyway - might be a temporary error
      }
    }
    
    // Fetch existing test cases to check for duplicates
    let existingTestCases: any[] = []
    try {
      const existingResponse = await api.get(
        `/projects/${projectId}/repositories/${repoId}/suites/${targetSuiteId}/test-cases?limit=1000&includeDeleted=false`
      )
      if (existingResponse.data?.data?.testCases) {
        existingTestCases = existingResponse.data.data.testCases
      }
    } catch (err) {
      console.warn('Failed to fetch existing test cases for duplicate check:', err)
    }
    
    const titleToIdMap = new Map<string, string>()
    existingTestCases.forEach(tc => {
      if (tc.title) {
        titleToIdMap.set(tc.title.toLowerCase().trim(), tc.id)
      }
    })
    
    const errors: string[] = []
    let successCount = 0
    let failedCount = 0
    let createdCount = 0
    let updatedCount = 0
    
    for (let i = 0; i < parsedTestCases.length; i++) {
      const testCase = parsedTestCases[i]
      setUploadProgress({ current: i + 1, total: parsedTestCases.length })
      
      try {
        const normalizedTitle = testCase.title.toLowerCase().trim()
        const existingId = titleToIdMap.get(normalizedTitle)
        
        const testCaseData = {
          title: testCase.title,
          description: testCase.description,
          automated: testCase.automated,
          priority: testCase.priority,
          severity: testCase.severity,
          labels: testCase.labels,
          regression: testCase.regression,
          epicLink: testCase.epicLink,
          linkedIssue: testCase.linkedIssue,
          releaseVersion: testCase.releaseVersion,
          platform: testCase.platform,
          data: testCase.data && Object.keys(testCase.data).length > 0 ? testCase.data : undefined,
        }
        
        if (existingId) {
          await api.patch(
            `/projects/${projectId}/repositories/${repoId}/suites/${targetSuiteId}/test-cases/${existingId}`,
            testCaseData
          )
          updatedCount++
          successCount++
    } else {
          await api.post(
            `/projects/${projectId}/repositories/${repoId}/suites/${targetSuiteId}/test-cases`,
            testCaseData
          )
          createdCount++
          successCount++
        }
      } catch (err: any) {
        failedCount++
        let errorMsg = err.response?.data?.error?.message || 'Unknown error'
        
        if (err.response?.data?.error?.details) {
          const details = err.response.data.error.details
          if (Array.isArray(details)) {
            const detailMessages = details.map((d: any) => `${d.path.join('.')}: ${d.message}`).join(', ')
            errorMsg = `${errorMsg} (${detailMessages})`
          }
        }
        
        errors.push(`Row ${i + 1} (${testCase.title}): ${errorMsg}`)
      }
    }
    
    setUploadResults({ success: successCount, failed: failedCount, created: createdCount, updated: updatedCount, errors })
    setIsUploading(false)
    
    // Refresh repositories to update counts
    refetchRepositories()
  }

  const openTestCaseModal = async (testCase: any) => {
    setIsTestCaseModalOpen(true)
    setModalTestCaseId(testCase.id)
    setModalTestCaseRepoId(testCase.repository.id)
    setModalTestCaseSuiteId(testCase.suiteId || testCase.suite?.id)
    setModalTestCaseRepository(testCase.repository ? repositories.find(r => r.id === testCase.repository.id) || null : null)
    
    await fetchTestCaseDetail(testCase.repository.id, testCase.suiteId || testCase.suite?.id, testCase.id)
  }

  const closeTestCaseModal = () => {
    setIsTestCaseModalOpen(false)
    setModalTestCaseId(null)
    setModalTestCaseRepoId(null)
    setModalTestCaseSuiteId(null)
    setModalTestCaseRepository(null)
    clearTestCase()
  }

  // Calculate project-level statistics from all repositories
  const projectStats = {
    totalTestCases: repositories.reduce((sum, repo) => sum + (repo.counts?.testCases || 0), 0),
    automatedTestCases: repositories.reduce((sum, repo) => {
      const total = repo.counts?.testCases || 0
      const automation = repo.counts?.automation || 0
      return sum + Math.round((total * automation) / 100)
    }, 0),
    manualTestCases: 0,
    automationPercent: 0,
  }
  
  projectStats.manualTestCases = projectStats.totalTestCases - projectStats.automatedTestCases
  projectStats.automationPercent = projectStats.totalTestCases > 0
    ? Math.round((projectStats.automatedTestCases / projectStats.totalTestCases) * 100)
    : 0

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
        return repositories.reduce((sum, repo) => sum + (repo.counts?.suites || 0), 0)
      case 'testCases':
        return projectStats.totalTestCases
      case 'automation':
        return projectStats.automationPercent
      default:
        return 0
    }
  }

  const handleImportTestCases = (repo: Repository) => {
    setSelectedRepoForImport(repo)
    setShowImportTestCasesModal(true)
    setUploadedFile(null)
    setParsedTestCases([])
    setUploadResults({ success: 0, failed: 0, created: 0, updated: 0, errors: [] })
    fetchTestSuitesForImport(repo.id)
      }

  if (isLoadingProject) {
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

  if (projectError || !project) {
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
            <p className="text-gray-600 mb-6">{projectError || 'Project not found'}</p>
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
            <div className="flex items-center gap-2">
              <Link
                href={`/projects/${projectId}/edit`}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                title="Edit Project"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </Link>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 border border-red-300 rounded-lg hover:bg-red-50 transition-colors font-medium"
                title="Delete Project"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Project Statistics */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-200 md:border-b-0 md:border-r border-gray-200 md:pr-4">
              <span className="text-sm text-gray-600">Test Cases</span>
              <span className="text-sm font-semibold text-gray-900">{projectStats.totalTestCases}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-200 md:border-b-0 md:border-r border-gray-200 md:pr-4">
              <span className="text-sm text-gray-600">Automated</span>
              <span className="text-sm font-semibold text-green-600">{projectStats.automatedTestCases}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-600">Manual</span>
              <span className="text-sm font-semibold text-blue-600">{projectStats.manualTestCases}</span>
            </div>
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

        {/* Tab Content */}
        {activeTab === 'squads' && (
          <SquadsTab
            projectId={projectId}
            repositories={repositories}
            isLoading={isLoadingRepos}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            openRepoMenu={openRepoMenu}
            onOpenRepoMenu={setOpenRepoMenu}
            hoveredStat={hoveredStat}
            onHoveredStatChange={setHoveredStat}
            onImportTestCases={handleImportTestCases}
            onDeleteRepository={(repo) => {
              setRepoToDelete(repo)
              setShowDeleteRepoModal(true)
            }}
          />
        )}

        {activeTab === 'testPlans' && (
          <TestPlansTab
            projectId={projectId}
            testPlans={testPlans}
            isLoading={isLoadingTestPlans}
            pagination={testPlansPagination}
            onPaginationChange={setTestPlansPagination}
            openTestPlanMenu={openTestPlanMenu}
            onOpenTestPlanMenu={setOpenTestPlanMenu}
            isDownloadingTestPlan={isDownloadingTestPlan}
            onViewTestPlan={(testPlan) => {
              router.push(`/projects/${projectId}/repositories/${testPlan.repository.id}/test-plans/${testPlan.id}`)
                              }}
            onDownloadTestPlan={handleDownloadTestPlan}
            onDeleteTestPlan={(testPlan) => {
              setTestPlanToDelete(testPlan)
              setShowDeleteTestPlanModal(true)
                              }}
          />
        )}

        {activeTab === 'testSuites' && (
          <TestSuitesTab
            projectId={projectId}
            testSuites={allTestSuites}
            isLoading={isLoadingAllTestSuites}
            pagination={allTestSuitesPagination}
            onPaginationChange={setAllTestSuitesPagination}
          />
        )}

        {activeTab === 'testCases' && (
          <TestCasesTab
            testCases={allTestCases}
            isLoading={isLoadingAllTestCases}
            pagination={testCasesPagination}
            onPaginationChange={setTestCasesPagination}
            onTestCaseClick={openTestCaseModal}
          />
        )}

        {activeTab === 'automation' && (
          <AutomationTab
            testCases={automatedTestCases}
            isLoading={isLoadingAutomatedTestCases}
            pagination={automatedTestCasesPagination}
            onPaginationChange={setAutomatedTestCasesPagination}
            onTestCaseClick={openTestCaseModal}
          />
                          )}

        {activeTab === 'testRuns' && (
          <TestRunsTab
            projectId={projectId}
            testRuns={testRuns}
            isLoading={isLoadingTestRuns}
            pagination={testRunsPagination}
            onPaginationChange={setTestRunsPagination}
            openTestRunMenu={openTestRunMenu}
            onOpenTestRunMenu={setOpenTestRunMenu}
            onDeleteTestRun={(testRun) => {
              setTestRunToDelete(testRun)
              setShowDeleteTestRunModal(true)
            }}
          />
        )}

        {/* Placeholder for other tabs */}
        {activeTab !== 'squads' && activeTab !== 'testPlans' && activeTab !== 'testSuites' && activeTab !== 'testCases' && activeTab !== 'automation' && activeTab !== 'testRuns' && (
          <ComingSoonPlaceholder
            message="This section is under development."
          />
        )}
      </main>

      {/* Modals */}
      <DeleteProjectModal
        isOpen={showDeleteModal}
        onClose={() => {
                    setShowDeleteModal(false)
                    setError(null)
                  }}
        onConfirm={handleDeleteProject}
        project={project}
        isDeleting={isDeleting}
        error={error}
      />

      <DeleteRepositoryModal
        isOpen={showDeleteRepoModal}
        onClose={() => {
                    setShowDeleteRepoModal(false)
                    setRepoToDelete(null)
                    setError(null)
                  }}
        onConfirm={handleDeleteRepository}
        repository={repoToDelete}
        isDeleting={isDeletingRepo}
        error={error}
      />

      <DeleteTestPlanModal
        isOpen={showDeleteTestPlanModal}
        onClose={() => {
          setShowDeleteTestPlanModal(false)
          setTestPlanToDelete(null)
          setError(null)
        }}
        onConfirm={handleDeleteTestPlan}
        testPlan={testPlanToDelete}
        isDeleting={isDeletingTestPlan}
        error={error}
      />

      <DeleteTestRunModal
        isOpen={showDeleteTestRunModal}
        onClose={() => {
          setShowDeleteTestRunModal(false)
          setTestRunToDelete(null)
          setError(null)
        }}
        onConfirm={handleDeleteTestRun}
        testRun={testRunToDelete}
        isDeleting={isDeletingTestRun}
        error={error}
      />

      <ImportTestCasesModal
        isOpen={showImportTestCasesModal}
        onClose={() => {
          setShowImportTestCasesModal(false)
          setSelectedRepoForImport(null)
          setUploadedFile(null)
          setParsedTestCases([])
          setUploadResults({ success: 0, failed: 0, created: 0, updated: 0, errors: [] })
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        }}
        projectId={projectId}
        repository={selectedRepoForImport}
        uploadedFile={uploadedFile}
        parsedTestCases={parsedTestCases}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        uploadResults={uploadResults}
        error={error}
        testSuites={testSuitesForImport}
        isLoadingSuites={isLoadingSuites}
        fileInputRef={fileInputRef}
        onFileSelect={handleFileSelect}
        onBulkImport={handleBulkImport}
      />

      <TestCaseDetailModal
        isOpen={isTestCaseModalOpen}
        onClose={closeTestCaseModal}
        isLoading={isLoadingModalTestCase}
        testCase={modalTestCaseData as any}
        repository={modalTestCaseRepository}
      />
    </div>
  )
}
