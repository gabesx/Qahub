import { useState, useEffect, useCallback } from 'react'
import { api } from '../../../../lib/api'
import { Repository } from '../types'

interface TestCase {
  id: string
  title: string
  description?: string
  jiraKey?: string
  priority: number
  repository: {
    id: string
    title: string
    prefix?: string
  }
  suite: {
    id: string
    title: string
  }
  suiteId: string
  updatedAt: string
}

export function useAutomatedTestCases(projectId: string, repositories: Repository[]) {
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchAutomatedTestCases = useCallback(async () => {
    setIsLoading(true)
    try {
      const allCases: TestCase[] = []
      
      // Fetch test cases from all repositories
      for (const repo of repositories) {
        try {
          // First get all suites
          const suitesResponse = await api.get(
            `/projects/${projectId}/repositories/${repo.id}/suites`,
            { params: { page: 1, limit: 1000 } }
          )
          const suites = suitesResponse.data?.data?.suites || []
          
          // Then get test cases from each suite
          for (const suite of suites) {
            try {
              const testCasesResponse = await api.get(
                `/projects/${projectId}/repositories/${repo.id}/suites/${suite.id}/test-cases`,
                { params: { page: 1, limit: 1000, includeDeleted: false } }
              )
              const testCases = testCasesResponse.data?.data?.testCases || []
              // Filter for automated test cases only
              testCases
                .filter((tc: any) => tc.automated === true)
                .forEach((tc: any) => {
                  allCases.push({
                    ...tc,
                    repository: { id: repo.id, title: repo.title, prefix: repo.prefix },
                    suite: { id: suite.id, title: suite.title },
                    suiteId: suite.id, // Store suiteId for easy access in links
                  })
                })
            } catch (err) {
              console.error(`Error fetching test cases for suite ${suite.id}:`, err)
            }
          }
        } catch (err) {
          console.error(`Error fetching test cases for repository ${repo.id}:`, err)
        }
      }
      
      // Sort by updatedAt descending
      allCases.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      
      setTestCases(allCases)
    } catch (err: any) {
      console.error('Fetch automated test cases error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, repositories])

  useEffect(() => {
    if (repositories.length > 0) {
      fetchAutomatedTestCases()
    } else {
      setTestCases([])
    }
  }, [fetchAutomatedTestCases, repositories.length])

  return {
    testCases,
    isLoading,
    refetch: fetchAutomatedTestCases,
  }
}

