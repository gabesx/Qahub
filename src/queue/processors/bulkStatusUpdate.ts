import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface BulkStatusUpdateData {
  testRunId: string
  testCaseIds: string[]
  status: 'passed' | 'failed' | 'blocked' | 'skipped' | 'inProgress'
  executedBy?: string
}

export async function processBulkStatusUpdate(data: BulkStatusUpdateData) {
  const { testRunId, testCaseIds, status, executedBy } = data
  
  try {
    const results = await prisma.testRunResult.findMany({
      where: {
        testRunId: BigInt(testRunId),
        testCaseId: { in: testCaseIds.map(id => BigInt(id)) },
      },
    })
    
    const now = new Date()
    const updates = results.map((result) => {
      const updateData: any = {
        status,
        executedBy: executedBy ? BigInt(executedBy) : null,
      }
      
      // Set executedAt when transitioning from 'toDo' to 'inProgress'
      if (status === 'inProgress' && !result.executedAt) {
        updateData.executedAt = now
      }
      
      // Set completedAt and calculate executionTime for final statuses
      if (['passed', 'failed', 'blocked'].includes(status)) {
        updateData.completedAt = now
        
        if (result.executedAt) {
          const executionTime = Math.floor((now.getTime() - result.executedAt.getTime()) / 1000)
          updateData.executionTime = executionTime
        }
      }
      
      // Clear executionTime for skipped
      if (status === 'skipped') {
        updateData.executionTime = null
        updateData.completedAt = null
      }
      
      return prisma.testRunResult.update({
        where: { id: result.id },
        data: updateData,
      })
    })
    
    await Promise.all(updates)
    
    return {
      success: true,
      updated: updates.length,
    }
  } catch (error) {
    console.error('Bulk status update error:', error)
    throw error
  }
}

