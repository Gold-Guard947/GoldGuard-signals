/*
 GOLDGUARD TEST REPORT GENERATOR V1.0

 Reads actual GitHub Actions test logs.
 Generates test-results.json for the dashboard.

 Historical and backtest reporting only.
 No live market feed.
 No trade execution.
 No trading signals.
*/

"use strict";

const fs = require("fs");
const path = require("path");

const VERSION = "1.0";
const OUTPUT_FILE = "test-results.json";

const SUITES = [
  {
    id: "historical-integration",
    name: "Historical Integration V1.2",
    log: "historical-integration-test.log",
    type: "historical"
  },
  {
    id: "backtest-regression",
    name: "Backtest Regression V1.3",
    log: "backtest-regression-test.log"
  },
  {
    id: "backtest-v1.2",
    name: "Backtest Engine V1.2",
    log: "backtest-v1.2-test.log"
  },
  {
    id: "backtest-advanced",
    name: "Advanced Backtest V1.2",
    log: "backtest-advanced-test.log"
  },
  {
    id: "end-to-end",
    name: "End-to-End Tests",
    log: "end-to-end-test.log"
  },
  {
    id: "full-backtest-integration",
    name: "Full Backtest Integration",
    log: "full-backtest-integration-test.log"
  },
  {
    id: "execution-cost",
    name: "Execution Cost V1.3",
    log: "execution-cost-test.log"
  }
];

function missingResult(suite) {
  return {
    id: suite.id,
    name: suite.name,
    log: suite.log,
    status: "MISSING",
    passed: null,
    failed: null,
    total: null,
    error: "Test log file was not found."
  };
}

function errorResult(suite, message) {
  return {
    id: suite.id,
    name: suite.name,
    log: suite.log,
    status: "ERROR",
    passed: null,
    failed: null,
    total: null,
    error: message
  };
}

function extractNumber(pattern, content) {
  const matches = [...content.matchAll(pattern)];

  if (matches.length === 0) {
    return null;
  }

  return Number(matches[matches.length - 1][1]);
}

function parseHistoricalLog(suite, content) {
  const match = content.match(
    /Historical integration tests V1\.2:\s*(\d+)\s*\/\s*(\d+)\s*passed\.\s*FAILURES:\s*(\d+)/i
  );

  if (!match) {
    return errorResult(
      suite,
      "Could not find the Historical Integration test summary."
    );
  }

  const passed = Number(match[1]);
  const total = Number(match[2]);
  const failed = Number(match[3]);

  return buildResult(suite, passed, failed, total);
}

function buildResult(suite, passed, failed, total) {
  if (
    !Number.isInteger(passed) ||
    !Number.isInteger(failed) ||
    !Number.isInteger(total) ||
    passed < 0 ||
    failed < 0 ||
    total < 0
  ) {
    return errorResult(suite, "Invalid test summary numbers.");
  }

  if (passed + failed !== total) {
    return errorResult(
      suite,
      "Passed and failed counts do not match the reported total."
    );
  }

  return {
    id: suite.id,
    name: suite.name,
    log: suite.log,
    status: failed === 0 ? "PASSED" : "FAILED",
    passed,
    failed,
    total,
    error: null
  };
}

function parseStandardLog(suite, content) {
  const passed = extractNumber(
    /^\s*PASSED:\s*(\d+)\s*$/gim,
    content
  );

  const failed = extractNumber(
    /^\s*FAILED:\s*(\d+)\s*$/gim,
    content
  );

  const reportedTotal = extractNumber(
    /^\s*TOTAL:\s*(\d+)\s*$/gim,
    content
  );

  if (passed === null || failed === null) {
    return errorResult(
      suite,
      "Could not find PASSED and FAILED summary values."
    );
  }

  const total =
    reportedTotal === null
      ? passed + failed
      : reportedTotal;

  return buildResult(suite, passed, failed, total);
}

function readSuite(suite) {
  const logPath = path.join(__dirname, suite.log);

  if (!fs.existsSync(logPath)) {
    return missingResult(suite);
  }

  try {
    const content = fs.readFileSync(logPath, "utf8");

    if (suite.type === "historical") {
      return parseHistoricalLog(suite, content);
    }

    return parseStandardLog(suite, content);
  } catch (error) {
    return errorResult(suite, error.message);
  }
}

function generateReport() {
  const results = SUITES.map(readSuite);

  const validResults = results.filter(
    result => Number.isInteger(result.total)
  );

  const passed = validResults.reduce(
    (sum, result) => sum + result.passed,
    0
  );

  const failed = validResults.reduce(
    (sum, result) => sum + result.failed,
    0
  );

  const total = validResults.reduce(
    (sum, result) => sum + result.total,
    0
  );

  const allSuitesValid = results.every(
    result =>
      result.status === "PASSED" ||
      result.status === "FAILED"
  );

  const overallStatus =
    allSuitesValid && failed === 0
      ? "PASSED"
      : "INCOMPLETE";

  const report = {
    project: "GoldGuard",
    reportVersion: VERSION,
    generatedAt: new Date().toISOString(),

    commit: process.env.GITHUB_SHA || "unknown",
    workflowRunId: process.env.GITHUB_RUN_ID || "unknown",
    workflowRunNumber: process.env.GITHUB_RUN_NUMBER || "unknown",

    mode: "HISTORICAL TESTING ONLY",

    status: overallStatus,

    summary: {
      passed,
      failed,
      total,
      suitesPassed: results.filter(
        result => result.status === "PASSED"
      ).length,
      suitesFailed: results.filter(
        result => result.status === "FAILED"
      ).length,
      suitesIncomplete: results.filter(
        result =>
          result.status === "MISSING" ||
          result.status === "ERROR"
      ).length
    },

    suites: results
  };

  const outputPath = path.join(__dirname, OUTPUT_FILE);

  fs.writeFileSync(
    outputPath,
    JSON.stringify(report, null, 2) + "\n",
    "utf8"
  );

  console.log("==================================");
  console.log(" GOLDGUARD TEST REPORT GENERATOR");
  console.log(" Version:", VERSION);
  console.log("==================================");

  console.log("Overall status:", report.status);
  console.log("Passed:", passed);
  console.log("Failed:", failed);
  console.log("Total:", total);

  console.log("\nSuite results:");

  results.forEach(result => {
    console.log(
      result.name + ": " + result.status
    );
  });

  console.log("\nReport created:", OUTPUT_FILE);

  if (overallStatus !== "PASSED") {
    process.exitCode = 1;
  }
}

generateReport();
