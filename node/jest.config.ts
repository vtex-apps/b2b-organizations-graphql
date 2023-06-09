/** @type {import("jest").Config} */

module.exports = {
  projects: [
    {
      globals: {
        'ts-jest': {
          tsConfig: '<rootDir>/tsconfig.json',
        },
      },
      moduleFileExtensions: ['ts', 'tsx', 'js'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      testEnvironmentOptions: {},
      testMatch: ['<rootDir>/**/?(*.)+(spec|test).(js|ts)?(x)'],
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
    },
  ],
}
