export default {
  testEnvironment: "node",
  transform: {},
  setupFiles: ["<rootDir>/src/__tests__/setupEnv.js"],
  moduleFileExtensions: ["js"],
  testMatch: ["**/__tests__/**/*.test.js"],
  testPathIgnorePatterns: ["/node_modules/"],
};
