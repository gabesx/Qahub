import { Worker, WorkerOptions } from 'bullmq'
import { redisConnection } from './queue'
import { processBulkStatusUpdate } from './processors/bulkStatusUpdate'
import { processBulkDelete } from './processors/bulkDelete'
import { processExport } from './processors/export'
import { processScheduledRun } from './processors/scheduledRun'

// Worker configuration
const workerOptions: WorkerOptions = {
  connection: redisConnection,
  concurrency: 5, // Process up to 5 jobs concurrently
  limiter: {
    max: 10, // Max 10 jobs
    duration: 1000, // Per second
  },
}

// Test Run Workers
export const testRunWorker = new Worker(
  'test-run-jobs',
  async (job) => {
    const { type, data } = job.data
    
    switch (type) {
      case 'bulk-status-update':
        return await processBulkStatusUpdate(data)
      case 'bulk-delete':
        return await processBulkDelete(data)
      default:
        throw new Error(`Unknown job type: ${type}`)
    }
  },
  workerOptions
)

// Export Workers
export const exportWorker = new Worker(
  'export-jobs',
  async (job) => {
    const { format, data } = job.data
    return await processExport(format, data)
  },
  workerOptions
)

// Scheduled Run Workers
export const scheduledRunWorker = new Worker(
  'scheduled-run-jobs',
  async (job) => {
    const { scheduleId, templateId, projectId } = job.data
    return await processScheduledRun(scheduleId, templateId, projectId)
  },
  workerOptions
)

// Worker event handlers
testRunWorker.on('completed', (job) => {
  console.log(`Test run job ${job.id} completed`)
})

testRunWorker.on('failed', (job, err) => {
  console.error(`Test run job ${job?.id} failed:`, err)
})

exportWorker.on('completed', (job) => {
  console.log(`Export job ${job.id} completed`)
})

exportWorker.on('failed', (job, err) => {
  console.error(`Export job ${job?.id} failed:`, err)
})

scheduledRunWorker.on('completed', (job) => {
  console.log(`Scheduled run job ${job.id} completed`)
})

scheduledRunWorker.on('failed', (job, err) => {
  console.error(`Scheduled run job ${job?.id} failed:`, err)
})

