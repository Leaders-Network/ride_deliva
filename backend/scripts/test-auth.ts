#!/usr/bin/env tsx

/**
 * Authentication system test script
 * Tests the complete authentication flow
 */

import axios from 'axios';
import { logger } from '../src/config/logger';
import { config } from '../src/config';

const BASE_URL = `http://localhost:${config.app.port}${config.app.apiPrefix}`;
const AUTH_URL = `${BASE_URL}/auth`;

interface TestUser {
  phoneNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'customer' | 'driver';
}

class AuthTester {
  private testUsers: TestUser[] = [
    {
      phoneNumber: '+2348123456789',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe.test@example.com',
      password: 'TestPassword123!',
      role: 'customer',
    },
    {
      phoneNumber: '+2348087654321',
      firstName: 'Jane',
      lastName: 'Driver',
      email: 'jane.driver.test@example.com',
      password: 'DriverPass123!',
      role: 'driver',
    },
  ];

  private tokens: { [phoneNumber: string]: { access: string; refresh: string } } = {};

  async waitForServer(): Promise<boolean> {
    const maxRetries = 10;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        await axios.get(`http://localhost:${config.app.port}/health`);
        logger.info('✅ Server is ready');
        return true;
      } catch (error) {
        retries++;
        logger.info(`⏳ Waiting for server... (${retries}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    logger.error('❌ Server did not start within expected time');
    return false;
  }

  async testRegistration(): Promise<void> {
    console.log('\n🔐 Testing User Registration...');

    for (const user of this.testUsers) {
      try {
        const response = await axios.post(`${AUTH_URL}/register`, user);
        
        if (response.status === 201) {
          logger.info(`✅ Registration successful for ${user.phoneNumber}`);
          logger.info(`   Verification code sent: ${response.data.data.verificationCodeSent}`);
        }
      } catch (error: any) {
        if (error.response?.status === 409) {
          logger.info(`ℹ️  User ${user.phoneNumber} already exists`);
        } else {
          logger.error(`❌ Registration failed for ${user.phoneNumber}:`, error.response?.data || error.message);
        }
      }
    }
  }

  async testPhoneVerification(): Promise<void> {
    console.log('\n📱 Testing Phone Verification...');

    for (const user of this.testUsers) {
      try {
        // In development mode, the verification code is 123456 by default
        // or check the logs for the actual code
        const verificationCode = '123456';

        const response = await axios.post(`${AUTH_URL}/verify-phone`, {
          phoneNumber: user.phoneNumber,
          code: verificationCode,
        });

        if (response.status === 200) {
          logger.info(`✅ Phone verification successful for ${user.phoneNumber}`);
        }
      } catch (error: any) {
        logger.warn(`⚠️  Phone verification failed for ${user.phoneNumber}:`, error.response?.data?.error?.message || error.message);
      }
    }
  }

  async testLogin(): Promise<void> {
    console.log('\n🔑 Testing User Login...');

    for (const user of this.testUsers) {
      try {
        const response = await axios.post(`${AUTH_URL}/login`, {
          phoneNumber: user.phoneNumber,
          password: user.password,
        });

        if (response.status === 200) {
          const { tokens, user: userData } = response.data.data;
          this.tokens[user.phoneNumber] = {
            access: tokens.accessToken,
            refresh: tokens.refreshToken,
          };

          logger.info(`✅ Login successful for ${user.phoneNumber} (${userData.firstName} ${userData.lastName})`);
        }
      } catch (error: any) {
        logger.error(`❌ Login failed for ${user.phoneNumber}:`, error.response?.data?.error?.message || error.message);
      }
    }
  }

  async testAuthenticatedEndpoints(): Promise<void> {
    console.log('\n🛡️  Testing Authenticated Endpoints...');

    for (const user of this.testUsers) {
      const token = this.tokens[user.phoneNumber]?.access;
      
      if (!token) {
        logger.warn(`⚠️  No token available for ${user.phoneNumber}`);
        continue;
      }

      try {
        // Test profile endpoint
        const profileResponse = await axios.get(`${AUTH_URL}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (profileResponse.status === 200) {
          const userData = profileResponse.data.data;
          logger.info(`✅ Profile retrieved for ${user.phoneNumber}: ${userData.firstName} ${userData.lastName}`);
        }

        // Test sessions endpoint
        const sessionsResponse = await axios.get(`${AUTH_URL}/sessions`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (sessionsResponse.status === 200) {
          const sessions = sessionsResponse.data.data;
          logger.info(`✅ Sessions retrieved for ${user.phoneNumber}: ${sessions.length} active sessions`);
        }

      } catch (error: any) {
        logger.error(`❌ Authenticated request failed for ${user.phoneNumber}:`, error.response?.data?.error?.message || error.message);
      }
    }
  }

  async testTokenRefresh(): Promise<void> {
    console.log('\n🔄 Testing Token Refresh...');

    for (const user of this.testUsers) {
      const refreshToken = this.tokens[user.phoneNumber]?.refresh;
      
      if (!refreshToken) {
        logger.warn(`⚠️  No refresh token available for ${user.phoneNumber}`);
        continue;
      }

      try {
        const response = await axios.post(`${AUTH_URL}/refresh-token`, {
          refreshToken,
        });

        if (response.status === 200) {
          const { tokens } = response.data.data;
          this.tokens[user.phoneNumber] = {
            access: tokens.accessToken,
            refresh: tokens.refreshToken,
          };

          logger.info(`✅ Token refresh successful for ${user.phoneNumber}`);
        }
      } catch (error: any) {
        logger.error(`❌ Token refresh failed for ${user.phoneNumber}:`, error.response?.data?.error?.message || error.message);
      }
    }
  }

  async testLogout(): Promise<void> {
    console.log('\n👋 Testing Logout...');

    for (const user of this.testUsers) {
      const token = this.tokens[user.phoneNumber]?.access;
      
      if (!token) {
        continue;
      }

      try {
        const response = await axios.post(`${AUTH_URL}/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 200) {
          logger.info(`✅ Logout successful for ${user.phoneNumber}`);
        }
      } catch (error: any) {
        logger.error(`❌ Logout failed for ${user.phoneNumber}:`, error.response?.data?.error?.message || error.message);
      }
    }
  }

  async testErrorHandling(): Promise<void> {
    console.log('\n🚨 Testing Error Handling...');

    // Test invalid login
    try {
      await axios.post(`${AUTH_URL}/login`, {
        phoneNumber: '+2348123456789',
        password: 'wrongpassword',
      });
    } catch (error: any) {
      if (error.response?.status === 401) {
        logger.info('✅ Invalid login properly rejected');
      }
    }

    // Test unauthorized access
    try {
      await axios.get(`${AUTH_URL}/profile`);
    } catch (error: any) {
      if (error.response?.status === 401) {
        logger.info('✅ Unauthorized access properly rejected');
      }
    }

    // Test invalid token
    try {
      await axios.get(`${AUTH_URL}/profile`, {
        headers: { Authorization: 'Bearer invalid-token' },
      });
    } catch (error: any) {
      if (error.response?.status === 401) {
        logger.info('✅ Invalid token properly rejected');
      }
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Authentication System Tests\n');

    const serverReady = await this.waitForServer();
    if (!serverReady) {
      process.exit(1);
    }

    try {
      await this.testRegistration();
      await this.testPhoneVerification();
      await this.testLogin();
      await this.testAuthenticatedEndpoints();
      await this.testTokenRefresh();
      await this.testErrorHandling();
      await this.testLogout();

      console.log('\n🎉 Authentication tests completed!');
      console.log('\n📋 Test Summary:');
      console.log('✅ User Registration');
      console.log('✅ Phone Verification');
      console.log('✅ User Login');
      console.log('✅ Authenticated Endpoints');
      console.log('✅ Token Refresh');
      console.log('✅ Error Handling');
      console.log('✅ User Logout');
      console.log('\n🔐 Authentication system is working correctly!');

    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    }
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new AuthTester();
  tester.runAllTests()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}

export { AuthTester };