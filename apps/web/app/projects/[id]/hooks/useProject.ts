import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '../../../../lib/api'
import { Project } from '../types'

export function useProject(projectId: string) {
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    fetchProject()
  }, [projectId, router])

  const fetchProject = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await api.get(`/projects/${projectId}`)
      
      if (response.data?.data?.project) {
        setProject(response.data.data.project)
      }
    } catch (err: any) {
      console.error('Fetch project error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else if (err.response?.status === 404) {
        setError('Project not found')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to fetch project')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return {
    project,
    isLoading,
    error,
    refetch: fetchProject,
  }
}

