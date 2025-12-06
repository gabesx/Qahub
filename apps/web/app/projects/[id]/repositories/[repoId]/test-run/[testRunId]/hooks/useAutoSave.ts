import { useCallback } from 'react'
import { api } from '../../../../../../../../lib/api'
import { TestRunResult } from '../types'

interface UseAutoSaveProps {
  testRunId: string
  selectedTestCaseForModal: any
  selectedTestRunResult: TestRunResult | null
  errorMessage: string
  executionLogs: string
  bugTicketUrl: string
  setSelectedTestRunResult: (result: TestRunResult | null) => void
}

export function useAutoSave({
  testRunId,
  selectedTestCaseForModal,
  selectedTestRunResult,
  errorMessage,
  executionLogs,
  bugTicketUrl,
  setSelectedTestRunResult,
}: UseAutoSaveProps) {
  const handleAutoSaveFields = useCallback(async () => {
    if (!selectedTestCaseForModal || !selectedTestRunResult) {
      return
    }

    const currentStatus = selectedTestRunResult.status
    
    if (currentStatus === 'skipped') {
      return
    }

    try {
      const updatePayload: any = {}
      let hasChanges = false

      if (currentStatus === 'failed' || currentStatus === 'blocked') {
        const newErrorMessage = errorMessage.trim() || null
        const currentErrorMessage = selectedTestRunResult.errorMessage || ''
        if (newErrorMessage !== currentErrorMessage) {
          updatePayload.errorMessage = newErrorMessage
          hasChanges = true
        }
      }

      const newLogs = executionLogs.trim() || null
      const currentLogs = selectedTestRunResult.logs || ''
      if (newLogs !== currentLogs) {
        updatePayload.logs = newLogs
        hasChanges = true
      }

      if (currentStatus === 'failed' || currentStatus === 'blocked') {
        const newBugTicketUrl = bugTicketUrl.trim() || null
        const currentBugTicketUrl = selectedTestRunResult.bugTicketUrl || ''
        if (newBugTicketUrl !== currentBugTicketUrl) {
          updatePayload.bugTicketUrl = newBugTicketUrl
          hasChanges = true
        }
      }

      if (hasChanges) {
        if (selectedTestRunResult.executedBy) {
          updatePayload.executedBy = typeof selectedTestRunResult.executedBy === 'object' && selectedTestRunResult.executedBy.id 
            ? selectedTestRunResult.executedBy.id 
            : selectedTestRunResult.executedBy
        }

        await api.patch(`/test-runs/${testRunId}/results/${selectedTestRunResult.id}`, updatePayload)
        
        const freshResultResponse = await api.get(`/test-runs/${testRunId}/results`, {
          params: { 
            testCaseId: selectedTestCaseForModal.id,
            page: 1,
            limit: 1,
          },
        })
        
        const freshResult = freshResultResponse.data?.data?.results?.[0]
        if (freshResult) {
          setSelectedTestRunResult({
            ...freshResult,
            executedAt: freshResult.executedAt || null,
            executionTime: freshResult.executionTime || null,
          })
        }
      }
    } catch (err: any) {
      console.error('Auto-save error:', err)
    }
  }, [selectedTestCaseForModal, selectedTestRunResult, errorMessage, executionLogs, bugTicketUrl, testRunId, setSelectedTestRunResult])

  return {
    handleAutoSaveFields,
  }
}

