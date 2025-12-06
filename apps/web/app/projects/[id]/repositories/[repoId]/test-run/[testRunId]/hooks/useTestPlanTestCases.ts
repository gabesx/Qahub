import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '../../../../../../../../lib/api'
import { TestPlanTestCase } from '../types'

export function useTestPlanTestCases(projectId: string, repoId: string, testPlanId: string | null) {
  const router = useRouter()
  const [testPlanTestCases, setTestPlanTestCases] = useState<TestPlanTestCase[]>([])
  const [error, setError] = useState<string | null>(null)

  const fetchTestPlanTestCases = useCallback(async () => {
    if (!testPlanId) return
    
    try {
      const response = await api.get(
        `/projects/${projectId}/repositories/${repoId}/test-plans/${testPlanId}`
      )
      
      if (response.data?.data?.testPlan?.testCases) {
        const testCases = response.data.data.testPlan.testCases
        
        const repoResponse = await api.get(`/projects/${projectId}/repositories/${repoId}`)
        const repository = repoResponse.data?.data?.repository
        
        const testCasesWithDetails = testCases.map((tc: any) => ({
          id: tc.id,
          title: tc.title,
          automated: tc.automated,
          priority: tc.priority,
          severity: tc.severity,
          order: tc.order,
          suiteId: tc.suiteId || tc.suite?.id,
          suite: tc.suite || null,
          repository: repository ? {
            id: repository.id,
            prefix: repository.prefix,
          } : undefined,
          jiraKey: tc.jiraKey,
        }))
        
        setTestPlanTestCases(testCasesWithDetails)
      }
    } catch (err: any) {
      console.error('Fetch test plan test cases error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else if (err.response?.status === 400 && err.response?.data?.error?.code === 'INVALID_TEST_CASES') {
        const invalidTestCaseIds = err.response?.data?.error?.details?.invalidTestCaseIds || []
        if (invalidTestCaseIds.length > 0) {
          console.log(`Auto-removing ${invalidTestCaseIds.length} deleted/invalid test case(s) from test plan`)
          try {
            for (const testCaseId of invalidTestCaseIds) {
              try {
                await api.delete(
                  `/projects/${projectId}/repositories/${repoId}/test-plans/${testPlanId}/test-cases/${testCaseId}`
                )
              } catch (deleteErr: any) {
                console.error(`Error removing test case ${testCaseId}:`, deleteErr)
              }
            }
            
            const retryResponse = await api.get(
              `/projects/${projectId}/repositories/${repoId}/test-plans/${testPlanId}`
            )
            
            if (retryResponse.data?.data?.testPlan?.testCases) {
              const testCases = retryResponse.data.data.testPlan.testCases
              const repoResponse = await api.get(`/projects/${projectId}/repositories/${repoId}`)
              const repository = repoResponse.data?.data?.repository
              
              const testCasesWithDetails = testCases.map((tc: any) => ({
                id: tc.id,
                title: tc.title,
                automated: tc.automated,
                priority: tc.priority,
                severity: tc.severity,
                order: tc.order,
                suiteId: tc.suiteId || tc.suite?.id,
                suite: tc.suite || null,
                repository: repository ? {
                  id: repository.id,
                  prefix: repository.prefix,
                } : undefined,
                jiraKey: tc.jiraKey,
              }))
              
              setTestPlanTestCases(testCasesWithDetails)
              console.log(`Successfully removed ${invalidTestCaseIds.length} deleted/invalid test case(s)`)
            }
          } catch (cleanupErr: any) {
            console.error('Error during auto-cleanup:', cleanupErr)
            setError(`Failed to automatically remove deleted test cases. ${err.response?.data?.error?.message || 'Please remove them manually.'}`)
          }
        } else {
          setError(err.response?.data?.error?.message || 'Failed to fetch test plan test cases')
        }
      } else {
        setError(err.response?.data?.error?.message || 'Failed to fetch test plan test cases')
      }
    }
  }, [testPlanId, projectId, repoId, router])

  return {
    testPlanTestCases,
    error,
    setError,
    fetchTestPlanTestCases,
  }
}

