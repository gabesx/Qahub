import { useState } from 'react'
import { api } from '../../../../lib/api'

interface TestSuite {
  id: string
  title: string
  counts?: {
    testCases?: number
    children?: number
  }
}

export function useTestSuitesForImport(projectId: string) {
  const [testSuites, setTestSuites] = useState<TestSuite[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchTestSuites = async (repoId: string) => {
    setIsLoading(true)
    try {
      const response = await api.get(`/projects/${projectId}/repositories/${repoId}/suites?limit=1000`)
      if (response.data?.data?.suites) {
        setTestSuites(response.data.data.suites)
      }
    } catch (err: any) {
      console.error('Fetch test suites error:', err)
      setTestSuites([])
    } finally {
      setIsLoading(false)
    }
  }

  return {
    testSuites,
    isLoading,
    fetchTestSuites,
  }
}

