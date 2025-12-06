import { useState, useCallback } from 'react'
import { api } from '../../../../../../../../lib/api'
import { TestCaseStatus, TestRunResult } from '../types'

interface UseStatusUpdateProps {
  testRunId: string
  projectId: string
  testRun: any
  results: TestRunResult[]
  fetchResults: (forceRefresh?: boolean) => Promise<TestRunResult[] | null>
  mergeTestCasesWithResults: (resultsToMerge?: TestRunResult[]) => void
  fetchTestRun: () => Promise<void>
  onError: (error: string) => void
}

export function useStatusUpdate({
  testRunId,
  projectId,
  testRun,
  results,
  fetchResults,
  mergeTestCasesWithResults,
  fetchTestRun,
  onError,
}: UseStatusUpdateProps) {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  const handleUpdateStatus = useCallback(async (
    status: TestCaseStatus,
    selectedTestCaseForModal: any,
    errorMessage: string,
    executionLogs: string,
    bugTicketUrl: string,
    setSelectedTestRunResult: (result: TestRunResult | null) => void,
    handleTestCaseRowClick: (testCase: any) => Promise<void>
  ) => {
    if (!selectedTestCaseForModal) return

    try {
      setIsUpdatingStatus(true)
      await fetchResults(true)
      
      let result = results.find(r => r.testCase && r.testCase.id === selectedTestCaseForModal.id)
      
      if (!result) {
        try {
          const resultResponse = await api.get(`/test-runs/${testRunId}/results`, {
            params: { 
              testCaseId: selectedTestCaseForModal.id,
              page: 1,
              limit: 1,
            },
          })
          const foundResults = resultResponse.data?.data?.results || []
          if (foundResults.length > 0) {
            result = foundResults[0]
          }
        } catch (apiErr) {
          console.warn('Could not fetch result from API:', apiErr)
        }
      }
      
      const now = new Date().toISOString()
      const currentStatus = result ? result.status : 'toDo'
      
      if (currentStatus === status) {
        return
      }
      
      if (status === 'toDo') {
        if (result) {
          await api.delete(`/test-runs/${testRunId}/results/${result.id}`)
        }
      } else if (status === 'inProgress') {
        const backendStatus = 'inProgress' as const
        
        if (result) {
          const executedAtValue = result.executedAt ? new Date(result.executedAt).toISOString() : now
          const updatePayload: any = {
            status: backendStatus,
            executedAt: executedAtValue,
          }
          if (executionLogs.trim()) {
            updatePayload.logs = executionLogs.trim()
          }
          if (result.executedBy) {
            updatePayload.executedBy = typeof result.executedBy === 'object' && result.executedBy.id 
              ? result.executedBy.id 
              : result.executedBy
          }
          await api.patch(`/test-runs/${testRunId}/results/${result.id}`, updatePayload)
        } else {
          const createPayload: any = {
            testCaseId: selectedTestCaseForModal.id,
            status: backendStatus,
            executedAt: now,
          }
          if (executionLogs.trim()) {
            createPayload.logs = executionLogs.trim()
          }
          await api.post(`/test-runs/${testRunId}/results`, createPayload)
        }
        
        if (testRun && testRun.status === 'pending') {
          try {
            const updatePayload: any = {
              status: 'running'
            }
            if (!testRun.executionDate) {
              updatePayload.executionDate = new Date().toISOString().split('T')[0]
            }
            await api.patch(`/projects/${projectId}/test-runs/${testRunId}`, updatePayload)
            await fetchTestRun()
          } catch (err: any) {
            console.error('Failed to auto-start test run:', err)
          }
        }
      } else if (status === 'skipped') {
        const backendStatus = 'skipped' as const
        
        if (result) {
          const updatePayload: any = {
            status: backendStatus,
            executedAt: null,
            executionTime: null,
            errorMessage: null,
          }
          if (executionLogs.trim()) {
            updatePayload.logs = executionLogs.trim()
          }
          if (result.executedBy) {
            updatePayload.executedBy = result.executedBy.id || result.executedBy
          }
          await api.patch(`/test-runs/${testRunId}/results/${result.id}`, updatePayload)
        } else {
          const createPayload: any = {
            testCaseId: selectedTestCaseForModal.id,
            status: backendStatus,
          }
          if (executionLogs.trim()) {
            createPayload.logs = executionLogs.trim()
          }
          await api.post(`/test-runs/${testRunId}/results`, createPayload)
        }
      } else {
        const backendStatus = status as 'passed' | 'failed' | 'blocked'
        
        if (result) {
          const executedAtValue = result.executedAt ? new Date(result.executedAt).toISOString() : now
          const startTime = result.executedAt ? new Date(result.executedAt).getTime() : new Date(now).getTime()
          const endTime = new Date(now).getTime()
          const executionTime = Math.floor((endTime - startTime) / 1000)
          
          const updatePayload: any = {
            status: backendStatus,
            executedAt: executedAtValue,
            executionTime: executionTime > 0 ? executionTime : 1,
          }
          if (backendStatus === 'failed' || backendStatus === 'blocked') {
            if (errorMessage.trim()) {
              updatePayload.errorMessage = errorMessage.trim()
            }
            if (bugTicketUrl.trim()) {
              updatePayload.bugTicketUrl = bugTicketUrl.trim()
            }
          } else if (backendStatus === 'passed') {
            updatePayload.errorMessage = null
            updatePayload.bugTicketUrl = null
          }
          if (executionLogs.trim()) {
            updatePayload.logs = executionLogs.trim()
          }
          if (result.executedBy) {
            updatePayload.executedBy = result.executedBy.id || result.executedBy
          }
          await api.patch(`/test-runs/${testRunId}/results/${result.id}`, updatePayload)
        } else {
          const createPayload: any = {
            testCaseId: selectedTestCaseForModal.id,
            status: backendStatus,
            executedAt: now,
            executionTime: 1,
          }
          if (backendStatus === 'failed' || backendStatus === 'blocked') {
            if (errorMessage.trim()) {
              createPayload.errorMessage = errorMessage.trim()
            }
            if (bugTicketUrl.trim()) {
              createPayload.bugTicketUrl = bugTicketUrl.trim()
            }
          }
          if (executionLogs.trim()) {
            createPayload.logs = executionLogs.trim()
          }
          await api.post(`/test-runs/${testRunId}/results`, createPayload)
        }
      }

      const updatedResults = await fetchResults(true)
      if (updatedResults) {
        mergeTestCasesWithResults(updatedResults)
      }
      
      try {
        const freshResultResponse = await api.get(`/test-runs/${testRunId}/results`, {
          params: { 
            testCaseId: selectedTestCaseForModal.id,
            page: 1,
            limit: 1,
          },
        })
        
        const freshResult = freshResultResponse.data?.data?.results?.[0]
        
        if (status === 'toDo') {
          setSelectedTestRunResult(null)
        } else if (freshResult) {
          setSelectedTestRunResult({
            ...freshResult,
            executedAt: freshResult.executedAt || null,
            executionTime: freshResult.executionTime || null,
          })
        } else {
          setSelectedTestRunResult(null)
        }
      } catch (fetchErr: any) {
        console.error('Error fetching fresh result:', fetchErr)
      }
    } catch (err: any) {
      console.error('Update status error:', err)
      
      if (err.response?.status === 409) {
        try {
          await fetchResults(true)
          const updatedResults = await api.get(`/test-runs/${testRunId}/results`, {
            params: { 
              testCaseId: selectedTestCaseForModal.id,
              page: 1,
              limit: 10,
            },
          })
          const allResults = updatedResults.data?.data?.results || []
          const foundResult = allResults.find((r: any) => r.testCase?.id === selectedTestCaseForModal.id)
          
          if (foundResult) {
            // Retry logic similar to above but simplified
            const now = new Date().toISOString()
            if (status === 'toDo') {
              await api.delete(`/test-runs/${testRunId}/results/${foundResult.id}`)
            } else {
              const updatePayload: any = { status }
              if (result?.executedBy) {
                updatePayload.executedBy = typeof result.executedBy === 'object' && result.executedBy.id 
                  ? result.executedBy.id 
                  : result.executedBy
              }
              await api.patch(`/test-runs/${testRunId}/results/${foundResult.id}`, updatePayload)
            }
            
            const updatedResults = await fetchResults(true)
            if (updatedResults) {
              mergeTestCasesWithResults(updatedResults)
            }
            return
          }
        } catch (retryErr: any) {
          console.error('Retry update error:', retryErr)
        }
      }
      
      const errorMessage = err.response?.data?.error?.message || 'Failed to update status'
      onError(errorMessage)
    } finally {
      setIsUpdatingStatus(false)
    }
  }, [testRunId, projectId, testRun, results, fetchResults, mergeTestCasesWithResults, fetchTestRun, onError])

  return {
    isUpdatingStatus,
    handleUpdateStatus,
  }
}

