# Job Queue System Documentation

The Ride Deliva platform uses BullMQ with Redis for robust background job processing. This system handles SMS notifications, email sending, ride processing, payment operations, and delivery management.

## Overview

### Architecture
- **Queue Engine**: BullMQ with Redis backend
- **Processors**: Individual job processors for different operations
- **Monitoring**: Bull Board dashboard for queue management
- **Scheduling**: Utilities for easy job scheduling and management

### Key Features
- ✅ Reliable job processing with retries
- ✅ Real-time queue monitoring dashboard
- ✅ Batch processing capabilities
- ✅ Delayed and scheduled jobs
- ✅ Job progress tracking
- ✅ Error handling and dead letter queues
- ✅ Horizontal scaling support

## Queue Types

### 1. SMS Queue (`sms`)
Handles SMS notifications and verification codes.

**Job Types:**
- `verification` - Phone verification codes
- `notification` - Ride/delivery status updates
- `alert` - Emergency or urgent notifications
- `marketing` - Promotional messages

**Configuration:**
- Concurrency: 10 workers
- Retry attempts: 5
- Backoff: Exponential (1s initial delay)

### 2. Email Queue (`email`)
Processes email notifications and receipts.

**Job Types:**
- `transactional` - Account verification, password reset
- `marketing` - Promotional campaigns
- `system` - Admin alerts, system notifications
- `receipt` - Ride/delivery receipts
- `notification` - Status updates

**Configuration:**
- Concurrency: 5 workers
- Retry attempts: 3
- Backoff: Exponential (2s initial delay)

### 3. Notification Queue (`notification`)
Handles push notifications and in-app messages.

**Job Types:**
- `push` - Push notifications to users
- `in_app` - In-app notification storage
- `broadcast` - Broadcast to all users or topics

**Configuration:**
- Concurrency: 15 workers
- Retry attempts: 3
- Backoff: Exponential (1s initial delay)

### 4. Ride Queue (`ride`)
Processes ride-related operations.

**Job Types:**
- `match_driver` - Find and assign drivers
- `update_status` - Update ride status
- `calculate_fare` - Calculate ride fare
- `cancel_ride` - Handle ride cancellations
- `complete_ride` - Process ride completion
- `driver_assignment` - Assign driver to ride
- `route_optimization` - Optimize routes

**Configuration:**
- Concurrency: 8 workers
- Retry attempts: 5
- Backoff: Exponential (2s initial delay)

### 5. Payment Queue (`payment`)
Handles payment processing and financial operations.

**Job Types:**
- `process_ride_payment` - Process ride payments
- `process_refund` - Handle refunds
- `wallet_top_up` - Process wallet top-ups
- `driver_payout` - Driver earnings payouts
- `payment_verification` - Verify payment status
- `failed_payment_retry` - Retry failed payments

**Configuration:**
- Concurrency: 3 workers (limited for financial security)
- Retry attempts: 5
- Backoff: Exponential (5s initial delay)

### 6. Delivery Queue (`delivery`)
Manages delivery and courier operations.

**Job Types:**
- `assign_courier` - Find and assign couriers
- `update_status` - Update delivery status
- `calculate_delivery_fee` - Calculate delivery costs
- `optimize_route` - Optimize delivery routes
- `handle_delivery_completion` - Complete deliveries
- `process_failed_delivery` - Handle failed deliveries

**Configuration:**
- Concurrency: 6 workers
- Retry attempts: 4
- Backoff: Exponential (3s initial delay)

## Usage Examples

### Basic Job Scheduling

```typescript
import { JobScheduler } from '@/shared/utils/job-scheduler';

// Schedule SMS verification
const smsJob = await JobScheduler.scheduleSMS({
  type: 'verification',
  to: '+2348012345678',
  message: 'Your verification code is: 123456',
  userId: 'user-123',
});

// Schedule push notification
const notificationJob = await JobScheduler.schedulePushNotification(
  'user-123',
  'Ride Update',
  'Your driver is arriving soon',
  { rideId: 'ride-456' },
  { priority: 'high' }
);
```

### Using Queue Helpers

```typescript
import { 
  AuthQueueHelpers, 
  RideQueueHelpers, 
  PaymentQueueHelpers 
} from '@/shared/utils/queue-helpers';

// Handle user registration
await AuthQueueHelpers.sendVerificationCode('+2348012345678', '123456', 'user-123');
await AuthQueueHelpers.sendWelcomeEmail('user@example.com', 'John Doe', 'user-123');

// Handle ride workflow
const rideResult = await RideQueueHelpers.handleNewRideRequest(
  'ride-123',
  6.5244,  // Lagos latitude
  3.3792   // Lagos longitude
);

// Process payment
const paymentResult = await PaymentQueueHelpers.processRidePayment(
  'ride-123',
  2500,     // 25 Naira in kobo
  'user-123',
  'card'
);
```

### Batch Operations

```typescript
// Send notifications to multiple users
const jobs = await JobScheduler.scheduleBatchNotifications(
  ['user-1', 'user-2', 'user-3'],
  'Special Offer',
  'Get 20% off your next ride!',
  { promoCode: 'SAVE20' },
  { batchSize: 100 }
);

// Schedule multiple jobs
const batchJobs = await JobScheduler.scheduleBatchJobs('sms', [
  {
    name: 'verification',
    data: { type: 'verification', to: '+2348011111111', message: 'Code: 111111' }
  },
  {
    name: 'verification', 
    data: { type: 'verification', to: '+2348022222222', message: 'Code: 222222' }
  }
]);
```

### Delayed and Recurring Jobs

```typescript
// Schedule delayed job
const delayedJob = await JobScheduler.scheduleDelayedJob(
  'notification',
  'reminder',
  { message: 'Don\'t forget to rate your driver!' },
  300000 // 5 minutes delay
);

// Schedule recurring job
const recurringJob = await JobScheduler.scheduleRecurringJob(
  'email',
  'daily_report',
  { type: 'system', to: 'admin@ridedeliva.com', subject: 'Daily Report' },
  '0 9 * * *' // Daily at 9 AM
);
```

### Job Status Monitoring

```typescript
import { JobStatusChecker } from '@/shared/utils/job-scheduler';

// Check job progress
const progress = await JobStatusChecker.getJobProgress('sms', 'job-123');
console.log(`Job progress: ${progress.progress}%, Status: ${progress.status}`);

// Wait for job completion
try {
  const result = await JobStatusChecker.waitForJobCompletion('sms', 'job-123', 30000);
  console.log('Job completed:', result);
} catch (error) {
  console.log('Job failed or timed out:', error.message);
}

// Check multiple job statuses
const jobs = [
  { queueName: 'sms', jobId: 'job-1' },
  { queueName: 'email', jobId: 'job-2' }
];
const statuses = await checkJobStatuses(jobs);
```

## Queue Management

### Bull Board Dashboard

Access the queue monitoring dashboard at `/admin/queues` (requires admin authentication).

**Features:**
- View queue statistics and job counts
- Monitor job progress and failures
- Retry failed jobs
- Clean up completed/failed jobs
- Pause/resume queues
- Real-time updates

**Authentication:**
- Requires admin role JWT token
- Can be passed via Authorization header or `?token=` query parameter
- Can be disabled in development with `BULL_BOARD_AUTH_DISABLED=true`

### API Endpoints

```
GET    /api/v1/queues/statistics           # Get overall statistics
GET    /api/v1/queues/:queueName           # Get specific queue details
POST   /api/v1/queues/:queueName/pause     # Pause a queue
POST   /api/v1/queues/:queueName/resume    # Resume a queue
POST   /api/v1/queues/:queueName/clean     # Clean completed/failed jobs
GET    /api/v1/queues/:queueName/jobs/:id  # Get job details
POST   /api/v1/queues/:queueName/jobs/:id/retry   # Retry a failed job
DELETE /api/v1/queues/:queueName/jobs/:id/remove  # Remove a job
```

### Programmatic Management

```typescript
import { queueService } from '@/config/queues';

// Get queue statistics
const stats = await queueService.getQueueStats('sms');
const allStats = await queueService.getAllQueueStats();

// Pause/resume queues
await queueService.pauseQueue('sms');
await queueService.resumeQueue('sms');

// Clean up old jobs
await queueService.cleanQueue('sms', 0, 100, 'completed');

// Job operations
const job = await queueService.getJob('sms', 'job-123');
await queueService.retryJob('sms', 'job-123');
await queueService.removeJob('sms', 'job-123');
```

## Error Handling

### Automatic Retries
Jobs automatically retry on failure with exponential backoff:

```typescript
// Default retry configuration
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000, // 2s, 4s, 8s, 16s...
  }
}

// Custom retry configuration
const job = await queueService.addJob('sms', 'test', data, {
  attempts: 5,
  backoff: {
    type: 'fixed',
    delay: 5000, // 5s between retries
  }
});
```

### Error Monitoring
- Failed jobs are logged with full error details
- Jobs that exceed max attempts go to failed state
- Failed jobs can be retried manually via dashboard or API
- Error patterns are monitored for system health

### Graceful Degradation
```typescript
try {
  await JobScheduler.scheduleSMS(smsData);
} catch (error) {
  // Fallback: store in database for manual processing
  await storeFailedNotification(smsData, error);
  logger.error('SMS scheduling failed, stored for retry', { error });
}
```

## Testing

### Unit Tests
Run queue system tests:
```bash
npm run test:queues
```

### Integration Tests
```bash
npm test -- queue.test.ts
```

### Manual Testing Script
```bash
npm run test:queues
```

This runs comprehensive tests including:
- Basic job scheduling
- Complete ride/delivery workflows
- Payment processing
- Batch operations
- Error handling
- Queue management

## Performance Optimization

### Scaling
1. **Horizontal Scaling**: Add more worker instances
2. **Queue Separation**: Distribute load across multiple Redis instances
3. **Priority Queues**: Use job priorities for critical operations

### Monitoring Metrics
- Job processing rate (jobs/second)
- Queue depth (waiting jobs)
- Failed job rate
- Processing duration
- Memory usage

### Best Practices
1. **Job Size**: Keep job data small (< 1MB)
2. **Idempotency**: Make jobs idempotent for safe retries
3. **Timeouts**: Set appropriate job timeouts
4. **Batching**: Use batch operations for bulk operations
5. **Monitoring**: Monitor queue health and performance

## Configuration

### Environment Variables
```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
REDIS_DB=0

# Queue Configuration
BULL_BOARD_AUTH_DISABLED=false  # Disable auth in development
MAX_CONCURRENT_JOBS=50          # Global job limit
JOB_TIMEOUT_MS=300000          # Default job timeout (5 minutes)

# External Service Configuration
TWILIO_ACCOUNT_SID=your-sid    # SMS service
TWILIO_AUTH_TOKEN=your-token
SENDGRID_API_KEY=your-key      # Email service
```

### Queue Settings
Customize queue behavior in `src/config/queues.ts`:

```typescript
const queueConfigs: QueueConfig[] = [
  {
    name: 'sms',
    concurrency: 10,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 200,
      removeOnFail: 100,
    },
  },
  // ... other queues
];
```

## Troubleshooting

### Common Issues

1. **Jobs Not Processing**
   - Check Redis connection
   - Verify queue is not paused
   - Check worker concurrency limits

2. **High Failure Rate**
   - Review error logs
   - Check external service availability
   - Verify job data format

3. **Memory Issues**
   - Clean old completed/failed jobs
   - Reduce job retention counts
   - Monitor Redis memory usage

4. **Performance Issues**
   - Increase worker concurrency
   - Optimize job processors
   - Use batch operations

### Debug Mode
Enable debug logging:
```env
DEBUG=bull*
LOG_LEVEL=debug
```

### Health Checks
Monitor queue health:
```typescript
// Built-in health check endpoint
GET /api/v1/queues/statistics

// Custom health monitoring
const healthStatus = await SystemQueueHelpers.getQueueHealthStatus();
```

## Migration and Deployment

### Production Deployment
1. **Redis Setup**: Use Redis Cluster for high availability
2. **Worker Scaling**: Deploy multiple worker instances
3. **Monitoring**: Set up queue monitoring and alerting
4. **Backup**: Backup queue data regularly

### Zero-Downtime Updates
1. **Graceful Shutdown**: Wait for jobs to complete
2. **Rolling Deployment**: Update workers incrementally
3. **Job Migration**: Migrate pending jobs if needed

### Disaster Recovery
1. **Queue Persistence**: Enable Redis persistence
2. **Job Replay**: Implement job replay mechanisms
3. **Monitoring**: Monitor for job loss/corruption

---

For more information, see the [API documentation](/api-docs) and [system architecture](/docs/ARCHITECTURE.md).