// Unit tests live next to the code (src/**/*.spec.ts); e2e tests run against a separate *_test database.
const tsJest = { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json', isolatedModules: true }] };

module.exports = {
  projects: [
    {
      displayName: 'unit',
      rootDir: '.',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      transform: tsJest,
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
    {
      displayName: 'e2e',
      rootDir: '.',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
      transform: tsJest,
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
      globalSetup: '<rootDir>/test/e2e/global-setup.ts',
      setupFiles: ['<rootDir>/test/e2e/setup-env.ts'],
    },
  ],
};
