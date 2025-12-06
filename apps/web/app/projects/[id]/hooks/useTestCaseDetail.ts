import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '../../../../lib/api'

interface TestCaseDetail {
  id: string
  title: string
  jiraKey?: string
  automated: boolean
  priority: number
  severity?: string
  regression: boolean
  epicLink?: string
  releaseVersion?: string
  linkedIssue?: string
  labels?: string
  description?: string
  platform?: string
  data?: {
    preconditions?: string
    bddScenarios?: string
  }
  createdAt: string
  updatedAt: string
  createdBy?: {
    name: string
  }
  updatedBy?: {
    name: string
  }
}

export function useTestCaseDetail(projectId: string) {
  const router = useRouter()
  const [testCase, setTestCase] = useState<TestCaseDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTestCaseDetail = async (
    repoId: string,
    suiteId: string,
    testCaseId: string
  ) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await api.get(
        `/projects/${projectId}/repositories/${repoId}/suites/${suiteId}/test-cases/${testCaseId}`
      )
      
      if (response.data?.data?.testCase) {
        setTestCase(response.data.data.testCase)
      }
    } catch (err: any) {
      console.error('Fetch test case detail error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else {
        setError('Failed to load test case details')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const clearTestCase = () => {
    setTestCase(null)
    setError(null)
  }

  return {
    testCase,
    isLoading,
    error,
    fetchTestCaseDetail,
    clearTestCase,
  }
}

