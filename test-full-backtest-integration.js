
/*

 GOLDGUARD FULL BACKTEST INTEGRATION TEST V1.0

 Tests the REAL production components:

 - Data Adapter V1.1
 - Signal Engine V1.0
 - Historical Integration V1.2
 - Backtest Engine V1.0

 Uses controlled historical candles.

 No live market feed.
 No fabricated live prices.
 No real trade execution.

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

function formatTimestamp(date) {
  return date.getUTCFullYear() + "." +
    String(date.getUTCMonth() + 1).padStart(2, "0") + "." +
    String(date.getUTCDate()).padStart(2, "0") + " " +
    String(date.getUTCHours()).padStart(2, "0") + ":" +
    String(date.getUTCMinutes()).padStart(2, "0") + ":00";
}

function makeCandle(date, open, high, low, close) {
  return {
    Timestamp: formatTimestamp(date),
    Open: open,
    High: high,
    Low: low,
    Close: close,
    TickVolume: 100,
    Spread: 10
  };
}

function makeHistoricalData(overrides) {

  const target = new Date("2026-01-03T03:00:00Z");

  // H1: 50 completed candles with bullish direction.

  const h1 = [];

  for (let i = 0; i < 50; i++) {

    const date = new Date(
      target.getTime() - (50 - i) * 3600000
    );

    const close = 100 + i * 0.2;

    h1.push(
      makeCandle(
        date,
        close - 0.2,
        close + 0.5,
        close - 0.5,
        close
      )
    );
  }

  // M15: 11 previous candles followed by
  // one bullish liquidity sweep candle.

  const m15 = [];

  for (let i = 0; i < 11; i++) {

    const date = new Date(
      target.getTime() - (11 - i) * 900000
    );

    m15.push(
      makeCandle(
        date,
        104,
        110,
        100,
        105
      )
    );
  }

  m15.push(
    makeCandle(
      target,
      102,
      107,
      98,
      105
    )
  );

  // M5: confirmation followed by a candle
  // that reaches the simulated take profit.

  const m5 = [];

  m5.push(
    makeCandle(
      target,
      102,
      104,
      101,
      103
    )
  );

  m5.push(
    makeCandle(
      new Date(target.getTime() + 300000),
      103,
      105,
      102,
      104
    )
  );

  m5.push(
    makeCandle(
      new Date(target.getTime() + 600000),
      105.5,
      108,
      104.5,
      107
    )
  );

  // The next candle reaches the BUY take profit.

  m5.push(
    makeCandle(
      new Date(target.getTime() + 900000),
      107,
      126,
      106,
      124
    )
  );

  return Object.assign({
    symbol: "XAUUSD",
    h1: h1,
    m15: m15,
    m5: m5,
    newsBlocked: false
  }, overrides || {});
}

console.log("");
console.log("GOLDGUARD FULL BACKTEST INTEGRATION TEST");
console.log("---------------------------------------");

let loadError = null;

try {
  loadFile("data-adapter.js");
  loadFile("signal-engine.js");
  loadFile("historical-integration.js");
  loadFile("backtest-engine.js");
} catch (error) {
  loadError = error;
  console.error("FILE LOAD ERROR: " + error.message);
}

if (!loadError) {

  test("Real data adapter is loaded", function () {
    assert.strictEqual(
      typeof context.window.GoldGuardDataAdapter.convertCandles,
      "function"
    );
  });

  test("Real signal engine is loaded", function () {
    assert.strictEqual(
      typeof context.window.GoldGuardEngine.analyze,
      "function"
    );
  });

  test("Real historical integration is loaded", function () {
    assert.strictEqual(
      typeof context.window.GoldGuardHistoricalIntegration.analyze,
      "function"
    );
  });

  test("Real backtest engine is loaded", function () {
    assert.strictEqual(
      typeof context.window.GoldGuardBacktest.run,
      "function"
    );
  });

  test("Full historical pipeline completes successfully", function () {

    const result =
      context.window.GoldGuardBacktest.run(
        makeHistoricalData()
      );

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.status, "COMPLETED");
    assert.strictEqual(result.mode, "HISTORICAL SIMULATION ONLY");
  });

  test("Real signal engine opens a BUY trade", function () {

    const result =
      context.window.GoldGuardBacktest.run(
        makeHistoricalData()
      );

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.totalTrades, 1);
    assert.strictEqual(result.trades[0].direction, "BUY");
  });

  test("Historical BUY trade reaches take profit", function () {

    const result =
      context.window.GoldGuardBacktest.run(
        makeHistoricalData()
      );

    assert.strictEqual(result.trades[0].outcome, "WIN");
    assert.strictEqual(result.trades[0].exitPrice, 125);
    assert.strictEqual(result.statistics.wins, 1);
    assert.strictEqual(result.statistics.losses, 0);
  });

  test("Risk remains at 0.5 percent", function () {

    const result =
      context.window.GoldGuardBacktest.run(
        makeHistoricalData()
      );

    assert.strictEqual(result.riskPercent, 0.5);
    assert.strictEqual(result.trades[0].rMultiple, 2);
    assert.strictEqual(result.trades[0].profitPercent, 1);
  });

  test("Ending equity reflects the winning trade", function () {

    const result =
      context.window.GoldGuardBacktest.run(
        makeHistoricalData()
      );

    assert.strictEqual(result.startingEquity, 100);
    assert.strictEqual(result.endingEquity, 101);
    assert.strictEqual(result.netReturnPercent, 1);
  });

  test("News protection prevents trade entry", function () {

    const result =
      context.window.GoldGuardBacktest.run(
        makeHistoricalData({ newsBlocked: true })
      );

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.totalTrades, 0);
    assert.strictEqual(result.statistics.waitSignals, 2);
  });

  test("Invalid historical timestamps are rejected", function () {

    const data = makeHistoricalData();

    data.m5[1].Timestamp = data.m5[0].Timestamp;

    const result =
      context.window.GoldGuardBacktest.run(data);

    assert.strictEqual(result.valid, false);
    assert.ok(result.reason.length > 0);
  });

  test("Unverified news status is rejected", function () {

    const result =
      context.window.GoldGuardBacktest.run(
        makeHistoricalData({ newsBlocked: null })
      );

    assert.strictEqual(result.valid, false);
    assert.ok(result.reason.includes("News status"));
  });

} else {
  failed++;
  console.error("Integration tests skipped because files could not load.");
}

console.log("---------------------------------------");
console.log("PASSED: " + passed);
console.log("FAILED: " + failed);
console.log("TOTAL: " + (passed + failed));
console.log("---------------------------------------");

if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log("ALL FULL BACKTEST INTEGRATION TESTS PASSED");
}
