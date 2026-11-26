
/*

 GOLDGUARD HISTORICAL DATA VALIDATOR TESTS V1.0

 Independent automated test suite.

 Tests:
 - Component loading and version.
 - Historical-only operating mode.
 - H1, M15 and M5 validation.
 - OHLC validation.
 - Timestamp validation.
 - Duplicate timestamps.
 - Out-of-order timestamps.
 - Weekend market closures.
 - Configured market holidays.
 - Unexplained missing candles.
 - Spread validation.
 - Tick volume validation.
 - Invalid candle handling.
 - Invalid configuration handling.
 - Unsupported timeframe handling.

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
          start + (interval * i)
        )
      );

    }

    return candles;

  }


  const BASE_TIME = Date.UTC(
    2026,
    0,
    5,
    0,
    0,
    0
  );


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
    "Version: 1.0"
  );

  console.log(
    "======================================"
  );


  // ----------------------------------
  // 1. COMPONENT TESTS
  // ----------------------------------

  test(
    "Validator component loads",
    function () {

      assert(
        validator !== null,
        "Validator failed to load."
      );

    }
  );


  if (!validator) {

    console.error(
      "TEST SUITE STOPPED: Validator unavailable."
    );

    return;

  }


  test(
    "Validator version is 1.0",
    function () {

      assertEqual(
        validator.version,
        "1.0"
      );

    }
  );


  test(
    "Historical-only operating mode",
    function () {

      assertEqual(
        validator.mode,
        "HISTORICAL DATA ONLY"
      );

    }
  );


  test(
    "H1 timeframe is correctly configured",
    function () {

      assertEqual(
        validator.timeframes.H1,
        HOUR
      );

    }
  );


  test(
    "M15 timeframe is correctly configured",
    function () {

      assertEqual(
        validator.timeframes.M15,
        15 * MINUTE
      );

    }
  );


  test(
    "M5 timeframe is correctly configured",
    function () {

      assertEqual(
        validator.timeframes.M5,
        5 * MINUTE
      );

    }
  );


  // ----------------------------------
  // 2. VALID DATA TESTS
  // ----------------------------------

  test(
    "Valid H1 historical dataset passes",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        HOUR,
        5
      );

      const result = validate(
        candles,
        "H1"
      );

      assertEqual(
        result.status,
        "PASS"
      );

    }
  );


  test(
    "Valid M15 historical dataset passes",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        15 * MINUTE,
        5
      );

      const result = validate(
        candles,
        "M15"
      );

      assertEqual(
        result.status,
        "PASS"
      );

    }
  );


  test(
    "Valid M5 historical dataset passes",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        5 * MINUTE,
        5
      );

      const result = validate(
        candles,
        "M5"
      );

      assertEqual(
        result.status,
        "PASS"
      );

    }
  );


  // ----------------------------------
  // 3. DATASET VALIDATION
  // ----------------------------------

  test(
    "Non-array historical data fails",
    function () {

      const result = validate(
        null,
        "H1"
      );

      assertEqual(
        result.status,
        "FAIL"
      );

    }
  );


  test(
    "Empty dataset fails",
    function () {

      const result = validate(
        [],
        "H1"
      );

      assertEqual(
        result.status,
        "FAIL"
      );

    }
  );


  test(
    "Single candle dataset fails",
    function () {

      const result = validate(
        [makeCandle(BASE_TIME)],
        "H1"
      );

      assertEqual(
        result.status,
        "FAIL"
      );

    }
  );


  test(
    "Unsupported timeframe fails",
    function () {

      const result = validate(
        makeDataset(
          BASE_TIME,
          HOUR,
          3
        ),
        "M1"
      );

      assertEqual(
        result.status,
        "FAIL"
      );

    }
  );


  // ----------------------------------
  // 4. OHLC VALIDATION
  // ----------------------------------

  test(
    "High below low fails",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        HOUR,
        3
      );

      candles[1].high = 3980;

      candles[1].low = 3990;

      const result = validate(
        candles,
        "H1"
      );

      assertEqual(
        result.status,
        "FAIL"
      );

    }
  );


  test(
    "Invalid open value fails",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        HOUR,
        3
      );

      candles[1].open = "4000";

      const result = validate(
        candles,
        "H1"
      );

      assertEqual(
        result.status,
        "FAIL"
      );

    }
  );


  test(
    "High below close fails",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        HOUR,
        3
      );

      candles[1].high = 4002;

      candles[1].close = 4005;

      const result = validate(
        candles,
        "H1"
      );

      assertEqual(
        result.status,
        "FAIL"
      );

    }
  );


  // ----------------------------------
  // 5. TIMESTAMP VALIDATION
  // ----------------------------------

  test(
    "Invalid timestamp fails",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        HOUR,
        3
      );

      candles[1].timestampMs = "invalid";

      const result = validate(
        candles,
        "H1"
      );

      assertEqual(
        result.status,
        "FAIL"
      );

    }
  );


  test(
    "Duplicate timestamps fail",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        HOUR,
        3
      );

      candles[2].timestampMs =
        candles[1].timestampMs;

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
        1
      );

    }
  );


  test(
    "Out-of-order timestamps fail",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        HOUR,
        3
      );

      candles[2].timestampMs =
        BASE_TIME + (30 * MINUTE);

      const result = validate(
        candles,
        "H1"
      );

      assertEqual(
        result.status,
        "FAIL"
      );

    }
  );


  // ----------------------------------
  // 6. MISSING CANDLE TESTS
  // ----------------------------------

  test(
    "Unexplained missing candles generate warning",
    function () {

      const candles = [

        makeCandle(BASE_TIME),

        makeCandle(
          BASE_TIME + (3 * HOUR)
        )

      ];

      const result = validate(
        candles,
        "H1"
      );

      assertEqual(
        result.status,
        "WARNING"
      );

      assertEqual(
        result.statistics.expectedMissingCandles,
        2
      );

    }
  );


  // ----------------------------------
  // 7. WEEKEND CLOSURE TEST
  // ----------------------------------

  test(
    "Weekend closures are not treated as corrupt gaps",
    function () {

      const friday = Date.UTC(
        2026,
        0,
        2,
        21,
        0
      );

      const monday = Date.UTC(
        2026,
        0,
        5,
        0,
        0
      );

      const candles = [

        makeCandle(friday),

        makeCandle(monday)

      ];

      const result = validate(
        candles,
        "H1",
        {
          weekendClosure: {
            enabled: true,
            fridayCloseHour: 22,
            sundayOpenHour: 23
          }
        }
      );

      assertEqual(
        result.status,
        "PASS"
      );

    }
  );


  test(
    "Saturday is recognised as a market closure",
    function () {

      const saturday = Date.UTC(
        2026,
        0,
        3,
        12,
        0
      );

      assert(
        validator.isMarketClosed(
          saturday
        ),
        "Saturday was not recognised as closed."
      );

    }
  );


  // ----------------------------------
  // 8. MARKET HOLIDAY TEST
  // ----------------------------------

  test(
    "Configured market holiday is recognised",
    function () {

      const start = BASE_TIME;

      const candles = [

        makeCandle(start),

        makeCandle(
          start + (3 * HOUR)
        )

      ];

      const result = validate(
        candles,
        "H1",
        {
          marketClosures: [

            {
              startMs: start + HOUR,
              endMs: start + (2 * HOUR)
            }

          ]
        }
      );

      assertEqual(
        result.status,
        "PASS"
      );

    }
  );


  // ----------------------------------
  // 9. SPREAD TESTS
  // ----------------------------------

  test(
    "Missing optional spread generates warning",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        HOUR,
        3
      );

      delete candles[1].spread;

      const result = validate(
        candles,
        "H1"
      );

      assertEqual(
        result.status,
        "WARNING"
      );

    }
  );


  test(
    "Missing required spread fails",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        HOUR,
        3
      );

      delete candles[1].spread;

      const result = validate(
        candles,
        "H1",
        {
          spread: {
            required: true
          }
        }
      );

      assertEqual(
        result.status,
        "FAIL"
      );

    }
  );


  test(
    "Negative spread fails",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        HOUR,
        3
      );

      candles[1].spread = -5;

      const result = validate(
        candles,
        "H1"
      );

      assertEqual(
        result.status,
        "FAIL"
      );

    }
  );


  test(
    "Spread above configured maximum generates warning",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        HOUR,
        3
      );

      candles[1].spread = 10;

      const result = validate(
        candles,
        "H1",
        {
          spread: {
            maximum: 5
          }
        }
      );

      assertEqual(
        result.status,
        "WARNING"
      );

    }
  );


  // ----------------------------------
  // 10. TICK VOLUME TESTS
  // ----------------------------------

  test(
    "Missing optional tick volume generates warning",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        HOUR,
        3
      );

      delete candles[1].tickVolume;

      const result = validate(
        candles,
        "H1"
      );

      assertEqual(
        result.status,
        "WARNING"
      );

    }
  );


  test(
    "Missing required tick volume fails",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        HOUR,
        3
      );

      delete candles[1].tickVolume;

      const result = validate(
        candles,
        "H1",
        {
          tickVolume: {
            required: true
          }
        }
      );

      assertEqual(
        result.status,
        "FAIL"
      );

    }
  );


  test(
    "Negative tick volume fails",
    function () {

      const candles = makeDataset(
        BASE_TIME,
        HOUR,
        3
      );

      candles[1].tickVolume = -10;

      const result = validate(
        candles,
        "H1"
      );

      assertEqual(
        result.status,
        "FAIL"
      );

    }
  );


  // ----------------------------------
  // 11. CONFIGURATION TESTS
  // ----------------------------------

  test(
    "Invalid gap inspection limit fails",
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
          maxGapChecks: 0
        }
      );

      assertEqual(
        result.status,
        "FAIL"
      );

    }
  );


  test(
    "Invalid weekend closing hour fails",
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
          weekendClosure: {
            fridayCloseHour: 25
          }
        }
      );

      assertEqual(
        result.status,
        "FAIL"
      );

    }
  );


  // ----------------------------------
  // 12. NULL CANDLE SAFETY TEST
  // ----------------------------------

  test(
    "Null candle returns FAIL without crashing",
    function () {

      const candles = [

        makeCandle(BASE_TIME),

        null,

        makeCandle(
          BASE_TIME + (2 * HOUR)
        )

      ];

      const result = validate(
        candles,
        "H1"
      );

      assertEqual(
        result.status,
        "FAIL"
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
    "HISTORICAL VALIDATOR TEST REPORT"
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

  console.log(
    "======================================"
  );


  const report = {

    component: "GoldGuard Historical Data Validator",

    version: "1.0",

    mode: "HISTORICAL DATA ONLY",

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
