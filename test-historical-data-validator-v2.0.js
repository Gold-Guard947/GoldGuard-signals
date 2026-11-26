
/*
 GOLDGUARD HISTORICAL DATA VALIDATOR TESTS V2.0

 Reliability and regression testing.

 Tests:
 - Validator loading and version.
 - Large historical datasets.
 - Original dataset immutability.
 - Duplicate timestamps.
 - Out-of-order timestamps.
 - Invalid and non-positive prices.
 - OHLC relationship validation.
 - Missing required spread and tick volume.
 - Invalid spread and tick volume.
 - Friday and Sunday weekend boundaries.
 - Market closure boundaries.
 - Gap detection.
 - Global gap inspection limit.
 - Invalid nested configuration.
 - Unsupported timezone rejection.
 - Optional timestamp alignment.
 - Unsupported timeframe.
 - Empty and malformed datasets.
 - Provider timestamp strings are not silently parsed.

 Historical data only.
 No live market feed.
 No trade execution.
*/

(function () {
  "use strict";

  var assert = require("assert");

  var Validator = require(
    "./historical-data-validator-v2.0.js"
  );

  var passed = 0;
  var failed = 0;
  var results = [];

  function test(name, callback) {
    try {
      callback();

      passed += 1;

      results.push({
        test: name,
        result: "PASS"
      });

      console.log("PASS:", name);

    } catch (error) {
      failed += 1;

      results.push({
        test: name,
        result: "FAIL",
        error: error.message
      });

      console.error("FAIL:", name);
      console.error("      ", error.message);
    }
  }

  function makeCandle(timestampMs, overrides) {
    return Object.assign({
      timestampMs: timestampMs,
      open: 2000,
      high: 2010,
      low: 1990,
      close: 2005,
      spread: 20,
      tickVolume: 100
    }, overrides || {});
  }

  function makeDataset(count, interval, start) {
    var candles = [];

    for (var i = 0; i < count; i += 1) {
      candles.push(
        makeCandle(start + i * interval)
      );
    }

    return candles;
  }

  var M5 = Validator.TIMEFRAMES.M5;
  var H1 = Validator.TIMEFRAMES.H1;

  var MONDAY = Date.UTC(2026, 10, 23, 10, 0, 0);

  console.log("");
  console.log("==========================================");
  console.log(" GOLDGUARD HISTORICAL VALIDATOR V2.0 TESTS");
  console.log("==========================================");
  console.log("");

  // 1. Loading and version.

  test("Validator loads correctly", function () {
    assert.ok(Validator);
    assert.strictEqual(Validator.VERSION, "2.0");
  });

  test("Historical-only mode is declared", function () {
    assert.strictEqual(
      Validator.MODE,
      "HISTORICAL DATA ONLY"
    );
  });

  test("Validator API is immutable", function () {
    assert.strictEqual(
      Object.isFrozen(Validator),
      true
    );
  });

  // 2. Large historical datasets.

  test("20,000 M5 candles process successfully", function () {
    var candles = makeDataset(
      20000,
      M5,
      MONDAY
    );

    var result = Validator.validate(
      candles,
      "M5"
    );

    assert.strictEqual(result.status, "PASS");
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.stats.candleCount, 20000);
    assert.strictEqual(result.stats.validCandles, 20000);
  });

  test("10,000 H1 candles process successfully", function () {
    var candles = makeDataset(
      10000,
      H1,
      MONDAY
    );

    var result = Validator.validate(
      candles,
      "H1"
    );

    assert.strictEqual(result.status, "PASS");
    assert.strictEqual(result.stats.candleCount, 10000);
    assert.strictEqual(result.stats.invalidCandles, 0);
  });

  // 3. Dataset integrity.

  test("Original historical dataset is not modified", function () {
    var candles = makeDataset(
      10,
      M5,
      MONDAY
    );

    var original = JSON.stringify(candles);

    Validator.validate(candles, "M5");

    assert.strictEqual(
      JSON.stringify(candles),
      original
    );
  });

  test("Multiple duplicate timestamps are detected", function () {
    var candles = [
      makeCandle(MONDAY),
      makeCandle(MONDAY),
      makeCandle(MONDAY),
      makeCandle(MONDAY + M5)
    ];

    var result = Validator.validate(
      candles,
      "M5"
    );

    assert.strictEqual(result.status, "FAIL");
    assert.strictEqual(
      result.stats.duplicateTimestamps,
      2
    );
  });

  test("Out-of-order timestamps are detected", function () {
    var candles = [
      makeCandle(MONDAY),
      makeCandle(MONDAY + M5 * 2),
      makeCandle(MONDAY + M5)
    ];

    var result = Validator.validate(
      candles,
      "M5"
    );

    assert.strictEqual(result.status, "FAIL");
    assert.ok(
      result.stats.outOfOrderTimestamps > 0
    );
  });

  // 4. Price validation.

  test("Zero and negative prices are rejected", function () {
    var candles = [
      makeCandle(MONDAY, { open: 0 }),
      makeCandle(MONDAY + M5, { close: -1 })
    ];

    var result = Validator.validate(
      candles,
      "M5"
    );

    assert.strictEqual(result.status, "FAIL");
  });

  test("Invalid OHLC relationships are rejected", function () {
    var candles = [
      makeCandle(MONDAY, {
        open: 2000,
        high: 1990,
        low: 1980,
        close: 2005
      })
    ];

    var result = Validator.validate(
      candles,
      "M5"
    );

    assert.strictEqual(result.status, "FAIL");
  });

  test("Non-finite prices are rejected", function () {
    var candles = [
      makeCandle(MONDAY, {
        high: Infinity
      })
    ];

    var result = Validator.validate(
      candles,
      "M5"
    );

    assert.strictEqual(result.status, "FAIL");
  });

  // 5. Spread and tick volume.

  test("Missing optional spread produces a warning", function () {
    var candles = [
      makeCandle(MONDAY, {
        spread: undefined
      })
    ];

    var result = Validator.validate(
      candles,
      "M5"
    );

    assert.strictEqual(result.status, "WARNING");
    assert.strictEqual(result.stats.missingSpread, 1);
  });

  test("Missing required spread causes failure", function () {
    var candles = [
      makeCandle(MONDAY, {
        spread: undefined
      })
    ];

    var result = Validator.validate(
      candles,
      "M5",
      {
        requireSpread: true
      }
    );

    assert.strictEqual(result.status, "FAIL");
  });

  test("Invalid negative spread is rejected", function () {
    var candles = [
      makeCandle(MONDAY, {
        spread: -1
      })
    ];

    var result = Validator.validate(
      candles,
      "M5"
    );

    assert.strictEqual(result.status, "FAIL");
  });

  test("Missing required tick volume causes failure", function () {
    var candles = [
      makeCandle(MONDAY, {
        tickVolume: undefined
      })
    ];

    var result = Validator.validate(
      candles,
      "M5",
      {
        requireTickVolume: true
      }
    );

    assert.strictEqual(result.status, "FAIL");
  });

  test("Invalid negative tick volume is rejected", function () {
    var candles = [
      makeCandle(MONDAY, {
        tickVolume: -10
      })
    ];

    var result = Validator.validate(
      candles,
      "M5"
    );

    assert.strictEqual(result.status, "FAIL");
  });

  // 6. Weekend boundaries.

  test("Friday market closing boundary is recognized", function () {
    var fridayClose = Date.UTC(
      2026, 10, 27, 22, 0, 0
    );

    assert.strictEqual(
      Validator.isMarketClosed(fridayClose),
      true
    );
  });

  test("Friday before market closing remains open", function () {
    var fridayBeforeClose = Date.UTC(
      2026, 10, 27, 21, 0, 0
    );

    assert.strictEqual(
      Validator.isMarketClosed(fridayBeforeClose),
      false
    );
  });

  test("Sunday opening boundary convention is preserved", function () {
    var sundayOpenBoundary = Date.UTC(
      2026, 10, 29, 22, 0, 0
    );

    var sundayAfterOpen = Date.UTC(
      2026, 10, 29, 23, 0, 0
    );

    assert.strictEqual(
      Validator.isMarketClosed(sundayOpenBoundary),
      true
    );

    assert.strictEqual(
      Validator.isMarketClosed(sundayAfterOpen),
      false
    );
  });

  test("Saturday is recognized as closed", function () {
    var saturday = Date.UTC(
      2026, 10, 28, 12, 0, 0
    );

    assert.strictEqual(
      Validator.isMarketClosed(saturday),
      true
    );
  });

  // 7. Explicit market closures.

  test("Market closure start and end are inclusive", function () {
    var start = MONDAY + M5 * 10;
    var end = MONDAY + M5 * 12;

    var options = {
      marketClosures: [{
        startMs: start,
        endMs: end
      }]
    };

    assert.strictEqual(
      Validator.isMarketClosed(start, options),
      true
    );

    assert.strictEqual(
      Validator.isMarketClosed(end, options),
      true
    );

    assert.strictEqual(
      Validator.isMarketClosed(start - 1, options),
      false
    );
  });

  test("Malformed market closures are rejected", function () {
    var result = Validator.validate(
      [makeCandle(MONDAY)],
      "M5",
      {
        marketClosures: [{
          startMs: "invalid",
          endMs: MONDAY
        }]
      }
    );

    assert.strictEqual(result.status, "FAIL");
  });

  test("Reversed market closure boundaries are rejected", function () {
    var result = Validator.validate(
      [makeCandle(MONDAY)],
      "M5",
      {
        marketClosures: [{
          startMs: MONDAY + 1000,
          endMs: MONDAY
        }]
      }
    );

    assert.strictEqual(result.status, "FAIL");
  });

  // 8. Missing candle detection.

  test("Missing historical candle intervals are detected", function () {
    var candles = [
      makeCandle(MONDAY),
      makeCandle(MONDAY + M5 * 3)
    ];

    var result = Validator.validate(
      candles,
      "M5"
    );

    assert.strictEqual(result.status, "WARNING");
    assert.strictEqual(result.stats.detectedGaps, 2);
    assert.strictEqual(result.gaps.length, 2);
  });

  test("Gap inspection respects global maxGapChecks", function () {
    var candles = [
      makeCandle(MONDAY),
      makeCandle(MONDAY + M5 * 10)
    ];

    var result = Validator.validate(
      candles,
      "M5",
      {
        maxGapChecks: 2
      }
    );

    assert.strictEqual(result.status, "INCOMPLETE");
    assert.strictEqual(
      result.stats.checkedIntervals,
      2
    );

    assert.strictEqual(
      result.stats.gapInspectionTruncated,
      true
    );

    assert.strictEqual(result.complete, false);
  });

  // 9. Configuration validation.

  test("Invalid nested weekend configuration is rejected", function () {
    var result = Validator.validate(
      [makeCandle(MONDAY)],
      "M5",
      {
        weekend: {
          enabled: "yes",
          fridayCloseHour: 22,
          sundayOpenHour: 22
        }
      }
    );

    assert.strictEqual(result.status, "FAIL");
  });

  test("Unsupported timezone is rejected", function () {
    var result = Validator.validate(
      [makeCandle(MONDAY)],
      "M5",
      {
        timezone: "Africa/Johannesburg"
      }
    );

    assert.strictEqual(result.status, "FAIL");
  });

  test("Invalid maxIssues configuration is rejected", function () {
    var result = Validator.validate(
      [makeCandle(MONDAY)],
      "M5",
      {
        maxIssues: 0
      }
    );

    assert.strictEqual(result.status, "FAIL");
  });

  // 10. Timestamp alignment.

  test("Timestamp alignment is optional by default", function () {
    var candles = [
      makeCandle(MONDAY + 1234)
    ];

    var result = Validator.validate(
      candles,
      "M5"
    );

    assert.strictEqual(result.status, "PASS");
  });

  test("Enabled timestamp alignment detects misaligned candles", function () {
    var candles = [
      makeCandle(MONDAY + 1234)
    ];

    var result = Validator.validate(
      candles,
      "M5",
      {
        checkAlignment: true
      }
    );

    assert.strictEqual(result.status, "FAIL");
  });

  // 11. Input and format rejection.

  test("Unsupported timeframe is rejected", function () {
    var result = Validator.validate(
      [makeCandle(MONDAY)],
      "M1"
    );

    assert.strictEqual(result.status, "FAIL");
  });

  test("Empty candle dataset is rejected", function () {
    var result = Validator.validate(
      [],
      "M5"
    );

    assert.strictEqual(result.status, "FAIL");
  });

  test("Malformed candle entries are rejected", function () {
    var result = Validator.validate(
      [null],
      "M5"
    );

    assert.strictEqual(result.status, "FAIL");
  });

  test("Provider timestamp strings are not silently parsed", function () {
    var candles = [{
      Timestamp: "2026.11.23 10:00:00",
      Open: 2000,
      High: 2010,
      Low: 1990,
      Close: 2005,
      Spread: 20,
      TickVolume: 100
    }];

    var result = Validator.validate(
      candles,
      "M5"
    );

    assert.strictEqual(result.status, "FAIL");
  });

  // Final report.

  console.log("");
  console.log("==========================================");
  console.log(" GOLDGUARD V2.0 VALIDATOR TEST SUMMARY");
  console.log("==========================================");
  console.log("");

  console.table(results);

  console.log("");
  console.log("TOTAL TESTS:", passed + failed);
  console.log("PASSED:", passed);
  console.log("FAILED:", failed);

  console.log("");

  if (failed > 0) {
    console.error("V2.0 VALIDATOR TESTS FAILED.");
    process.exitCode = 1;
  } else {
    console.log("ALL V2.0 VALIDATOR TESTS PASSED.");
  }

})();
