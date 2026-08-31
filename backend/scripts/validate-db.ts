#!/usr/bin/env tsx

/**
 * Database validation script
 * Validates database connection, schema, and initial setup
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../src/config/logger';
import { config } from '../src/config';

const prisma = new PrismaClient();

interface ValidationResult {
  passed: boolean;
  name: string;
  error?: string;
  details?: any;
}

class DatabaseValidator {
  private results: ValidationResult[] = [];

  async validateConnection(): Promise<ValidationResult> {
    const name = 'Database Connection';
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1 as test`;
      logger.info('✅ Database connection successful');
      return { passed: true, name };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Database connection failed:', error);
      return { passed: false, name, error: errorMsg };
    }
  }

  async validateExtensions(): Promise<ValidationResult> {
    const name = 'Required Extensions';
    try {
      const extensions = await prisma.$queryRaw<Array<{ name: string; installed_version: string | null }>>`
        SELECT name, installed_version 
        FROM pg_available_extensions 
        WHERE name IN ('postgis', 'uuid-ossp', 'pgcrypto', 'fuzzystrmatch')
        ORDER BY name;
      `;

      const requiredExtensions = ['postgis', 'uuid-ossp', 'pgcrypto', 'fuzzystrmatch'];
      const installedExtensions = extensions
        .filter(ext => ext.installed_version !== null)
        .map(ext => ext.name);

      const missingExtensions = requiredExtensions.filter(
        req => !installedExtensions.includes(req)
      );

      if (missingExtensions.length > 0) {
        return {
          passed: false,
          name,
          error: `Missing extensions: ${missingExtensions.join(', ')}`,
          details: { installed: installedExtensions, missing: missingExtensions },
        };
      }

      logger.info('✅ All required extensions are installed');
      return {
        passed: true,
        name,
        details: { installed: installedExtensions },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { passed: false, name, error: errorMsg };
    }
  }

  async validateSchema(): Promise<ValidationResult> {
    const name = 'Schema Structure';
    try {
      // Check if main tables exist
      const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `;

      const tableNames = tables.map(t => t.table_name);
      const requiredTables = [
        'users',
        'customer_profiles',
        'driver_profiles',
        'vehicles',
        'rides',
        'deliveries',
        'addresses',
        'payments',
        'wallets',
        'notifications',
      ];

      const missingTables = requiredTables.filter(
        req => !tableNames.includes(req)
      );

      if (missingTables.length > 0) {
        return {
          passed: false,
          name,
          error: `Missing tables: ${missingTables.join(', ')}`,
          details: { existing: tableNames, missing: missingTables },
        };
      }

      logger.info('✅ Schema structure is valid');
      return {
        passed: true,
        name,
        details: { tables: tableNames.length },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { passed: false, name, error: errorMsg };
    }
  }

  async validateFunctions(): Promise<ValidationResult> {
    const name = 'Custom Functions';
    try {
      // Check if custom functions exist
      const functions = await prisma.$queryRaw<Array<{ function_name: string }>>`
        SELECT routine_name as function_name
        FROM information_schema.routines
        WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION'
        AND routine_name IN ('calculate_distance', 'find_nearby_drivers', 'update_driver_location')
        ORDER BY routine_name;
      `;

      const functionNames = functions.map(f => f.function_name);
      const requiredFunctions = ['calculate_distance', 'find_nearby_drivers', 'update_driver_location'];

      const missingFunctions = requiredFunctions.filter(
        req => !functionNames.includes(req)
      );

      if (missingFunctions.length > 0) {
        return {
          passed: false,
          name,
          error: `Missing functions: ${missingFunctions.join(', ')}`,
          details: { existing: functionNames, missing: missingFunctions },
        };
      }

      logger.info('✅ Custom functions are available');
      return {
        passed: true,
        name,
        details: { functions: functionNames },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { passed: false, name, error: errorMsg };
    }
  }

  async validateGeospatial(): Promise<ValidationResult> {
    const name = 'Geospatial Capabilities';
    try {
      // Test PostGIS functionality
      const result = await prisma.$queryRaw<Array<{ distance: number }>>`
        SELECT ST_Distance(
          ST_GeogFromText('POINT(3.4219 6.4281)'),
          ST_GeogFromText('POINT(3.4553 6.4474)')
        ) as distance;
      `;

      if (result.length === 0 || typeof result[0].distance !== 'number') {
        return {
          passed: false,
          name,
          error: 'PostGIS distance calculation failed',
        };
      }

      logger.info('✅ Geospatial capabilities are working');
      return {
        passed: true,
        name,
        details: { sample_distance: result[0].distance },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { passed: false, name, error: errorMsg };
    }
  }

  async validateConstraints(): Promise<ValidationResult> {
    const name = 'Database Constraints';
    try {
      // Test unique constraints
      const constraints = await prisma.$queryRaw<Array<{ constraint_name: string; table_name: string }>>`
        SELECT constraint_name, table_name
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
        AND constraint_type = 'UNIQUE'
        ORDER BY table_name, constraint_name;
      `;

      const constraintCount = constraints.length;
      
      if (constraintCount === 0) {
        return {
          passed: false,
          name,
          error: 'No unique constraints found',
        };
      }

      logger.info('✅ Database constraints are in place');
      return {
        passed: true,
        name,
        details: { constraint_count: constraintCount },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return { passed: false, name, error: errorMsg };
    }
  }

  async runAllValidations(): Promise<void> {
    console.log('🔍 Starting database validation...\n');

    const validations = [
      this.validateConnection(),
      this.validateExtensions(),
      this.validateSchema(),
      this.validateFunctions(),
      this.validateGeospatial(),
      this.validateConstraints(),
    ];

    this.results = await Promise.all(validations);

    // Print results
    console.log('📊 Validation Results:');
    console.log('=' .repeat(50));

    let allPassed = true;
    for (const result of this.results) {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.name}`);
      
      if (!result.passed) {
        allPassed = false;
        console.log(`    Error: ${result.error}`);
      }
      
      if (result.details) {
        const details = Object.entries(result.details)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        console.log(`    Details: ${details}`);
      }
    }

    console.log('=' .repeat(50));

    if (allPassed) {
      console.log('🎉 All validations passed! Database is ready for use.');
      process.exit(0);
    } else {
      console.log('⚠️  Some validations failed. Please fix the issues before proceeding.');
      process.exit(1);
    }
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  const validator = new DatabaseValidator();
  validator.runAllValidations()
    .catch((error) => {
      console.error('Validation script failed:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { DatabaseValidator };