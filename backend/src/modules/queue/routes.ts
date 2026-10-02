import { Router } from 'express';
import { QueueController } from './controllers/queue.controller';
import { authenticate as requireAuth, requireAdmin } from '../../shared/middleware/auth.middleware';
import { rateLimiter } from '../../shared/middleware/rate-limiter';

const router = Router();
const queueController = new QueueController();

/**
 * Queue Management Routes
 * All routes require admin authentication
 */

// Apply admin authentication to all queue routes
router.use(requireAuth);
router.use(requireAdmin);

// Apply rate limiting to queue management operations
router.use(rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute for admin operations
  message: 'Too many queue management requests, please try again later',
}));

/**
 * @swagger
 * /api/v1/queues/statistics:
 *   get:
 *     summary: Get overall queue statistics
 *     tags: [Queue Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Queue statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalQueues:
 *                       type: number
 *                     totalJobs:
 *                       type: number
 *                     activeJobs:
 *                       type: number
 *                     completedJobs:
 *                       type: number
 *                     failedJobs:
 *                       type: number
 *                     waitingJobs:
 *                       type: number
 *                     delayedJobs:
 *                       type: number
 *                     queues:
 *                       type: array
 *                     timestamp:
 *                       type: string
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 */
router.get('/statistics', queueController.getStatistics.bind(queueController));

/**
 * @swagger
 * /api/v1/queues/{queueName}:
 *   get:
 *     summary: Get detailed statistics for a specific queue
 *     tags: [Queue Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queueName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the queue
 *     responses:
 *       200:
 *         description: Queue details retrieved successfully
 *       400:
 *         description: Invalid queue name
 *       401:
 *         description: Unauthorized - Admin access required
 *       404:
 *         description: Queue not found
 *       500:
 *         description: Internal server error
 */
router.get('/:queueName', queueController.getQueueDetails.bind(queueController));

/**
 * @swagger
 * /api/v1/queues/{queueName}/pause:
 *   post:
 *     summary: Pause a queue
 *     tags: [Queue Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queueName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the queue to pause
 *     responses:
 *       200:
 *         description: Queue paused successfully
 *       400:
 *         description: Invalid queue name
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 */
router.post('/:queueName/pause', queueController.pauseQueue.bind(queueController));

/**
 * @swagger
 * /api/v1/queues/{queueName}/resume:
 *   post:
 *     summary: Resume a paused queue
 *     tags: [Queue Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queueName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the queue to resume
 *     responses:
 *       200:
 *         description: Queue resumed successfully
 *       400:
 *         description: Invalid queue name
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 */
router.post('/:queueName/resume', queueController.resumeQueue.bind(queueController));

/**
 * @swagger
 * /api/v1/queues/{queueName}/clean:
 *   post:
 *     summary: Clean jobs from a queue
 *     tags: [Queue Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queueName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the queue to clean
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [completed, failed, active, waiting, delayed]
 *           default: completed
 *         description: Type of jobs to clean
 *       - in: query
 *         name: grace
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Grace period in milliseconds
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           maximum: 1000
 *         description: Maximum number of jobs to clean
 *     responses:
 *       200:
 *         description: Queue cleaned successfully
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 */
router.post('/:queueName/clean', queueController.cleanQueue.bind(queueController));

/**
 * @swagger
 * /api/v1/queues/{queueName}/jobs/{jobId}:
 *   get:
 *     summary: Get job details by ID
 *     tags: [Queue Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queueName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the queue
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the job
 *     responses:
 *       200:
 *         description: Job details retrieved successfully
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized - Admin access required
 *       404:
 *         description: Job not found
 *       500:
 *         description: Internal server error
 */
router.get('/:queueName/jobs/:jobId', queueController.getJob.bind(queueController));

/**
 * @swagger
 * /api/v1/queues/{queueName}/jobs/{jobId}/retry:
 *   post:
 *     summary: Retry a failed job
 *     tags: [Queue Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queueName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the queue
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the job to retry
 *     responses:
 *       200:
 *         description: Job retried successfully
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized - Admin access required
 *       404:
 *         description: Job not found
 *       500:
 *         description: Internal server error
 */
router.post('/:queueName/jobs/:jobId/retry', queueController.retryJob.bind(queueController));

/**
 * @swagger
 * /api/v1/queues/{queueName}/jobs/{jobId}/remove:
 *   delete:
 *     summary: Remove a job from the queue
 *     tags: [Queue Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queueName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the queue
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the job to remove
 *     responses:
 *       200:
 *         description: Job removed successfully
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized - Admin access required
 *       404:
 *         description: Job not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:queueName/jobs/:jobId/remove', queueController.removeJob.bind(queueController));

/**
 * @swagger
 * /api/v1/queues/{queueName}/test:
 *   post:
 *     summary: Add a test job to the queue (development only)
 *     tags: [Queue Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queueName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the queue
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobName
 *             properties:
 *               jobName:
 *                 type: string
 *                 description: Name of the test job
 *               data:
 *                 type: object
 *                 description: Job data
 *               options:
 *                 type: object
 *                 description: Job options
 *     responses:
 *       200:
 *         description: Test job added successfully
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized - Admin access required
 *       403:
 *         description: Not allowed in production
 *       500:
 *         description: Internal server error
 */
router.post('/:queueName/test', queueController.addTestJob.bind(queueController));

export default router;
