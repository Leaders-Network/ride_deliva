#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Ride Deliva infrastructure...\n');

function runCommand(command, description) {
  console.log(`📦 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit', cwd: process.cwd() });
    console.log(`✅ ${description} completed\n`);
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    process.exit(1);
  }
}

function checkDockerInstalled() {
  try {
    execSync('docker --version', { stdio: 'pipe' });
    execSync('docker-compose --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function createDirectories() {
  const directories = [
    'backend/logs',
    'backend/uploads',
    'backend/src/modules',
    'backend/src/shared/utils',
    'backend/src/shared/middleware',
    'backend/src/shared/services',
    'backend/src/shared/constants',
    'backend/src/shared/validators',
    'docs/api',
    'docs/architecture',
    'docs/development',
    'docs/deployment',
    'docs/user-guides'
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
}

async function main() {
  // Check prerequisites
  console.log('🔍 Checking prerequisites...');
  
  if (!checkDockerInstalled()) {
    console.error('❌ Docker and Docker Compose are required but not installed.');
    console.log('📖 Please install Docker Desktop from: https://www.docker.com/products/docker-desktop');
    process.exit(1);
  }
  
  console.log('✅ Docker and Docker Compose are installed\n');

  // Create necessary directories
  console.log('📁 Creating project directories...');
  createDirectories();
  console.log('✅ Directories created\n');

  // Install backend dependencies
  runCommand('cd backend && npm install', 'Installing backend dependencies');

  // Start infrastructure services
  runCommand('docker-compose up -d postgres redis', 'Starting PostgreSQL and Redis services');

  // Wait for services to be ready
  console.log('⏳ Waiting for services to be ready...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Generate Prisma client
  runCommand('cd backend && npx prisma generate', 'Generating Prisma client');

  // Run database migrations
  runCommand('cd backend && npx prisma db push', 'Running database migrations');

  // Test connections
  console.log('🔍 Testing service connections...');
  
  try {
    // Test database connection
    execSync('cd backend && node -e "const { PrismaClient } = require(\'@prisma/client\'); const prisma = new PrismaClient(); prisma.$connect().then(() => { console.log(\'Database connection: ✅\'); process.exit(0); }).catch((e) => { console.error(\'Database connection: ❌\', e.message); process.exit(1); });"', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Database connection test failed');
  }

  console.log('\n🎉 Infrastructure setup completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Review the .env file in the backend directory');
  console.log('2. Add your API keys for external services (Google Maps, Twilio, etc.)');
  console.log('3. Run `npm run dev` to start the development servers');
  console.log('4. Access the services:');
  console.log('   - API: http://localhost:3000');
  console.log('   - PostgreSQL: localhost:5432 (user: postgres, password: postgres)');
  console.log('   - Redis: localhost:6379');
  console.log('   - PgAdmin: http://localhost:8080 (admin@ridedeliva.com / admin)');
  console.log('   - Redis Commander: http://localhost:8081');
  console.log('\n🛠️ Development commands:');
  console.log('   - Start all services: npm run dev');
  console.log('   - Start backend only: npm run dev:backend');
  console.log('   - View logs: docker-compose logs -f');
  console.log('   - Stop services: npm run docker:down');
  console.log('   - Database studio: cd backend && npm run db:studio');
}

main().catch(error => {
  console.error('❌ Setup failed:', error.message);
  process.exit(1);
});