/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "src",
  setupFiles: ["reflect-metadata"],
  testRegex: "(/__tests__/.*|\\.(test|spec))\\.(ts|tsx)$",
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  collectCoverageFrom: ["**/*.(t|j)s"],
  coverageDirectory: "../coverage",
  passWithNoTests: true,
};
