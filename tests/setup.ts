/**
 * Jest setup file
 * Runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/qahub_test?schema=public';

// Increase timeout for database operations
jest.setTimeout(10000);

// Global test utilities can be added here
// Example: global test database cleanup, mocks, etc.

