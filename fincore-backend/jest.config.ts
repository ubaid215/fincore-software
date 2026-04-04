import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  transformIgnorePatterns: ['node_modules/(?!(uuid|@otplib|otplib|@bundled-es-modules)/)'],

  // Runs BEFORE any module is imported — this is critical
  setupFiles: ['<rootDir>/test/setup-env.ts'],

  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/config/**',
  ],
  coverageDirectory: './coverage',
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
};

export default config;
