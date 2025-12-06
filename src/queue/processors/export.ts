import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

export type ExportFormat = 'csv' | 'pdf' | 'jira'

export interface ExportData {
  testRunId: string
  projectId: string
  repositoryId: string
}

export async function processExport(format: ExportFormat, data: ExportData) {
  const { testRunId, projectId, repositoryId } = data
  
  try {
    // Fetch test run with all related data
    const testRun = await prisma.testRun.findUnique({
      where: { id: BigInt(testRunId) },
      include: {
        testPlan: {
          include: {
            testPlanCases: {
              include: {
                testCase: {
                  include: {
                    suite: true,
                  },
                },
              },
            },
          },
        },
        results: {
          include: {
            testCase: true,
          },
        },
      },
    })
    
    if (!testRun) {
      throw new Error(`Test run ${testRunId} not found`)
    }
    
    // Prepare export data
    const exportData = {
      testRun: {
        id: testRun.id.toString(),
        title: testRun.title,
        status: testRun.status,
        executionDate: testRun.executionDate?.toISOString(),
        startedAt: testRun.startedAt?.toISOString(),
        completedAt: testRun.completedAt?.toISOString(),
        environment: testRun.environment,
        buildVersion: testRun.buildVersion,
      },
      testPlan: {
        id: testRun.testPlan.id.toString(),
        title: testRun.testPlan.title,
      },
      testCases: testRun.results.map((result) => ({
        id: result.testCase.id.toString(),
        title: result.testCase.title,
        status: result.status,
        executionTime: result.executionTime,
        executedAt: result.executedAt?.toISOString(),
        executedBy: result.executedBy?.toString(),
      })),
    }
    
    // Generate export based on format
    // For now, return file path - in production, this would upload to S3 or return download URL
    const exportDir = path.join(process.cwd(), 'exports')
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true })
    }
    
    const filename = `test-run-${testRunId}-${Date.now()}.${format}`
    const filepath = path.join(exportDir, filename)
    
    switch (format) {
      case 'csv':
        // Generate CSV
        const csvContent = generateCSV(exportData)
        fs.writeFileSync(filepath, csvContent)
        return { filepath, filename, format: 'csv' }
      
      case 'pdf':
        // PDF generation would require a library like pdfkit or puppeteer
        // For now, return placeholder
        return { filepath: null, filename, format: 'pdf', message: 'PDF export not yet implemented' }
      
      case 'jira':
        // Generate JIRA format
        const jiraContent = generateJIRA(exportData)
        fs.writeFileSync(filepath, jiraContent)
        return { filepath, filename, format: 'jira' }
      
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  } catch (error) {
    console.error('Export error:', error)
    throw error
  }
}

function generateCSV(data: any): string {
  const headers = ['Test Case ID', 'Title', 'Status', 'Execution Time', 'Executed At', 'Executed By']
  const rows = data.testCases.map((tc: any) => [
    tc.id,
    tc.title,
    tc.status,
    tc.executionTime || '',
    tc.executedAt || '',
    tc.executedBy || '',
  ])
  
  return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
}

function generateJIRA(data: any): string {
  let output = `Test Run: ${data.testRun.title}\n`
  output += `Test Plan: ${data.testPlan.title}\n`
  output += `Status: ${data.testRun.status}\n\n`
  
  data.testCases.forEach((tc: any) => {
    output += `* ${tc.title} [${tc.status}]\n`
    if (tc.executionTime) {
      output += `  Execution Time: ${tc.executionTime}s\n`
    }
  })
  
  return output
}

