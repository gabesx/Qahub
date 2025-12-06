import { TestRun, TestCaseWithResult, User } from '../types'
import TestRunHeader from './TestRunHeader'
import TestRunMetadata from './TestRunMetadata'
import TestRunStats from './TestRunStats'
import TestRunActions from './TestRunActions'
import FiltersSection from './FiltersSection'
import BulkAssigneeSelector from './BulkAssigneeSelector'
import SuiteExpandControls from './SuiteExpandControls'

interface TestRunHeaderCardProps {
  testRun: TestRun | null
  projectId: string
  testRunId: string
  isLoading: boolean
  isUpdatingStatus: boolean
  isExecutionPaused: boolean
  pausedAt: number | null
  isEditingMetadata: boolean
  editedMetadata: {
    executionDate: string
    environment: string
    buildVersion: string
  }
  displayStats: {
    total: number
    passed: number
    failed: number
    skipped: number
    blocked: number
    toDo: number
    inProgress: number
  }
  totalExecutionTime: number
  statusFilter: string
  assigneeFilter: string
  assignees: Array<{ id: string; name: string; email: string }>
  users: User[]
  testCasesBySuite: Record<string, { id: string; title: string; testCases: TestCaseWithResult[] }>
  selectedTestCaseIds: Set<string>
  bulkAssignee: string
  onTitleUpdate: (title: string) => Promise<void>
  onMetadataEdit: () => void
  onMetadataChange: (metadata: { executionDate: string; environment: string; buildVersion: string }) => void
  onSaveMetadata: () => Promise<void>
  onCancelMetadata: () => void
  onRefresh: () => Promise<void>
  onStart: () => Promise<void>
  onPause: () => void
  onContinue: () => void
  onFinish: () => Promise<void>
  onStatusFilterChange: (status: string) => void
  onAssigneeFilterChange: (assignee: string) => void
  onResetFilters: () => void
  onBulkAssigneeChange: (userId: string | null) => void
  onExpandAll: () => void
  onCollapseAll: () => void
  onError: (error: string) => void
}

export default function TestRunHeaderCard({
  testRun,
  projectId,
  testRunId,
  isLoading,
  isUpdatingStatus,
  isExecutionPaused,
  pausedAt,
  isEditingMetadata,
  editedMetadata,
  displayStats,
  totalExecutionTime,
  statusFilter,
  assigneeFilter,
  assignees,
  users,
  testCasesBySuite,
  selectedTestCaseIds,
  bulkAssignee,
  onTitleUpdate,
  onMetadataEdit,
  onMetadataChange,
  onSaveMetadata,
  onCancelMetadata,
  onRefresh,
  onStart,
  onPause,
  onContinue,
  onFinish,
  onStatusFilterChange,
  onAssigneeFilterChange,
  onResetFilters,
  onBulkAssigneeChange,
  onExpandAll,
  onCollapseAll,
  onError,
}: TestRunHeaderCardProps) {
  const hasTestCases = Object.keys(testCasesBySuite).length > 0

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6 backdrop-blur-sm bg-opacity-95">
      <TestRunHeader
        testRun={testRun}
        projectId={projectId}
        onTitleUpdate={onTitleUpdate}
        onMetadataEdit={onMetadataEdit}
        isEditingMetadata={isEditingMetadata}
      />

      <TestRunMetadata
        testRun={testRun}
        isEditing={isEditingMetadata}
        editedMetadata={editedMetadata}
        onMetadataChange={onMetadataChange}
        onSave={onSaveMetadata}
        onCancel={onCancelMetadata}
      />

      <TestRunStats stats={displayStats} totalExecutionTime={totalExecutionTime} />

      <TestRunActions
        testRun={testRun}
        projectId={projectId}
        testRunId={testRunId}
        isLoading={isLoading}
        isUpdatingStatus={isUpdatingStatus}
        isExecutionPaused={isExecutionPaused}
        pausedAt={pausedAt}
        onRefresh={onRefresh}
        onStart={onStart}
        onPause={onPause}
        onContinue={onContinue}
        onFinish={onFinish}
        onError={onError}
      />

      <FiltersSection
        statusFilter={statusFilter}
        assigneeFilter={assigneeFilter}
        assignees={assignees}
        onStatusFilterChange={onStatusFilterChange}
        onAssigneeFilterChange={onAssigneeFilterChange}
        onResetFilters={onResetFilters}
      />

      <BulkAssigneeSelector
        users={users}
        selectedCount={selectedTestCaseIds.size}
        bulkAssignee={bulkAssignee}
        onAssigneeChange={onBulkAssigneeChange}
        hasTestCases={hasTestCases}
      />

      <SuiteExpandControls
        hasTestCases={hasTestCases}
        onExpandAll={onExpandAll}
        onCollapseAll={onCollapseAll}
      />
    </div>
  )
}

