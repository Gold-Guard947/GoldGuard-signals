
/*

 GOLDGUARD HISTORICAL DATA VALIDATOR TESTS V1.1

 Extended reliability testing.

 Tests:
 - Large historical datasets.
 - Dataset integrity protection.
 - Multiple duplicate timestamps.
 - Weekend timestamp boundaries.
 - Market closure boundaries.
 - Global gap inspection limits.
 - Invalid nested configuration.
 - Invalid market closure entries.
 - Historical data consistency.

 Historical data only.
 No live market feed.
 No trade execution.
 No pipeline integration.

*/

(function () {

  "use strict";

  // ----------------------------------
  // LOAD VALIDATOR
  // ----------------------------------

  let validator = null;

  if (
    typeof module !== "undefined" &&
    module.exports &&
    typeof require === "function"
  ) {

    validator = require(
      "./historical-data-validator.js"
    );

  } else if (
    typeof globalThis !== "undefined"
  ) {

    validator =
      globalThis.GoldGuardHistoricalDataValidator;

  }

  // ----------------------------------
  // TEST RUNNER
  // ----------------------------------

  let passed = 0;
  let failed = 0;

  const results = [];

  function test(name, callback) {

    try {

      callback();

      passed++;

      results.push({
        name: name,
        status: "PASS"
      });

      console.log("PASS:", name);

    } catch (error) {

      failed++;

      results.push({
        name: name,
        status: "FAIL",
        reason: error.message
      });

      console.error(
        "FAIL:",
        name,
        error.message
      );

    }

  }

  function assert(condition, message) {

    if (!condition) {

      throw new Error(
        message || "Assertion failed."
      );

    }

  }

  function assertEqual(
    actual,
    expected,
    message
  ) {

    if (actual !== expected) {

      throw new Error(
        (message || "Values do not match.") +
        " Expected: " + expected +
        ", received: " + actual
      );

    }

  }

  // ----------------------------------
  // TEST DATA HELPERS
  // ----------------------------------

  const HOUR = 60 * 60 * 1000;
  const MINUTE = 60 * 1000;

  const BASE_TIME = Date.UTC(
    2026, 0, 5, 0, 0, 0
  );

  function makeCandle(
    timestamp,
    overrides
  ) {

    return Object.assign({

      timestampMs: timestamp,
      open: 4000,
      high: 4010,
      low: 3990,
      close: 4005,
      tickVolume: 100,
      spread: 20

    }, overrides || {});

  }

  function makeDataset(
    start,
    interval,
    count
  ) {

    const candles = [];

    for (let i = 0; i < count; i++) {

      candles.push(
        makeCandle(
          start + interval * i
        )
      );

    }

    return candles;

  }

  function validate(
    candles,
    timeframe,
    config
  ) {

    return validator.validate(
      candles,
      timeframe,
      config || {}
    );

  }

  // ----------------------------------
  // SUITE START
  // ----------------------------------

  console.log(
    "======================================"
  );

  console.log(
    "GOLDGUARD HISTORICAL VALIDATOR TESTS"
  );

  console.log(
    "Version: 1.1"
  );

  console.log(
    "Mode: EXTENDED RELIABILITY TESTING"
  );

  console.log(
    "======================================"
  );

  if (!validator) {

    console.error(
      "TEST SUITE STOPPED: Validator unavailable."
    );

    return;

  }

  // ----------------------------------
  // 1. LARGE DATASET TESTS
  // ----------------------------------

  test(
    "20,000 historical candles process successfully",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        MINUTE * 5,
        20000
      );

      const result = validate(
        candles,
        "M5",
        {
          weekendClosure: {
            enabled: false
          }
        }
      );

      assertEqual(
        result.status,
        "PASS"
      );

      assertEqual(
        result.statistics.candleCount,
        20000
      );

      assertEqual(
        result.statistics.validCandles,
        20000
      );

    }
  );

  test(
    "Large dataset contains no invalid candles",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        HOUR,
        10000
      );

      const result = validate(
        candles,
        "H1",
        {
          weekendClosure: {
            enabled: false
          }
        }
      );

      assertEqual(
        result.status,
        "PASS"
      );

      assertEqual(
        result.statistics.invalidCandles,
        0
      );

      assertEqual(
        result.statistics.duplicateTimestamps,
        0
      );

      assertEqual(
        result.statistics.outOfOrderTimestamps,
        0
      );

    }
  );

  // ----------------------------------
  // 2. DATASET INTEGRITY
  // ----------------------------------

  test(
    "Validator does not modify original historical data",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        HOUR,
        10
      );

      const original = JSON.stringify(
        candles
      );

      validate(
        candles,
        "H1"
      );

      assertEqual(
        JSON.stringify(candles),
        original,
        "Original dataset was modified."
      );

    }
  );

  test(
    "Multiple duplicate timestamps are detected",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        HOUR,
        5
      );

      candles[2].timestampMs =
        candles[1].timestampMs;

      candles[4].timestampMs =
        candles[3].timestampMs;

      const result = validate(
        candles,
        "H1"
      );

      assertEqual(
        result.status,
        "FAIL"
      );

      assertEqual(
        result.statistics.duplicateTimestamps,
        2
      );

    }
  );

  // ----------------------------------
  // 3. WEEKEND BOUNDARIES
  // ----------------------------------

  test(
    "Friday closing boundary is recognised",
    function () {

      const fridayClose = Date.UTC(
        2026, 0, 2, 22, 0
      );

      assert(
        validator.isMarketClosed(
          fridayClose
        ),
        "Friday closing boundary not recognised."
      );

    }
  );

  test(
    "Friday before closing remains open",
    function () {

      const fridayBeforeClose = Date.UTC(
        2026, 0, 2, 21, 0
      );

      assert(
        !validator.isMarketClosed(
          fridayBeforeClose
        ),
        "Friday before closing incorrectly marked closed."
      );

    }
  );

  test(
    "Sunday opening boundary is recognised",
    function () {

      const sundayOpen = Date.UTC(
        2026, 0, 4, 22, 0
      );

      assert(
        validator.isMarketClosed(
          sundayOpen,
          {
            weekendClosure: {
              enabled: true,
              fridayCloseHour: 22,
              sundayOpenHour: 22
            }
          }
        ),
        "Sunday opening boundary convention failed."
      );

    }
  );

  test(
    "Sunday after opening is recognised as open",
    function () {

      const sundayAfterOpen = Date.UTC(
        2026, 0, 4, 23, 0
      );

      assert(
        !validator.isMarketClosed(
          sundayAfterOpen,
          {
            weekendClosure: {
              enabled: true,
              fridayCloseHour: 22,
              sundayOpenHour: 22
            }
          }
        ),
        "Sunday after opening incorrectly marked closed."
      );

    }
  );

  // ----------------------------------
  // 4. MARKET HOLIDAY BOUNDARIES
  // ----------------------------------

  test(
    "Market closure start boundary is recognised",
    function () {

      const start = BASE_TIME + HOUR;
      const end = BASE_TIME + (3 * HOUR);

      assert(
        validator.isMarketClosed(
          start,
          {
            marketClosures: [{
              startMs: start,
              endMs: end
            }]
          }
        ),
        "Market closure start not recognised."
      );

    }
  );

  test(
    "Market closure end boundary is recognised",
    function () {

      const start = BASE_TIME + HOUR;
      const end = BASE_TIME + (3 * HOUR);

      assert(
        validator.isMarketClosed(
          end,
          {
            marketClosures: [{
              startMs: start,
              endMs: end
            }]
          }
        ),
        "Market closure end not recognised."
      );

    }
  );

  // ----------------------------------
  // 5. GAP INSPECTION LIMIT
  // ----------------------------------

  test(
    "Gap inspection respects global inspection limit",
    function () {

      const candles = [

        makeCandle(BASE_TIME),

        makeCandle(
          BASE_TIME + (4 * HOUR)
        ),

        makeCandle(
          BASE_TIME + (8 * HOUR)
        )

      ];

      const result = validate(
        candles,
        "H1",
        {
          maxGapChecks: 2
        }
      );

      assert(
        result.statistics.checkedIntervals <= 2,
        "Global gap inspection limit exceeded."
      );

    }
  );

  // ----------------------------------
  // 6. CONFIGURATION SAFETY
  // ----------------------------------

  test(
    "Invalid nested weekend configuration is rejected",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        HOUR,
        3
      );

      const result = validate(
        candles,
        "H1",
        {
          weekendClosure: "invalid"
        }
      );

      assertEqual(
        result.status,
        "FAIL"
      );

    }
  );

  test(
    "Malformed market closure entry is rejected",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        HOUR,
        3
      );

      const result = validate(
        candles,
        "H1",
        {
          marketClosures: [{
            startMs: "invalid",
            endMs: BASE_TIME + HOUR
          }]
        }
      );

      assertEqual(
        result.status,
        "FAIL"
      );

    }
  );

  test(
    "Reversed market closure boundaries are rejected",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        HOUR,
        3
      );

      const result = validate(
        candles,
        "H1",
        {
          marketClosures: [{
            startMs: BASE_TIME + (2 * HOUR),
            endMs: BASE_TIME + HOUR
          }]
        }
      );

      assertEqual(
        result.status,
        "FAIL"
      );

    }
  );

  // ----------------------------------
  // 7. HISTORICAL DATA CONSISTENCY
  // ----------------------------------

  test(
    "Valid H1 dataset remains PASS",
    function () {

      const result = validate(
        makeDataset(BASE_TIME, HOUR, 100),
        "H1"
      );

      assertEqual(
        result.status,
        "PASS"
      );

    }
  );

  test(
    "Valid M15 dataset remains PASS",
    function () {

      const result = validate(
        makeDataset(BASE_TIME, 15 * MINUTE, 100),
        "M15"
      );

      assertEqual(
        result.status,
        "PASS"
      );

    }
  );

  test(
    "Valid M5 dataset remains PASS",
    function () {

      const result = validate(
        makeDataset(BASE_TIME, 5 * MINUTE, 100),
        "M5"
      );

      assertEqual(
        result.status,
        "PASS"
      );

    }
  );

  // ----------------------------------
  // FINAL REPORT
  // ----------------------------------

  console.log(
    "======================================"
  );

  console.log(
    "HISTORICAL VALIDATOR V1.1 TEST REPORT"
  );

  console.log(
    "======================================"
  );

  console.log(
    "TOTAL TESTS:",
    passed + failed
  );

  console.log(
    "PASSED:",
    passed
  );

  console.log(
    "FAILED:",
    failed
  );

  const report = {

    component:
      "GoldGuard Historical Data Validator",

    version: "1.1",

    mode: "EXTENDED RELIABILITY TESTING",

    total: passed + failed,

    passed: passed,

    failed: failed,

    status: failed === 0
      ? "PASS"
      : "FAIL",

    results: results

  };

  console.log(
    "FINAL RESULT:",
    report.status
  );

  if (
    typeof module !== "undefined" &&
    module.exports
  ) {

    module.exports = report;

    if (
      typeof process !== "undefined"
    ) {

      process.exitCode =
        failed === 0 ? 0 : 1;

    }

  }

})();
