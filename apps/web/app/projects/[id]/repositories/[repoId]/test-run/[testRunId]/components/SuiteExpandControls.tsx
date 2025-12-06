interface SuiteExpandControlsProps {
  hasTestCases: boolean
  onExpandAll: () => void
  onCollapseAll: () => void
}

export default function SuiteExpandControls({
  hasTestCases,
  onExpandAll,
  onCollapseAll,
}: SuiteExpandControlsProps) {
  if (!hasTestCases) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onExpandAll}
        className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all font-medium shadow-sm hover:shadow-md"
      >
        Expand All
      </button>
      <button
        onClick={onCollapseAll}
        className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all font-medium shadow-sm hover:shadow-md"
      >
        Collapse All
      </button>
    </div>
  )
}

