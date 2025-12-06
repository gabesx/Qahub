import { useState, useEffect, useCallback } from 'react'
import { api } from '../../../../lib/api'
import { Repository } from '../types'

interface TestPlan {
  id: string
  title: string
  description?: string
  status: 'draft' | 'active' | 'archived'
  createdAt: string
  updatedAt: string
  repository: {
    id: string
    title: string
  }
  counts?: {
    testCases?: number
    testRuns?: number
  }
  createdBy?: {
    id: string
    name: string
    email: string
  } | null
}

export function useTestPlans(projectId: string, repositories: Repository[]) {
  const [testPlans, setTestPlans] = useState<TestPlan[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchTestPlans = useCallback(async () => {
    setIsLoading(true)
    try {
      const allTestPlans: TestPlan[] = []
      
      // Fetch test plans from all repositories
      for (const repo of repositories) {
        try {
          const response = await api.get(
            `/projects/${projectId}/repositories/${repo.id}/test-plans`,
            { params: { page: 1, limit: 100 } }
          )
          const plans = response.data?.data?.testPlans || []
          plans.forEach((plan: any) => {
            allTestPlans.push({
              ...plan,
              repository: { id: repo.id, title: repo.title },
            })
          })
        } catch (err) {
          console.error(`Error fetching test plans for repository ${repo.id}:`, err)
        }
      }
      
      // Sort by createdAt descending (newest first)
      allTestPlans.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      
      setTestPlans(allTestPlans)
    } catch (err: any) {
      console.error('Fetch test plans error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, repositories])

  useEffect(() => {
    if (repositories.length > 0) {
      fetchTestPlans()
    } else {
      setTestPlans([])
    }
  }, [fetchTestPlans, repositories.length])

  return {
    testPlans,
    isLoading,
    refetch: fetchTestPlans,
  }
}

