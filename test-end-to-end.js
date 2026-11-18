
/*

 GOLDGUARD END-TO-END INTEGRATION TEST V1.0

 Tests the REAL:
 - Signal engine
 - Historical data adapter
 - Historical integration

 Uses controlled historical candles only.

 No live market feed.
 No trade execution.
 No simulated integration.

*/

"use strict";

const fs = require("fs");
const vm = require("vm");
const path = require("path");
const assert = require("assert");

let passed = 0;
let failed = 0;

function test(name, callback) {
  try {
    callback();
    passed++;
    console.log("PASS: " + name);
  } catch (error) {
    failed++;
    console.error("FAIL: " + name);
    console.error(error.message);
  }
}

const context = {
  window: {},
  console: console,
  Date: Date,
  Math: Math,
  Number: Number,
  Array: Array,
  Object: Object
};

vm.createContext(context);

function loadFile(filename) {
  const filePath = path.join(__dirname, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error("Required file missing: " + filename);
  }

  const source = fs.readFileSync(filePath, "utf8");

  vm.runInContext(source, context, {
    filename: filename
  });
}

function timestamp(date) {
  return date.getUTCFullYear() + "." +
    String(date.getUTCMonth() + 1).padStart(2, "0") + "." +
    String(date.getUTCDate()).padStart(2, "0") + " " +
    String(date.getUTCHours()).padStart(2, "0") + ":" +
    String(date.getUTCMinutes()).padStart(2, "0") + ":00";
}

function makeCandle(date, open, high, low, close) {
  return {
    Timestamp: timestamp(date),
    Open: open,
    High: high,
    Low: low,
    Close: close,
    TickVolume: 100,
    Spread: 10
  };
}

function makeH1() {
  const candles = [];
  const start = new Date("2026-01-01T00:00:00Z");

  for (let i = 0; i < 50; i++) {
    const close = 50 + i;

    candles.push(
      makeCandle(
        new Date(start.getTime() + i * 3600000),
        close - 0.2,
        close + 0.5,
        close - 0.5,
        close
      )
    );
  }

  return candles;
}

function makeM15() {
  const candles = [];
  const start = new Date("2026-01-01T00:00:00Z");

  for (let i = 0; i < 11; i++) {
    candles.push(
      makeCandle(
        new Date(start.getTime() + i * 900000),
        104,
        110,
        100,
        105
      )
    );
  }

  // Final candle sweeps below previous lows
  // and closes back above the previous low.

  candles.push(
    makeCandle(
      new Date(start.getTime() + 11 * 900000),
      102,
      107,
      98,
      105
    )
  );

  return candles;
}

function makeM5() {
  const candles = [];
  const start = new Date("2026-01-01T00:00:00Z");

  candles.push(
    makeCandle(
      start,
      102,
      104,
      101,
      103
    )
  );

  candles.push(
    makeCandle(
      new Date(start.getTime() + 300000),
      103,
      105,
      102,
      104
    )
  );

  // Final candle closes above previous M5 high.

  candles.push(
    makeCandle(
      new Date(start.getTime() + 600000),
      105.5,
      108,
      104.5,
      107
    )
  );

  return candles;
}

function makeData(overrides) {
  return Object.assign({
    symbol: "XAUUSD",
    h1: makeH1(),
    m15: makeM15(),
    m5: makeM5(),
    newsBlocked: false
  }, overrides || {});
}

console.log("");
console.log("GOLDGUARD END-TO-END INTEGRATION TEST");
console.log("-------------------------------------");

// Load the actual production files.

let loadError = null;

try {
  loadFile("signal-engine.js");
  loadFile("data-adapter.js");
  loadFile("historical-integration.js");
} catch (error) {
  loadError = error;
  console.error("FILE LOAD ERROR: " + error.message);
}

if (!loadError) {

  test("Real signal engine is loaded", function () {
    assert.strictEqual(
      typeof context.window.GoldGuardEngine.analyze,
      "function"
    );
  });

  test("Real historical data adapter is loaded", function () {
    assert.strictEqual(
      typeof context.window.GoldGuardDataAdapter.convertCandles,
      "function"
    );
  });

  test("Real historical integration is loaded", function () {
    assert.strictEqual(
      typeof context.window.GoldGuardHistoricalIntegration.analyze,
      "function"
    );
  });

  test("Valid bullish historical setup produces BUY", function () {
    const result =
      context.window.GoldGuardHistoricalIntegration.analyze(
        makeData()
      );

    assert.strictEqual(result.status, "BUY");
    assert.strictEqual(result.result.status, "BUY");
    assert.strictEqual(result.result.h1Bias, "BULLISH");
    assert.strictEqual(result.result.m15Sweep, true);
    assert.strictEqual(result.result.m5Confirmation, true);
    assert.strictEqual(result.result.riskPercent, 0.5);
  });

  test("Major news protection produces WAIT", function () {
    const result =
      context.window.GoldGuardHistoricalIntegration.analyze(
        makeData({ newsBlocked: true })
      );

    assert.strictEqual(result.status, "WAIT");
    assert.strictEqual(
      result.reason,
      "Major economic news protection"
    );
  });

  test("Unverified news status produces WAIT", function () {
    const result =
      context.window.GoldGuardHistoricalIntegration.analyze(
        makeData({ newsBlocked: null })
      );

    assert.strictEqual(result.status, "WAIT");
    assert.ok(result.reason.includes("News status"));
  });

  test("Invalid OHLC data is rejected safely", function () {
    const data = makeData();

    data.m5[2].High = 90;

    const result =
      context.window.GoldGuardHistoricalIntegration.analyze(data);

    assert.strictEqual(result.status, "WAIT");
    assert.ok(result.reason.length > 0);
  });

  test("Insufficient historical candles produce WAIT", function () {
    const data = makeData();

    data.h1 = data.h1.slice(0, 20);

    const result =
      context.window.GoldGuardHistoricalIntegration.analyze(data);

    assert.strictEqual(result.status, "WAIT");
  });

  test("Missing market data produces WAIT", function () {
    const result =
      context.window.GoldGuardHistoricalIntegration.analyze({
        symbol: "XAUUSD",
        newsBlocked: false
      });

    assert.strictEqual(result.status, "WAIT");
  });

} else {
  failed++;
  console.error("Integration tests skipped because files could not load.");
}

console.log("-------------------------------------");
console.log("PASSED: " + passed);
console.log("FAILED: " + failed);
console.log("-------------------------------------");

if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log("END-TO-END INTEGRATION TESTS PASSED");
}
