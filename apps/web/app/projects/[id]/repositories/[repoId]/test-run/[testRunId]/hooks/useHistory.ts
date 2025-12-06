import { useState, useCallback } from 'react'
import { api } from '../../../../../../../../lib/api'
import { HistoryEntry } from '../types'

export function useHistory(testRunId: string) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotalPages, setHistoryTotalPages] = useState(1)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  const fetchHistory = useCallback(async (resultId: string, page: number = 1) => {
    if (!resultId) return
    
    try {
      setIsLoadingHistory(true)
      const response = await api.get(`/test-runs/${testRunId}/results/${resultId}/history`, {
        params: { page, limit: 20 }
      })
      
      if (response.data?.data) {
        setHistory(response.data.data.history || [])
        setHistoryTotalPages(response.data.data.pagination?.totalPages || 1)
        setHistoryPage(page)
      }
    } catch (err: any) {
      console.error('Fetch history error:', err)
      setHistory([])
    } finally {
      setIsLoadingHistory(false)
    }
  }, [testRunId])

  return {
    history,
    historyPage,
    historyTotalPages,
    isLoadingHistory,
    fetchHistory,
  }
}

