import request from 'supertest';
import app from '../app';

describe('Express App', () => {
  describe('GET /', () => {
    it('should return app information', async () => {
      const response = await request(app.app)
        .get('/')
        .expect(200);

      expect(response.body).toMatchObject({
        name: expect.any(String),
        version: expect.any(String),
        environment: expect.any(String),
        timestamp: expect.any(String),
        endpoints: expect.any(Object),
      });
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app.app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: expect.stringMatching(/^(healthy|unhealthy)$/),
        timestamp: expect.any(String),
        services: expect.any(Object),
      });
    });
  });

  describe('GET /health/readiness', () => {
    it('should return readiness status', async () => {
      const response = await request(app.app)
        .get('/health/readiness')
        .expect(200);

      expect(response.body).toMatchObject({
        ready: expect.any(Boolean),
      });
    });
  });

  describe('GET /health/liveness', () => {
    it('should return liveness status', async () => {
      const response = await request(app.app)
        .get('/health/liveness')
        .expect(200);

      expect(response.body).toMatchObject({
        alive: expect.any(Boolean),
      });
    });
  });

  describe('GET /api/v1', () => {
    it('should return API information', async () => {
      const response = await request(app.app)
        .get('/api/v1')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Ride Deliva API',
        version: expect.any(String),
        endpoints: expect.any(Object),
      });
    });
  });

  describe('GET /api/v1/auth', () => {
    it('should return auth endpoints', async () => {
      const response = await request(app.app)
        .get('/api/v1/auth')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.endpoints).toBeDefined();
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app.app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toMatchObject({
        error: {
          code: 'NOT_FOUND',
          message: expect.stringContaining('not found'),
          statusCode: 404,
        },
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app.app)
        .post('/api/v1/auth/login')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.error.code).toBe('BAD_REQUEST');
    });
  });
});