export interface Project {
  id: string
  title: string
  description: string | null
  createdBy: string | null
  updatedBy: string | null
  creator: {
    id: string
    name: string
    email: string
    avatar: string | null
  } | null
  updater: {
    id: string
    name: string
    email: string
    avatar: string | null
  } | null
  createdAt: string
  updatedAt: string
  counts: {
    repositories: number
    testPlans: number
    testRuns: number
    documents: number
  }
}

export interface Repository {
  id: string
  title: string
  description: string | null
  prefix: string
  createdAt: string
  updatedAt: string
  counts?: {
    suites?: number
    testCases?: number
    automation?: number
    automated?: number
  }
}

export type TabType = 'squads' | 'testSuites' | 'testCases' | 'automation' | 'testPlans' | 'testRuns'

export interface PaginationState {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface UploadResults {
  success: number
  failed: number
  created: number
  updated: number
  errors: string[]
}

export interface UploadProgress {
  current: number
  total: number
}

