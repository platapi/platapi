/** @type {import("ts-jest").JestConfigWithTsJest} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    roots: ["./tests/"],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1"
    }
};
