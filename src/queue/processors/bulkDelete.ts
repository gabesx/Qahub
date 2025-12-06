import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface BulkDeleteData {
  testRunId: string
  resultIds: string[]
}

export async function processBulkDelete(data: BulkDeleteData) {
  const { testRunId, resultIds } = data
  
  try {
    await prisma.testRunResult.deleteMany({
      where: {
        id: { in: resultIds.map(id => BigInt(id)) },
        testRunId: BigInt(testRunId),
      },
    })
    
    return {
      success: true,
      deleted: resultIds.length,
    }
  } catch (error) {
    console.error('Bulk delete error:', error)
    throw error
  }
}

