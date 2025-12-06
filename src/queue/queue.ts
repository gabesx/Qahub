import { Queue, QueueOptions } from 'bullmq'
import Redis from 'ioredis'

// Redis connection configuration
const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

// Queue configuration
const queueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep max 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
}

// Export queues
export const testRunQueue = new Queue('test-run-jobs', queueOptions)
export const exportQueue = new Queue('export-jobs', queueOptions)
export const scheduledRunQueue = new Queue('scheduled-run-jobs', queueOptions)

// Export Redis connection for workers
export { redisConnection }

