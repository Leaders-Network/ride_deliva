import type { Job } from 'bullmq';

// These processors only need job data, identity, attempt count, and progress updates.
export type ProcessorJob<T> = Pick<Job<T>, 'id' | 'data' | 'attemptsMade' | 'updateProgress'>;
