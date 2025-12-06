export interface TestRun {
  id: string
  title: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  executionDate: string | null
  startedAt: string | null
  completedAt: string | null
  environment: string | null
  buildVersion: string | null
  stats: {
    total: number
    passed: number
    failed: number
    skipped: number
    blocked: number
  }
  testPlan: {
    id: string
    title: string
  }
  repository: {
    id: string
    title: string
  } | null
}

export interface TestPlanTestCase {
  id: string
  title: string
  automated: boolean
  priority: number
  severity?: string
  order?: number
  suiteId?: string
  suite?: {
    id: string
    title: string
  }
  repository?: {
    id: string
    prefix: string
  }
  jiraKey?: string
}

export interface TestRunResult {
  id: string
  status: 'passed' | 'failed' | 'skipped' | 'blocked' | 'inProgress'
  executedAt: string | null
  executionTime: number | null
  executedBy: {
    id: string
    name: string
    email: string
  } | null
  testCase: {
    id: string
    title: string
    priority: number
    automated: boolean
  } | null
  screenshots?: any
  errorMessage?: string | null
  stackTrace?: string | null
  logs?: string | null
  bugTicketUrl?: string | null
  isValid?: boolean
}

export interface Comment {
  id: string
  userId?: string
  content?: string
  comments?: string // Test run comments use 'comments' field
  createdAt: string
  updatedAt?: string
  user?: {
    id: string
    name: string
    email: string
    avatar?: string
  } | null
  attachments?: Array<{
    id: string
    url: string
    createdAt: string
  }>
}

export interface TestCaseWithResult extends TestPlanTestCase {
  result?: TestRunResult
  status: 'passed' | 'failed' | 'skipped' | 'blocked' | 'toDo' | 'inProgress'
  executedBy?: {
    id: string
    name: string
    email: string
  } | null
  isValid?: boolean
}

export interface HistoryEntry {
  id: string
  action: string
  oldStatus?: string
  newStatus?: string
  executedBy?: { id: string; name: string; email: string } | null
  createdAt: string
}

export interface User {
  id: string
  name: string
  email: string
}

export type TestCaseStatus = 'passed' | 'failed' | 'skipped' | 'blocked' | 'toDo' | 'inProgress'

