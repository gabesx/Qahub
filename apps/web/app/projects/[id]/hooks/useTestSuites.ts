import { useState, useEffect, useCallback } from 'react'
import { api } from '../../../../lib/api'
import { Repository } from '../types'

interface TestSuite {
  id: string
  title: string
  parentId?: string
  repository: {
    id: string
    title: string
  }
  counts?: {
    testCases?: number
    children?: number
  }
}

export function useTestSuites(projectId: string, repositories: Repository[]) {
  const [testSuites, setTestSuites] = useState<TestSuite[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchAllTestSuites = useCallback(async () => {
    setIsLoading(true)
    try {
      const allSuites: TestSuite[] = []
      
      // Fetch test suites from all repositories
      for (const repo of repositories) {
        try {
          const response = await api.get(
            `/projects/${projectId}/repositories/${repo.id}/suites`,
            { params: { page: 1, limit: 1000 } }
          )
          const suites = response.data?.data?.suites || []
          suites.forEach((suite: any) => {
            allSuites.push({
              ...suite,
              repository: { id: repo.id, title: repo.title },
            })
          })
        } catch (err) {
          console.error(`Error fetching test suites for repository ${repo.id}:`, err)
        }
      }
      
      // Sort by title
      allSuites.sort((a, b) => a.title.localeCompare(b.title))
      
      setTestSuites(allSuites)
    } catch (err: any) {
      console.error('Fetch test suites error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, repositories])

  useEffect(() => {
    if (repositories.length > 0) {
      fetchAllTestSuites()
    } else {
      setTestSuites([])
    }
  }, [fetchAllTestSuites, repositories.length])

  return {
    testSuites,
    isLoading,
    refetch: fetchAllTestSuites,
  }
}

