'use client'

import { useState, useEffect, useRef } from 'react'
import React from 'react'
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

interface TestSuite {
  id: string
  title: string
  parentId: string | null
  parent: {
    id: string
    title: string
  } | null
  order: number | null
  counts: {
    children: number
    testCases: number
  }
  createdAt: string
  updatedAt: string
}

interface TestCase {
  id: string
  title: string
  description: string | null
  automated: boolean
  priority: number
  severity: string
  labels: string | null
  regression: boolean
  epicLink: string | null
  linkedIssue: string | null
  jiraKey: string | null
  platform: string | null
  releaseVersion: string | null
  createdAt: string
  updatedAt: string
}

interface TestCaseDetail extends TestCase {
  data: any
  order: number | null
  defectStage: string | null
  version: number
  suite?: {
    id: string
    title: string
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
  counts: {
    comments: number
    testPlans: number
    testRuns: number
  }
}

export default function ViewRepositoryPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const repoId = params.repoId as string

  const [project, setProject] = useState<Project | null>(null)
  const [repository, setRepository] = useState<Repository | null>(null)
  const [testSuites, setTestSuites] = useState<TestSuite[]>([])
  const [selectedSuite, setSelectedSuite] = useState<string | null>(null)
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [selectedTestCase, setSelectedTestCase] = useState<string | null>(null)
  const [selectedTestCasesForDelete, setSelectedTestCasesForDelete] = useState<Set<string>>(new Set())
  const [isDeletingTestCases, setIsDeletingTestCases] = useState(false)
  const [showMoveTestCasesModal, setShowMoveTestCasesModal] = useState(false)
  const [isMovingTestCases, setIsMovingTestCases] = useState(false)
  const [selectedTargetSuiteForMove, setSelectedTargetSuiteForMove] = useState<string | null>(null)
  const [showFindDuplicatesModal, setShowFindDuplicatesModal] = useState(false)
  const [duplicateGroups, setDuplicateGroups] = useState<Array<{ testCases: TestCaseDetail[], similarity: number }>>([])
  const [isFindingDuplicates, setIsFindingDuplicates] = useState(false)
  const [selectedDuplicatePair, setSelectedDuplicatePair] = useState<{ left: TestCaseDetail, right: TestCaseDetail } | null>(null)
  const [isMergingDuplicates, setIsMergingDuplicates] = useState(false)
  const [showNoDuplicatesModal, setShowNoDuplicatesModal] = useState(false)
  const [isMergingAll, setIsMergingAll] = useState(false)
  const [mergeAllProgress, setMergeAllProgress] = useState({ current: 0, total: 0 })
  const [showCreateSuiteInUploadModal, setShowCreateSuiteInUploadModal] = useState(false)
  const [newSuiteNameInUpload, setNewSuiteNameInUpload] = useState('')
  const [isCreatingSuiteInUpload, setIsCreatingSuiteInUpload] = useState(false)
  const [showFileErrorModal, setShowFileErrorModal] = useState(false)
  const [fileErrorMessage, setFileErrorMessage] = useState('')
  const [showMergeAllConfirmModal, setShowMergeAllConfirmModal] = useState(false)
  const [testCaseDetail, setTestCaseDetail] = useState<TestCaseDetail | null>(null)
  const [isCreatingTestCase, setIsCreatingTestCase] = useState(false)
  const [isEditingTestCase, setIsEditingTestCase] = useState(false)
  const [editingTestCaseId, setEditingTestCaseId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingSuites, setIsLoadingSuites] = useState(false)
  const [isLoadingTestCases, setIsLoadingTestCases] = useState(false)
  const [isLoadingTestCaseDetail, setIsLoadingTestCaseDetail] = useState(false)
  const [isSubmittingTestCase, setIsSubmittingTestCase] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [testCaseFormData, setTestCaseFormData] = useState({
    title: '',
    description: '',
    automated: false, // Test Type: false = Manual, true = Automated
    priority: 2, // Default to Medium (2) - matches template: High=3, Medium=2, Low=1
    severity: 'Moderate',
    labels: '',
    regression: false, // Default to No
    epicLink: '',
    linkedIssue: '',
    releaseVersion: '',
    platform: [] as string[], // Array for checkboxes: Android, iOS, Mweb, Web
    preconditions: '',
    preconditionsMode: 'free_text' as 'free_text' | 'from_other', // Toggle for preconditions
    bddScenarios: '',
    featureSuiteId: '', // Feature (Test Suite) ID - auto-selected from selectedSuite
  })
  const [showLabelInput, setShowLabelInput] = useState(false)
  const [labelInputValue, setLabelInputValue] = useState('')
  const [labelSuggestions, setLabelSuggestions] = useState<string[]>([])
  const [showLabelSuggestions, setShowLabelSuggestions] = useState(false)
  const [availableLabels, setAvailableLabels] = useState<string[]>([])
  const [showCreateSuiteModal, setShowCreateSuiteModal] = useState(false)
  const [showSelectSuiteModal, setShowSelectSuiteModal] = useState(false)
  const [showEditSuiteModal, setShowEditSuiteModal] = useState(false)
  const [showTestCaseSelectionModal, setShowTestCaseSelectionModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [parsedTestCases, setParsedTestCases] = useState<any[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [uploadResults, setUploadResults] = useState<{ success: number; failed: number; created: number; updated: number; errors: string[] }>({ success: 0, failed: 0, created: 0, updated: 0, errors: [] })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [allTestCases, setAllTestCases] = useState<TestCase[]>([])
  const [selectedTestCaseIds, setSelectedTestCaseIds] = useState<Set<string>>(new Set())
  const [testCaseSearchQuery, setTestCaseSearchQuery] = useState('')
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set())
  const [isLoadingAllTestCases, setIsLoadingAllTestCases] = useState(false)
  const [rightColumnWidth, setRightColumnWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rightColumnWidth')
      return saved ? parseInt(saved, 10) : 600
    }
    return 600
  })
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartX = useRef<number>(0)
  const resizeStartWidth = useRef<number>(600)
  const [editingSuite, setEditingSuite] = useState<TestSuite | null>(null)
  const [newSuiteName, setNewSuiteName] = useState('')
  const [isCreatingSuite, setIsCreatingSuite] = useState(false)
  const [isUpdatingSuite, setIsUpdatingSuite] = useState(false)
  const [hoveredSuite, setHoveredSuite] = useState<string | null>(null)
  const [draggedSuite, setDraggedSuite] = useState<string | null>(null)
  const [dragOverSuite, setDragOverSuite] = useState<string | null>(null)
  const [dragDropType, setDragDropType] = useState<'child' | 'sibling-above' | 'sibling-below' | 'parent' | 'root' | null>(null)
  const [isReordering, setIsReordering] = useState(false)
  const dragOverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTestCaseData, setModalTestCaseData] = useState<TestCaseDetail | null>(null)
  const [isLoadingModalTestCase, setIsLoadingModalTestCase] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    fetchProject()
    fetchRepository()
    fetchTestSuites()
    
    // Check if suite and test case are in URL params
    const urlParams = new URLSearchParams(window.location.search)
    const suiteId = urlParams.get('suite')
    const testCaseId = urlParams.get('testCase')
    if (suiteId) {
      setSelectedSuite(suiteId)
    }
    if (testCaseId && suiteId) {
      setSelectedTestCase(testCaseId)
    }
  }, [projectId, repoId, router])

  useEffect(() => {
    if (selectedSuite) {
      fetchTestCases()
      setSelectedTestCasesForDelete(new Set()) // Clear selection when switching suites
      // Update URL
      const url = new URL(window.location.href)
      url.searchParams.set('suite', selectedSuite)
      if (!selectedTestCase) {
        url.searchParams.delete('testCase')
      }
      window.history.replaceState({}, '', url.toString())
    } else {
      setTestCases([])
      setSelectedTestCase(null)
      setTestCaseDetail(null)
      setSelectedTestCasesForDelete(new Set()) // Clear selection
    }
  }, [selectedSuite])

  useEffect(() => {
    if (selectedTestCase && selectedSuite) {
      fetchTestCaseDetail()
      setIsCreatingTestCase(false)
      // Update URL
      const url = new URL(window.location.href)
      url.searchParams.set('suite', selectedSuite)
      url.searchParams.set('testCase', selectedTestCase)
      window.history.replaceState({}, '', url.toString())
    } else {
      setTestCaseDetail(null)
    }
  }, [selectedTestCase, selectedSuite])

  // Handle clicks on links in modal preconditions after modal is rendered
  useEffect(() => {
    if (!isModalOpen || !modalTestCaseData) return

    const handleModalLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a') as HTMLAnchorElement
      if (link && link.href && link.closest('.preconditions-content')) {
        e.preventDefault()
        e.stopPropagation()
        
        // Extract test case ID from href
        try {
          const url = new URL(link.href)
          const testCaseId = url.searchParams.get('testCase')
          const suiteId = url.searchParams.get('suite')
          if (testCaseId) {
            openTestCaseModal(testCaseId, suiteId || undefined)
          }
        } catch {
          // If URL parsing fails, try to extract from data attributes
          const testCaseId = link.getAttribute('data-test-case-id')
          const suiteId = link.getAttribute('data-suite-id')
          if (testCaseId) {
            openTestCaseModal(testCaseId, suiteId || undefined)
          }
        }
      }
    }

    // Add event listener with a small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleModalLinkClick, true)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleModalLinkClick, true)
    }
  }, [isModalOpen, modalTestCaseData])

  // Auto-update featureSuiteId when selectedSuite changes and form is in create mode
  useEffect(() => {
    if (isCreatingTestCase && selectedSuite && !testCaseFormData.featureSuiteId) {
      setTestCaseFormData(prev => ({ ...prev, featureSuiteId: selectedSuite }))
    }
  }, [selectedSuite, isCreatingTestCase])

  // Fetch labels when creating test case
  useEffect(() => {
    if (isCreatingTestCase && repoId) {
      fetchAllLabels()
    }
  }, [isCreatingTestCase, repoId])

  // Handle clicks on test case links in preconditions
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Check for links with test-case-link class or links that match the test case URL pattern
      const link = target.closest('a.test-case-link') as HTMLAnchorElement || 
                   target.closest('a[href*="/repository/"][href*="testCase="]') as HTMLAnchorElement
      if (link) {
        e.preventDefault()
        e.stopPropagation()
        
        // Try to get test case ID from data attributes first
        let testCaseId: string | null = link.getAttribute('data-test-case-id')
        let suiteId: string | null = link.getAttribute('data-suite-id')
        
        // If not found, try to extract from href
        if (!testCaseId && link.href) {
          const url = new URL(link.href)
          const testCaseMatch = url.searchParams.get('testCase')
          const suiteMatch = url.searchParams.get('suite')
          if (testCaseMatch) {
            testCaseId = testCaseMatch
            suiteId = suiteId || suiteMatch
          }
        }
        
        if (testCaseId) {
          openTestCaseModal(testCaseId, suiteId || undefined)
        }
      }
    }

    document.addEventListener('click', handleLinkClick)
    return () => {
      document.removeEventListener('click', handleLinkClick)
    }
  }, [projectId, repoId, testSuites])

  // Handle resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      // Calculate difference: dragging right should make column larger, dragging left should make it smaller
      // Since the column is anchored to the right, dragging the resizer right moves the left edge right,
      // which makes the column narrower. So we need to invert the calculation.
      const diff = e.clientX - resizeStartX.current
      // Invert: drag right (positive diff) should increase width, so we subtract the diff
      const newWidth = Math.max(400, Math.min(1200, resizeStartWidth.current - diff))
      setRightColumnWidth(newWidth)
      if (typeof window !== 'undefined') {
        localStorage.setItem('rightColumnWidth', newWidth.toString())
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    resizeStartX.current = e.clientX
    resizeStartWidth.current = rightColumnWidth
  }

  // Parse CSV file
  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    
    // Find the header row (usually contains: title,description,label,automated,priority,precondition,scenario,regression,epic_link,link_issue,platform,fix_version,severity)
    let headerIndex = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes('title') && lines[i].toLowerCase().includes('description')) {
        headerIndex = i
        break
      }
    }
    
    if (headerIndex === -1) {
      throw new Error('Could not find CSV header row')
    }
    
    // Parse header - detect delimiter (semicolon for CSV, tab for TSV)
    const headerLine = lines[headerIndex]
    const delimiter = headerLine.includes('\t') ? '\t' : ';'
    const headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase())
    
    // Find column indices
    const titleIdx = headers.indexOf('title')
    const descriptionIdx = headers.indexOf('description')
    const labelIdx = headers.indexOf('label')
    const automatedIdx = headers.indexOf('automated')
    const priorityIdx = headers.indexOf('priority')
    const preconditionIdx = headers.indexOf('precondition')
    const scenarioIdx = headers.indexOf('scenario')
    const regressionIdx = headers.indexOf('regression')
    const epicLinkIdx = headers.indexOf('epic_link')
    const linkIssueIdx = headers.indexOf('link_issue')
    const platformIdx = headers.indexOf('platform')
    const fixVersionIdx = headers.indexOf('fix_version')
    const severityIdx = headers.indexOf('severity')
    
    if (titleIdx === -1) {
      throw new Error('Title column not found in CSV')
    }
    
    // Parse data rows
    const testCases: any[] = []
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line || line.trim().length === 0) continue
      
      // Handle multi-line cells (scenario field can span multiple lines)
      let fullLine = line
      let quoteCount = (fullLine.match(/"/g) || []).length
      while (quoteCount % 2 !== 0 && i + 1 < lines.length) {
        i++
        fullLine += '\n' + lines[i]
        quoteCount = (fullLine.match(/"/g) || []).length
      }
      
      // Parse CSV line with proper handling of quoted fields
      const values: string[] = []
      let currentValue = ''
      let inQuotes = false
      
      for (let j = 0; j < fullLine.length; j++) {
        const char = fullLine[j]
        const nextChar = fullLine[j + 1]
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Escaped quote
            currentValue += '"'
            j++ // Skip next quote
          } else {
            // Toggle quote state
            inQuotes = !inQuotes
          }
        } else if ((char === delimiter || (delimiter === '\t' && char === '\t')) && !inQuotes) {
          // Field separator
          values.push(currentValue)
          currentValue = ''
        } else {
          currentValue += char
        }
      }
      // Add last value
      values.push(currentValue)
      
      // Trim all values
      const trimmedValues = values.map(v => v.trim())
      
      const title = trimmedValues[titleIdx]?.trim()
      if (!title || title.length === 0) continue // Skip empty rows
      
      // Parse boolean values
      const automated = trimmedValues[automatedIdx]?.toLowerCase() === 'yes'
      const regression = trimmedValues[regressionIdx]?.toLowerCase() === 'yes'
      
      // Parse priority (low=1, medium=2, high=3)
      let priority = 2 // default medium
      const priorityStr = trimmedValues[priorityIdx]?.toLowerCase()
      if (priorityStr === 'low') priority = 1
      else if (priorityStr === 'medium') priority = 2
      else if (priorityStr === 'high') priority = 3
      
      // Parse severity
      const severity = trimmedValues[severityIdx]?.trim() || 'Moderate'
      
      // Parse labels (semicolon-separated in CSV, convert to comma-separated for API)
      let labels = trimmedValues[labelIdx]?.trim() || ''
      if (labels) {
        labels = labels.replace(/;/g, ',') // Convert semicolons to commas
      }
      
      // Parse platform (semicolon or comma-separated) - convert to array
      let platformArray: string[] = []
      const platformStr = trimmedValues[platformIdx]?.trim() || ''
      if (platformStr) {
        // Split by semicolon or comma, normalize to lowercase, filter empty
        platformArray = platformStr
          .split(/[;,]/)
          .map(p => p.trim().toLowerCase())
          .filter(p => p.length > 0)
      }
      
      // Build data JSON for preconditions and scenarios
      const dataJson: any = {}
      if (trimmedValues[preconditionIdx]?.trim()) {
        dataJson.preconditions = trimmedValues[preconditionIdx].trim()
        dataJson.preconditionsMode = 'free_text'
      }
      if (trimmedValues[scenarioIdx]?.trim()) {
        dataJson.bddScenarios = trimmedValues[scenarioIdx].trim()
      }
      
      // Helper to convert empty strings to undefined
      const toOptional = (val: string) => val && val.trim() ? val.trim() : undefined
      
      testCases.push({
        title,
        description: toOptional(trimmedValues[descriptionIdx] || ''),
        labels: toOptional(labels),
        automated,
        priority,
        severity,
        regression,
        epicLink: toOptional(trimmedValues[epicLinkIdx] || ''),
        linkedIssue: toOptional(trimmedValues[linkIssueIdx] || ''),
        releaseVersion: toOptional(trimmedValues[fixVersionIdx] || ''),
        platform: platformArray.length > 0 ? JSON.stringify(platformArray) : undefined,
        data: Object.keys(dataJson).length > 0 ? dataJson : undefined,
      })
    }
    
    return testCases
  }

  // Download CSV template
  const handleDownloadCSVTemplate = () => {
    // CSV template with all required and optional columns
    const headers = [
      'title',
      'description',
      'label',
      'automated',
      'priority',
      'precondition',
      'scenario',
      'regression',
      'epic_link',
      'link_issue',
      'platform',
      'fix_version',
      'severity'
    ]
    
    // Example data rows
    const exampleRows = [
      [
        'Example Test Case 1',
        'This is a sample test case description',
        'smoke,regression',
        'yes',
        'high',
        'User is logged in',
        'Given I am on the homepage\nWhen I click the login button\nThen I should see the login form',
        'yes',
        'EPIC-123',
        'JIRA-456',
        'web,android',
        'v1.0.0',
        'Critical'
      ],
      [
        'Example Test Case 2',
        'Another example test case',
        'integration',
        'no',
        'medium',
        'System is configured',
        'Given the system is ready\nWhen I perform an action\nThen the result should be correct',
        'yes',
        '',
        '',
        'ios',
        'v1.1.0',
        'Moderate'
      ]
    ]
    
    // Build CSV content
    let csvContent = headers.join(';') + '\n'
    exampleRows.forEach(row => {
      // Escape semicolons and quotes in values, and wrap in quotes if needed
      const escapedRow = row.map(value => {
        if (!value) return ''
        // If value contains semicolon, newline, or quote, wrap in quotes and escape quotes
        if (value.includes(';') || value.includes('\n') || value.includes('"')) {
          return '"' + value.replace(/"/g, '""') + '"'
        }
        return value
      })
      csvContent += escapedRow.join(';') + '\n'
    })
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'test-cases-template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.tsv')) {
      setFileErrorMessage('Please select a CSV or TSV file')
      setShowFileErrorModal(true)
      e.target.value = ''
      return
    }
    
    setUploadedFile(file)
    setError(null) // Clear any previous errors
    
    try {
      const text = await file.text()
      const parsed = parseCSV(text)
      
      if (parsed.length === 0) {
        setFileErrorMessage('No test cases found in file')
        setShowFileErrorModal(true)
        e.target.value = ''
        return
      }
      
      setParsedTestCases(parsed)
      setShowUploadModal(true)
    } catch (err: any) {
      // Format error message to be more user-friendly
      let errorMsg = err.message || 'Failed to parse file'
      
      // Make error messages more descriptive
      if (errorMsg.includes('Could not find CSV header row')) {
        errorMsg = 'Could not find the header row in the file. Please ensure your file has a header row with columns like "title" and "description".'
      } else if (errorMsg.includes('Title column not found')) {
        errorMsg = 'Title column not found in the file. Please ensure your CSV/TSV file contains a "title" column in the header row.'
      } else if (errorMsg.includes('Failed to parse')) {
        errorMsg = 'Failed to parse the file. Please ensure the file is a valid CSV or TSV file with the correct format.'
      }
      
      // Show error in modal, don't set the main error state
      setFileErrorMessage(errorMsg)
      setShowFileErrorModal(true)
      setError(null) // Ensure main error state is cleared
      e.target.value = ''
    }
  }

  // Handle bulk move test cases
  const handleBulkMoveTestCases = async (targetSuiteId: string) => {
    if (selectedTestCasesForDelete.size === 0 || !selectedSuite) return
    
    setIsMovingTestCases(true)
    setError(null)
    
    const testCaseIds = Array.from(selectedTestCasesForDelete)
    let successCount = 0
    let failedCount = 0
    const errors: string[] = []
    
    try {
      // Move test cases one by one
      for (const testCaseId of testCaseIds) {
        try {
          await api.post(
            `/projects/${projectId}/repositories/${repoId}/test-cases/${testCaseId}/move`,
            { targetSuiteId }
          )
          successCount++
        } catch (err: any) {
          failedCount++
          const testCase = testCases.find(tc => tc.id === testCaseId)
          const testCaseTitle = testCase?.title || testCaseId
          const errorMsg = err.response?.data?.error?.message || 'Unknown error'
          errors.push(`${testCaseTitle}: ${errorMsg}`)
        }
      }
      
      // Clear selection
      setSelectedTestCasesForDelete(new Set())
      setShowMoveTestCasesModal(false)
      setSelectedTargetSuiteForMove(null)
      
      // Refresh test cases list
      await fetchTestCases()
      
      // Refresh suites to update counts
      await fetchTestSuites()
      
      // Clear selected test case if it was moved
      if (selectedTestCase && testCaseIds.includes(selectedTestCase)) {
        setSelectedTestCase(null)
        setTestCaseDetail(null)
      }
      
      // Show success/error message
      if (failedCount === 0) {
        setError(null)
      } else {
        setError(`Moved ${successCount} test case${successCount !== 1 ? 's' : ''}. Failed to move ${failedCount} test case${failedCount !== 1 ? 's' : ''}. ${errors.slice(0, 3).join('; ')}`)
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to move test cases')
    } finally {
      setIsMovingTestCases(false)
    }
  }

  // Handle bulk delete test cases
  const handleBulkDeleteTestCases = async () => {
    if (selectedTestCasesForDelete.size === 0 || !selectedSuite) return
    
    const count = selectedTestCasesForDelete.size
    const confirmMessage = `Are you sure you want to delete ${count} test case${count !== 1 ? 's' : ''}? This action cannot be undone.`
    
    if (!confirm(confirmMessage)) {
      return
    }
    
    setIsDeletingTestCases(true)
    setError(null)
    
    const testCaseIds = Array.from(selectedTestCasesForDelete)
    let successCount = 0
    let failedCount = 0
    const errors: string[] = []
    
    try {
      // Delete test cases one by one
      for (const testCaseId of testCaseIds) {
        try {
          await api.delete(
            `/projects/${projectId}/repositories/${repoId}/suites/${selectedSuite}/test-cases/${testCaseId}`
          )
          successCount++
        } catch (err: any) {
          failedCount++
          const testCase = testCases.find(tc => tc.id === testCaseId)
          const testCaseTitle = testCase?.title || testCaseId
          const errorMsg = err.response?.data?.error?.message || 'Unknown error'
          errors.push(`${testCaseTitle}: ${errorMsg}`)
        }
      }
      
      // Clear selection
      setSelectedTestCasesForDelete(new Set())
      
      // Refresh test cases list
      await fetchTestCases()
      
      // Clear selected test case if it was deleted
      if (selectedTestCase && testCaseIds.includes(selectedTestCase)) {
        setSelectedTestCase(null)
        setTestCaseDetail(null)
      }
      
      // Show success/error message
      if (failedCount === 0) {
        setError(null)
        // You could add a success message here if needed
      } else {
        setError(`Deleted ${successCount} test case${successCount !== 1 ? 's' : ''}. Failed to delete ${failedCount} test case${failedCount !== 1 ? 's' : ''}. ${errors.slice(0, 3).join('; ')}`)
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to delete test cases')
    } finally {
      setIsDeletingTestCases(false)
    }
  }

  // Handle bulk import
  const handleBulkImport = async (suiteId: string) => {
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
        // Suite doesn't exist, try to find it by ID or create a new one
        const suite = testSuites.find(s => s.id === suiteId)
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
              await fetchTestSuites()
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
          const suite = testSuites.find(s => s.id === suiteId)
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
              await fetchTestSuites()
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
    let existingTestCases: TestCase[] = []
    try {
      const existingResponse = await api.get(
        `/projects/${projectId}/repositories/${repoId}/suites/${targetSuiteId}/test-cases?limit=1000&includeDeleted=false`
      )
      if (existingResponse.data?.data?.testCases) {
        existingTestCases = existingResponse.data.data.testCases
      }
    } catch (err) {
      console.warn('Failed to fetch existing test cases for duplicate check:', err)
      // Continue anyway - we'll just create new ones
    }
    
    // Create a map of title -> testCaseId for quick lookup (case-insensitive)
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
          // Update existing test case
          await api.patch(
            `/projects/${projectId}/repositories/${repoId}/suites/${targetSuiteId}/test-cases/${existingId}`,
            testCaseData
          )
          updatedCount++
          successCount++
        } else {
          // Create new test case
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
        
        // Include detailed validation errors if available
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
    
    // Refresh test cases if suite is selected
    if (selectedSuite === suiteId) {
      fetchTestCases()
    }
    
    // Refresh suites to update counts
    fetchTestSuites()
  }

  const handleCreateTestCase = () => {
    if (!selectedSuite) {
      setShowSelectSuiteModal(true)
      return
    }
    setIsCreatingTestCase(true)
    setSelectedTestCase(null)
    setTestCaseDetail(null)
    setTestCaseFormData({
      title: '',
      description: '',
      automated: false,
      priority: 2,
      severity: 'Moderate',
      labels: '',
      regression: false,
      epicLink: '',
      linkedIssue: '',
      releaseVersion: '',
      platform: [],
      preconditions: '',
      preconditionsMode: 'free_text',
      bddScenarios: '',
      featureSuiteId: selectedSuite || '',
    })
    setShowLabelInput(false)
    setLabelInputValue('')
    setShowLabelSuggestions(false)
    setError(null)
  }

  const handleAddLabel = (label: string) => {
    if (!label) return
    
    const currentLabels = testCaseFormData.labels 
      ? testCaseFormData.labels.split(',').map(l => l.trim()).filter(l => l)
      : []
    
    // Handle comma-separated input
    const newLabels = label.split(',').map(l => l.trim()).filter(l => l && !currentLabels.includes(l))
    
    if (newLabels.length > 0) {
      const updatedLabels = currentLabels.length > 0 
        ? [...currentLabels, ...newLabels].join(', ')
        : newLabels.join(', ')
      setTestCaseFormData({ ...testCaseFormData, labels: updatedLabels })
      setLabelInputValue('')
      setShowLabelSuggestions(false)
    }
  }

  const handleCancelCreateTestCase = () => {
    setIsCreatingTestCase(false)
    setTestCaseFormData({
      title: '',
      description: '',
      automated: false,
      priority: 2,
      severity: 'Moderate',
      labels: '',
      regression: false,
      epicLink: '',
      linkedIssue: '',
      releaseVersion: '',
      platform: [],
      preconditions: '',
      preconditionsMode: 'free_text',
      bddScenarios: '',
      featureSuiteId: selectedSuite || '',
    })
    setShowLabelInput(false)
    setLabelInputValue('')
    setShowLabelSuggestions(false)
    setError(null)
  }

  const handleStartEdit = () => {
    if (!testCaseDetail) return
    
    // Populate form with current test case data
    let platforms: string[] = []
    try {
      if (testCaseDetail.platform) {
        platforms = JSON.parse(testCaseDetail.platform)
      }
    } catch {
      if (testCaseDetail.platform) {
        platforms = [testCaseDetail.platform]
      }
    }

    // Determine preconditions mode
    let preconditionsMode: 'free_text' | 'from_other' = 'free_text'
    let preconditions = ''
    if (testCaseDetail.data?.preconditions) {
      // Check if it contains HTML links (from "Get from other test cases")
      if (typeof testCaseDetail.data.preconditions === 'string' && testCaseDetail.data.preconditions.includes('<a href')) {
        preconditionsMode = 'from_other'
        preconditions = testCaseDetail.data.preconditions
      } else {
        preconditions = testCaseDetail.data.preconditions
      }
    }

    setTestCaseFormData({
      title: testCaseDetail.title || '',
      description: testCaseDetail.description || '',
      automated: testCaseDetail.automated || false,
      priority: testCaseDetail.priority || 2,
      severity: testCaseDetail.severity || 'Moderate',
      labels: testCaseDetail.labels || '',
      regression: testCaseDetail.regression || false,
      epicLink: testCaseDetail.epicLink || '',
      linkedIssue: testCaseDetail.linkedIssue || '',
      releaseVersion: testCaseDetail.releaseVersion || '',
      platform: platforms,
      preconditions: preconditions,
      preconditionsMode: preconditionsMode,
      bddScenarios: testCaseDetail.data?.bddScenarios || '',
      featureSuiteId: testCaseDetail.suite?.id || selectedSuite || '',
    })

    // Set labels display
    if (testCaseDetail.labels) {
      setShowLabelInput(true)
      const labelArray = testCaseDetail.labels.split(',').map(l => l.trim()).filter(l => l)
      setLabelInputValue('')
    } else {
      setShowLabelInput(false)
      setLabelInputValue('')
    }

    setIsEditingTestCase(true)
    setEditingTestCaseId(selectedTestCase)
    setIsCreatingTestCase(false)
    setError(null)
  }

  const handleUpdateTestCase = async (e: React.FormEvent): Promise<any> => {
    e.preventDefault()
    if (!selectedSuite || !editingTestCaseId) return

    setIsSubmittingTestCase(true)
    setError(null)

    try {
      // Build data JSON object for preconditions and BDD scenarios
      const dataJson: any = {}
      if (testCaseFormData.preconditions) {
        dataJson.preconditions = testCaseFormData.preconditions
        dataJson.preconditionsMode = testCaseFormData.preconditionsMode
      }
      if (testCaseFormData.bddScenarios) {
        dataJson.bddScenarios = testCaseFormData.bddScenarios
      }

      // Use featureSuiteId if provided, otherwise fall back to selectedSuite
      const suiteIdToUse = testCaseFormData.featureSuiteId || selectedSuite
      if (!suiteIdToUse) {
        setError('Please select a test suite')
        return
      }

      const response = await api.patch(
        `/projects/${projectId}/repositories/${repoId}/suites/${suiteIdToUse}/test-cases/${editingTestCaseId}`,
        {
          title: testCaseFormData.title.trim(),
          description: testCaseFormData.description.trim() || undefined,
          automated: testCaseFormData.automated,
          priority: testCaseFormData.priority,
          severity: testCaseFormData.severity,
          labels: testCaseFormData.labels.trim() || undefined,
          regression: testCaseFormData.regression,
          epicLink: testCaseFormData.epicLink.trim() || undefined,
          linkedIssue: testCaseFormData.linkedIssue.trim() || undefined,
          releaseVersion: testCaseFormData.releaseVersion.trim() || undefined,
          platform: testCaseFormData.platform.length > 0 ? JSON.stringify(testCaseFormData.platform) : undefined,
          data: Object.keys(dataJson).length > 0 ? dataJson : undefined,
        }
      )

      if (response.data?.data?.testCase) {
        // Refresh test cases list and detail
        await fetchTestCases()
        await fetchTestCaseDetail()
        // Close edit mode
        setIsEditingTestCase(false)
        setEditingTestCaseId(null)
        // Return test case
        return response.data.data.testCase
      }
    } catch (err: any) {
      console.error('Update test case error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else if (err.response?.status === 403) {
        setError(err.response?.data?.error?.message || 'You do not have permission to update test cases.')
      } else if (err.response?.status === 404) {
        setError('Test case not found')
      } else if (err.response?.status === 409) {
        setError('Test case has been modified by another user. Please refresh and try again.')
      } else if (err.response?.data?.error?.details) {
        const details = err.response.data.error.details
        const errorMessages = Array.isArray(details)
          ? details.map((d: any) => `${d.path.join('.')}: ${d.message}`).join(', ')
          : 'Invalid input data'
        setError(errorMessages)
      } else {
        setError(err.response?.data?.error?.message || 'Failed to update test case')
      }
    } finally {
      setIsSubmittingTestCase(false)
    }
  }

  const handleSubmitTestCase = async (e: React.FormEvent): Promise<any> => {
    e.preventDefault()
    if (!selectedSuite) return

    setIsSubmittingTestCase(true)
    setError(null)

    try {
      // Build data JSON object for preconditions and BDD scenarios
      const dataJson: any = {}
      if (testCaseFormData.preconditions) {
        dataJson.preconditions = testCaseFormData.preconditions
        dataJson.preconditionsMode = testCaseFormData.preconditionsMode
      }
      if (testCaseFormData.bddScenarios) {
        dataJson.bddScenarios = testCaseFormData.bddScenarios
      }

      // Use featureSuiteId if provided, otherwise fall back to selectedSuite
      const suiteIdToUse = testCaseFormData.featureSuiteId || selectedSuite
      if (!suiteIdToUse) {
        setError('Please select a test suite')
        return
      }

      const response = await api.post(
        `/projects/${projectId}/repositories/${repoId}/suites/${suiteIdToUse}/test-cases`,
        {
          title: testCaseFormData.title.trim(),
          description: testCaseFormData.description.trim() || undefined,
          automated: testCaseFormData.automated,
          priority: testCaseFormData.priority,
          severity: testCaseFormData.severity,
          labels: testCaseFormData.labels.trim() || undefined,
          regression: testCaseFormData.regression,
          epicLink: testCaseFormData.epicLink.trim() || undefined,
          linkedIssue: testCaseFormData.linkedIssue.trim() || undefined,
          releaseVersion: testCaseFormData.releaseVersion.trim() || undefined,
          platform: testCaseFormData.platform.length > 0 ? JSON.stringify(testCaseFormData.platform) : undefined,
          data: Object.keys(dataJson).length > 0 ? dataJson : undefined,
        }
      )

      if (response.data?.data?.testCase) {
        // Refresh test cases list
        await fetchTestCases()
        // Select the newly created test case
        setSelectedTestCase(response.data.data.testCase.id)
        // Return test case - let the button handlers decide whether to close form
        return response.data.data.testCase
      }
    } catch (err: any) {
      console.error('Create test case error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else if (err.response?.status === 403) {
        setError(err.response?.data?.error?.message || 'You do not have permission to create test cases.')
      } else if (err.response?.status === 404) {
        setError('Test suite not found')
      } else if (err.response?.data?.error?.details) {
        const details = err.response.data.error.details
        const errorMessages = Array.isArray(details)
          ? details.map((d: any) => `${d.path.join('.')}: ${d.message}`).join(', ')
          : 'Invalid input data'
        setError(errorMessages)
      } else {
        setError(err.response?.data?.error?.message || 'Failed to create test case')
      }
    } finally {
      setIsSubmittingTestCase(false)
    }
  }

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

  const fetchTestSuites = async () => {
    setIsLoadingSuites(true)
    try {
      // Fetch all suites (no parentId filter to get all levels)
      const response = await api.get(`/projects/${projectId}/repositories/${repoId}/suites`, {
        params: {
          page: 1,
          limit: 1000,
          sortBy: 'order',
          sortOrder: 'asc',
        },
      })
      
      if (response.data?.data?.suites) {
        const organized = organizeSuites(response.data.data.suites)
        setTestSuites(organized)
      }
    } catch (err: any) {
      console.error('Fetch test suites error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      }
    } finally {
      setIsLoadingSuites(false)
    }
  }

  // Organize suites into a tree structure
  const organizeSuites = (suites: TestSuite[]): TestSuite[] => {
    const suiteMap = new Map<string, TestSuite & { children?: TestSuite[] }>()
    const rootSuites: (TestSuite & { children?: TestSuite[] })[] = []

    // First pass: create map of all suites
    suites.forEach(suite => {
      suiteMap.set(suite.id, { ...suite, children: [] })
    })

    // Second pass: build tree structure
    suites.forEach(suite => {
      const suiteWithChildren = suiteMap.get(suite.id)!
      if (suite.parentId) {
        const parent = suiteMap.get(suite.parentId)
        if (parent) {
          if (!parent.children) parent.children = []
          parent.children.push(suiteWithChildren)
        }
      } else {
        rootSuites.push(suiteWithChildren)
      }
    })

    // Flatten tree for display (maintaining hierarchy)
    const flattenTree = (nodes: (TestSuite & { children?: TestSuite[] })[], level: number = 0): TestSuite[] => {
      const result: TestSuite[] = []
      nodes.forEach(node => {
        const { children, ...suite } = node
        result.push({ ...suite, level } as TestSuite & { level?: number })
        if (children && children.length > 0) {
          result.push(...flattenTree(children, level + 1))
        }
      })
      return result
    }

    return flattenTree(rootSuites)
  }

  // Build tree structure for rendering
  const buildSuiteTree = (suites: TestSuite[]): (TestSuite & { children?: TestSuite[] })[] => {
    const suiteMap = new Map<string, TestSuite & { children?: TestSuite[] }>()
    const rootSuites: (TestSuite & { children?: TestSuite[] })[] = []

    // First pass: create map of all suites
    suites.forEach(suite => {
      suiteMap.set(suite.id, { ...suite, children: [] })
    })

    // Second pass: build tree structure
    suites.forEach(suite => {
      const suiteWithChildren = suiteMap.get(suite.id)!
      if (suite.parentId) {
        const parent = suiteMap.get(suite.parentId)
        if (parent) {
          if (!parent.children) parent.children = []
          parent.children.push(suiteWithChildren)
        }
      } else {
        rootSuites.push(suiteWithChildren)
      }
    })

    // Sort by order
    const sortByOrder = (nodes: (TestSuite & { children?: TestSuite[] })[]): (TestSuite & { children?: TestSuite[] })[] => {
      return nodes.sort((a, b) => (a.order || 0) - (b.order || 0)).map(node => ({
        ...node,
        children: node.children ? sortByOrder(node.children) : undefined
      }))
    }

    return sortByOrder(rootSuites)
  }

  const toggleSuiteExpansion = (suiteId: string) => {
    setExpandedSuites(prev => {
      const newSet = new Set(prev)
      if (newSet.has(suiteId)) {
        newSet.delete(suiteId)
      } else {
        newSet.add(suiteId)
      }
      return newSet
    })
  }


  const fetchTestCases = async () => {
    if (!selectedSuite) return

    setIsLoadingTestCases(true)
    try {
      const response = await api.get(
        `/projects/${projectId}/repositories/${repoId}/suites/${selectedSuite}/test-cases`,
        {
          params: {
            page: 1,
            limit: 100,
            sortBy: 'order',
            sortOrder: 'asc',
          },
        }
      )

      if (response.data?.data?.testCases) {
        setTestCases(response.data.data.testCases)
      }
    } catch (err: any) {
      console.error('Fetch test cases error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      }
    } finally {
      setIsLoadingTestCases(false)
    }
  }

  const fetchTestCaseDetail = async () => {
    if (!selectedTestCase || !selectedSuite) return

    setIsLoadingTestCaseDetail(true)
    try {
      const response = await api.get(
        `/projects/${projectId}/repositories/${repoId}/suites/${selectedSuite}/test-cases/${selectedTestCase}`
      )

      if (response.data?.data?.testCase) {
        setTestCaseDetail(response.data.data.testCase)
      }
    } catch (err: any) {
      console.error('Fetch test case detail error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      }
    } finally {
      setIsLoadingTestCaseDetail(false)
    }
  }

  const openTestCaseModal = async (testCaseId: string, suiteId?: string) => {
    setIsLoadingModalTestCase(true)
    setIsModalOpen(true)
    try {
      // If suiteId is not provided, we need to find which suite this test case belongs to
      let targetSuiteId = suiteId
      if (!targetSuiteId) {
        // Search through all suites to find the test case
        for (const suite of testSuites) {
          try {
            const response = await api.get(
              `/projects/${projectId}/repositories/${repoId}/suites/${suite.id}/test-cases/${testCaseId}`
            )
            if (response.data?.data?.testCase) {
              targetSuiteId = suite.id
              setModalTestCaseData(response.data.data.testCase)
              setIsLoadingModalTestCase(false)
              return
            }
          } catch {
            // Continue searching
          }
        }
        // If not found in any suite, try fetching all test cases from all suites
        const allSuitesResponse = await api.get(
          `/projects/${projectId}/repositories/${repoId}/suites`
        )
        if (allSuitesResponse.data?.data?.suites) {
          for (const suite of allSuitesResponse.data.data.suites) {
            try {
              const response = await api.get(
                `/projects/${projectId}/repositories/${repoId}/suites/${suite.id}/test-cases/${testCaseId}`
              )
              if (response.data?.data?.testCase) {
                targetSuiteId = suite.id
                setModalTestCaseData(response.data.data.testCase)
                setIsLoadingModalTestCase(false)
                return
              }
            } catch {
              // Continue searching
            }
          }
        }
        throw new Error('Test case not found')
      } else {
        const response = await api.get(
          `/projects/${projectId}/repositories/${repoId}/suites/${targetSuiteId}/test-cases/${testCaseId}`
        )
        if (response.data?.data?.testCase) {
          setModalTestCaseData(response.data.data.testCase)
        }
      }
    } catch (err: any) {
      console.error('Fetch modal test case error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else {
        setError('Failed to load test case details')
      }
    } finally {
      setIsLoadingModalTestCase(false)
    }
  }

  const closeTestCaseModal = () => {
    setIsModalOpen(false)
    setModalTestCaseData(null)
  }

  // Calculate similarity between two strings (Levenshtein distance normalized)
  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase().trim()
    const s2 = str2.toLowerCase().trim()
    
    if (s1 === s2) return 100
    
    // Exact match after normalization
    if (s1.replace(/\s+/g, ' ') === s2.replace(/\s+/g, ' ')) return 95
    
    // Check if one contains the other
    if (s1.includes(s2) || s2.includes(s1)) {
      const longer = s1.length > s2.length ? s1 : s2
      const shorter = s1.length > s2.length ? s2 : s1
      return (shorter.length / longer.length) * 90
    }
    
    // Levenshtein distance
    const matrix: number[][] = []
    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j
    }
    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    const distance = matrix[s2.length][s1.length]
    const maxLength = Math.max(s1.length, s2.length)
    return maxLength === 0 ? 100 : ((maxLength - distance) / maxLength) * 100
  }

  // Find duplicate test cases
  const handleFindDuplicates = async () => {
    setIsFindingDuplicates(true)
    setError(null)
    setDuplicateGroups([])
    setSelectedDuplicatePair(null)
    
    try {
      // Fetch all suites
      const suitesResponse = await api.get(
        `/projects/${projectId}/repositories/${repoId}/suites`
      )
      const suites = suitesResponse.data?.data?.suites || []
      
      // Fetch all test cases from all suites
      const allTestCases: TestCaseDetail[] = []
      for (const suite of suites) {
        try {
          const testCasesResponse = await api.get(
            `/projects/${projectId}/repositories/${repoId}/suites/${suite.id}/test-cases`,
            { params: { limit: 9999, includeDeleted: false } }
          )
          if (testCasesResponse.data?.data?.testCases) {
            const testCases = testCasesResponse.data.data.testCases
            // Fetch full details for each test case
            for (const tc of testCases) {
              try {
                const detailResponse = await api.get(
                  `/projects/${projectId}/repositories/${repoId}/suites/${suite.id}/test-cases/${tc.id}`
                )
                if (detailResponse.data?.data?.testCase) {
                  allTestCases.push({
                    ...detailResponse.data.data.testCase,
                    suite: { id: suite.id, title: suite.title }
                  })
                }
              } catch (err) {
                // If detail fetch fails, use basic info
                allTestCases.push({
                  ...tc,
                  data: null,
                  order: null,
                  defectStage: null,
                  version: 1,
                  suite: { id: suite.id, title: suite.title },
                  createdBy: null,
                  updatedBy: null,
                  counts: { comments: 0, testPlans: 0, testRuns: 0 }
                })
              }
            }
          }
        } catch (err) {
          console.error(`Error fetching test cases for suite ${suite.id}:`, err)
        }
      }
      
      // Find duplicates by comparing titles
      const duplicateGroupsFound: Array<{ testCases: TestCaseDetail[], similarity: number }> = []
      const processed = new Set<string>()
      
      for (let i = 0; i < allTestCases.length; i++) {
        if (processed.has(allTestCases[i].id)) continue
        
        const current = allTestCases[i]
        const similar: TestCaseDetail[] = [current]
        
        for (let j = i + 1; j < allTestCases.length; j++) {
          if (processed.has(allTestCases[j].id)) continue
          
          const similarity = calculateSimilarity(current.title, allTestCases[j].title)
          if (similarity >= 80) { // 80% similarity threshold
            similar.push(allTestCases[j])
            processed.add(allTestCases[j].id)
          }
        }
        
        if (similar.length > 1) {
          processed.add(current.id)
          // Calculate average similarity for the group
          let totalSimilarity = 0
          let comparisons = 0
          for (let a = 0; a < similar.length; a++) {
            for (let b = a + 1; b < similar.length; b++) {
              totalSimilarity += calculateSimilarity(similar[a].title, similar[b].title)
              comparisons++
            }
          }
          const avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 100
          duplicateGroupsFound.push({ testCases: similar, similarity: avgSimilarity })
        }
      }
      
      setDuplicateGroups(duplicateGroupsFound)
      
      if (duplicateGroupsFound.length === 0) {
        setShowNoDuplicatesModal(true)
      } else {
        setShowFindDuplicatesModal(true)
      }
    } catch (err: any) {
      console.error('Find duplicates error:', err)
      setError(err.response?.data?.error?.message || 'Failed to find duplicates')
    } finally {
      setIsFindingDuplicates(false)
    }
  }

  // Get field differences between two test cases
  const getFieldDifferences = (left: TestCaseDetail, right: TestCaseDetail) => {
    const differences: Array<{ field: string, left: any, right: any }> = []
    
    const compareField = (field: string, leftVal: any, rightVal: any) => {
      const leftStr = leftVal?.toString() || ''
      const rightStr = rightVal?.toString() || ''
      if (leftStr.trim() !== rightStr.trim()) {
        differences.push({ field, left: leftVal, right: rightVal })
      }
    }
    
    compareField('title', left.title, right.title)
    compareField('description', left.description, right.description)
    compareField('automated', left.automated, right.automated)
    compareField('priority', left.priority, right.priority)
    compareField('severity', left.severity, right.severity)
    compareField('labels', left.labels, right.labels)
    compareField('regression', left.regression, right.regression)
    compareField('epicLink', left.epicLink, right.epicLink)
    compareField('linkedIssue', left.linkedIssue, right.linkedIssue)
    compareField('platform', left.platform, right.platform)
    compareField('releaseVersion', left.releaseVersion, right.releaseVersion)
    compareField('suite', left.suite?.title, right.suite?.title)
    
    return differences
  }

  // Merge duplicate test cases
  const handleMergeDuplicates = async (keepId: string, mergeId: string) => {
    if (!selectedDuplicatePair) return
    
    setIsMergingDuplicates(true)
    setError(null)
    
    try {
      // Get the test case to keep and the one to merge
      const keep = selectedDuplicatePair.left.id === keepId ? selectedDuplicatePair.left : selectedDuplicatePair.right
      const merge = selectedDuplicatePair.left.id === keepId ? selectedDuplicatePair.right : selectedDuplicatePair.left
      
      // Update the kept test case with the best values from both
      const updateData: any = {
        title: keep.title, // Keep the original title
        description: merge.description && !keep.description ? merge.description : keep.description,
        automated: keep.automated || merge.automated, // If either is automated, keep it
        priority: Math.max(keep.priority, merge.priority), // Keep higher priority
        severity: keep.severity || merge.severity,
        labels: keep.labels || merge.labels,
        regression: keep.regression || merge.regression,
        epicLink: keep.epicLink || merge.epicLink,
        linkedIssue: keep.linkedIssue || merge.linkedIssue,
        platform: keep.platform || merge.platform,
        releaseVersion: keep.releaseVersion || merge.releaseVersion,
      }
      
      // Update the kept test case
      await api.patch(
        `/projects/${projectId}/repositories/${repoId}/suites/${keep.suite?.id || selectedSuite}/test-cases/${keep.id}`,
        updateData
      )
      
      // Delete the merged test case
      await api.delete(
        `/projects/${projectId}/repositories/${repoId}/suites/${merge.suite?.id || selectedSuite}/test-cases/${merge.id}`
      )
      
      // Refresh data
      await fetchTestCases()
      await fetchTestSuites()
      
      // Remove from duplicate groups
      setDuplicateGroups(prev => prev.map(group => ({
        ...group,
        testCases: group.testCases.filter(tc => tc.id !== merge.id)
      })).filter(group => group.testCases.length > 1))
      
      setSelectedDuplicatePair(null)
      setError(null)
    } catch (err: any) {
      console.error('Merge duplicates error:', err)
      setError(err.response?.data?.error?.message || 'Failed to merge test cases')
    } finally {
      setIsMergingDuplicates(false)
    }
  }

  // Merge all duplicates - keep newest, delete oldest
  const handleMergeAllDuplicates = async () => {
    if (duplicateGroups.length === 0) return
    
    setShowMergeAllConfirmModal(false)
    setIsMergingAll(true)
    setError(null)
    
    const totalGroups = duplicateGroups.length
    let processedGroups = 0
    let successCount = 0
    let failedCount = 0
    const errors: string[] = []
    
    try {
      // Process each duplicate group
      for (const group of duplicateGroups) {
        if (group.testCases.length < 2) continue
        
        try {
          // Sort by createdAt - newest first (keep the newest)
          const sorted = [...group.testCases].sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime()
            const dateB = new Date(b.createdAt).getTime()
            return dateB - dateA // Descending (newest first)
          })
          
          const keep = sorted[0] // Newest test case
          const toMerge = sorted.slice(1) // All older test cases
          
          // Merge data from all older test cases into the newest
          const mergedData: any = {
            title: keep.title, // Keep original title
            description: keep.description,
            automated: keep.automated,
            priority: keep.priority,
            severity: keep.severity,
            labels: keep.labels,
            regression: keep.regression,
            epicLink: keep.epicLink,
            linkedIssue: keep.linkedIssue,
            platform: keep.platform,
            releaseVersion: keep.releaseVersion,
          }
          
          // Merge fields from older test cases (use non-empty values)
          for (const oldTc of toMerge) {
            if (!mergedData.description && oldTc.description) {
              mergedData.description = oldTc.description
            }
            if (!mergedData.automated && oldTc.automated) {
              mergedData.automated = oldTc.automated
            }
            if (oldTc.priority > mergedData.priority) {
              mergedData.priority = oldTc.priority // Keep higher priority
            }
            if (!mergedData.severity && oldTc.severity) {
              mergedData.severity = oldTc.severity
            }
            if (!mergedData.labels && oldTc.labels) {
              mergedData.labels = oldTc.labels
            }
            if (!mergedData.regression && oldTc.regression) {
              mergedData.regression = oldTc.regression
            }
            if (!mergedData.epicLink && oldTc.epicLink) {
              mergedData.epicLink = oldTc.epicLink
            }
            if (!mergedData.linkedIssue && oldTc.linkedIssue) {
              mergedData.linkedIssue = oldTc.linkedIssue
            }
            if (!mergedData.platform && oldTc.platform) {
              mergedData.platform = oldTc.platform
            }
            if (!mergedData.releaseVersion && oldTc.releaseVersion) {
              mergedData.releaseVersion = oldTc.releaseVersion
            }
          }
          
          // Update the kept test case
          await api.patch(
            `/projects/${projectId}/repositories/${repoId}/suites/${keep.suite?.id || selectedSuite}/test-cases/${keep.id}`,
            mergedData
          )
          
          // Delete all older test cases
          for (const oldTc of toMerge) {
            try {
              await api.delete(
                `/projects/${projectId}/repositories/${repoId}/suites/${oldTc.suite?.id || selectedSuite}/test-cases/${oldTc.id}`
              )
            } catch (err: any) {
              console.error(`Error deleting test case ${oldTc.id}:`, err)
              errors.push(`Failed to delete ${oldTc.jiraKey || oldTc.id}: ${err.response?.data?.error?.message || 'Unknown error'}`)
              failedCount++
            }
          }
          
          successCount++
        } catch (err: any) {
          console.error(`Error merging group:`, err)
          const groupTitle = group.testCases[0]?.title || 'Unknown'
          errors.push(`Failed to merge group "${groupTitle}": ${err.response?.data?.error?.message || 'Unknown error'}`)
          failedCount++
        }
        
        processedGroups++
        setMergeAllProgress({ current: processedGroups, total: totalGroups })
      }
      
      // Refresh data
      await fetchTestCases()
      await fetchTestSuites()
      
      // Clear duplicate groups
      setDuplicateGroups([])
      setSelectedDuplicatePair(null)
      
      // Show results
      if (failedCount === 0) {
        setError(null)
        // Success message could be shown here
      } else {
        setError(`Merged ${successCount} group${successCount !== 1 ? 's' : ''} successfully. Failed to merge ${failedCount} group${failedCount !== 1 ? 's' : ''}. ${errors.slice(0, 3).join('; ')}`)
      }
      
      // Close modal after a short delay if successful
      if (failedCount === 0) {
        setTimeout(() => {
          setShowFindDuplicatesModal(false)
        }, 1000)
      }
    } catch (err: any) {
      console.error('Merge all duplicates error:', err)
      setError(err.response?.data?.error?.message || 'Failed to merge all duplicates')
    } finally {
      setIsMergingAll(false)
      setMergeAllProgress({ current: 0, total: 0 })
    }
  }

  const fetchAllLabels = async () => {
    try {
      // Fetch all test cases from all suites in this repository to get all labels
      const response = await api.get(
        `/projects/${projectId}/repositories/${repoId}/suites`
      )
      if (response.data?.data?.suites) {
        const allLabels = new Set<string>()
        // Fetch test cases from each suite to collect labels
        for (const suite of response.data.data.suites) {
          try {
            const testCasesResponse = await api.get(
              `/projects/${projectId}/repositories/${repoId}/suites/${suite.id}/test-cases`
            )
            if (testCasesResponse.data?.data?.testCases) {
              testCasesResponse.data.data.testCases.forEach((tc: TestCase) => {
                if (tc.labels) {
                  tc.labels.split(',').forEach((label: string) => {
                    const trimmed = label.trim()
                    if (trimmed) {
                      allLabels.add(trimmed)
                    }
                  })
                }
              })
            }
          } catch (err) {
            // Skip if suite has no test cases or error
            console.error(`Error fetching test cases for suite ${suite.id}:`, err)
          }
        }
        setAvailableLabels(Array.from(allLabels).sort())
      }
    } catch (err: any) {
      console.error('Fetch labels error:', err)
    }
  }

  const fetchAllTestCases = async () => {
    setIsLoadingAllTestCases(true)
    try {
      // Fetch all suites first
      const suitesResponse = await api.get(
        `/projects/${projectId}/repositories/${repoId}/suites`
      )
      
      if (suitesResponse.data?.data?.suites) {
        const allCases: (TestCase & { suiteId: string })[] = []
        
        // Fetch test cases from each suite
        for (const suite of suitesResponse.data.data.suites) {
          try {
            const testCasesResponse = await api.get(
              `/projects/${projectId}/repositories/${repoId}/suites/${suite.id}/test-cases`
            )
            if (testCasesResponse.data?.data?.testCases) {
              // Add suiteId to each test case
              const testCasesWithSuite = testCasesResponse.data.data.testCases.map((tc: TestCase) => ({
                ...tc,
                suiteId: suite.id,
              }))
              allCases.push(...testCasesWithSuite)
            }
          } catch (err) {
            console.error(`Error fetching test cases for suite ${suite.id}:`, err)
          }
        }
        
        setAllTestCases(allCases as any)
      }
    } catch (err: any) {
      console.error('Fetch all test cases error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      }
    } finally {
      setIsLoadingAllTestCases(false)
    }
  }

  const handleOpenTestCaseSelection = () => {
    setShowTestCaseSelectionModal(true)
    setSelectedTestCaseIds(new Set())
    setTestCaseSearchQuery('')
    fetchAllTestCases()
  }

  const handleCloseTestCaseSelection = () => {
    setShowTestCaseSelectionModal(false)
    setSelectedTestCaseIds(new Set())
    setTestCaseSearchQuery('')
  }

  const handleToggleTestCaseSelection = (testCaseId: string) => {
    setSelectedTestCaseIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(testCaseId)) {
        newSet.delete(testCaseId)
      } else {
        newSet.add(testCaseId)
      }
      return newSet
    })
  }

  const handleSubmitTestCaseSelection = () => {
    if (selectedTestCaseIds.size === 0) {
      setError('Please select at least one test case.')
      return
    }
    
    // Get selected test cases with their suite information
    const selectedCases = allTestCases.filter((tc: any) => selectedTestCaseIds.has(tc.id))
    
    // Get repository prefix for formatting test case IDs
    const prefix = repository?.prefix || 'TC'
    
    // Format preconditions as HTML with links in numbered list format
    const preconditionsHTML = `<ol>${selectedCases
      .map((tc: any) => {
        const id = tc.jiraKey || `${prefix}-${tc.id}`
        const suiteId = tc.suiteId || ''
        return `<li><a href="/projects/${projectId}/repository/${repoId}?suite=${suiteId}&testCase=${tc.id}" class="text-primary-600 hover:text-primary-700 hover:underline test-case-link" data-test-case-id="${tc.id}" data-suite-id="${suiteId}"><b>${id}</b>: ${tc.title}</a></li>`
      })
      .join('')}</ol>`
    
    setTestCaseFormData({
      ...testCaseFormData,
      preconditions: preconditionsHTML,
      preconditionsMode: 'from_other',
    })
    
    handleCloseTestCaseSelection()
  }

  const filteredTestCases = allTestCases.filter((tc: TestCase) => {
    if (!testCaseSearchQuery.trim()) return true
    const query = testCaseSearchQuery.toLowerCase()
    const prefix = repository?.prefix || 'TC'
    const id = (tc.jiraKey || `${prefix}-${tc.id}`).toLowerCase()
    const title = tc.title.toLowerCase()
    return id.includes(query) || title.includes(query)
  })

  const handleCreateSuite = async () => {
    if (!newSuiteName.trim()) return

    setIsCreatingSuite(true)
    try {
      await api.post(`/projects/${projectId}/repositories/${repoId}/suites`, {
        title: newSuiteName.trim(),
        parentId: null,
      })
      
      setShowCreateSuiteModal(false)
      setNewSuiteName('')
      await fetchTestSuites()
    } catch (err: any) {
      console.error('Create suite error:', err)
      setError(err.response?.data?.error?.message || 'Failed to create test suite')
    } finally {
      setIsCreatingSuite(false)
    }
  }

  // Handle create suite from upload modal
  const handleCreateSuiteInUpload = async () => {
    if (!newSuiteNameInUpload.trim()) return

    setIsCreatingSuiteInUpload(true)
    setError(null)
    try {
      const createResponse = await api.post(
        `/projects/${projectId}/repositories/${repoId}/suites`,
        {
          title: newSuiteNameInUpload.trim(),
          parentId: null,
        }
      )
      
      if (createResponse.data?.data?.suite) {
        await fetchTestSuites()
        setShowCreateSuiteInUploadModal(false)
        setNewSuiteNameInUpload('')
        // Automatically import to the newly created suite
        handleBulkImport(createResponse.data.data.suite.id)
      }
    } catch (err: any) {
      console.error('Create suite error:', err)
      setError(err.response?.data?.error?.message || 'Failed to create test suite')
    } finally {
      setIsCreatingSuiteInUpload(false)
    }
  }

  const handleDeleteSuite = async (suiteId: string) => {
    if (!confirm('Are you sure you want to delete this test suite?')) return

    try {
      await api.delete(`/projects/${projectId}/repositories/${repoId}/suites/${suiteId}`)
      await fetchTestSuites()
      if (selectedSuite === suiteId) {
        setSelectedSuite(null)
        window.history.replaceState({}, '', `/projects/${projectId}/repository/${repoId}`)
      }
    } catch (err: any) {
      console.error('Delete suite error:', err)
      setError(err.response?.data?.error?.message || 'Failed to delete test suite')
    }
  }

  const handleEditSuite = (suite: TestSuite) => {
    setEditingSuite(suite)
    setNewSuiteName(suite.title)
    setShowEditSuiteModal(true)
  }

  const handleUpdateSuite = async () => {
    if (!editingSuite || !newSuiteName.trim()) return

    setIsUpdatingSuite(true)
    setError(null)
    try {
      await api.patch(`/projects/${projectId}/repositories/${repoId}/suites/${editingSuite.id}`, {
        title: newSuiteName.trim(),
      })
      
      setShowEditSuiteModal(false)
      setEditingSuite(null)
      setNewSuiteName('')
      await fetchTestSuites()
    } catch (err: any) {
      console.error('Update suite error:', err)
      setError(err.response?.data?.error?.message || 'Failed to update test suite')
    } finally {
      setIsUpdatingSuite(false)
    }
  }

  const handleDragStart = (e: React.DragEvent, suiteId: string) => {
    e.stopPropagation()
    setDraggedSuite(suiteId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', suiteId)
    // Use a drag image for better performance
    const dragImage = document.createElement('div')
    dragImage.style.position = 'absolute'
    dragImage.style.top = '-1000px'
    dragImage.textContent = testSuites.find(s => s.id === suiteId)?.title || ''
    document.body.appendChild(dragImage)
    e.dataTransfer.setDragImage(dragImage, 0, 0)
    setTimeout(() => document.body.removeChild(dragImage), 0)
  }

  const handleDragEnd = (e: React.DragEvent) => {
    e.stopPropagation()
    if (dragOverTimeoutRef.current) {
      clearTimeout(dragOverTimeoutRef.current)
      dragOverTimeoutRef.current = null
    }
    setDraggedSuite(null)
    setDragOverSuite(null)
    setDragDropType(null)
  }

  const handleDragOver = (e: React.DragEvent, suiteId: string) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    
    if (!draggedSuite || draggedSuite === suiteId) {
      if (dragOverTimeoutRef.current) {
        clearTimeout(dragOverTimeoutRef.current)
      }
      dragOverTimeoutRef.current = setTimeout(() => {
        setDragOverSuite(null)
        setDragDropType(null)
      }, 50)
      return
    }

    const dragged = testSuites.find(s => s.id === draggedSuite)
    const target = testSuites.find(s => s.id === suiteId)
    
    if (!dragged || !target) return

    // Prevent making a suite a child of itself or its descendants
    const isDescendant = (parentId: string, childId: string): boolean => {
      const child = testSuites.find(s => s.id === childId)
      if (!child || !child.parentId) return false
      if (child.parentId === parentId) return true
      return isDescendant(parentId, child.parentId)
    }

    if (isDescendant(draggedSuite, suiteId)) {
      if (dragOverTimeoutRef.current) {
        clearTimeout(dragOverTimeoutRef.current)
      }
      dragOverTimeoutRef.current = setTimeout(() => {
        setDragOverSuite(null)
        setDragDropType(null)
      }, 50)
      return
    }

    // Clear any pending timeout
    if (dragOverTimeoutRef.current) {
      clearTimeout(dragOverTimeoutRef.current)
    }

    setDragOverSuite(suiteId)

    // Determine drop type based on mouse position within the element
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mouseY = e.clientY - rect.top
    const elementHeight = rect.height
    const topHalf = elementHeight / 2
    const topThird = elementHeight / 3

    // Top third = sibling above (insert before target)
    // Between top third and middle = sibling below (insert after target) or parent (move to parent's level)
    // Bottom half = child (make dragged suite a child of target) - larger zone for easier child drops
    if (mouseY < topThird) {
      setDragDropType('sibling-above')
    } else if (mouseY < topHalf) {
      // Check if dragged suite is a child of target - if so, this could be "parent" (move up one level)
      const dragged = testSuites.find(s => s.id === draggedSuite)
      if (dragged && dragged.parentId === suiteId) {
        setDragDropType('parent')
      } else {
        setDragDropType('sibling-below')
      }
    } else {
      // Bottom half = child (make dragged suite a child of target)
      // Can make child of any suite (not just root)
      setDragDropType('child')
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're actually leaving the element (not just moving to a child)
    const relatedTarget = e.relatedTarget as HTMLElement
    const currentTarget = e.currentTarget as HTMLElement
    
    if (!currentTarget.contains(relatedTarget)) {
      if (dragOverTimeoutRef.current) {
        clearTimeout(dragOverTimeoutRef.current)
      }
      dragOverTimeoutRef.current = setTimeout(() => {
        setDragOverSuite(null)
        setDragDropType(null)
      }, 100)
    }
  }

  const handleDrop = async (e: React.DragEvent, targetSuiteId: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (dragOverTimeoutRef.current) {
      clearTimeout(dragOverTimeoutRef.current)
      dragOverTimeoutRef.current = null
    }

    if (!draggedSuite || draggedSuite === targetSuiteId || !dragDropType) {
      setDragOverSuite(null)
      setDragDropType(null)
      setDraggedSuite(null)
      return
    }

    const dragged = testSuites.find(s => s.id === draggedSuite)
    const target = testSuites.find(s => s.id === targetSuiteId)

    if (!dragged || !target) {
      setDragOverSuite(null)
      setDragDropType(null)
      setDraggedSuite(null)
      return
    }

    // Prevent circular reference
    const isDescendant = (parentId: string, childId: string): boolean => {
      const child = testSuites.find(s => s.id === childId)
      if (!child || !child.parentId) return false
      if (child.parentId === parentId) return true
      return isDescendant(parentId, child.parentId)
    }

    if (isDescendant(draggedSuite, targetSuiteId)) {
      setError('Cannot move suite into its own descendant')
      setDragOverSuite(null)
      setDragDropType(null)
      setDraggedSuite(null)
      return
    }

    setIsReordering(true)
    setDragOverSuite(null)
    setDragDropType(null)

    try {
      let newParentId: string | null = null
      let newOrder: number | null = null

      if (dragDropType === 'child') {
        // Make dragged suite a child of target suite
        newParentId = targetSuiteId
        // Get existing children of target (excluding the dragged suite)
        const children = testSuites.filter(s => s.parentId === targetSuiteId && s.id !== draggedSuite)
        // Set order to be after the last child, or 1 if no children
        newOrder = children.length > 0 
          ? (Math.max(...children.map(c => c.order || 0)) + 1) 
          : 1
      } else if (dragDropType === 'sibling-above') {
        // Make dragged suite a sibling before target (same parent as target)
        newParentId = target.parentId
        // Get siblings at the same level (excluding dragged suite)
        const siblings = testSuites.filter(
          s => s.parentId === target.parentId && s.id !== draggedSuite && s.id !== targetSuiteId
        )
        // Place it at the target's order, shift target and subsequent siblings down
        newOrder = target.order || 0
        // Update orders of target and subsequent siblings
        const siblingsToShift = siblings.filter(s => (s.order || 0) >= newOrder!)
        siblingsToShift.push(target) // Include target in the shift
        if (siblingsToShift.length > 0) {
          await Promise.all(
            siblingsToShift.map(s => 
              api.patch(
                `/projects/${projectId}/repositories/${repoId}/suites/${s.id}`,
                { order: (s.order || 0) + 1 }
              )
            )
          )
        }
      } else if (dragDropType === 'sibling-below') {
        // Make dragged suite a sibling after target (same parent as target)
        newParentId = target.parentId
        // Get siblings at the same level (excluding dragged suite)
        const siblings = testSuites.filter(
          s => s.parentId === target.parentId && s.id !== draggedSuite && s.id !== targetSuiteId
        )
        // Place it right after the target
        newOrder = (target.order || 0) + 1
        // Update orders of subsequent siblings
        const subsequentSiblings = siblings.filter(s => (s.order || 0) >= newOrder!)
        if (subsequentSiblings.length > 0) {
          await Promise.all(
            subsequentSiblings.map(s => 
              api.patch(
                `/projects/${projectId}/repositories/${repoId}/suites/${s.id}`,
                { order: (s.order || 0) + 1 }
              )
            )
          )
        }
      } else if (dragDropType === 'parent') {
        // Move dragged suite to parent's level (become sibling of target's parent)
        // This means moving the dragged suite (which is a child of target) up one level
        newParentId = target.parentId
        // Get siblings at the parent's level (excluding dragged suite)
        const siblings = testSuites.filter(
          s => s.parentId === target.parentId && s.id !== draggedSuite && s.id !== targetSuiteId
        )
        // Place it right after the target
        newOrder = (target.order || 0) + 1
        // Update orders of subsequent siblings
        const subsequentSiblings = siblings.filter(s => (s.order || 0) >= newOrder!)
        if (subsequentSiblings.length > 0) {
          await Promise.all(
            subsequentSiblings.map(s => 
              api.patch(
                `/projects/${projectId}/repositories/${repoId}/suites/${s.id}`,
                { order: (s.order || 0) + 1 }
              )
            )
          )
        }
      } else if (dragDropType === 'root') {
        // Root level
        newParentId = null
        const rootSuites = testSuites.filter(s => !s.parentId && s.id !== draggedSuite)
        newOrder = rootSuites.length > 0 
          ? (Math.max(...rootSuites.map(s => s.order || 0)) + 1) 
          : 1
      }

      // Update the dragged suite
      await api.patch(
        `/projects/${projectId}/repositories/${repoId}/suites/${draggedSuite}`,
        {
          parentId: newParentId,
          order: newOrder,
        }
      )

      // Refresh to get latest data
      await fetchTestSuites()
    } catch (err: any) {
      console.error('Move suite error:', err)
      setError(err.response?.data?.error?.message || 'Failed to move test suite')
      // Revert on error
      await fetchTestSuites()
    } finally {
      setIsReordering(false)
      setDraggedSuite(null)
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
      <main className="max-w-full mx-auto">
        {/* Header Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  {repository.title}
                </h1>
                <p className="text-sm text-gray-500">
                  Repository
                  {testSuites.length > 0 && (
                    <span className="ml-2 text-gray-700 font-medium">
                      • {testSuites.reduce((sum, suite) => sum + (suite.counts.testCases || 0), 0)} test case{testSuites.reduce((sum, suite) => sum + (suite.counts.testCases || 0), 0) !== 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              </div>
              {selectedSuite && (
                <div className="flex items-center gap-3 pl-6 border-l border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Suite:</span>
                    <span className="text-sm font-semibold text-gray-900 px-3 py-1 bg-primary-50 text-primary-700 rounded-lg">
                      {testSuites.find(s => s.id === selectedSuite)?.title || 'Select Test Suite'}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedSuite(null)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Clear selection"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              {!selectedSuite && (
                <div className="flex items-center gap-2 pl-6 border-l border-gray-200">
                  <span className="text-sm text-gray-500">Select a test suite to get started</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/projects/${projectId}?tab=squads`}
                className="flex items-center gap-1.5 px-3 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
              </Link>
              <button
                onClick={() => setShowCreateSuiteModal(true)}
                className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Suite
              </button>
              <button
                onClick={handleCreateTestCase}
                className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Case
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <button
                onClick={handleDownloadCSVTemplate}
                className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-1.5"
                title="Download CSV Template"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">Template</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium flex items-center gap-1.5"
                title="Upload Test Cases"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="hidden sm:inline">Upload</span>
              </button>
              <button
                onClick={handleFindDuplicates}
                disabled={isFindingDuplicates}
                className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Find Duplicate Test Cases"
              >
                {isFindingDuplicates ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span className="hidden sm:inline">Finding...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                    </svg>
                    <span className="hidden sm:inline">Duplicates</span>
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Link
                href={`/projects/${projectId}/repository/${repoId}/edit`}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Settings"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="w-full h-[calc(100vh-140px)]">
          <div className="flex h-full">
            {/* Left Sidebar - Test Suites List - col-3 equivalent */}
            <div id="suites_tree_col" className="w-1/4 bg-white border-r border-gray-200 overflow-y-auto shadow-sm flex-shrink-0">
            {/* Tree List */}
            {isLoadingSuites ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
              </div>
            ) : testSuites.length === 0 ? (
              <div className="text-center py-8 px-4">
                <p className="text-sm text-gray-500 mb-4">No test suites yet</p>
                <button
                  onClick={() => setShowCreateSuiteModal(true)}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Create your first test suite
                </button>
              </div>
            ) : (
              <ul id="tree" className="list-none p-0 m-0">
                {/* Root Level Drop Zone */}
                {draggedSuite && (
                  <li
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      e.dataTransfer.dropEffect = 'move'
                      setDragOverSuite(null)
                      setDragDropType('root')
                    }}
                    onDragLeave={(e) => {
                      const relatedTarget = e.relatedTarget as HTMLElement
                      const currentTarget = e.currentTarget as HTMLElement
                      if (!currentTarget.contains(relatedTarget)) {
                        setDragDropType(null)
                      }
                    }}
                    onDrop={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (!draggedSuite) return

                      const dragged = testSuites.find(s => s.id === draggedSuite)
                      if (!dragged) return

                      setIsReordering(true)
                      setDragDropType(null)
                      try {
                        const rootSuites = testSuites.filter(s => !s.parentId && s.id !== draggedSuite)
                        const newOrder = rootSuites.length > 0 
                          ? (Math.max(...rootSuites.map(s => s.order || 0)) + 1) 
                          : 1

                        await api.patch(
                          `/projects/${projectId}/repositories/${repoId}/suites/${draggedSuite}`,
                          {
                            parentId: null,
                            order: newOrder,
                          }
                        )

                        await fetchTestSuites()
                      } catch (err: any) {
                        console.error('Move to root error:', err)
                        setError(err.response?.data?.error?.message || 'Failed to move test suite to root')
                        await fetchTestSuites()
                      } finally {
                        setIsReordering(false)
                        setDraggedSuite(null)
                      }
                    }}
                    className={`h-3 rounded transition-colors mb-2 mx-2 ${
                      dragDropType === 'root' ? 'bg-blue-400 border-2 border-blue-500' : 'bg-transparent border-2 border-dashed border-transparent'
                    }`}
                  >
                    {dragDropType === 'root' && (
                      <div className="text-xs text-blue-700 text-center py-0.5 font-medium">
                        Drop here to move to root
                      </div>
                    )}
                  </li>
                )}
                {(() => {
                  const suiteTree = buildSuiteTree(testSuites)
                  const renderSuiteTree = (suites: (TestSuite & { children?: TestSuite[] })[], level: number = 1): JSX.Element[] => {
                    return suites.map((suite) => {
                      const hasChildren = suite.children && suite.children.length > 0
                      const isExpanded = expandedSuites.has(suite.id)
                      const isSelected = selectedSuite === suite.id
                      
                      const isDragOver = dragOverSuite === suite.id
                      const isDragged = draggedSuite === suite.id
                      
                      return (
                        <li
                          key={suite.id}
                          className={`tree-branch branch-level-${level} ${isDragOver && !isDragged ? 'drag-over' : ''} relative`}
                          data-level={level}
                          data-mid={suite.id}
                          data-pid={suite.parentId || 'null'}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (!isDragged) {
                              handleDragOver(e, suite.id)
                            }
                          }}
                          onDragLeave={(e) => {
                            if (!isDragged) {
                              handleDragLeave(e)
                            }
                          }}
                          onDrop={(e) => {
                            if (!isDragged) {
                              handleDrop(e, suite.id)
                            }
                          }}
                        >
                          {/* Drop zone indicator - sibling above */}
                          {isDragOver && dragDropType === 'sibling-above' && (
                            <div className="drop-zone-indicator drop-zone-sibling-above absolute top-0 left-0 right-0 h-1 bg-blue-500 z-20 shadow-lg">
                              <div className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap font-medium">
                                Drop as sibling above
                              </div>
                            </div>
                          )}
                          {/* Drop zone indicator - sibling below or parent */}
                          {isDragOver && (dragDropType === 'sibling-below' || dragDropType === 'parent') && (
                            <div className="drop-zone-indicator drop-zone-sibling-below absolute bottom-0 left-0 right-0 h-1 bg-green-500 z-20 shadow-lg">
                              <div className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-green-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap font-medium">
                                {dragDropType === 'parent' ? 'Drop to move up one level' : 'Drop as sibling below'}
                              </div>
                            </div>
                          )}
                          {/* Drop zone indicator - child */}
                          {isDragOver && dragDropType === 'child' && (
                            <>
                              <div className="drop-zone-indicator drop-zone-child absolute bottom-0 left-0 right-0 h-2 bg-purple-500 z-20 shadow-lg">
                                <div className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-purple-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap font-medium">
                                  Drop as child
                                </div>
                              </div>
                              {/* Visual indicator showing child drop area */}
                              <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-purple-100 opacity-30 pointer-events-none z-10" />
                            </>
                          )}
                          <div className="contents">
                            <div 
                              className={`branch-wrapper relative ${isSelected ? 'selected' : ''} ${isDragged ? 'opacity-50' : ''} ${isDragOver && !isDragged ? (dragDropType === 'child' ? 'bg-purple-50 border-l-4 border-purple-500 rounded-r' : dragDropType === 'sibling-above' ? 'border-t-2 border-blue-500' : dragDropType === 'sibling-below' || dragDropType === 'parent' ? 'border-b-2 border-green-500' : '') : ''}`}
                            >
                              <div 
                                className="left-sidebar flex items-center gap-2 cursor-grab active:cursor-grabbing py-2 px-2 hover:bg-gray-50 rounded select-none"
                                style={{ paddingLeft: level > 1 ? `${(level - 1) * 1.5}rem` : '0.5rem' }}
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation()
                                  handleDragStart(e, suite.id)
                                }}
                                onDragEnd={(e) => {
                                  e.stopPropagation()
                                  handleDragEnd(e)
                                }}
                                onClick={(e) => {
                                  // Only select if we're not dragging (drag didn't start)
                                  if (!draggedSuite) {
                                    setSelectedSuite(suite.id)
                                    setSelectedTestCase(null)
                                    setTestCaseDetail(null)
                                  }
                                }}
                              >
                                <div 
                                  className="branch-drag-handler text-gray-400 hover:text-gray-600 pointer-events-none"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M7 2.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zM2 1a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1-2-2V1zm11 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1zM4 7a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H4z"/>
                                  </svg>
                                </div>
                                <span 
                                  id={`suite_title_${suite.id}`}
                                  className={`branch-title text-sm flex-1 ${isSelected ? 'font-semibold text-primary-700' : 'text-gray-700'}`}
                                  title={suite.title}
                                >
                                  {suite.title}
                                  {suite.counts.testCases > 0 && (
                                    <span className="ml-2 text-xs text-gray-500 font-normal">
                                      ({suite.counts.testCases})
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div className="right-sidebar flex items-center justify-end absolute end-0 top-0 h-full pr-2">
                                {hasChildren && (
                                  <button
                                    id="toogle_collaple_expand"
                                    type="button"
                                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                    title={isExpanded ? 'Collapse' : 'Expand'}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleSuiteExpansion(suite.id)
                                    }}
                                  >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                                      <path fillRule="evenodd" d="M3.646 9.146a.5.5 0 0 1 .708 0L8 12.793l3.646-3.647a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 0-.708zm0-2.292a.5.5 0 0 0 .708 0L8 3.207l3.646 3.647a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 0 0 0 .708z"/>
                                    </svg>
                                  </button>
                                )}
                                <button
                                  id="edit_suite_btn"
                                  type="button"
                                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors edit_suite_btn"
                                  title="Edit"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEditSuite(suite)
                                  }}
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/>
                                  </svg>
                                </button>
                                <button
                                  id="delete_suite_btn"
                                  type="button"
                                  className="p-1 text-gray-400 hover:text-red-600 transition-colors remove-branch delete_suite_btn"
                                  title="Delete"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteSuite(suite.id)
                                  }}
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                    <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                          {hasChildren && isExpanded && (
                            <div className="children-bus ml-0">
                              <ul className="list-none p-0 m-0">
                                {renderSuiteTree(suite.children!, level + 1)}
                              </ul>
                            </div>
                          )}
                        </li>
                      )
                    })
                  }
                  return renderSuiteTree(suiteTree)
                })()}
              </ul>
            )}
          </div>

            {/* Middle Column - Test Cases List - col equivalent */}
            <div id="test_cases_list_col" className="flex-1 bg-white border-r border-gray-200 overflow-y-auto shadow-sm flex-shrink-0">
            {selectedSuite ? (
              <div className="h-full flex flex-col">
                {/* Header */}
                <div className="border-b border-gray-200 mt-2 pb-2 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {testCases.length > 0 && (
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={testCases.length > 0 && selectedTestCasesForDelete.size === testCases.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTestCasesForDelete(new Set(testCases.map(tc => tc.id)))
                              } else {
                                setSelectedTestCasesForDelete(new Set())
                              }
                            }}
                            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                            title="Select all"
                          />
                          <span className="text-sm text-gray-500">Select all</span>
                        </div>
                      )}
                      <div>
                        <span className="text-lg text-gray-500">Suite: </span>
                        <span id="test_cases_list_site_title" className="text-lg font-medium text-gray-900">
                          {testSuites.find(s => s.id === selectedSuite)?.title}
                        </span>
                      </div>
                    </div>
                    {selectedTestCasesForDelete.size > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">
                          {selectedTestCasesForDelete.size} selected
                        </span>
                        <button
                          onClick={() => setShowMoveTestCasesModal(true)}
                          disabled={isDeletingTestCases || isMovingTestCases}
                          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          Move ({selectedTestCasesForDelete.size})
                        </button>
                        <button
                          onClick={handleBulkDeleteTestCases}
                          disabled={isDeletingTestCases || isMovingTestCases}
                          className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          {isDeletingTestCases ? (
                            <>
                              <div className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                              Deleting...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete ({selectedTestCasesForDelete.size})
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setSelectedTestCasesForDelete(new Set())}
                          className="px-3 py-1.5 text-gray-600 text-sm rounded-lg hover:bg-gray-100 transition-colors"
                          title="Clear selection"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Test Cases List */}
                <div id="test_cases_list" className="flex-1 overflow-y-auto">
                  {isLoadingTestCases ? (
                    <div className="p-12 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"></div>
                    </div>
                  ) : testCases.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="text-gray-300 mb-4">
                        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-600 mb-4">No test cases yet</p>
                      <button
                        onClick={handleCreateTestCase}
                        className="text-sm text-primary-600 hover:text-primary-700 font-semibold transition-colors"
                      >
                        Create test case
                      </button>
                    </div>
                  ) : (
                    <div>
                      {testCases.map((testCase) => {
                        const isSelectedForDelete = selectedTestCasesForDelete.has(testCase.id)
                        return (
                          <div
                            key={testCase.id}
                            id={testCase.id}
                            className={`test_case border-b border-gray-200 flex ps-1 justify-content-between ${
                              selectedTestCase === testCase.id ? 'bg-primary-50' : ''
                            } ${isSelectedForDelete ? 'bg-red-50' : ''}`}
                            data-case_id={testCase.id}
                          >
                            <div className="flex items-center gap-2 px-2">
                              <input
                                type="checkbox"
                                checked={isSelectedForDelete}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  const newSet = new Set(selectedTestCasesForDelete)
                                  if (e.target.checked) {
                                    newSet.add(testCase.id)
                                  } else {
                                    newSet.delete(testCase.id)
                                  }
                                  setSelectedTestCasesForDelete(newSet)
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                              />
                            </div>
                            <div
                              className="d-flex justify-content-start test_case_clickable_area flex items-center gap-2 py-2 px-2 cursor-pointer hover:bg-gray-50 flex-1"
                              onClick={() => {
                                setSelectedTestCase(testCase.id)
                                setIsCreatingTestCase(false)
                                setIsEditingTestCase(false)
                              }}
                            >
                            <div className="me-1 test_case_info flex items-center gap-1">
                              <i className="bi bi-list text-blue-500"></i>
                              <span>
                                {testCase.automated ? (
                                  <i className="bi bi-robot mx-1 text-gray-600" title="Automated"></i>
                                ) : (
                                  <i className="bi bi-person mx-1 text-gray-600" title="Manual"></i>
                                )}
                              </span>
                              <u className="text-primary-600 underline">
                                <a
                                  href={`/projects/${projectId}/repository/${repoId}?suite=${selectedSuite}&testCase=${testCase.id}`}
                                  className="text-primary-600 hover:text-primary-700 cursor-pointer"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    openTestCaseModal(testCase.id, selectedSuite || undefined)
                                  }}
                                >
                                  {testCase.jiraKey || `${repository?.prefix || 'ST'}-${testCase.id}`}
                                </a>
                              </u>
                            </div>
                            <div className="test_case_title flex-1 min-w-0">
                              <span className="text-sm text-gray-700">{testCase.title}</span>
                            </div>
                          </div>
                        </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8">
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Select Test Suite</h3>
                  <p className="text-gray-600">
                    Select a test suite from the sidebar to view its test cases.
                  </p>
                </div>
              </div>
            )}
          </div>

            {/* Right Column - Test Case Detail or Create Form - col-5 equivalent but resizable */}
            {(selectedTestCase || isCreatingTestCase || isEditingTestCase) && (
              <>
                {/* Resizer Handle */}
                <div
                  onMouseDown={handleResizeStart}
                  className={`bg-gray-300 hover:bg-primary-500 cursor-col-resize transition-colors flex-shrink-0 relative group z-10 ${
                    isResizing ? 'bg-primary-600' : ''
                  }`}
                  style={{ width: '4px', minWidth: '4px' }}
                  title="Drag left to shrink, drag right to expand"
                >
                  <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-1 bg-gray-400 group-hover:bg-primary-400 transition-colors" />
                </div>
                <div 
                  id="test_case_col"
                  className="bg-white overflow-y-auto flex-shrink-0 shadow-sm"
                  style={{ width: `${rightColumnWidth}px`, minWidth: '400px', maxWidth: '1200px' }}
                >
              {(isCreatingTestCase || isEditingTestCase) ? (
                <div id="test_case_area" className="h-full flex flex-col">
                  <div id="test_case_editor" className="h-full flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-gray-200 mt-2 pb-2 mb-2 px-4 pt-2">
                      <div>
                        <span className="text-lg font-semibold text-gray-900">
                          {isEditingTestCase ? 'Edit Test Case' : 'Create Test Case'}
                        </span>
                      </div>
                      <div>
                        <button
                          onClick={() => {
                            if (isEditingTestCase) {
                              setIsEditingTestCase(false)
                              setEditingTestCaseId(null)
                              setSelectedTestCase(editingTestCaseId)
                            } else {
                              setIsCreatingTestCase(false)
                            }
                            setError(null)
                          }}
                          className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm transition-colors font-medium flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <b>Cancel</b>
                        </button>
                      </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={async (e) => {
                      e.preventDefault()
                      if (isEditingTestCase) {
                        await handleUpdateTestCase(e)
                      } else {
                        const result = await handleSubmitTestCase(e)
                        if (result) {
                          // Close form after successful creation
                          setIsCreatingTestCase(false)
                          setSelectedTestCase(result.id)
                          // Clear form
                          setTestCaseFormData({
                            title: '',
                            description: '',
                            automated: false,
                            priority: 2,
                            severity: 'Moderate',
                            labels: '',
                            regression: false,
                            epicLink: '',
                            linkedIssue: '',
                            releaseVersion: '',
                            platform: [],
                            preconditions: '',
                            preconditionsMode: 'free_text',
                            bddScenarios: '',
                            featureSuiteId: selectedSuite || '',
                          })
                          setShowLabelInput(false)
                          setLabelInputValue('')
                          setShowLabelSuggestions(false)
                        }
                      }
                    }} className="flex-1 overflow-y-auto">
                      <div id="test_case_content" className="p-1 pt-0">
                        {error && (
                          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                            {error}
                          </div>
                        )}

                        {/* Top Section: Feature, Priority, Test Type, Regression */}
                        <div className="mb-3 flex justify-start border border-gray-300 p-3 bg-gray-50">
                          <div className="flex flex-wrap items-end gap-4">
                            <div>
                              <label htmlFor="test_suite_id" className="block text-sm font-medium text-gray-700 mb-1">
                                <strong>Feature</strong>
                              </label>
                              <select
                                name="suite_id"
                                id="tce_test_suite_select"
                                value={testCaseFormData.featureSuiteId}
                                onChange={(e) => setTestCaseFormData({ ...testCaseFormData, featureSuiteId: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                              >
                                {testSuites.map((suite) => (
                                  <option key={suite.id} value={suite.id}>
                                    {suite.title}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="mx-3">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                <b>Priority</b>
                              </label>
                              <select
                                id="tce_priority_select"
                                name="priority"
                                value={testCaseFormData.priority}
                                onChange={(e) => setTestCaseFormData({ ...testCaseFormData, priority: Number(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                              >
                                <option value={3}>High</option>
                                <option value={2}>Medium</option>
                                <option value={1}>Low</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                <b>Test Type</b>
                              </label>
                              <select
                                name="automated"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                                id="tce_automated_select"
                                value={testCaseFormData.automated ? '1' : '0'}
                                onChange={(e) => setTestCaseFormData({ ...testCaseFormData, automated: e.target.value === '1' })}
                              >
                                <option value="0">Manual</option>
                                <option value="1">Automated</option>
                              </select>
                            </div>

                            <div className="mx-4">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                <b>Regression</b>
                              </label>
                              <select
                                name="regression_status"
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                                id="tce_regression"
                                style={{ width: '80px' }}
                                value={testCaseFormData.regression ? '1' : '0'}
                                onChange={(e) => setTestCaseFormData({ ...testCaseFormData, regression: e.target.value === '1' })}
                              >
                                <option value="0">No</option>
                                <option value="1">Yes</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Middle Section: Epic Link, Severity, Platform */}
                        <div className="mb-3 flex justify-start border border-gray-300 p-3 bg-gray-50">
                          <div className="flex flex-wrap items-end gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                <b>Epic Link</b> <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                name="epic_link"
                                id="tce_epic_link"
                                required
                                value={testCaseFormData.epicLink}
                                onChange={(e) => setTestCaseFormData({ ...testCaseFormData, epicLink: e.target.value })}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                                placeholder="Enter epic link..."
                                style={{ width: '150px' }}
                              />
                              {error && error.includes('epic') && (
                                <div className="text-red-600 text-sm mt-1" id="epic_link_error" style={{ display: error.includes('epic') ? 'block' : 'none' }}>
                                  Please fill the mandatory epic link!
                                </div>
                              )}
                            </div>

                            <div className="mx-4">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                <b>Severity</b>
                              </label>
                              <select
                                name="severity"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                                id="tce_severity"
                                value={testCaseFormData.severity}
                                onChange={(e) => setTestCaseFormData({ ...testCaseFormData, severity: e.target.value })}
                              >
                                <option value="Critical">Critical</option>
                                <option value="Major">Major</option>
                                <option value="Moderate">Moderate</option>
                                <option value="Minor">Minor</option>
                                <option value="Low">Low</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                <b>Platform</b> <span className="text-red-500">*</span>
                              </label>
                              <div className="flex flex-wrap gap-4">
                                {['Android', 'iOS', 'Mweb', 'Web'].map((platform) => (
                                  <div key={platform} className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      name="platform"
                                      id={`tce_platform_${platform.toLowerCase()}`}
                                      checked={testCaseFormData.platform.includes(platform)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setTestCaseFormData({
                                            ...testCaseFormData,
                                            platform: [...testCaseFormData.platform, platform],
                                          })
                                        } else {
                                          setTestCaseFormData({
                                            ...testCaseFormData,
                                            platform: testCaseFormData.platform.filter((p) => p !== platform),
                                          })
                                        }
                                      }}
                                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 cursor-pointer"
                                    />
                                    <label htmlFor={`tce_platform_${platform.toLowerCase()}`} className="text-sm text-gray-700 cursor-pointer">
                                      {platform}
                                    </label>
                                  </div>
                                ))}
                              </div>
                              {error && error.includes('platform') && (
                                <div className="text-red-600 text-sm mt-1" id="platform_error" style={{ display: error.includes('platform') ? 'block' : 'none' }}>
                                  At least one platform must be selected!
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Third Section: Linked Issue, Fix Version, Labels */}
                        <div className="mb-3 flex justify-start border border-gray-300 p-3 bg-gray-50">
                          <div className="flex flex-wrap items-end gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                <b>Linked Issue</b>
                              </label>
                              <input
                                type="text"
                                name="linked_issue"
                                id="tce_linked_issue"
                                value={testCaseFormData.linkedIssue}
                                onChange={(e) => setTestCaseFormData({ ...testCaseFormData, linkedIssue: e.target.value })}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                                placeholder="Enter linked issue..."
                                style={{ width: '150px' }}
                              />
                            </div>

                            <div className="mx-4">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                <b>Fix Version</b>
                              </label>
                              <input
                                type="text"
                                name="release_version"
                                id="tce_release_version"
                                value={testCaseFormData.releaseVersion}
                                onChange={(e) => setTestCaseFormData({ ...testCaseFormData, releaseVersion: e.target.value })}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                                placeholder="Enter version..."
                                style={{ width: '110px' }}
                              />
                            </div>

                            <div className="mb-3 p-0">
                              <label htmlFor="labels" className="block text-sm font-medium text-gray-700 mb-1">
                                <b>Labels</b> <span className="text-red-500">*</span>
                              </label>
                              <div id="label_input_container" className="relative" onClick={() => {
                                setShowLabelInput(true)
                                setLabelInputValue('')
                              }}>
                                <div id="tce_labels" className="flex flex-wrap gap-1 mb-2">
                                  {testCaseFormData.labels ? (
                                    testCaseFormData.labels.split(',').map((label, idx) => {
                                      const trimmed = label.trim()
                                      if (!trimmed) return null
                                      return (
                                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-800 text-xs font-medium rounded">
                                          {trimmed}
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              const labels = testCaseFormData.labels.split(',').filter((_, i) => i !== idx).join(',').trim()
                                              setTestCaseFormData({ ...testCaseFormData, labels: labels || '' })
                                              if (!labels) {
                                                setShowLabelInput(false)
                                                setLabelInputValue('')
                                              }
                                            }}
                                            className="text-primary-600 hover:text-primary-800 font-bold"
                                          >
                                            ×
                                          </button>
                                        </span>
                                      )
                                    })
                                  ) : (
                                    !showLabelInput && (
                                      <span className="inline-flex items-center px-2 py-1 bg-gray-200 text-gray-600 text-xs font-medium rounded" id="default_label">None</span>
                                    )
                                  )}
                                </div>
                                <input
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                                  type="text"
                                  id="tce_label_input"
                                  placeholder="Enter a label..."
                                  value={labelInputValue}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    setLabelInputValue(value)
                                    
                                    // Filter suggestions based on input
                                    if (value.trim()) {
                                      const currentLabels = testCaseFormData.labels 
                                        ? testCaseFormData.labels.split(',').map(l => l.trim()).filter(l => l)
                                        : []
                                      const filtered = availableLabels.filter(label => 
                                        label.toLowerCase().includes(value.toLowerCase()) &&
                                        !currentLabels.includes(label)
                                      )
                                      setLabelSuggestions(filtered)
                                      setShowLabelSuggestions(filtered.length > 0)
                                    } else {
                                      setLabelSuggestions([])
                                      setShowLabelSuggestions(false)
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ',') {
                                      e.preventDefault()
                                      handleAddLabel(labelInputValue.trim())
                                    } else if (e.key === 'Escape') {
                                      setShowLabelInput(false)
                                      setLabelInputValue('')
                                      setShowLabelSuggestions(false)
                                    }
                                  }}
                                  onBlur={() => {
                                    setTimeout(() => {
                                      if (labelInputValue.trim()) {
                                        handleAddLabel(labelInputValue.trim())
                                      }
                                      setShowLabelInput(false)
                                      setLabelInputValue('')
                                      setShowLabelSuggestions(false)
                                    }, 200)
                                  }}
                                  style={{ display: showLabelInput ? 'block' : 'none' }}
                                  autoFocus={showLabelInput}
                                />
                                <div className="suggestion-box relative" id="tce_label_suggestion" style={{ display: showLabelSuggestions ? 'block' : 'none' }}>
                                  {showLabelSuggestions && labelSuggestions.length > 0 && (
                                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                      {labelSuggestions.map((suggestion, idx) => (
                                        <button
                                          key={idx}
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            handleAddLabel(suggestion)
                                            setLabelInputValue('')
                                            setShowLabelSuggestions(false)
                                          }}
                                          className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm text-gray-700 border-b border-gray-100 last:border-b-0"
                                        >
                                          {suggestion}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {error && error.includes('label') && (
                                <div className="text-red-600 text-sm mt-1" id="empty_label_error" style={{ display: error.includes('label') ? 'block' : 'none' }}>
                                  Please add at least one label!
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <input type="hidden" id="tce_case_id" value={editingTestCaseId || ''} />

                        {/* Content Section: Title, Description, Preconditions, BDD Scenarios */}
                        <div className="mb-3 p-0">
                          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                            <b>Title</b> <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            id="tce_title_input"
                            name="title"
                            required
                            maxLength={255}
                            value={testCaseFormData.title}
                            onChange={(e) => setTestCaseFormData({ ...testCaseFormData, title: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                            placeholder="Please enter a title..."
                            autoFocus
                          />
                          {error && error.includes('title') && (
                            <div className="text-red-600 text-sm mt-1" id="title_error" style={{ display: error.includes('title') ? 'block' : 'none' }}>
                              Please fill the mandatory title!
                            </div>
                          )}
                        </div>

                        <div className="mb-3 p-0">
                          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                            <b>Description</b>
                          </label>
                          <textarea
                            id="tce_desc_input"
                            name="description"
                            rows={3}
                            value={testCaseFormData.description}
                            onChange={(e) => setTestCaseFormData({ ...testCaseFormData, description: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                            style={{ overflow: 'hidden', height: '82px' }}
                            placeholder="Please enter a description..."
                          />
                        </div>

                        <div className="mb-3 p-0">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            <b>Preconditions</b> <span className="text-red-500">*</span>
                          </label>
                          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden" role="group" aria-label="Precondition Type">
                            <input
                              type="radio"
                              className="sr-only"
                              id="precond_free_text"
                              name="precond_type"
                              value="free_text"
                              checked={testCaseFormData.preconditionsMode === 'free_text'}
                              onChange={() => setTestCaseFormData({ ...testCaseFormData, preconditionsMode: 'free_text' })}
                              autoComplete="off"
                            />
                            <label
                              htmlFor="precond_free_text"
                              className={`px-4 py-2 text-sm font-medium border-r border-gray-300 cursor-pointer transition-colors ${
                                testCaseFormData.preconditionsMode === 'free_text'
                                  ? 'bg-primary-600 text-white'
                                  : 'bg-white text-primary-600 hover:bg-gray-50'
                              }`}
                              onClick={() => {
                                const radio = document.getElementById('precond_free_text') as HTMLInputElement
                                if (radio) radio.checked = true
                                setTestCaseFormData({ ...testCaseFormData, preconditionsMode: 'free_text' })
                              }}
                            >
                              Free text
                            </label>
                            <input
                              type="radio"
                              className="sr-only"
                              id="precond_from_cases"
                              name="precond_type"
                              value="from_cases"
                              checked={testCaseFormData.preconditionsMode === 'from_other'}
                              onChange={() => setTestCaseFormData({ ...testCaseFormData, preconditionsMode: 'from_other' })}
                              autoComplete="off"
                            />
                            <label
                              htmlFor="precond_from_cases"
                              className={`px-4 py-2 text-sm font-medium cursor-pointer transition-colors ${
                                testCaseFormData.preconditionsMode === 'from_other'
                                  ? 'bg-primary-600 text-white'
                                  : 'bg-white text-primary-600 hover:bg-gray-50'
                              }`}
                              onClick={() => {
                                const radio = document.getElementById('precond_from_cases') as HTMLInputElement
                                if (radio) radio.checked = true
                                setTestCaseFormData({ ...testCaseFormData, preconditionsMode: 'from_other' })
                              }}
                            >
                              Get from other test cases
                            </label>
                          </div>
                          {/* Free text area */}
                          <div id="precond_textarea_wrap" className="mt-2" style={{ display: testCaseFormData.preconditionsMode === 'free_text' ? 'block' : 'none' }}>
                            <textarea
                              name="pre_conditions"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                              id="tce_preconditions_input"
                              rows={3}
                              required
                              value={testCaseFormData.preconditions}
                              onChange={(e) => setTestCaseFormData({ ...testCaseFormData, preconditions: e.target.value })}
                              style={{ overflow: 'hidden', height: testCaseFormData.preconditionsMode === 'free_text' ? '84px' : '0px' }}
                            />
                            {error && error.includes('precondition') && (
                              <div className="text-red-600 text-sm mt-1" id="pre_conditions_error" style={{ display: error.includes('precondition') ? 'block' : 'none' }}>
                                Please fill the mandatory pre-conditions!
                              </div>
                            )}
                          </div>

                          {/* Button to open popup for test case selection */}
                          <div id="precond_select_cases_wrap" className="mt-2" style={{ display: testCaseFormData.preconditionsMode === 'from_other' ? 'block' : 'none' }}>
                            <button
                              type="button"
                              className="px-4 py-2 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors text-sm font-medium"
                              onClick={handleOpenTestCaseSelection}
                            >
                              Select Test Cases
                            </button>
                            {testCaseFormData.preconditions && (
                              <div id="selected_test_cases" className="mt-2">
                                <div dangerouslySetInnerHTML={{ __html: testCaseFormData.preconditions }} />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mb-3 p-0">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            <b>BDD Scenarios</b> <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            name="bdd_scenarios"
                            id="tce_bdd_scenarios_input"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                            rows={3}
                            required
                            value={testCaseFormData.bddScenarios}
                            onChange={(e) => setTestCaseFormData({ ...testCaseFormData, bddScenarios: e.target.value })}
                            style={{ overflow: 'hidden', height: '82px' }}
                          />
                          {error && error.includes('BDD') && (
                            <div className="text-red-600 text-sm mt-1" id="bdd_scenarios_error" style={{ display: error.includes('BDD') ? 'block' : 'none' }}>
                              Please fill the mandatory BDD scenarios!
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Footer */}
                      <div id="test_case_editor_footer" className="flex justify-end pt-2 px-4 pb-4 border-t border-gray-200">
                        <div className="flex justify-end gap-3">
                          {isEditingTestCase ? (
                            <button
                              id="tce_save_btn"
                              type="submit"
                              disabled={isSubmittingTestCase || !testCaseFormData.title.trim() || !testCaseFormData.epicLink.trim() || testCaseFormData.platform.length === 0 || !testCaseFormData.labels.trim() || !testCaseFormData.preconditions.trim() || !testCaseFormData.bddScenarios.trim()}
                              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              {isSubmittingTestCase ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                  Updating...
                                </>
                              ) : (
                                <>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Update Test Case
                                </>
                              )}
                            </button>
                          ) : (
                            <>
                              <button
                                id="tce_save_btn"
                                type="submit"
                                disabled={isSubmittingTestCase || !testCaseFormData.title.trim() || !testCaseFormData.epicLink.trim() || testCaseFormData.platform.length === 0 || !testCaseFormData.labels.trim() || !testCaseFormData.preconditions.trim() || !testCaseFormData.bddScenarios.trim()}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isSubmittingTestCase ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block mr-2"></div>
                                    Creating...
                                  </>
                                ) : (
                                  'Create'
                                )}
                              </button>
                              <button
                                id="tce_save_btn"
                                type="button"
                                onClick={async (e) => {
                                  e.preventDefault()
                                  const result = await handleSubmitTestCase(e as any)
                                  if (result) {
                                    // Reset form but keep create mode open
                                    setTestCaseFormData({
                                      title: '',
                                      description: '',
                                      automated: false,
                                      priority: 2,
                                      severity: 'Moderate',
                                      labels: '',
                                      regression: false,
                                      epicLink: '',
                                      linkedIssue: '',
                                      releaseVersion: '',
                                      platform: [],
                                      preconditions: '',
                                      preconditionsMode: 'free_text',
                                      bddScenarios: '',
                                      featureSuiteId: selectedSuite || '',
                                    })
                                    setShowLabelInput(false)
                                    setLabelInputValue('')
                                    setShowLabelSuggestions(false)
                                    setError(null)
                                    // Keep form open - don't close isCreatingTestCase
                                  }
                                }}
                                disabled={isSubmittingTestCase || !testCaseFormData.title.trim() || !testCaseFormData.epicLink.trim() || testCaseFormData.platform.length === 0 || !testCaseFormData.labels.trim() || !testCaseFormData.preconditions.trim() || !testCaseFormData.bddScenarios.trim()}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Create and add another
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              ) : isLoadingTestCaseDetail ? (
                <div className="p-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  <p className="mt-4 text-gray-600">Loading test case details...</p>
                </div>
              ) : testCaseDetail ? (
                <div id="test_case_area" className="h-full flex flex-col">
                  <div id="test_case_editor" className="h-full flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between mt-2 mb-2 px-4 pt-2">
                      <div className="pt-2 flex items-center gap-2">
                        <span>
                          {testCaseDetail.automated ? (
                            <i className="bi bi-robot mx-1 text-gray-600" title="Automated"></i>
                          ) : (
                            <i className="bi bi-person mx-1 text-gray-600" title="Manual"></i>
                          )}
                        </span>
                        <u className="text-primary-600 underline">
                          <a
                            href={`/projects/${projectId}/repository/${repoId}?suite=${selectedSuite}&testCase=${selectedTestCase}`}
                            className="text-primary-600 hover:text-primary-700 cursor-pointer"
                            onClick={(e) => {
                              e.preventDefault()
                              openTestCaseModal(selectedTestCase!, selectedSuite || undefined)
                            }}
                          >
                            {testCaseDetail.jiraKey || `${repository?.prefix || 'ST'}-${testCaseDetail.id}`}
                          </a>
                        </u>
                      </div>
                      <input type="hidden" id="tce_suite_id" value={selectedSuite || ''} />
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={handleStartEdit}
                          className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-sm rounded transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm('Are you sure you want to delete this test case?')) {
                              try {
                                await api.delete(`/projects/${projectId}/repositories/${repoId}/suites/${selectedSuite}/test-cases/${selectedTestCase}`)
                                await fetchTestCases()
                                setSelectedTestCase(null)
                                setTestCaseDetail(null)
                                const url = new URL(window.location.href)
                                url.searchParams.delete('testCase')
                                window.history.replaceState({}, '', url.toString())
                              } catch (err: any) {
                                console.error('Delete test case error:', err)
                                setError(err.response?.data?.error?.message || 'Failed to delete test case')
                              }
                            }
                          }}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTestCase(null)
                            setTestCaseDetail(null)
                            setIsCreatingTestCase(false)
                            setIsEditingTestCase(false)
                            const url = new URL(window.location.href)
                            url.searchParams.delete('testCase')
                            window.history.replaceState({}, '', url.toString())
                          }}
                          className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
                          title="Close"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {/* Title */}
                    <div className="test_case_title border-b border-gray-200 text-lg mb-3 px-4 pb-3">
                      <b className="font-bold text-gray-900">{testCaseDetail.title}</b>
                    </div>

                    {/* Content */}
                    <div id="test_case_content" className="flex-1 overflow-y-auto relative">
                      <div className="mx-4">
                        <strong className="text-base font-semibold mb-5 pb-3 block">Details Test Case</strong>
                        <div className="grid grid-cols-2 gap-4">
                          {/* Left Column */}
                          <div className="space-y-3">
                            <div className="test-case-card flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                              <span className="text-sm text-gray-700">Test Type</span>
                              <span className="test-case-status text-sm font-medium text-gray-900">
                                {testCaseDetail.automated ? 'Automated' : 'Manual'}
                              </span>
                            </div>
                            <div className="test-case-card flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                              <span className="text-sm text-gray-700">Platform</span>
                              <span className="test-case-status flex items-center gap-1">
                                {(() => {
                                  let platforms: string[] = []
                                  try {
                                    if (testCaseDetail.platform) {
                                      platforms = JSON.parse(testCaseDetail.platform)
                                    }
                                  } catch {
                                    if (testCaseDetail.platform) {
                                      platforms = [testCaseDetail.platform]
                                    }
                                  }
                                  if (platforms.length === 0) return <span className="text-gray-400">—</span>
                                  return platforms.map((platform, idx) => {
                                    const platformLower = platform.toLowerCase()
                                    return (
                                      <span key={idx} className="flex items-center" title={platform}>
                                        {platformLower === 'android' && (
                                          <i className="bi bi-android2 text-green-600" title="Android"></i>
                                        )}
                                        {platformLower === 'ios' && (
                                          <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                                          </svg>
                                        )}
                                        {(platformLower === 'web' || platformLower === 'mweb') && (
                                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                          </svg>
                                        )}
                                      </span>
                                    )
                                  })
                                })()}
                              </span>
                            </div>
                            <div className="test-case-card flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                              <span className="text-sm text-gray-700">Priority</span>
                              <span className="test-case-status text-sm font-medium text-gray-900">
                                {testCaseDetail.priority === 1 ? 'Low' :
                                 testCaseDetail.priority === 2 ? 'Medium' :
                                 testCaseDetail.priority === 3 ? 'High' : 'Critical'}
                              </span>
                            </div>
                            <div className="test-case-card flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                              <span className="text-sm text-gray-700">Regression</span>
                              <span className="test-case-status">
                                {testCaseDetail.regression ? (
                                  <span className="test-case-icon" title="Yes">
                                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 16 16">
                                      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 4.97 6.9a.75.75 0 0 0-1.08 1.04l3.25 3.5a.75.75 0 0 0 1.08.02l5.25-5.5a.75.75 0 0 0-.022-1.08z"/>
                                    </svg>
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </span>
                            </div>
                          </div>
                          {/* Right Column */}
                          <div className="space-y-3">
                            <div className="test-case-card flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                              <span className="text-sm text-gray-700">Epic Link</span>
                              <span className="test-case-status text-sm font-medium text-gray-900">
                                {testCaseDetail.epicLink ? (
                                  <a
                                    href={testCaseDetail.epicLink.startsWith('http') ? testCaseDetail.epicLink : `https://allofresh.atlassian.net/browse/${testCaseDetail.epicLink}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary-600 hover:text-primary-700 hover:underline"
                                  >
                                    {testCaseDetail.epicLink}
                                  </a>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </span>
                            </div>
                            <div className="test-case-card flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                              <span className="text-sm text-gray-700">Fix Version</span>
                              <span className="test-case-status text-sm font-medium text-gray-900">
                                {testCaseDetail.releaseVersion || <span className="text-gray-400">—</span>}
                              </span>
                            </div>
                            <div className="test-case-card flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                              <span className="text-sm text-gray-700">Severity</span>
                              <span className="test-case-status text-sm font-medium text-gray-900">{testCaseDetail.severity}</span>
                            </div>
                            <div className="test-case-card flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                              <span className="text-sm text-gray-700">Linked Issue</span>
                              <span className="test-case-status text-sm font-medium text-gray-900">
                                {testCaseDetail.linkedIssue ? (
                                  <a
                                    href={testCaseDetail.linkedIssue.startsWith('http') ? testCaseDetail.linkedIssue : `https://allofresh.atlassian.net/browse/${testCaseDetail.linkedIssue}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary-600 hover:text-primary-700 hover:underline"
                                  >
                                    {testCaseDetail.linkedIssue}
                                  </a>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mx-4 mt-4">
                        <strong className="text-base font-semibold block">Labels</strong>
                        <div className="mt-1 mb-3 border border-gray-200 rounded p-3 bg-white">
                          <div id="tce_labels" className="flex flex-wrap gap-2">
                            {testCaseDetail.labels ? (
                              testCaseDetail.labels.split(',').map((label, idx) => (
                                <span key={idx} className="badge px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm border border-gray-200">
                                  {label.trim()}
                                </span>
                              ))
                            ) : (
                              <span className="badge px-2 py-1 bg-gray-100 text-gray-500 rounded text-sm border border-gray-200">None</span>
                            )}
                          </div>
                        </div>

                        <strong className="text-base font-semibold block">Description</strong>
                        <div className="mt-1 mb-3 border border-gray-200 rounded p-3 bg-white">
                          {testCaseDetail.description ? (
                            <div className="text-sm text-gray-700 whitespace-pre-wrap">{testCaseDetail.description}</div>
                          ) : (
                            <div className="text-sm text-gray-400 italic">No description provided</div>
                          )}
                        </div>

                        <strong className="text-base font-semibold block">Preconditions</strong>
                        <div className="mt-1 mb-3 border border-gray-200 rounded p-3 bg-white">
                          {testCaseDetail.data?.preconditions ? (
                            <div
                              className="text-sm text-gray-700"
                              dangerouslySetInnerHTML={{ __html: testCaseDetail.data.preconditions }}
                            />
                          ) : (
                            <div className="text-sm text-gray-400 italic">No preconditions provided</div>
                          )}
                        </div>

                        <strong className="text-base font-semibold block">BDD Scenarios</strong>
                        <div className="mt-1 mb-3 border border-gray-200 rounded p-3 bg-white">
                          {testCaseDetail.data?.bddScenarios ? (
                            <div className="text-sm text-gray-700 whitespace-pre-wrap">{testCaseDetail.data.bddScenarios}</div>
                          ) : (
                            <div className="text-sm text-gray-400 italic">No BDD scenarios provided</div>
                          )}
                        </div>
                      </div>

                      {/* Information Container */}
                      <div className="information-container mb-5 mx-4 mt-4">
                        <div className="info-item flex items-center gap-4 py-2">
                          <span className="info-label text-sm font-medium text-gray-600 w-28">Created By</span>
                          <span className="info-value text-sm font-medium text-gray-900">{testCaseDetail.createdBy?.name || 'Unknown'}</span>
                          <span className="datetime text-xs text-gray-500 ml-auto">
                            {new Date(testCaseDetail.createdAt).toLocaleString('en-US', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: false
                            }).replace(',', '')}
                          </span>
                        </div>
                        <div className="info-item flex items-center gap-4 py-2">
                          <span className="info-label text-sm font-medium text-gray-600 w-28">Updated By</span>
                          <span className="info-value text-sm font-medium text-gray-900">{testCaseDetail.updatedBy?.name || 'Unknown'}</span>
                          <span className="datetime text-xs text-gray-500 ml-auto">
                            {new Date(testCaseDetail.updatedAt).toLocaleString('en-US', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: false
                            }).replace(',', '')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Select Suite Modal for Test Case */}
      {showSelectSuiteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Select Test Suite</h2>
              
              <p className="text-sm text-gray-600 mb-4">
                Please select a test suite to create a test case.
              </p>

              {testSuites.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-4">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">No test suites available</p>
                  <button
                    onClick={() => {
                      setShowSelectSuiteModal(false)
                      setShowCreateSuiteModal(true)
                    }}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Create a test suite first
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto mb-6">
                  {testSuites.map((suite) => (
                    <button
                      key={suite.id}
                      onClick={() => {
                        setSelectedSuite(suite.id)
                        setShowSelectSuiteModal(false)
                        setIsCreatingTestCase(true)
                        setTestCaseFormData({
                          title: '',
                          description: '',
                          automated: false,
                          priority: 3,
                          severity: 'Moderate',
                          labels: '',
                          regression: false,
                          epicLink: '',
                          linkedIssue: '',
                          releaseVersion: '',
                          platform: [],
                          preconditions: '',
                          preconditionsMode: 'free_text',
                          bddScenarios: '',
                          featureSuiteId: suite.id,
                        })
                        setError(null)
                      }}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-gray-900 truncate">{suite.title}</h3>
                          {(suite.counts.testCases > 0 || suite.counts.children > 0) && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {suite.counts.testCases} test case{suite.counts.testCases !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                        <svg className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowSelectSuiteModal(false)
                  }}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Test Cases Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Upload Test Cases</h2>
                <button
                  onClick={() => {
                    setShowUploadModal(false)
                    setUploadedFile(null)
                    setParsedTestCases([])
                    setUploadResults({ success: 0, failed: 0, created: 0, updated: 0, errors: [] })
                    if (fileInputRef.current) {
                      fileInputRef.current.value = ''
                    }
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {uploadedFile && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">{uploadedFile.name}</span>
                    <span className="text-gray-500">({parsedTestCases.length} test cases found)</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {isUploading ? (
                <div className="space-y-4">
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-4"></div>
                    <p className="text-sm text-gray-600">
                      Uploading test cases... {uploadProgress.current} of {uploadProgress.total}
                    </p>
                    <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ) : uploadResults.success > 0 || uploadResults.failed > 0 ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700 mb-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">Import completed!</span>
                    </div>
                    <div className="text-sm text-green-700">
                      <p>Successfully imported: {uploadResults.success} test case{uploadResults.success !== 1 ? 's' : ''}</p>
                      {uploadResults.created > 0 && (
                        <p className="mt-1">• Created: {uploadResults.created} new test case{uploadResults.created !== 1 ? 's' : ''}</p>
                      )}
                      {uploadResults.updated > 0 && (
                        <p className="mt-1">• Updated: {uploadResults.updated} existing test case{uploadResults.updated !== 1 ? 's' : ''}</p>
                      )}
                      {uploadResults.failed > 0 && (
                        <p className="text-red-600 mt-1">Failed: {uploadResults.failed} test case{uploadResults.failed !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                  </div>

                  {uploadResults.errors.length > 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg max-h-48 overflow-y-auto">
                      <h3 className="text-sm font-medium text-red-700 mb-2">Errors:</h3>
                      <ul className="text-xs text-red-600 space-y-1">
                        {uploadResults.errors.slice(0, 10).map((error, idx) => (
                          <li key={idx}>• {error}</li>
                        ))}
                        {uploadResults.errors.length > 10 && (
                          <li className="text-gray-500">... and {uploadResults.errors.length - 10} more errors</li>
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        setShowUploadModal(false)
                        setUploadedFile(null)
                        setParsedTestCases([])
                        setUploadResults({ success: 0, failed: 0, created: 0, updated: 0, errors: [] })
                        if (fileInputRef.current) {
                          fileInputRef.current.value = ''
                        }
                      }}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Test Suite
                    </label>
                    {testSuites.length === 0 ? (
                      <div className="text-center py-8 border border-gray-200 rounded-lg">
                        <p className="text-sm text-gray-600 mb-4">No test suites available</p>
                        <button
                          onClick={() => {
                            setShowUploadModal(false)
                            setShowCreateSuiteModal(true)
                          }}
                          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          Create a test suite first
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2">
                          {testSuites.map((suite) => (
                            <button
                              key={suite.id}
                              onClick={() => handleBulkImport(suite.id)}
                              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors group mb-2 last:mb-0"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-sm font-medium text-gray-900 truncate">{suite.title}</h3>
                                  {(suite.counts.testCases > 0 || suite.counts.children > 0) && (
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {suite.counts.testCases} test case{suite.counts.testCases !== 1 ? 's' : ''}
                                    </p>
                                  )}
                                </div>
                                <svg className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            setNewSuiteNameInUpload('')
                            setShowCreateSuiteInUploadModal(true)
                          }}
                          className="w-full p-3 rounded-lg border-2 border-dashed border-primary-300 hover:border-primary-400 hover:bg-primary-50 transition-colors text-sm font-medium text-primary-700 flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Create New Suite
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setShowUploadModal(false)
                        setUploadedFile(null)
                        setParsedTestCases([])
                        if (fileInputRef.current) {
                          fileInputRef.current.value = ''
                        }
                      }}
                      className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Test Suite Modal */}
      {showEditSuiteModal && editingSuite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Edit Test Suite</h2>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Suite name
                </label>
                <input
                  type="text"
                  value={newSuiteName}
                  onChange={(e) => setNewSuiteName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUpdateSuite()
                    } else if (e.key === 'Escape') {
                      setShowEditSuiteModal(false)
                      setEditingSuite(null)
                      setNewSuiteName('')
                    }
                  }}
                  placeholder="Test suite name"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                  autoFocus
                />
              </div>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowEditSuiteModal(false)
                    setEditingSuite(null)
                    setNewSuiteName('')
                    setError(null)
                  }}
                  disabled={isUpdatingSuite}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateSuite}
                  disabled={isUpdatingSuite || !newSuiteName.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isUpdatingSuite ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Updating...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Test Suite Modal */}
      {showCreateSuiteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Create Test Suite</h2>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Suite name
                </label>
                <input
                  type="text"
                  value={newSuiteName}
                  onChange={(e) => setNewSuiteName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateSuite()
                    } else if (e.key === 'Escape') {
                      setShowCreateSuiteModal(false)
                      setNewSuiteName('')
                    }
                  }}
                  placeholder="New test suite"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                  autoFocus
                />
              </div>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateSuiteModal(false)
                    setNewSuiteName('')
                    setError(null)
                  }}
                  disabled={isCreatingSuite}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSuite}
                  disabled={isCreatingSuite || !newSuiteName.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isCreatingSuite ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Creating...
                    </>
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Move Test Cases Modal */}
      {showMoveTestCasesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Move Test Cases</h2>
              
              {selectedTargetSuiteForMove ? (
                // Confirmation step
                <>
                  <div className="mb-6">
                    <p className="text-sm text-gray-600 mb-4">
                      Are you sure you want to move <strong>{selectedTestCasesForDelete.size}</strong> test case{selectedTestCasesForDelete.size !== 1 ? 's' : ''} to:
                    </p>
                    <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                      <div className="font-medium text-gray-900">
                        {testSuites.find(s => s.id === selectedTargetSuiteForMove)?.title || 'Unknown Suite'}
                      </div>
                      {testSuites.find(s => s.id === selectedTargetSuiteForMove)?.counts?.testCases !== undefined && (
                        <div className="text-xs text-gray-600 mt-1">
                          {testSuites.find(s => s.id === selectedTargetSuiteForMove)?.counts?.testCases} test case{testSuites.find(s => s.id === selectedTargetSuiteForMove)?.counts?.testCases !== 1 ? 's' : ''} currently in this suite
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => {
                        setSelectedTargetSuiteForMove(null)
                      }}
                      disabled={isMovingTestCases}
                      className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => {
                        if (selectedTargetSuiteForMove) {
                          handleBulkMoveTestCases(selectedTargetSuiteForMove)
                        }
                      }}
                      disabled={isMovingTestCases}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isMovingTestCases ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Moving...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Confirm Move
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                // Suite selection step
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    Select a test suite to move {selectedTestCasesForDelete.size} test case{selectedTestCasesForDelete.size !== 1 ? 's' : ''} to:
                  </p>
                  {testSuites.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-gray-400 mb-4">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">No test suites available</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto mb-6">
                      {testSuites.map((suite) => {
                        const isCurrentSuite = selectedSuite === suite.id
                        const isSelected = selectedTargetSuiteForMove === suite.id
                        return (
                          <button
                            key={suite.id}
                            onClick={() => {
                              if (!isCurrentSuite) {
                                setSelectedTargetSuiteForMove(suite.id)
                              }
                            }}
                            disabled={isCurrentSuite || isMovingTestCases}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                              isCurrentSuite
                                ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                                : isSelected
                                ? 'border-primary-500 bg-primary-50'
                                : 'border-gray-200 hover:border-primary-300 hover:bg-primary-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 truncate">{suite.title}</div>
                                {suite.counts?.testCases !== undefined && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {suite.counts.testCases} test case{suite.counts.testCases !== 1 ? 's' : ''}
                                  </div>
                                )}
                              </div>
                              {isCurrentSuite && (
                                <span className="text-xs text-gray-500 ml-2">(Current)</span>
                              )}
                              {isSelected && !isCurrentSuite && (
                                <svg className="w-5 h-5 text-primary-600 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-3 mt-6">
                    <button
                      onClick={() => {
                        setShowMoveTestCasesModal(false)
                        setSelectedTargetSuiteForMove(null)
                      }}
                      disabled={isMovingTestCases}
                      className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Merge All Confirmation Modal */}
      {showMergeAllConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Merge All Duplicates?</h2>
              <p className="text-sm text-gray-600 text-center mb-4">
                Are you sure you want to merge all <strong>{duplicateGroups.length}</strong> duplicate group{duplicateGroups.length !== 1 ? 's' : ''}?
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-700">
                  This will:
                </p>
                <ul className="text-sm text-gray-700 mt-2 space-y-1 list-disc list-inside">
                  <li>Keep the <strong>newest</strong> test case in each group</li>
                  <li>Delete all <strong>older</strong> test cases in each group</li>
                  <li>Merge data from deleted test cases into the kept ones</li>
                </ul>
                <p className="text-sm text-red-600 font-medium mt-3">
                  ⚠️ This action cannot be undone.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowMergeAllConfirmModal(false)}
                  disabled={isMergingAll}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMergeAllDuplicates}
                  disabled={isMergingAll}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isMergingAll ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Merging...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Confirm Merge
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Suite in Upload Modal */}
      {showCreateSuiteInUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Create New Test Suite</h2>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Suite name
                </label>
                <input
                  type="text"
                  value={newSuiteNameInUpload}
                  onChange={(e) => setNewSuiteNameInUpload(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateSuiteInUpload()
                    } else if (e.key === 'Escape') {
                      setShowCreateSuiteInUploadModal(false)
                      setNewSuiteNameInUpload('')
                    }
                  }}
                  placeholder="New test suite"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                  autoFocus
                />
              </div>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateSuiteInUploadModal(false)
                    setNewSuiteNameInUpload('')
                    setError(null)
                  }}
                  disabled={isCreatingSuiteInUpload}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSuiteInUpload}
                  disabled={isCreatingSuiteInUpload || !newSuiteNameInUpload.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isCreatingSuiteInUpload ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Creating...
                    </>
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Error Modal */}
      {showFileErrorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-xl font-bold text-gray-900 text-center mb-2">File Error</h2>
              <p className="text-sm text-gray-600 text-center mb-6">
                {fileErrorMessage}
              </p>
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    setShowFileErrorModal(false)
                    setFileErrorMessage('')
                  }}
                  className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Duplicates Found Modal */}
      {showNoDuplicatesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h2 className="text-xl font-bold text-gray-900 text-center mb-2">No Duplicates Found</h2>
              <p className="text-sm text-gray-600 text-center mb-6">
                Great news! No duplicate test cases were found in this repository.
              </p>
              <div className="flex justify-center">
                <button
                  onClick={() => setShowNoDuplicatesModal(false)}
                  className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Find Duplicates Modal */}
      {showFindDuplicatesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900">Duplicate Test Cases</h2>
                  <p className="text-sm text-gray-600 mt-2">
                    Found {duplicateGroups.length} group{duplicateGroups.length !== 1 ? 's' : ''} of duplicate test cases
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {!selectedDuplicatePair && duplicateGroups.length > 0 && (
                    <button
                      onClick={() => setShowMergeAllConfirmModal(true)}
                      disabled={isMergingAll}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isMergingAll ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Merging All... ({mergeAllProgress.current}/{mergeAllProgress.total})
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          Merge All (Keep Newest)
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowFindDuplicatesModal(false)
                      setSelectedDuplicatePair(null)
                      setDuplicateGroups([])
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              {isMergingAll && mergeAllProgress.total > 0 && (
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(mergeAllProgress.current / mergeAllProgress.total) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 text-center">
                    Processing group {mergeAllProgress.current} of {mergeAllProgress.total}
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {selectedDuplicatePair ? (
                // Show side-by-side comparison
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Compare Test Cases</h3>
                    <button
                      onClick={() => setSelectedDuplicatePair(null)}
                      className="text-sm text-gray-600 hover:text-gray-900"
                    >
                      ← Back to list
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Left Test Case */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900">Test Case 1</h4>
                        <span className="text-xs text-gray-500">Suite: {selectedDuplicatePair.left.suite?.title || 'Unknown'}</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div><strong>ID:</strong> {selectedDuplicatePair.left.jiraKey || `${repository?.prefix || 'TC'}-${selectedDuplicatePair.left.id}`}</div>
                        <div><strong>Title:</strong> <span className="font-medium">{selectedDuplicatePair.left.title}</span></div>
                        <div><strong>Description:</strong> <span className="text-gray-600">{selectedDuplicatePair.left.description || '—'}</span></div>
                        <div><strong>Automated:</strong> {selectedDuplicatePair.left.automated ? 'Yes' : 'No'}</div>
                        <div><strong>Priority:</strong> {selectedDuplicatePair.left.priority === 1 ? 'Low' : selectedDuplicatePair.left.priority === 2 ? 'Medium' : selectedDuplicatePair.left.priority === 3 ? 'High' : 'Critical'}</div>
                        <div><strong>Severity:</strong> {selectedDuplicatePair.left.severity}</div>
                        <div><strong>Labels:</strong> {selectedDuplicatePair.left.labels || '—'}</div>
                        <div><strong>Platform:</strong> {selectedDuplicatePair.left.platform || '—'}</div>
                        <div><strong>Epic Link:</strong> {selectedDuplicatePair.left.epicLink || '—'}</div>
                        <div><strong>Linked Issue:</strong> {selectedDuplicatePair.left.linkedIssue || '—'}</div>
                      </div>
                    </div>
                    
                    {/* Right Test Case */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900">Test Case 2</h4>
                        <span className="text-xs text-gray-500">Suite: {selectedDuplicatePair.right.suite?.title || 'Unknown'}</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div><strong>ID:</strong> {selectedDuplicatePair.right.jiraKey || `${repository?.prefix || 'TC'}-${selectedDuplicatePair.right.id}`}</div>
                        <div><strong>Title:</strong> <span className="font-medium">{selectedDuplicatePair.right.title}</span></div>
                        <div><strong>Description:</strong> <span className="text-gray-600">{selectedDuplicatePair.right.description || '—'}</span></div>
                        <div><strong>Automated:</strong> {selectedDuplicatePair.right.automated ? 'Yes' : 'No'}</div>
                        <div><strong>Priority:</strong> {selectedDuplicatePair.right.priority === 1 ? 'Low' : selectedDuplicatePair.right.priority === 2 ? 'Medium' : selectedDuplicatePair.right.priority === 3 ? 'High' : 'Critical'}</div>
                        <div><strong>Severity:</strong> {selectedDuplicatePair.right.severity}</div>
                        <div><strong>Labels:</strong> {selectedDuplicatePair.right.labels || '—'}</div>
                        <div><strong>Platform:</strong> {selectedDuplicatePair.right.platform || '—'}</div>
                        <div><strong>Epic Link:</strong> {selectedDuplicatePair.right.epicLink || '—'}</div>
                        <div><strong>Linked Issue:</strong> {selectedDuplicatePair.right.linkedIssue || '—'}</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Differences Highlight */}
                  <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Differences:</h4>
                    <div className="space-y-1 text-sm">
                      {getFieldDifferences(selectedDuplicatePair.left, selectedDuplicatePair.right).map((diff, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="font-medium text-gray-700 min-w-[120px]">{diff.field}:</span>
                          <div className="flex-1">
                            <div className="text-red-600 line-through">{diff.left || '—'}</div>
                            <div className="text-green-600 font-medium">{diff.right || '—'}</div>
                          </div>
                        </div>
                      ))}
                      {getFieldDifferences(selectedDuplicatePair.left, selectedDuplicatePair.right).length === 0 && (
                        <div className="text-gray-600">No differences found (identical test cases)</div>
                      )}
                    </div>
                  </div>
                  
                  {/* Merge Actions */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleMergeDuplicates(selectedDuplicatePair.right.id, selectedDuplicatePair.left.id)}
                      disabled={isMergingDuplicates}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isMergingDuplicates ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Merging...
                        </>
                      ) : (
                        <>
                          Keep Test Case 2, Merge Test Case 1
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleMergeDuplicates(selectedDuplicatePair.left.id, selectedDuplicatePair.right.id)}
                      disabled={isMergingDuplicates}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isMergingDuplicates ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Merging...
                        </>
                      ) : (
                        <>
                          Keep Test Case 1, Merge Test Case 2
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                // Show duplicate groups list
                <div className="space-y-4">
                  {duplicateGroups.length === 0 ? (
                    <div className="text-center py-8 text-gray-600">No duplicates found</div>
                  ) : (
                    duplicateGroups.map((group, groupIdx) => (
                      <div key={groupIdx} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              Group {groupIdx + 1} - {group.testCases.length} duplicate{group.testCases.length !== 1 ? 's' : ''}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                              {Math.round(group.similarity)}% similarity
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {group.testCases.map((tc, tcIdx) => (
                            <div key={tc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{tc.title}</div>
                                <div className="text-xs text-gray-500">
                                  {tc.jiraKey || `${repository?.prefix || 'TC'}-${tc.id}`} • Suite: {tc.suite?.title || 'Unknown'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {group.testCases.length === 2 && (
                          <button
                            onClick={() => setSelectedDuplicatePair({ left: group.testCases[0], right: group.testCases[1] })}
                            className="mt-3 w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
                          >
                            Compare & Merge
                          </button>
                        )}
                        {group.testCases.length > 2 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-sm text-gray-600 mb-2">Select pairs to compare:</p>
                            <div className="grid grid-cols-2 gap-2">
                              {group.testCases.map((tc1, idx1) => 
                                group.testCases.slice(idx1 + 1).map((tc2, idx2) => (
                                  <button
                                    key={`${tc1.id}-${tc2.id}`}
                                    onClick={() => setSelectedDuplicatePair({ left: tc1, right: tc2 })}
                                    className="px-3 py-2 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors text-sm text-primary-700 font-medium"
                                  >
                                    Compare {tc1.jiraKey || `${repository?.prefix || 'TC'}-${tc1.id}`} & {tc2.jiraKey || `${repository?.prefix || 'TC'}-${tc2.id}`}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Test Case Selection Modal */}
      {showTestCaseSelectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={handleCloseTestCaseSelection}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h5 className="text-lg font-semibold text-gray-900">Select Test Cases</h5>
              <button
                type="button"
                onClick={handleCloseTestCaseSelection}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden flex flex-col p-4">
              {/* Search Bar */}
              <input
                type="text"
                id="testCaseSearch"
                value={testCaseSearchQuery}
                onChange={(e) => setTestCaseSearchQuery(e.target.value)}
                placeholder="Search by ID or Title..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition mb-3"
              />

              {/* Test Cases List */}
              <form id="testCaseSelectForm" className="flex-1 overflow-y-auto">
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                  {isLoadingAllTestCases ? (
                    <div className="p-8 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                      <p className="mt-4 text-gray-600">Loading test cases...</p>
                    </div>
                  ) : filteredTestCases.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-gray-600">
                        {testCaseSearchQuery ? 'No test cases found matching your search.' : 'No test cases available.'}
                      </p>
                    </div>
                  ) : (
                    filteredTestCases.map((testCase: TestCase) => {
                      const testCaseId = testCase.jiraKey || `${repository?.prefix || 'ST'}-${testCase.id}`
                      const isSelected = selectedTestCaseIds.has(testCase.id)
                      
                      return (
                        <label
                          key={testCase.id}
                          className={`flex items-start p-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                            isSelected ? 'bg-primary-50' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 mr-2 w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                            checked={isSelected}
                            onChange={() => handleToggleTestCaseSelection(testCase.id)}
                            value={testCase.id}
                            data-title={testCase.title}
                            data-prefix={repository?.prefix || 'ST'}
                          />
                          <span className="text-sm text-gray-700">
                            <b>{testCaseId}</b>: {testCase.title}
                          </span>
                        </label>
                      )
                    })
                  )}
                </div>
              </form>

              {/* Error Message */}
              <div id="testCaseSelectionError" className="text-red-600 text-sm mt-2" style={{ display: error && error.includes('select') ? 'block' : 'none' }}>
                Please select at least one test case.
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleSubmitTestCaseSelection}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                Submit
              </button>
              <button
                type="button"
                onClick={handleCloseTestCaseSelection}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Case Detail Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={closeTestCaseModal}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {isLoadingModalTestCase ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                <p className="mt-4 text-gray-600">Loading test case details...</p>
              </div>
            ) : modalTestCaseData ? (
              <>
                {/* Modal Header */}
                <div className="border-b border-gray-200 my-3 px-4 pt-2 flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <i className="bi bi-list text-blue-500"></i>
                    <span>
                      <i className={`bi ${modalTestCaseData.automated ? 'bi-robot' : 'bi-person'} mx-1`} title={modalTestCaseData.automated ? 'Automated' : 'Manual'}></i>
                    </span>
                    <span className="text-primary-600">
                      {modalTestCaseData.jiraKey || `${repository?.prefix || 'ST'}-${modalTestCaseData.id}`}
                    </span>
                    {modalTestCaseData.title}
                  </h3>
                  <button
                    type="button"
                    onClick={closeTestCaseModal}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    aria-label="Close"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <div id="test_case_content" className="position-relative">
                    <div className="p-4 pt-0">
                      <strong className="text-lg font-semibold block mb-3">Details Test Case</strong>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="col-span-1">
                          <div className="test-case-card flex items-center justify-between p-3 bg-white border border-gray-200 rounded mb-3">
                            <span className="text-sm text-gray-700">Test Type</span>
                            <span className="test-case-status text-sm font-medium text-gray-900">
                              {modalTestCaseData.automated ? 'Automated' : 'Manual'}
                            </span>
                          </div>
                          <div className="test-case-card flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                            <span className="text-sm text-gray-700">Platform</span>
                            <span className="test-case-status flex items-center gap-1">
                              {(() => {
                                let platforms: string[] = []
                                try {
                                  if (modalTestCaseData.platform) {
                                    platforms = JSON.parse(modalTestCaseData.platform)
                                  }
                                } catch {
                                  if (modalTestCaseData.platform) {
                                    platforms = [modalTestCaseData.platform]
                                  }
                                }
                                if (platforms.length === 0) return <span className="text-gray-400">—</span>
                                return platforms.map((platform, idx) => {
                                  const platformLower = platform.toLowerCase()
                                  return (
                                    <span key={idx} className="flex items-center" title={platform}>
                                      {platformLower === 'android' && (
                                        <i className="bi bi-android2 text-green-600 text-lg inline-block" title="Android" style={{ fontSize: '1.25rem' }}></i>
                                      )}
                                      {platformLower === 'ios' && (
                                        <i className="bi bi-apple text-gray-600 text-lg inline-block" title="iOS" style={{ fontSize: '1.25rem' }}></i>
                                      )}
                                      {(platformLower === 'web' || platformLower === 'mweb') && (
                                        <i className="bi bi-globe text-blue-600 text-lg inline-block" title={platform} style={{ fontSize: '1.25rem' }}></i>
                                      )}
                                    </span>
                                  )
                                })
                              })()}
                            </span>
                          </div>
                        </div>
                        <div className="col-span-1">
                          <div className="test-case-card flex items-center justify-between p-3 bg-white border border-gray-200 rounded mb-3">
                            <span className="text-sm text-gray-700">Priority</span>
                            <span className="test-case-status text-sm font-medium text-gray-900">
                              {modalTestCaseData.priority === 1 ? 'Low' :
                               modalTestCaseData.priority === 2 ? 'Medium' :
                               modalTestCaseData.priority === 3 ? 'High' : 'Critical'}
                            </span>
                          </div>
                          <div className="test-case-card flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                            <span className="text-sm text-gray-700">Regression</span>
                            <span className="test-case-status d-flex align-items-center">
                              {modalTestCaseData.regression ? (
                                <i className="bi bi-check-circle-fill text-green-600 text-lg" title="Yes"></i>
                              ) : (
                                <i className="bi bi-x-circle-fill text-gray-400 text-lg" title="No"></i>
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="col-span-1">
                          <div className="test-case-card flex items-center justify-between p-3 bg-white border border-gray-200 rounded mb-3">
                            <span className="text-sm text-gray-700">Epic Link</span>
                            <span className="test-case-status text-sm font-medium text-gray-900">
                              {modalTestCaseData.epicLink ? (
                                <a
                                  href={modalTestCaseData.epicLink.startsWith('http') ? modalTestCaseData.epicLink : `https://allofresh.atlassian.net/browse/${modalTestCaseData.epicLink}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary-600 hover:text-primary-700 hover:underline"
                                >
                                  {modalTestCaseData.epicLink}
                                </a>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </span>
                          </div>
                          <div className="test-case-card flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                            <span className="text-sm text-gray-700">Fix Version</span>
                            <span className="test-case-status text-sm font-medium text-gray-900">
                              {modalTestCaseData.releaseVersion || '—'}
                            </span>
                          </div>
                        </div>
                        <div className="col-span-1">
                          <div className="test-case-card flex items-center justify-between p-3 bg-white border border-gray-200 rounded mb-3">
                            <span className="text-sm text-gray-700">Severity</span>
                            <span className="test-case-status text-sm font-medium text-gray-900">
                              {modalTestCaseData.severity || '—'}
                            </span>
                          </div>
                          <div className="test-case-card flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                            <span className="text-sm text-gray-700">Linked Issue</span>
                            <span className="test-case-status text-sm font-medium text-gray-900">
                              {modalTestCaseData.linkedIssue ? (
                                <a
                                  href={modalTestCaseData.linkedIssue.startsWith('http') ? modalTestCaseData.linkedIssue : `https://allofresh.atlassian.net/browse/${modalTestCaseData.linkedIssue}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary-600 hover:text-primary-700 hover:underline"
                                >
                                  {modalTestCaseData.linkedIssue}
                                </a>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <strong className="text-lg font-semibold block mb-3 mt-4">Labels</strong>
                      <div className="row mt-1 mb-3 border border-gray-200 p-3 rounded">
                        <div id="tce_labels" className="d-flex flex-wrap">
                          {modalTestCaseData.labels ? (
                            modalTestCaseData.labels.split(',').map((label, idx) => (
                              <span key={idx} className="badge bg-primary-100 text-primary-800 me-1 mb-1 px-2 py-1 rounded">
                                {label.trim()}
                              </span>
                            ))
                          ) : (
                            <span className="badge bg-gray-100 text-gray-600 me-1">None</span>
                          )}
                        </div>
                      </div>

                      <strong className="text-lg font-semibold block mb-3">Description</strong>
                      <div className="row mt-1 mb-3 border border-gray-200 p-3 rounded">
                        <div className="text-sm text-gray-700">
                          {modalTestCaseData.description || 'none'}
                        </div>
                      </div>

                      <strong className="text-lg font-semibold block mb-3">Preconditions</strong>
                      <div className="row mb-3 border border-gray-200 p-3 rounded">
                        <div className="text-sm text-gray-700 preconditions-content">
                          {modalTestCaseData.data?.preconditions ? (
                            <div 
                              className="[&_a]:text-primary-600 [&_a]:hover:text-primary-700 [&_a]:hover:underline [&_a]:cursor-pointer [&_a]:font-medium"
                              dangerouslySetInnerHTML={{ __html: modalTestCaseData.data.preconditions }}
                            />
                          ) : (
                            <span className="text-gray-400 italic">No preconditions provided</span>
                          )}
                        </div>
                      </div>

                      <strong className="text-base font-semibold block mb-3">BDD Scenarios</strong>
                      <div className="row mt-1 mb-3 border border-gray-200 p-2 rounded">
                        <div className="text-sm text-gray-700 whitespace-pre-wrap">
                          {modalTestCaseData.data?.bddScenarios || 'No BDD scenarios provided'}
                        </div>
                      </div>
                    </div>

                    {/* Information Container */}
                    <div className="information-container mb-5 px-4">
                      <div className="info-item flex items-center gap-4 py-2 border-b border-gray-100">
                        <span className="info-label text-sm font-medium text-gray-600 w-28">Created By</span>
                        <span className="info-value text-sm font-medium text-gray-900">
                          {modalTestCaseData.createdBy?.name || 'Unknown'}
                        </span>
                        <span className="datetime text-xs text-gray-500 ml-auto">
                          {new Date(modalTestCaseData.createdAt).toLocaleString('en-US', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                          }).replace(',', '')}
                        </span>
                      </div>
                      <div className="info-item flex items-center gap-4 py-2">
                        <span className="info-label text-sm font-medium text-gray-600 w-28">Updated By</span>
                        <span className="info-value text-sm font-medium text-gray-900">
                          {modalTestCaseData.updatedBy?.name || 'Unknown'}
                        </span>
                        <span className="datetime text-xs text-gray-500 ml-auto">
                          {new Date(modalTestCaseData.updatedAt).toLocaleString('en-US', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                          }).replace(',', '')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-12 text-center">
                <p className="text-gray-600">Failed to load test case details</p>
                <button
                  onClick={closeTestCaseModal}
                  className="mt-4 px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
