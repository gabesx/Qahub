import { useState, useEffect } from 'react'
import { api } from '../../../../lib/api'
import { Repository } from '../types'

export function useRepositories(projectId: string) {
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchRepositories = async () => {
    setIsLoading(true)
    try {
      const response = await api.get(`/projects/${projectId}/repositories`)
      
      if (response.data?.data?.repositories) {
        setRepositories(response.data.data.repositories)
      }
    } catch (err: any) {
      console.error('Fetch repositories error:', err)
      // If endpoint doesn't exist yet, use empty array
      if (err.response?.status === 404) {
        setRepositories([])
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRepositories()
  }, [projectId])

  return {
    repositories,
    isLoading,
    refetch: fetchRepositories,
  }
}

