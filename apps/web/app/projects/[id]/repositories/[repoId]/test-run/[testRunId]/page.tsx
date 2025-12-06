'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import AppHeader from '../../../../../../components/AppHeader'
import { api } from '../../../../../../../lib/api'
import { Repository } from '../../../../types'

// Types
import { 
  TestRun, 
  TestPlanTestCase, 
  TestRunResult, 
  TestCaseWithResult, 
  TestCaseStatus,
  User,
  Comment,
  HistoryEntry
} from './types'

// Hooks
import { useTestRun } from './hooks/useTestRun'
import { useTestRunResults } from './hooks/useTestRunResults'
import { useTestPlanTestCases } from './hooks/useTestPlanTestCases'
import { useComments } from './hooks/useComments'
import { useHistory } from './hooks/useHistory'
import { useStatusUpdate } from './hooks/useStatusUpdate'
import { useCommentSubmission } from './hooks/useCommentSubmission'
import { useCommentManagement } from './hooks/useCommentManagement'
import { useAutoSave } from './hooks/useAutoSave'

// Components
import TestRunHeaderCard from './components/TestRunHeaderCard'
import TestSuiteList from './components/TestSuiteList'
import TestCaseDetailPanel from './components/TestCaseDetailPanel'
import DeleteCommentModal from './components/DeleteCommentModal'
import ErrorMessage from './components/ErrorMessage'

// Utils
import { formatTotalExecutionTime } from './utils/formatters'
import { getStatusLabel } from './utils/statusHelpers'

export default function TestRunDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const projectId = params.id as string
  const repoId = params.repoId as string
  const testRunId = params.testRunId as string

  // Use extracted hooks
  const { testRun, isLoading: isLoadingTestRun, error: testRunError, setError: setTestRunError, fetchTestRun } = useTestRun(projectId, testRunId)
  const { results, fetchResults, isLoading: isLoadingResults } = useTestRunResults(testRunId)
  const { testPlanTestCases, error: testPlanError, fetchTestPlanTestCases } = useTestPlanTestCases(projectId, repoId, testRun?.testPlan.id || null)
  
  // Local state
  const [testCasesWithResults, setTestCasesWithResults] = useState<TestCaseWithResult[]>([])
  const [selectedTestCaseIds, setSelectedTestCaseIds] = useState<Set<string>>(new Set())
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set())
  const [users, setUsers] = useState<User[]>([])
  const [selectedTestCaseForModal, setSelectedTestCaseForModal] = useState<any>(null)
  const [selectedTestRunResult, setSelectedTestRunResult] = useState<TestRunResult | null>(null)
  const [isLoadingModalTestCase, setIsLoadingModalTestCase] = useState(false)
  const [repositoryForModal, setRepositoryForModal] = useState<Repository | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Error Message, Logs, and Bug Ticket URL state
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [executionLogs, setExecutionLogs] = useState<string>('')
  const [bugTicketUrl, setBugTicketUrl] = useState<string>('')
  
  // Enhanced Filters & Search
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams?.get('status') || 'all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>(() => searchParams?.get('assignee') || 'all')
  const [priorityFilter, setPriorityFilter] = useState<string>(() => searchParams?.get('priority') || 'all')
  const [severityFilter, setSeverityFilter] = useState<string>(() => searchParams?.get('severity') || 'all')
  const [automatedFilter, setAutomatedFilter] = useState<string>(() => searchParams?.get('automated') || 'all')
  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams?.get('search') || '')
  const [dateRangeFilter, setDateRangeFilter] = useState<{ start: string; end: string }>(() => ({
    start: searchParams?.get('startDate') || '',
    end: searchParams?.get('endDate') || '',
  }))
  const [bulkAssignee, setBulkAssignee] = useState<string>('')
  const [currentTime, setCurrentTime] = useState<number>(Date.now())
  // isUpdatingStatus is now from useStatusUpdate hook
  const [isExecutionPaused, setIsExecutionPaused] = useState(false)
  const [pausedAt, setPausedAt] = useState<number | null>(null)
  const [pausedTimeOffset, setPausedTimeOffset] = useState<number>(0)
  const [isEditingMetadata, setIsEditingMetadata] = useState<boolean>(false)
  const [editedMetadata, setEditedMetadata] = useState<{
    executionDate: string
    environment: string
    buildVersion: string
  }>({
    executionDate: '',
    environment: '',
    buildVersion: '',
  })
  const [activeTab, setActiveTab] = useState<'comments' | 'history'>('comments')

  // Merge test cases with results (defined early for use in hooks)
  const mergeTestCasesWithResults = useCallback((resultsToMerge?: TestRunResult[]) => {
    const resultsToUse = resultsToMerge || results
    
    const resultMap = new Map<string, TestRunResult>()
    resultsToUse.forEach((result) => {
      if (result.testCase) {
        resultMap.set(result.testCase.id, result)
      }
    })
    
    const merged = testPlanTestCases.map((testCase) => {
      const result = resultMap.get(testCase.id)
      const isDeleted = result ? (result.isValid === false) : false
      
      return {
        ...testCase,
        result,
        status: isDeleted ? 'skipped' as const : (result ? result.status : 'toDo' as const),
        executedBy: result?.executedBy || null,
        isValid: result ? (result.isValid !== false) : true,
      }
    })
    
    merged.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order
      }
      return a.title.localeCompare(b.title)
    })
    
    setTestCasesWithResults(merged)
  }, [testPlanTestCases, results])

  // Use comment hooks
  const {
    comments,
    newComment,
    setNewComment,
    commentFiles,
    setCommentFiles,
    filePreviews,
    setFilePreviews,
    currentUserId,
    fetchComments,
  } = useComments(testRunId, selectedTestCaseForModal?.id || null)

  // Use comment submission hook
  const { 
    isSubmittingComment, 
    handleSubmitComment: handleSubmitCommentHook 
  } = useCommentSubmission({
    testRunId,
    onError: setError,
    onSuccess: () => {},
  })

  // Use comment management hook
  const {
    editingCommentId,
    editingCommentText,
    setEditingCommentText,
    commentToDelete,
    isDeletingComment,
    handleEditComment,
    handleCancelEdit,
    handleSaveEdit: handleSaveEditHook,
    handleDeleteComment,
    confirmDeleteComment: confirmDeleteCommentHook,
    setCommentToDelete,
  } = useCommentManagement(testRunId, selectedTestCaseForModal?.id || null)

  // Use history hook
  const {
    history,
    historyPage,
    historyTotalPages,
    isLoadingHistory,
    fetchHistory,
  } = useHistory(testRunId)

  // Use status update hook
  const { handleUpdateStatus: handleUpdateStatusHook, isUpdatingStatus: isUpdatingStatusFromHook } = useStatusUpdate({
    testRunId,
    projectId,
    testRun,
    results,
    fetchResults,
    mergeTestCasesWithResults,
    fetchTestRun,
    onError: setError,
  })

  // Use auto-save hook
  const { handleAutoSaveFields } = useAutoSave({
    testRunId,
    selectedTestCaseForModal,
    selectedTestRunResult,
    errorMessage,
    executionLogs,
    bugTicketUrl,
    setSelectedTestRunResult,
  })

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get('/users', {
        params: { page: 1, limit: 1000, isActive: true }
      })
      if (response.data?.data?.users) {
        setUsers(response.data.data.users.map((user: any) => ({
          id: user.id,
          name: user.name,
          email: user.email,
        })))
      }
    } catch (err: any) {
      console.error('Fetch users error:', err)
    }
  }, [])

  // Fetch repository
  const fetchRepository = useCallback(async () => {
    try {
      const response = await api.get(`/projects/${projectId}/repositories/${repoId}`)
      if (response.data?.data?.repository) {
        setRepositoryForModal(response.data.data.repository)
      }
    } catch (err: any) {
      console.error('Fetch repository error:', err)
    }
  }, [projectId, repoId])

  // Handle test case row click
  const handleTestCaseRowClick = useCallback(async (testCase: TestCaseWithResult) => {
    if (!testCase.suiteId) {
      console.error('Test case does not have a suite ID')
      return
    }

    setIsLoadingModalTestCase(true)
    setSelectedTestCaseForModal(null)
    setSelectedTestRunResult(null)

    try {
      const [testCaseResponse, resultResponse] = await Promise.all([
        api.get(`/projects/${projectId}/repositories/${repoId}/suites/${testCase.suiteId}/test-cases/${testCase.id}`),
        api.get(`/test-runs/${testRunId}/results`, {
          params: { testCaseId: testCase.id }
        })
      ])
      
      if (testCaseResponse.data?.data?.testCase) {
        setSelectedTestCaseForModal(testCaseResponse.data.data.testCase)
      }

      if (resultResponse.data?.data?.results?.[0]) {
        const result = resultResponse.data.data.results[0]
        setSelectedTestRunResult({
          ...result,
          executedAt: result.executedAt || null,
          executionTime: result.executionTime || null,
        })
        setErrorMessage(result.errorMessage || '')
        setExecutionLogs(result.logs || '')
        setBugTicketUrl(result.bugTicketUrl || '')
      } else if (testCase.result) {
        const result = testCase.result as any
        setSelectedTestRunResult({
          ...result,
          executedAt: result.executedAt || null,
          executionTime: result.executionTime || null,
        })
        setErrorMessage(result.errorMessage || '')
        setExecutionLogs(result.logs || '')
        setBugTicketUrl(result.bugTicketUrl || '')
      } else {
        setSelectedTestRunResult(null)
        setErrorMessage('')
        setExecutionLogs('')
        setBugTicketUrl('')
      }

      await fetchComments()
      
      if (resultResponse.data?.data?.results?.[0]?.id) {
        fetchHistory(resultResponse.data.data.results[0].id, 1)
      }
    } catch (err: any) {
      console.error('Fetch test case detail error:', err)
      setError(err.response?.data?.error?.message || 'Failed to load test case details')
    } finally {
      setIsLoadingModalTestCase(false)
    }
  }, [projectId, repoId, testRunId, fetchComments, fetchHistory])

  // Handle status update
  const handleUpdateStatus = useCallback(async (status: TestCaseStatus) => {
    if (!selectedTestCaseForModal) return

    await handleUpdateStatusHook(
      status,
      selectedTestCaseForModal,
      errorMessage,
      executionLogs,
      bugTicketUrl,
      setSelectedTestRunResult,
      handleTestCaseRowClick
    )
  }, [selectedTestCaseForModal, errorMessage, executionLogs, bugTicketUrl, handleUpdateStatusHook, handleTestCaseRowClick])

  // Handle comment submission
  const handleSubmitComment = useCallback(async () => {
    await handleSubmitCommentHook(
      newComment,
      commentFiles,
      filePreviews,
      selectedTestCaseForModal,
      setNewComment,
      setCommentFiles,
      setFilePreviews,
      fetchComments
    )
  }, [newComment, commentFiles, filePreviews, selectedTestCaseForModal, handleSubmitCommentHook, fetchComments])

  // Handle file select
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files)
      setCommentFiles(files)
      
      const previews = files.map(file => {
        const isImage = file.type.startsWith('image/')
        const isVideo = file.type.startsWith('video/')
        
        if (isImage || isVideo) {
          return {
            url: URL.createObjectURL(file),
            type: file.type,
            name: file.name,
          }
        } else {
          return {
            url: '',
            type: file.type,
            name: file.name,
          }
        }
      })
      
      setFilePreviews(previews)
    } else {
      filePreviews.forEach(preview => {
        if (preview.url) {
          URL.revokeObjectURL(preview.url)
        }
      })
      setCommentFiles([])
      setFilePreviews([])
    }
  }, [filePreviews, setCommentFiles, setFilePreviews])

  // Handle save edit
  const handleSaveEdit = useCallback(async (commentId: string) => {
    await handleSaveEditHook(commentId, fetchComments, setError)
  }, [handleSaveEditHook, fetchComments])

  // Handle confirm delete
  const confirmDeleteComment = useCallback(async () => {
    await confirmDeleteCommentHook(fetchComments, setError)
  }, [confirmDeleteCommentHook, fetchComments])

  // Get current status
  const getCurrentStatus = useCallback((): TestCaseStatus => {
    if (selectedTestRunResult) {
      const backendStatus = selectedTestRunResult.status
      if (backendStatus === 'inProgress') {
        return 'inProgress'
      }
      return backendStatus as 'passed' | 'failed' | 'skipped' | 'blocked'
    }
    if (selectedTestCaseForModal) {
      const testCase = testCasesWithResults.find(tc => tc.id === selectedTestCaseForModal.id)
      if (testCase) {
        return testCase.status
      }
    }
    return 'toDo'
  }, [selectedTestRunResult, selectedTestCaseForModal, testCasesWithResults])

  // Suite and test case selection handlers
  const toggleSuiteExpansion = useCallback((suiteId: string) => {
    setExpandedSuites(prev => {
      const newSet = new Set(prev)
      if (newSet.has(suiteId)) {
        newSet.delete(suiteId)
      } else {
        newSet.add(suiteId)
      }
      return newSet
    })
  }, [])

  const expandAllSuites = useCallback(() => {
    const suiteIds = new Set<string>()
    testCasesWithResults.forEach(tc => {
      if (tc.suiteId) {
        suiteIds.add(tc.suiteId)
      }
      if (tc.isValid === false) {
        suiteIds.add('__deleted__')
      }
    })
    setExpandedSuites(suiteIds)
  }, [testCasesWithResults])

  const collapseAllSuites = useCallback(() => {
    setExpandedSuites(new Set())
  }, [])

  const toggleTestCaseSelection = useCallback((testCaseId: string) => {
    setSelectedTestCaseIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(testCaseId)) {
        newSet.delete(testCaseId)
      } else {
        newSet.add(testCaseId)
      }
      return newSet
    })
  }, [])

  const toggleSuiteSelection = useCallback((suiteId: string, suiteTestCases: TestCaseWithResult[]) => {
    const suiteTestCaseIds = suiteTestCases.map(tc => tc.id)
    const allSelected = suiteTestCaseIds.every(id => selectedTestCaseIds.has(id))
    
    setSelectedTestCaseIds(prev => {
      const newSet = new Set(prev)
      if (allSelected) {
        suiteTestCaseIds.forEach(id => newSet.delete(id))
      } else {
        suiteTestCaseIds.forEach(id => newSet.add(id))
      }
      return newSet
    })
  }, [selectedTestCaseIds])

  const isSuiteFullySelected = useCallback((suiteTestCases: TestCaseWithResult[]) => {
    if (suiteTestCases.length === 0) return false
    return suiteTestCases.every(tc => selectedTestCaseIds.has(tc.id))
  }, [selectedTestCaseIds])

  const isSuitePartiallySelected = useCallback((suiteTestCases: TestCaseWithResult[]) => {
    if (suiteTestCases.length === 0) return false
    const selectedCount = suiteTestCases.filter(tc => selectedTestCaseIds.has(tc.id)).length
    return selectedCount > 0 && selectedCount < suiteTestCases.length
  }, [selectedTestCaseIds])

  // Handle assign user
  const handleAssignUser = useCallback(async (testCaseId: string, userId: string | null) => {
    try {
      const result = results.find(r => r.testCase && r.testCase.id === testCaseId)
      
      if (result) {
        await api.patch(`/test-runs/${testRunId}/results/${result.id}`, {
          executedBy: userId,
        })
      } else {
        await api.post(`/test-runs/${testRunId}/results`, {
          testCaseId,
          executedBy: userId,
          status: 'toDo',
        })
      }
      
      await fetchResults(true)
    } catch (err: any) {
      console.error('Assign user error:', err)
      setError(err.response?.data?.error?.message || 'Failed to assign user')
    }
  }, [testRunId, results, fetchResults])

  // Handle bulk assign
  const handleBulkAssign = useCallback(async (userId: string | null) => {
    if (selectedTestCaseIds.size === 0) {
      setError('Please select at least one test case to assign')
      return
    }

    try {
      setError(null)
      const testCaseIds = Array.from(selectedTestCaseIds)
      
      const promises = testCaseIds.map(async (testCaseId) => {
        const result = results.find(r => r.testCase && r.testCase.id === testCaseId)
        
        if (result) {
          await api.patch(`/test-runs/${testRunId}/results/${result.id}`, {
            executedBy: userId,
          })
        } else {
          await api.post(`/test-runs/${testRunId}/results`, {
            testCaseId,
            executedBy: userId,
            status: 'toDo',
          })
        }
      })

      await Promise.all(promises)
      await fetchResults(true)
      setBulkAssignee('')
      
      const userName = userId ? users.find(u => u.id === userId)?.name || 'User' : 'Unassigned'
      setError(`Successfully assigned ${testCaseIds.length} test case(s) to ${userName}`)
      setTimeout(() => setError(null), 3000)
    } catch (err: any) {
      console.error('Bulk assign error:', err)
      setError(err.response?.data?.error?.message || 'Failed to assign test cases')
    }
  }, [selectedTestCaseIds, testRunId, results, users, fetchResults])

  // Handle title update
  const handleTitleUpdate = useCallback(async (title: string) => {
    try {
      setError(null)
      await api.patch(`/projects/${projectId}/test-runs/${testRunId}`, {
        title: title.trim(),
      })
      await fetchTestRun()
    } catch (err: any) {
      console.error('Update title error:', err)
      setError(err.response?.data?.error?.message || 'Failed to update title')
      throw err
    }
  }, [projectId, testRunId, fetchTestRun])

  // Handle metadata save
  const handleSaveMetadata = useCallback(async () => {
    try {
      setError(null)
      await api.patch(`/projects/${projectId}/test-runs/${testRunId}`, {
        executionDate: editedMetadata.executionDate || null,
        environment: editedMetadata.environment.trim() || null,
        buildVersion: editedMetadata.buildVersion.trim() || null,
      })
      await fetchTestRun()
      setIsEditingMetadata(false)
    } catch (err: any) {
      console.error('Update metadata error:', err)
      setError(err.response?.data?.error?.message || 'Failed to update metadata')
    }
  }, [projectId, testRunId, editedMetadata, fetchTestRun])

  // Test run actions
  const handleRefresh = useCallback(async () => {
    setIsLoadingModalTestCase(true)
    setError(null)
    try {
      await Promise.all([
        fetchTestRun(),
        fetchTestPlanTestCases(),
        fetchResults(true),
      ])
    } catch (err: any) {
      console.error('Refresh error:', err)
      setError(err.response?.data?.error?.message || 'Failed to refresh data')
    } finally {
      setIsLoadingModalTestCase(false)
    }
  }, [fetchTestRun, fetchTestPlanTestCases, fetchResults])

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  const handleStart = useCallback(async () => {
    setIsUpdatingStatus(true)
    try {
      const updatePayload: any = {
        status: 'running'
      }
      if (!testRun?.executionDate) {
        updatePayload.executionDate = new Date().toISOString().split('T')[0]
      }
      await api.patch(`/projects/${projectId}/test-runs/${testRunId}`, updatePayload)
      await fetchTestRun()
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to start test run')
    } finally {
      setIsUpdatingStatus(false)
    }
  }, [projectId, testRunId, testRun, fetchTestRun])

  const handlePause = useCallback(() => {
    setIsExecutionPaused(true)
    setPausedAt(Date.now())
  }, [])

  const handleContinue = useCallback(() => {
    if (pausedAt) {
      const pausedDuration = Date.now() - pausedAt
      setPausedTimeOffset(prev => prev + pausedDuration)
      setPausedAt(null)
    }
    setIsExecutionPaused(false)
  }, [pausedAt])

  const handleFinish = useCallback(async () => {
    setIsUpdatingStatus(true)
    try {
      await api.patch(`/projects/${projectId}/test-runs/${testRunId}`, {
        status: 'completed'
      })
      await fetchTestRun()
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to finish test run')
    } finally {
      setIsUpdatingStatus(false)
    }
  }, [projectId, testRunId, fetchTestRun])

  // Filtered test cases
  const filteredTestCases = useMemo(() => {
    return testCasesWithResults.filter((testCase) => {
      if (statusFilter !== 'all' && testCase.status !== statusFilter) return false
      if (assigneeFilter !== 'all' && testCase.executedBy?.id !== assigneeFilter) return false
      if (priorityFilter !== 'all' && testCase.priority?.toString() !== priorityFilter) return false
      if (severityFilter !== 'all' && testCase.severity !== severityFilter) return false
      if (automatedFilter !== 'all') {
        const isAutomated = testCase.automated === true
        if (automatedFilter === 'yes' && !isAutomated) return false
        if (automatedFilter === 'no' && isAutomated) return false
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const titleMatch = testCase.title?.toLowerCase().includes(query)
        const idMatch = testCase.id?.toString().toLowerCase().includes(query)
        const jiraKeyMatch = testCase.jiraKey?.toLowerCase().includes(query)
        if (!titleMatch && !idMatch && !jiraKeyMatch) return false
      }
      if (dateRangeFilter.start || dateRangeFilter.end) {
        const result = testCase.result
        if (!result?.executedAt) {
          if (dateRangeFilter.start || dateRangeFilter.end) return false
        } else {
          const executedDate = new Date(result.executedAt)
          if (dateRangeFilter.start) {
            const startDate = new Date(dateRangeFilter.start)
            if (executedDate < startDate) return false
          }
          if (dateRangeFilter.end) {
            const endDate = new Date(dateRangeFilter.end)
            endDate.setHours(23, 59, 59, 999)
            if (executedDate > endDate) return false
          }
        }
      }
      return true
    })
  }, [testCasesWithResults, statusFilter, assigneeFilter, priorityFilter, severityFilter, automatedFilter, searchQuery, dateRangeFilter])

  // Group test cases by suite
  const testCasesBySuite = useMemo(() => {
    const acc: Record<string, { id: string; title: string; testCases: TestCaseWithResult[] }> = {}
    
    filteredTestCases.forEach((testCase) => {
      const isDeleted = testCase.isValid === false || !testCase.isValid
      
      if (isDeleted) {
        const deletedSuiteId = '__deleted__'
        if (!acc[deletedSuiteId]) {
          acc[deletedSuiteId] = {
            id: deletedSuiteId,
            title: 'Deleted Test Suite',
            testCases: [],
          }
        }
        acc[deletedSuiteId].testCases.push(testCase)
      } else {
        const suiteId = testCase.suiteId || 'unknown'
        const suiteTitle = testCase.suite?.title || 'Unknown Suite'
        if (!acc[suiteId]) {
          acc[suiteId] = {
            id: suiteId,
            title: suiteTitle,
            testCases: [],
          }
        }
        acc[suiteId].testCases.push(testCase)
      }
    })
    
    return acc
  }, [filteredTestCases])

  // Calculate stats
  const displayStats = useMemo(() => ({
    total: testCasesWithResults.length,
    passed: testCasesWithResults.filter(tc => tc.status === 'passed').length,
    failed: testCasesWithResults.filter(tc => tc.status === 'failed').length,
    skipped: testCasesWithResults.filter(tc => tc.status === 'skipped').length,
    blocked: testCasesWithResults.filter(tc => tc.status === 'blocked').length,
    toDo: testCasesWithResults.filter(tc => tc.status === 'toDo').length,
    inProgress: testCasesWithResults.filter(tc => tc.status === 'inProgress').length,
  }), [testCasesWithResults])

  // Calculate total execution time
  const totalExecutionTime = useMemo(() => {
    let totalSeconds = 0
    
    results.forEach((result) => {
      if (result.executionTime && result.executionTime > 0) {
        totalSeconds += result.executionTime
      } else if (result.executedAt && result.status === 'inProgress') {
        const startTime = new Date(result.executedAt).getTime()
        let elapsed = Math.floor((currentTime - startTime) / 1000)
        
        if (isExecutionPaused && pausedAt) {
          const pausedDuration = Math.floor((currentTime - pausedAt) / 1000)
          elapsed -= pausedDuration
        }
        
        if (pausedTimeOffset > 0) {
          elapsed -= Math.floor(pausedTimeOffset / 1000)
        }
        
        if (elapsed > 0) {
          totalSeconds += elapsed
        }
      }
    })
    
    return totalSeconds
  }, [results, currentTime, isExecutionPaused, pausedAt, pausedTimeOffset])

  // Get unique assignees
  const assignees = useMemo(() => {
    return Array.from(
      new Set(testCasesWithResults.map(tc => tc.executedBy?.id).filter(Boolean))
    ).map(id => {
      const testCase = testCasesWithResults.find(tc => tc.executedBy?.id === id)
      return testCase?.executedBy
    }).filter(Boolean) as Array<{ id: string; name: string; email: string }>
  }, [testCasesWithResults])

  // Effects
  useEffect(() => {
    if (projectId && testRunId) {
      fetchUsers()
      fetchRepository()
    }
  }, [projectId, testRunId, fetchUsers, fetchRepository])

  useEffect(() => {
    if (testRun?.testPlan.id) {
      fetchTestPlanTestCases()
      fetchResults(false, 1)
    }
  }, [testRun?.testPlan.id, fetchTestPlanTestCases, fetchResults])

  useEffect(() => {
    if (testPlanTestCases.length > 0 || results.length > 0) {
      mergeTestCasesWithResults()
    }
  }, [testPlanTestCases, results, mergeTestCasesWithResults])

  useEffect(() => {
    if (testCasesWithResults.length > 0 && expandedSuites.size === 0) {
      const suiteIds = new Set<string>()
      testCasesWithResults.forEach(tc => {
        if (tc.suiteId) {
          suiteIds.add(tc.suiteId)
        }
      })
      if (suiteIds.size > 0) {
        setExpandedSuites(suiteIds)
      }
    }
  }, [testCasesWithResults.length])

  useEffect(() => {
    if (isExecutionPaused) {
      return
    }
    
    let animationFrameId: number
    let lastUpdate = Date.now()
    const UPDATE_INTERVAL = 5000
    const ACTIVE_UPDATE_INTERVAL = 1000
        
    const updateTime = () => {
      const now = Date.now()
      const isActiveTab = !document.hidden
      const interval = isActiveTab ? ACTIVE_UPDATE_INTERVAL : UPDATE_INTERVAL
      
      if (now - lastUpdate >= interval) {
        setCurrentTime(now)
        lastUpdate = now
      }
      
      animationFrameId = requestAnimationFrame(updateTime)
    }
    
    animationFrameId = requestAnimationFrame(updateTime)
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [isExecutionPaused])

  useEffect(() => {
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (assigneeFilter !== 'all') params.set('assignee', assigneeFilter)
    if (priorityFilter !== 'all') params.set('priority', priorityFilter)
    if (severityFilter !== 'all') params.set('severity', severityFilter)
    if (automatedFilter !== 'all') params.set('automated', automatedFilter)
    if (searchQuery.trim()) params.set('search', searchQuery.trim())
    if (dateRangeFilter.start) params.set('startDate', dateRangeFilter.start)
    if (dateRangeFilter.end) params.set('endDate', dateRangeFilter.end)
    
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
    window.history.replaceState({}, '', newUrl)
  }, [statusFilter, assigneeFilter, priorityFilter, severityFilter, automatedFilter, searchQuery, dateRangeFilter])

  useEffect(() => {
    if (isEditingMetadata && testRun) {
      setEditedMetadata({
        executionDate: testRun.executionDate ? new Date(testRun.executionDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        environment: testRun.environment || '',
        buildVersion: testRun.buildVersion || '',
      })
    }
  }, [isEditingMetadata, testRun])

  const isLoading = isLoadingTestRun || isLoadingResults

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <AppHeader />

      <main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TestRunHeaderCard
          testRun={testRun}
          projectId={projectId}
          testRunId={testRunId}
          isLoading={isLoading}
          isUpdatingStatus={isUpdatingStatus}
          isExecutionPaused={isExecutionPaused}
          pausedAt={pausedAt}
          isEditingMetadata={isEditingMetadata}
          editedMetadata={editedMetadata}
          displayStats={displayStats}
          totalExecutionTime={totalExecutionTime}
          statusFilter={statusFilter}
          assigneeFilter={assigneeFilter}
          assignees={assignees}
          users={users}
          testCasesBySuite={testCasesBySuite}
          selectedTestCaseIds={selectedTestCaseIds}
          bulkAssignee={bulkAssignee}
          onTitleUpdate={handleTitleUpdate}
          onMetadataEdit={() => setIsEditingMetadata(!isEditingMetadata)}
          onMetadataChange={setEditedMetadata}
          onSaveMetadata={handleSaveMetadata}
          onCancelMetadata={() => setIsEditingMetadata(false)}
          onRefresh={handleRefresh}
          onStart={handleStart}
          onPause={handlePause}
          onContinue={handleContinue}
          onFinish={handleFinish}
          onStatusFilterChange={setStatusFilter}
          onAssigneeFilterChange={setAssigneeFilter}
          onResetFilters={() => {
            setStatusFilter('all')
            setAssigneeFilter('all')
          }}
          onBulkAssigneeChange={(userId) => {
            setBulkAssignee(userId || '')
            if (userId) {
              handleBulkAssign(userId)
            }
          }}
          onExpandAll={expandAllSuites}
          onCollapseAll={collapseAllSuites}
          onError={setError}
        />

        <ErrorMessage message={error} />

        {/* Two Column Layout */}
        <div className="grid grid-cols-3 gap-6">
          {/* Left Column: Test Suites and Test Cases */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 col-span-2 flex flex-col backdrop-blur-sm bg-opacity-95" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            <TestSuiteList
              testCasesBySuite={testCasesBySuite}
              expandedSuites={expandedSuites}
              selectedTestCaseIds={selectedTestCaseIds}
              selectedTestCaseForModal={selectedTestCaseForModal}
              users={users}
              testRunId={testRunId}
              onSuiteToggle={toggleSuiteExpansion}
              onSuiteSelect={toggleSuiteSelection}
              onTestCaseSelect={toggleTestCaseSelection}
              onTestCaseClick={handleTestCaseRowClick}
              onAssignUser={handleAssignUser}
              isSuiteFullySelected={isSuiteFullySelected}
              isSuitePartiallySelected={isSuitePartiallySelected}
              isLoading={isLoading}
            />
          </div>

          {/* Right Column: Test Case Detail */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col backdrop-blur-sm bg-opacity-95" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            <TestCaseDetailPanel
              selectedTestCase={selectedTestCaseForModal}
              selectedTestRunResult={selectedTestRunResult}
              repository={repositoryForModal}
              projectId={projectId}
              repoId={repoId}
              testRunId={testRunId}
              isLoading={isLoadingModalTestCase}
              currentStatus={getCurrentStatus()}
              errorMessage={errorMessage}
              executionLogs={executionLogs}
              bugTicketUrl={bugTicketUrl}
              comments={comments}
              newComment={newComment}
              setNewComment={setNewComment}
              commentFiles={commentFiles}
              filePreviews={filePreviews}
              isSubmittingComment={isSubmittingComment}
              editingCommentId={editingCommentId}
              editingCommentText={editingCommentText}
              currentUserId={currentUserId}
              activeTab={activeTab}
              history={history}
              historyPage={historyPage}
              historyTotalPages={historyTotalPages}
              isLoadingHistory={isLoadingHistory}
              onStatusChange={handleUpdateStatus}
              onErrorMessageChange={setErrorMessage}
              onExecutionLogsChange={setExecutionLogs}
              onBugTicketUrlChange={setBugTicketUrl}
              onAutoSave={handleAutoSaveFields}
              onFileSelect={handleFileSelect}
              onSubmitComment={handleSubmitComment}
              onEditComment={handleEditComment}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={handleSaveEdit}
              onDeleteComment={handleDeleteComment}
              onTabChange={setActiveTab}
              onHistoryPageChange={(page) => selectedTestRunResult?.id && fetchHistory(selectedTestRunResult.id, page)}
              onError={setError}
            />
          </div>
        </div>
      </main>

      {/* Delete Comment Modal */}
      <DeleteCommentModal
        comment={commentToDelete}
        isDeleting={isDeletingComment}
        error={error}
        onConfirm={confirmDeleteComment}
        onCancel={() => {
          setCommentToDelete(null)
          setError(null)
        }}
      />
    </div>
  )
}
