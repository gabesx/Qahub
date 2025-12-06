import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '../../../../../../../../lib/api'
import { TestRun } from '../types'

export function useTestRun(projectId: string, testRunId: string) {
  const router = useRouter()
  const [testRun, setTestRun] = useState<TestRun | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTestRun = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await api.get(`/projects/${projectId}/test-runs/${testRunId}`)
      if (response.data?.data?.testRun) {
        setTestRun(response.data.data.testRun)
      }
    } catch (err: any) {
      console.error('Fetch test run error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to fetch test run')
      }
    } finally {
      setIsLoading(false)
    }
  }, [projectId, testRunId, router])

  useEffect(() => {
    if (projectId && testRunId) {
      fetchTestRun()
    }
  }, [projectId, testRunId, fetchTestRun])

  return {
    testRun,
    isLoading,
    error,
    setError,
    fetchTestRun,
  }
}

