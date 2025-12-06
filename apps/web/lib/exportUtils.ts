/**
 * Export utilities for test run results
 */

export interface TestRunExportData {
  testRun: {
    id: string
    title: string
    status: string
    createdAt: string
    startedAt?: string | null
    completedAt?: string | null
  }
  testCases: Array<{
    id: string
    jiraKey?: string
    title: string
    suite: string
    status: string
    priority?: number
    severity?: string
    automated: boolean
    executedBy?: string
    executedAt?: string | null
    executionTime?: number | null
    errorMessage?: string | null
  }>
}

/**
 * Export test run results to CSV
 */
export function exportToCSV(data: TestRunExportData): void {
  const headers = [
    'Test Case ID',
    'JIRA Key',
    'Title',
    'Suite',
    'Status',
    'Priority',
    'Severity',
    'Automated',
    'Assignee',
    'Executed At',
    'Execution Time (seconds)',
    'Error Message',
  ]

  const rows = data.testCases.map((tc) => [
    tc.id,
    tc.jiraKey || '',
    `"${(tc.title || '').replace(/"/g, '""')}"`, // Escape quotes in CSV
    tc.suite || '',
    tc.status || '',
    tc.priority?.toString() || '',
    tc.severity || '',
    tc.automated ? 'Yes' : 'No',
    tc.executedBy || '',
    tc.executedAt || '',
    tc.executionTime?.toString() || '',
    tc.errorMessage ? `"${tc.errorMessage.replace(/"/g, '""')}"` : '',
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `test-run-${data.testRun.id}-${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export test run results to JIRA format
 */
export function exportToJIRA(data: TestRunExportData): void {
  const jiraContent = [
    `h2. Test Run: ${data.testRun.title}`,
    `*Status:* ${data.testRun.status}`,
    `*Created:* ${new Date(data.testRun.createdAt).toLocaleString()}`,
    data.testRun.startedAt ? `*Started:* ${new Date(data.testRun.startedAt).toLocaleString()}` : '',
    data.testRun.completedAt ? `*Completed:* ${new Date(data.testRun.completedAt).toLocaleString()}` : '',
    '',
    'h3. Test Cases',
    '',
    '||Test Case ID||JIRA Key||Title||Suite||Status||Priority||Severity||Automated||Assignee||Executed At||Execution Time||',
    ...data.testCases.map((tc) => {
      const statusIcon = {
        passed: '✅',
        failed: '❌',
        blocked: '🚫',
        skipped: '⏭️',
        toDo: '📋',
        inProgress: '🔄',
      }[tc.status] || '❓'

      return [
        tc.id,
        tc.jiraKey || '',
        tc.title || '',
        tc.suite || '',
        `${statusIcon} ${tc.status}`,
        tc.priority?.toString() || '',
        tc.severity || '',
        tc.automated ? 'Yes' : 'No',
        tc.executedBy || '',
        tc.executedAt ? new Date(tc.executedAt).toLocaleString() : '',
        tc.executionTime ? `${tc.executionTime}s` : '',
      ].join('||')
    }),
  ]
    .filter(Boolean)
    .join('\n')

  const blob = new Blob([jiraContent], { type: 'text/plain;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `test-run-${data.testRun.id}-jira-${new Date().toISOString().split('T')[0]}.txt`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export test run results to PDF (using browser print)
 */
export function exportToPDF(data: TestRunExportData): void {
  // Create a printable HTML document
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Run Report: ${data.testRun.title}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { color: #666; margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .status-passed { color: green; font-weight: bold; }
    .status-failed { color: red; font-weight: bold; }
    .status-blocked { color: orange; font-weight: bold; }
    .status-skipped { color: blue; font-weight: bold; }
    .status-toDo { color: gray; }
    .status-inProgress { color: purple; font-weight: bold; }
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>Test Run Report</h1>
  <div>
    <p><strong>Test Run:</strong> ${data.testRun.title}</p>
    <p><strong>Status:</strong> ${data.testRun.status}</p>
    <p><strong>Created:</strong> ${new Date(data.testRun.createdAt).toLocaleString()}</p>
    ${data.testRun.startedAt ? `<p><strong>Started:</strong> ${new Date(data.testRun.startedAt).toLocaleString()}</p>` : ''}
    ${data.testRun.completedAt ? `<p><strong>Completed:</strong> ${new Date(data.testRun.completedAt).toLocaleString()}</p>` : ''}
  </div>
  
  <h2>Test Cases (${data.testCases.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Test Case ID</th>
        <th>JIRA Key</th>
        <th>Title</th>
        <th>Suite</th>
        <th>Status</th>
        <th>Priority</th>
        <th>Severity</th>
        <th>Automated</th>
        <th>Assignee</th>
        <th>Executed At</th>
        <th>Execution Time</th>
      </tr>
    </thead>
    <tbody>
      ${data.testCases
        .map(
          (tc) => `
        <tr>
          <td>${tc.id}</td>
          <td>${tc.jiraKey || ''}</td>
          <td>${tc.title || ''}</td>
          <td>${tc.suite || ''}</td>
          <td class="status-${tc.status}">${tc.status || ''}</td>
          <td>${tc.priority || ''}</td>
          <td>${tc.severity || ''}</td>
          <td>${tc.automated ? 'Yes' : 'No'}</td>
          <td>${tc.executedBy || ''}</td>
          <td>${tc.executedAt ? new Date(tc.executedAt).toLocaleString() : ''}</td>
          <td>${tc.executionTime ? `${tc.executionTime}s` : ''}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>
</body>
</html>
  `

  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(htmlContent)
    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.print()
    }
  }
}

