import { useState, useEffect, useCallback } from 'react'
import { api } from '../../../../lib/api'

interface TestRun {
  id: string
  title: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  executionDate: string | null
  startedAt: string | null
  completedAt: string | null
  environment: string | null
  buildVersion: string | null
  testPlan: {
    id: string
    title: string
  }
  repository: {
    id: string
    title: string
  } | null
  stats: {
    total: number
    passed: number
    failed: number
    skipped: number
    blocked: number
    inProgress?: number
    toDo?: number
    executed?: number
  }
  totalExecutionTime?: number
  createdAt: string
  updatedAt: string
  createdBy?: {
    id: string
    name: string
    email: string
  } | null
}

export function useTestRuns(projectId: string) {
  const [testRuns, setTestRuns] = useState<TestRun[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchTestRuns = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await api.get(`/projects/${projectId}/test-runs`, {
        params: { page: 1, limit: 1000 },
      })
      
      if (response.data?.data?.testRuns) {
        // Stats should already include inProgress, toDo, and executed from API
        // Just ensure they're present with defaults if missing
        const testRunsWithCalculatedStats = response.data.data.testRuns.map((tr: any) => {
          const stats = tr.stats || {}
          const total = stats.total || 0
          const passed = stats.passed || 0
          const failed = stats.failed || 0
          const skipped = stats.skipped || 0
          const blocked = stats.blocked || 0
          const inProgress = stats.inProgress || 0
          const executed = stats.executed !== undefined 
            ? stats.executed 
            : passed + failed + skipped + blocked + inProgress
          const toDo = stats.toDo !== undefined 
            ? stats.toDo 
            : Math.max(0, total - executed)
          
          return {
            ...tr,
            stats: {
              ...stats,
              total,
              passed,
              failed,
              skipped,
              blocked,
              inProgress,
              toDo,
              executed,
            },
            totalExecutionTime: tr.totalExecutionTime || 0,
          }
        })
        
        // Sort by createdAt descending (newest first)
        testRunsWithCalculatedStats.sort(
          (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        
        setTestRuns(testRunsWithCalculatedStats)
      }
    } catch (err: any) {
      console.error('Fetch test runs error:', err)
      setTestRuns([])
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchTestRuns()
  }, [fetchTestRuns])

  return {
    testRuns,
    isLoading,
    refetch: fetchTestRuns,
  }
}

