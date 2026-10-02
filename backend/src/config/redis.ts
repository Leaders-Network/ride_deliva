import Redis from 'ioredis';
import { logger } from './logger';

// Redis configuration
export const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  commandTimeout: 5000,
};

// Main Redis client for general operations
export const redis = new Redis({
  ...redisConfig,
  keyPrefix: 'ride_deliva:',
});

// Separate Redis client for pub/sub operations
export const redisPubSub = new Redis({
  ...redisConfig,
  keyPrefix: 'ride_deliva:pubsub:',
});

// Separate Redis client for BullMQ job queue
export const redisQueue = new Redis({
  ...redisConfig,
  keyPrefix: 'ride_deliva:queue:',
  db: 1, // Use different database for queue operations
});

// Redis connection event handlers
redis.on('connect', () => {
  logger.info('Redis client connected');
});

redis.on('ready', () => {
  logger.info('Redis client ready');
});

redis.on('error', (error) => {
  logger.error('Redis client error:', error);
});

redis.on('close', () => {
  logger.info('Redis client connection closed');
});

redis.on('reconnecting', () => {
  logger.info('Redis client reconnecting...');
});

// PubSub Redis event handlers
redisPubSub.on('connect', () => {
  logger.info('Redis PubSub client connected');
});

redisPubSub.on('error', (error) => {
  logger.error('Redis PubSub client error:', error);
});

// Queue Redis event handlers
redisQueue.on('connect', () => {
  logger.info('Redis Queue client connected');
});

redisQueue.on('error', (error) => {
  logger.error('Redis Queue client error:', error);
});

// Redis utility functions
export const redisUtils = {
  // Set key with expiration
  async setWithExpiry(key: string, value: string, expirySeconds: number): Promise<void> {
    await redis.setex(key, expirySeconds, value);
  },

  // Get key value
  async get(key: string): Promise<string | null> {
    return await redis.get(key);
  },

  // Delete key
  async delete(key: string): Promise<number> {
    return await redis.del(key);
  },

  // Check if key exists
  async exists(key: string): Promise<boolean> {
    const result = await redis.exists(key);
    return result === 1;
  },

  // Set hash field
  async setHash(key: string, field: string, value: string): Promise<void> {
    await redis.hset(key, field, value);
  },

  // Get hash field
  async getHash(key: string, field: string): Promise<string | null> {
    return await redis.hget(key, field);
  },

  // Get all hash fields
  async getAllHash(key: string): Promise<Record<string, string>> {
    return await redis.hgetall(key);
  },

  // Add to set
  async addToSet(key: string, value: string): Promise<number> {
    return await redis.sadd(key, value);
  },

  // Remove from set
  async removeFromSet(key: string, value: string): Promise<number> {
    return await redis.srem(key, value);
  },

  // Get set members
  async getSetMembers(key: string): Promise<string[]> {
    return await redis.smembers(key);
  },

  // Check set membership
  async isInSet(key: string, value: string): Promise<boolean> {
    const result = await redis.sismember(key, value);
    return result === 1;
  },

  // Publish message
  async publish(channel: string, message: string): Promise<number> {
    return await redisPubSub.publish(channel, message);
  },

  // Set location data for geospatial operations
  async setLocation(key: string, longitude: number, latitude: number, member: string): Promise<number> {
    return await redis.geoadd(key, longitude, latitude, member);
  },

  // Find nearby locations
  async findNearby(
    key: string,
    longitude: number,
    latitude: number,
    radius: number,
    unit: 'm' | 'km' | 'mi' | 'ft' = 'm'
  ): Promise<string[]> {
    const result = await redis.georadius(key, longitude, latitude, radius, unit);
    return result as string[];
  },
};

// Redis connection test function
export const testRedisConnection = async (): Promise<boolean> => {
  try {
    await redis.ping();
    logger.info('Redis connection established successfully');
    return true;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    return false;
  }
};

// Redis health check function
export const checkRedisHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
}> => {
  try {
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;
    
    return {
      status: 'healthy',
      latency,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Graceful shutdown function
export const closeRedisConnections = async (): Promise<void> => {
  try {
    await Promise.all([
      redis.disconnect(),
      redisPubSub.disconnect(),
      redisQueue.disconnect(),
    ]);
    logger.info('All Redis connections closed');
  } catch (error) {
    logger.error('Error closing Redis connections:', error);
  }
};

export default redis;
