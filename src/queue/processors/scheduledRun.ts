import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function processScheduledRun(
  scheduleId: string,
  templateId: string,
  projectId: string
) {
  try {
    // Fetch scheduled run and template
    const scheduledRun = await prisma.scheduledTestRun.findUnique({
      where: { id: BigInt(scheduleId) },
      include: {
        template: {
          include: {
            testPlan: {
              include: {
                testPlanCases: {
                  include: {
                    testCase: true,
                  },
                },
              },
            },
          },
        },
      },
    })
    
    if (!scheduledRun) {
      throw new Error(`Scheduled run ${scheduleId} not found`)
    }
    
    const template = scheduledRun.template
    
    // Generate test run title from pattern
    const now = new Date()
    const titlePattern = template.titlePattern || 'Test Run - {date}'
    const title = titlePattern
      .replace('{date}', now.toISOString().split('T')[0])
      .replace('{timestamp}', now.toISOString())
    
    // Create test run from template
    const testRun = await prisma.testRun.create({
      data: {
        testPlanId: template.testPlanId,
        projectId: BigInt(projectId),
        repositoryId: template.repositoryId,
        title,
        status: 'pending',
        environment: template.environment,
        buildVersion: template.buildVersion,
        executionDate: now,
      },
    })
    
    // Create initial results for all test cases in the test plan
    const testCaseIds = template.testPlan.testPlanCases.map(tpc => tpc.testCaseId)
    
    await prisma.testRunResult.createMany({
      data: testCaseIds.map((testCaseId) => ({
        testRunId: testRun.id,
        testCaseId,
        status: 'toDo',
      })),
    })
    
    // Update scheduled run
    await prisma.scheduledTestRun.update({
      where: { id: BigInt(scheduleId) },
      data: {
        lastRunAt: now,
        lastRunId: testRun.id,
        runCount: scheduledRun.runCount + 1,
        nextRunAt: calculateNextRun(scheduledRun.frequency, scheduledRun.schedule),
      },
    })
    
    return {
      success: true,
      testRunId: testRun.id.toString(),
    }
  } catch (error) {
    console.error('Scheduled run error:', error)
    throw error
  }
}

function calculateNextRun(frequency: string, schedule: string): Date {
  const now = new Date()
  
  try {
    const scheduleConfig = JSON.parse(schedule)
    
    switch (frequency) {
      case 'daily':
        const nextDay = new Date(now)
        nextDay.setDate(nextDay.getDate() + 1)
        nextDay.setHours(scheduleConfig.hour || 0, scheduleConfig.minute || 0, 0, 0)
        return nextDay
      
      case 'weekly':
        const nextWeek = new Date(now)
        const daysUntilNext = (scheduleConfig.dayOfWeek || 1) - now.getDay()
        nextWeek.setDate(nextWeek.getDate() + (daysUntilNext > 0 ? daysUntilNext : daysUntilNext + 7))
        nextWeek.setHours(scheduleConfig.hour || 0, scheduleConfig.minute || 0, 0, 0)
        return nextWeek
      
      case 'monthly':
        const nextMonth = new Date(now)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        nextMonth.setDate(scheduleConfig.dayOfMonth || 1)
        nextMonth.setHours(scheduleConfig.hour || 0, scheduleConfig.minute || 0, 0, 0)
        return nextMonth
      
      case 'custom':
        // For custom, expect a cron expression or specific date
        if (scheduleConfig.nextRun) {
          return new Date(scheduleConfig.nextRun)
        }
        // Default to next day if no specific schedule
        const next = new Date(now)
        next.setDate(next.getDate() + 1)
        return next
      
      default:
        const defaultNext = new Date(now)
        defaultNext.setDate(defaultNext.getDate() + 1)
        return defaultNext
    }
  } catch (error) {
    // If schedule parsing fails, default to next day
    const defaultNext = new Date(now)
    defaultNext.setDate(defaultNext.getDate() + 1)
    return defaultNext
  }
}

