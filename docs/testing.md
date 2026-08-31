# Ride Deliva Testing Strategy

## Testing Philosophy

Our testing approach follows the testing pyramid:
- **70% Unit Tests**: Fast, isolated, comprehensive coverage
- **20% Integration Tests**: API endpoints, database interactions
- **10% E2E Tests**: Critical user journeys, cross-platform testing

## Backend Testing

### Test Structure
```
backend/
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── utils/
│   │   └── validators/
│   ├── integration/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── orders/
│   │   └── queues/
│   ├── fixtures/
│   │   ├── users.json
│   │   ├── orders.json
│   │   └── drivers.json
│   └── helpers/
│       ├── database.ts
│       ├── auth.ts
│       └── setup.ts
└── jest.config.js
```

### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/setup.ts'],
  testTimeout: 10000,
};
```

### Unit Test Examples

#### Service Testing
```typescript
// tests/unit/services/auth.service.test.ts
import { AuthService } from '../../../src/services/auth.service';
import { prisma } from '../../../src/config/database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

jest.mock('../../../src/config/database');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  let authService: AuthService;
  
  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('generateOTP', () => {
    it('should generate a 6-digit OTP', () => {
      const otp = authService.generateOTP();
      expect(otp).toMatch(/^\d{6}$/);
    });
  });

  describe('verifyOTP', () => {
    it('should return true for valid OTP', async () => {
      const mockUser = { id: '123', phone: '+2348012345678', otp: '123456' };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.verifyOTP('+2348012345678', '123456');
      expect(result).toBe(true);
    });

    it('should return false for invalid OTP', async () => {
      const mockUser = { id: '123', phone: '+2348012345678', otp: '123456' };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.verifyOTP('+2348012345678', '654321');
      expect(result).toBe(false);
    });
  });
});
```

#### Middleware Testing
```typescript
// tests/unit/middleware/auth.middleware.test.ts
import { authMiddleware } from '../../../src/shared/middleware/auth.middleware';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

jest.mock('jsonwebtoken');

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  it('should pass with valid token', async () => {
    const mockPayload = { userId: '123', phone: '+2348012345678' };
    (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
    mockRequest.headers = { authorization: 'Bearer valid-token' };

    await authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockRequest.user).toEqual(mockPayload);
  });

  it('should return 401 for missing token', async () => {
    await authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(nextFunction).not.toHaveBeenCalled();
  });
});
```

### Integration Test Examples

#### API Endpoint Testing
```typescript
// tests/integration/auth/auth.routes.test.ts
import request from 'supertest';
import { app } from '../../../src/app';
import { prisma } from '../../../src/config/database';
import { clearDatabase, seedTestData } from '../../helpers/database';

describe('Auth Routes', () => {
  beforeEach(async () => {
    await clearDatabase();
    await seedTestData();
  });

  afterAll(async () => {
    await clearDatabase();
    await prisma.$disconnect();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const userData = {
        phone: '+2348087654321',
        firstName: 'John',
        lastName: 'Doe',
        userType: 'customer',
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.phone).toBe(userData.phone);
      expect(response.body.data.user.firstName).toBe(userData.firstName);
    });

    it('should return 400 for duplicate phone number', async () => {
      const userData = {
        phone: '+2348012345678', // Already exists in seed data
        firstName: 'Jane',
        lastName: 'Doe',
        userType: 'customer',
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('POST /api/v1/auth/verify-otp', () => {
    it('should verify OTP and return tokens', async () => {
      // First register user
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          phone: '+2348087654321',
          firstName: 'John',
          lastName: 'Doe',
          userType: 'customer',
        });

      // Mock OTP (in real test, you'd set a known OTP)
      const response = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({
          phone: '+2348087654321',
          otp: '123456', // This should match your test OTP
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });
  });
});
```

#### Database Testing
```typescript
// tests/integration/database/user.model.test.ts
import { prisma } from '../../../src/config/database';
import { clearDatabase } from '../../helpers/database';

describe('User Model', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
    await prisma.$disconnect();
  });

  it('should create user with valid data', async () => {
    const userData = {
      phone: '+2348012345678',
      firstName: 'John',
      lastName: 'Doe',
      userType: 'customer' as const,
      status: 'active' as const,
    };

    const user = await prisma.user.create({ data: userData });

    expect(user.id).toBeDefined();
    expect(user.phone).toBe(userData.phone);
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('should enforce unique phone constraint', async () => {
    const userData = {
      phone: '+2348012345678',
      firstName: 'John',
      lastName: 'Doe',
      userType: 'customer' as const,
      status: 'active' as const,
    };

    await prisma.user.create({ data: userData });

    await expect(
      prisma.user.create({ data: { ...userData, firstName: 'Jane' } })
    ).rejects.toThrow();
  });
});
```

### Queue Testing
```typescript
// tests/integration/queues/sms.queue.test.ts
import { Queue } from 'bullmq';
import { smsQueue } from '../../../src/config/queues';
import { smsProcessor } from '../../../src/shared/processors/sms.processor';

describe('SMS Queue', () => {
  beforeAll(async () => {
    await smsQueue.obliterate();
  });

  afterEach(async () => {
    await smsQueue.clean(0, 1000, 'completed');
    await smsQueue.clean(0, 1000, 'failed');
  });

  it('should process SMS job successfully', async () => {
    const jobData = {
      phone: '+2348012345678',
      message: 'Your OTP is 123456',
    };

    const job = await smsQueue.add('send-sms', jobData);
    
    // Wait for job completion
    await job.waitUntilFinished(queueEvents);

    expect(job.finishedOn).toBeDefined();
    expect(job.returnvalue.success).toBe(true);
  });

  it('should handle SMS job failure', async () => {
    const jobData = {
      phone: 'invalid-phone',
      message: 'Test message',
    };

    const job = await smsQueue.add('send-sms', jobData);
    
    await expect(job.waitUntilFinished(queueEvents)).rejects.toThrow();
  });
});
```

## Flutter Testing

### Test Structure
```
flutter/customer_app/
├── test/
│   ├── unit/
│   │   ├── models/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── utils/
│   ├── widget/
│   │   ├── screens/
│   │   ├── widgets/
│   │   └── components/
│   ├── integration/
│   │   ├── auth_flow_test.dart
│   │   ├── ride_booking_test.dart
│   │   └── payment_flow_test.dart
│   ├── mocks/
│   │   ├── mock_services.dart
│   │   └── mock_repositories.dart
│   └── helpers/
│       ├── test_helpers.dart
│       └── widget_tester_extensions.dart
└── test_driver/
    ├── app.dart
    └── app_test.dart
```

### Widget Testing
```dart
// test/widget/screens/auth/login_screen_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:ride_deliva/presentation/screens/auth/login_screen.dart';

import '../../helpers/test_helpers.dart';

void main() {
  group('LoginScreen Tests', () {
    testWidgets('should display login form', (WidgetTester tester) async {
      await tester.pumpWidget(createTestApp(const LoginScreen()));

      expect(find.text('Welcome Back'), findsOneWidget);
      expect(find.byType(TextFormField), findsNWidgets(2));
      expect(find.text('Sign In'), findsOneWidget);
    });

    testWidgets('should validate phone number input', (WidgetTester tester) async {
      await tester.pumpWidget(createTestApp(const LoginScreen()));

      // Enter invalid phone number
      await tester.enterText(
        find.byKey(const Key('phone_field')),
        '123',
      );
      await tester.tap(find.text('Sign In'));
      await tester.pump();

      expect(find.text('Please enter a valid phone number'), findsOneWidget);
    });

    testWidgets('should navigate to verify phone on successful login', 
        (WidgetTester tester) async {
      await tester.pumpWidget(createTestApp(const LoginScreen()));

      // Enter valid credentials
      await tester.enterText(
        find.byKey(const Key('phone_field')),
        '08012345678',
      );
      await tester.enterText(
        find.byKey(const Key('password_field')),
        'password123',
      );

      await tester.tap(find.text('Sign In'));
      await tester.pumpAndSettle();

      // Should navigate to verify phone screen
      expect(find.text('Verify Phone Number'), findsOneWidget);
    });
  });
}
```

### BLoC Testing
```dart
// test/unit/blocs/auth_bloc_test.dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:ride_deliva/presentation/blocs/auth/auth_bloc.dart';

import '../../mocks/mock_services.dart';

void main() {
  group('AuthBloc', () {
    late AuthBloc authBloc;
    late MockAuthService mockAuthService;

    setUp(() {
      mockAuthService = MockAuthService();
      authBloc = AuthBloc(authService: mockAuthService);
    });

    tearDown(() {
      authBloc.close();
    });

    test('initial state is AuthInitial', () {
      expect(authBloc.state, equals(AuthInitial()));
    });

    blocTest<AuthBloc, AuthState>(
      'emits [AuthLoading, AuthSuccess] when login succeeds',
      build: () {
        when(mockAuthService.login(any, any))
            .thenAnswer((_) async => LoginResult(success: true));
        return authBloc;
      },
      act: (bloc) => bloc.add(
        LoginRequested(phone: '+2348012345678', password: 'password123'),
      ),
      expect: () => [
        AuthLoading(),
        AuthSuccess(),
      ],
    );

    blocTest<AuthBloc, AuthState>(
      'emits [AuthLoading, AuthFailure] when login fails',
      build: () {
        when(mockAuthService.login(any, any))
            .thenThrow(Exception('Invalid credentials'));
        return authBloc;
      },
      act: (bloc) => bloc.add(
        LoginRequested(phone: '+2348012345678', password: 'wrongpassword'),
      ),
      expect: () => [
        AuthLoading(),
        const AuthFailure(error: 'Invalid credentials'),
      ],
    );
  });
}
```

### Integration Testing
```dart
// test/integration/auth_flow_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:ride_deliva/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Authentication Flow', () {
    testWidgets('complete login flow', (WidgetTester tester) async {
      app.main();
      await tester.pumpAndSettle();

      // Should start with splash screen
      expect(find.text('Ride Deliva'), findsOneWidget);
      await tester.pumpAndSettle(const Duration(seconds: 3));

      // Navigate through onboarding
      expect(find.text('Book Rides'), findsOneWidget);
      await tester.tap(find.text('Get Started'));
      await tester.pumpAndSettle();

      // Login screen
      expect(find.text('Welcome Back'), findsOneWidget);
      
      // Enter phone number
      await tester.enterText(
        find.byType(TextFormField).first,
        '08012345678',
      );
      
      // Enter password
      await tester.enterText(
        find.byType(TextFormField).last,
        'password123',
      );

      // Tap sign in
      await tester.tap(find.text('Sign In'));
      await tester.pumpAndSettle();

      // Should navigate to OTP verification
      expect(find.text('Verify Phone Number'), findsOneWidget);
    });
  });
}
```

## Test Data Management

### Database Test Helpers
```typescript
// tests/helpers/database.ts
import { prisma } from '../../src/config/database';

export async function clearDatabase() {
  await prisma.order.deleteMany();
  await prisma.driverProfile.deleteMany();
  await prisma.user.deleteMany();
}

export async function seedTestData() {
  const testUser = await prisma.user.create({
    data: {
      phone: '+2348012345678',
      firstName: 'Test',
      lastName: 'User',
      userType: 'customer',
      status: 'active',
    },
  });

  const testDriver = await prisma.user.create({
    data: {
      phone: '+2348087654321',
      firstName: 'Test',
      lastName: 'Driver',
      userType: 'driver',
      status: 'active',
    },
  });

  await prisma.driverProfile.create({
    data: {
      userId: testDriver.id,
      licenseNumber: 'ABC123456',
      vehicleType: 'sedan',
      vehicleModel: 'Toyota Corolla',
      vehicleYear: 2020,
      plateNumber: 'LAG 123 XY',
      verificationStatus: 'approved',
    },
  });

  return { testUser, testDriver };
}
```

### Flutter Test Helpers
```dart
// test/helpers/test_helpers.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

Widget createTestApp(Widget child) {
  return MaterialApp(
    home: child,
    theme: ThemeData.dark(),
  );
}

Widget createTestAppWithProviders(Widget child, List<Provider> providers) {
  return MultiProvider(
    providers: providers,
    child: MaterialApp(
      home: child,
      theme: ThemeData.dark(),
    ),
  );
}

extension WidgetTesterExtensions on WidgetTester {
  Future<void> enterTextAndSettle(Finder finder, String text) async {
    await enterText(finder, text);
    await pumpAndSettle();
  }

  Future<void> tapAndSettle(Finder finder) async {
    await tap(finder);
    await pumpAndSettle();
  }
}
```

## Performance Testing

### Backend Load Testing
```javascript
// tests/performance/load.test.js
const autocannon = require('autocannon');

describe('Load Testing', () => {
  test('API can handle 100 concurrent connections', async () => {
    const result = await autocannon({
      url: 'http://localhost:3000/api/v1/health',
      connections: 100,
      duration: 30,
    });

    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);
    expect(result.latency.mean).toBeLessThan(100); // 100ms average response time
  });
});
```

### Flutter Performance Testing
```dart
// test/performance/scroll_performance_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('ride list scrolls smoothly', (WidgetTester tester) async {
    await tester.pumpWidget(const MyApp());
    
    // Navigate to ride history
    await tester.tap(find.text('History'));
    await tester.pumpAndSettle();

    // Measure scroll performance
    await tester.fling(
      find.byType(ListView),
      const Offset(0, -500),
      1000,
    );

    await tester.pumpAndSettle();
    
    // Check for frame drops
    final frames = tester.binding.window.onReportTimings;
    // Add assertions for frame timing
  });
}
```

## Test Execution

### Running Tests

#### Backend Tests
```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --testPathPattern=auth

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run integration tests only
npm run test:integration
```

#### Flutter Tests
```bash
# Run all tests
flutter test

# Run specific test file
flutter test test/widget/screens/auth/login_screen_test.dart

# Run with coverage
flutter test --coverage

# Run integration tests
flutter drive --target=test_driver/app.dart
```

### Continuous Integration

#### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgis/postgis:14-3.2
        env:
          POSTGRES_PASSWORD: password
          POSTGRES_DB: ride_deliva_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd backend
          npm ci
      
      - name: Run tests
        run: |
          cd backend
          npm test
        env:
          DATABASE_URL: postgresql://postgres:password@localhost:5432/ride_deliva_test

  flutter-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.16.0'
      
      - name: Install dependencies
        run: |
          cd flutter/customer_app
          flutter pub get
      
      - name: Run tests
        run: |
          cd flutter/customer_app
          flutter test --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Coverage Goals

### Coverage Targets
- **Backend**: 80% line coverage, 70% branch coverage
- **Flutter**: 75% line coverage, 65% branch coverage
- **Critical paths**: 95% coverage (auth, payments, safety features)

### Coverage Reports
```bash
# Generate coverage report
npm run test:coverage
open coverage/lcov-report/index.html

# Flutter coverage
flutter test --coverage
genhtml coverage/lcov.info -o coverage/html
open coverage/html/index.html
```

## Testing Best Practices

### General Principles
1. **Test behavior, not implementation**
2. **Write tests first (TDD)**
3. **Keep tests simple and focused**
4. **Use descriptive test names**
5. **Mock external dependencies**
6. **Test edge cases and error conditions**

### Backend Best Practices
- Use test databases (separate from development)
- Mock external API calls
- Test middleware independently
- Validate input/output schemas
- Test error handling paths

### Flutter Best Practices
- Use widget testing for UI components
- Mock services and repositories
- Test user interactions
- Verify navigation behavior
- Test state management logic

### Performance Testing Guidelines
- Test under realistic load conditions
- Monitor memory usage
- Check for memory leaks
- Validate response times
- Test on different device configurations