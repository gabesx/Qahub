import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '../../../../../../../../lib/api'
import { TestRunResult } from '../types'

const CACHE_TTL = 30000 // 30 seconds
const RESULTS_PER_PAGE = 100

export function useTestRunResults(testRunId: string) {
  const router = useRouter()
  const [results, setResults] = useState<TestRunResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resultsPage, setResultsPage] = useState(1)
  const [resultsTotal, setResultsTotal] = useState(0)
  const [resultsTotalPages, setResultsTotalPages] = useState(1)

  const resultCacheRef = useRef<{
    data: TestRunResult[]
    timestamp: number
    testRunId: string
    total: number
  } | null>(null)

  const fetchResults = useCallback(async (forceRefresh = false, page = 1): Promise<TestRunResult[] | null> => {
    try {
      const now = Date.now()
      if (
        page === 1 &&
        !forceRefresh &&
        resultCacheRef.current &&
        resultCacheRef.current.testRunId === testRunId &&
        (now - resultCacheRef.current.timestamp) < CACHE_TTL
      ) {
        console.log('Using cached results')
        setResults(resultCacheRef.current.data)
        setResultsTotal(resultCacheRef.current.total)
        setResultsTotalPages(Math.ceil(resultCacheRef.current.total / RESULTS_PER_PAGE))
        setIsLoading(false)
        return resultCacheRef.current.data
      }

      const response = await api.get(`/test-runs/${testRunId}/results`, {
        params: { page, limit: RESULTS_PER_PAGE },
      })

      if (response.data?.data?.results) {
        const resultsData = response.data.data.results
        const pagination = response.data.data.pagination

        if (page === 1) {
          setResults(resultsData)
          resultCacheRef.current = {
            data: resultsData,
            timestamp: now,
            testRunId: testRunId,
            total: pagination.total,
          }
        } else {
          setResults(prev => [...prev, ...resultsData])
        }

        setResultsTotal(pagination.total)
        setResultsTotalPages(pagination.totalPages)
        return resultsData
      }
      return null
    } catch (err: any) {
      console.error('Fetch results error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to fetch test run results')
      }
      return null
    } finally {
      setIsLoading(false)
    }
  }, [testRunId, router])

  const loadMoreResults = useCallback(() => {
    if (resultsPage < resultsTotalPages && !isLoading) {
      const nextPage = resultsPage + 1
      setResultsPage(nextPage)
      fetchResults(false, nextPage)
    }
  }, [resultsPage, resultsTotalPages, isLoading, fetchResults])

  return {
    results,
    isLoading,
    error,
    setError,
    fetchResults,
    loadMoreResults,
    resultsTotal,
    resultsTotalPages,
  }
}

