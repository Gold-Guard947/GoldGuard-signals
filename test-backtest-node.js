

/*

 GOLDGUARD NODE BACKTEST TESTS V1.1

 Tests actual historical backtest mechanics.

 BUY and SELL simulations.

 Take profit detection.

 Stop loss detection.

 Simultaneous SL/TP priority.

 WAIT signal protection.

 Open trade handling.

 Controlled test candles only.

 No live market data.

 No real trade execution.

*/

"use strict";

const assert = require("assert");

// Load browser-compatible components in Node.js.

global.window = global;

require("./data-adapter.js");

require("./backtest-engine.js");

let passed = 0;

let failed = 0;

console.log("\n==================================");

console.log(" GOLDGUARD BACKTEST TESTS V1.1");

console.log("==================================");

function test(name, callback) {

  try {

    callback();

    passed++;

    console.log("PASS:", name);

  } catch (error) {

    failed++;

    console.error("FAIL:", name);

    console.error(error.message);

  }

}

function timestamp(milliseconds) {

  const d = new Date(milliseconds);

  return (

    d.getUTCFullYear() + "." +

    String(d.getUTCMonth() + 1).padStart(2, "0") + "." +

    String(d.getUTCDate()).padStart(2, "0") + " " +

    String(d.getUTCHours()).padStart(2, "0") + ":" +

    String(d.getUTCMinutes()).padStart(2, "0") + ":" +

    String(d.getUTCSeconds()).padStart(2, "0")

  );

}

function candle(time, open, high, low, close) {

  return {

    Timestamp: timestamp(time),

    Open: open,

    High: high,

    Low: low,

    Close: close,

    TickVolume: 100,

    Spread: 2

  };

}

function makeData(direction, exitMode) {

  const base = Date.UTC(2025, 0, 1, 0, 0, 0);

  const h1 = [];

  const m15 = [];

  const m5 = [];

  // 50 valid H1 candles.

  for (let i = 0; i < 50; i++) {

    h1.push(candle(

      base - (50 - i) * 60 * 60 * 1000,

      100, 101, 99, 100

    ));

  }

  // 12 valid M15 candles.

  for (let i = 0; i < 12; i++) {

    m15.push(candle(

      base - (12 - i) * 15 * 60 * 1000,

      100, 101, 99, 100

    ));

  }

  // Four M5 candles.

  for (let i = 0; i < 4; i++) {

    let high = 101;

    let low = 99;

    // Final candle controls the simulated exit.

    if (i === 3) {

      if (direction === "BUY") {

        if (exitMode === "TP") {

          high = 102;

          low = 99.5;

        }

        if (exitMode === "SL") {

          high = 101;

          low = 99;

        }

        if (exitMode === "BOTH") {

          high = 102;

          low = 99;

        }

        if (exitMode === "OPEN") {

          high = 101;

          low = 99.5;

        }

      }

      if (direction === "SELL") {

        if (exitMode === "TP") {

          high = 100.5;

          low = 98;

        }

        if (exitMode === "SL") {

          high = 101;

          low = 99.5;

        }

        if (exitMode === "BOTH") {

          high = 101;

          low = 98;

        }

        if (exitMode === "OPEN") {

          high = 100.5;

          low = 99;

        }

      }

    }

    m5.push(candle(

      base + i * 5 * 60 * 1000,

      100,

      high,

      low,

      100

    ));

  }

  const signal = direction === "BUY"

    ? {

        status: "BUY",

        entry: 100,

        stopLoss: 99,

        takeProfit: 102

      }

    : {

        status: "SELL",

        entry: 100,

        stopLoss: 101,

        takeProfit: 98

      };

  let calls = 0;

  // Controlled signal interface.

  window.GoldGuardHistoricalIntegration = {

    analyze: function () {

      calls++;

      return {

        result: calls === 1

          ? signal

          : { status: "WAIT" }

      };

    }

  };

  return {

    symbol: "XAUUSD",

    h1: h1,

    m15: m15,

    m5: m5,

    newsBlocked: false

  };

}

function simulate(direction, exitMode) {

  const data = makeData(direction, exitMode);

  return window.GoldGuardBacktest.run(data);

}


// Test 1: Engine availability.

test("Backtest engine loads correctly", function () {

  assert.ok(window.GoldGuardBacktest);

  assert.strictEqual(
    window.GoldGuardBacktest.version,
    "1.1"
  );

  assert.strictEqual(
    typeof window.GoldGuardBacktest.run,
    "function"
  );

});

// Test 2: BUY reaches take profit.

test("BUY trade reaches take profit", function () {

  const result = simulate("BUY", "TP");

  assert.strictEqual(result.valid, true);

  assert.strictEqual(result.totalTrades, 1);

  assert.strictEqual(result.trades[0].direction, "BUY");

  assert.strictEqual(result.trades[0].outcome, "WIN");

  assert.strictEqual(result.statistics.wins, 1);

});

// Test 3: SELL reaches take profit.

test("SELL trade reaches take profit", function () {

  const result = simulate("SELL", "TP");

  assert.strictEqual(result.valid, true);

  assert.strictEqual(result.totalTrades, 1);

  assert.strictEqual(result.trades[0].direction, "SELL");

  assert.strictEqual(result.trades[0].outcome, "WIN");

  assert.strictEqual(result.statistics.wins, 1);

});

// Test 4: BUY reaches stop loss.

test("BUY trade reaches stop loss", function () {

  const result = simulate("BUY", "SL");

  assert.strictEqual(result.totalTrades, 1);

  assert.strictEqual(result.trades[0].outcome, "LOSS");

  assert.strictEqual(result.statistics.losses, 1);

});

// Test 5: SELL reaches stop loss.

test("SELL trade reaches stop loss", function () {

  const result = simulate("SELL", "SL");

  assert.strictEqual(result.totalTrades, 1);

  assert.strictEqual(result.trades[0].outcome, "LOSS");

  assert.strictEqual(result.statistics.losses, 1);

});

// Test 6: SL has priority when both levels are touched.

test("Stop loss wins when SL and TP hit together", function () {

  const result = simulate("BUY", "BOTH");

  assert.strictEqual(result.totalTrades, 1);

  assert.strictEqual(result.trades[0].outcome, "LOSS");

  assert.strictEqual(result.trades[0].exitPrice, 99);

});

// Test 7: Unfinished trade stays open.

test("Unfinished trade remains open", function () {

  const result = simulate("BUY", "OPEN");

  assert.strictEqual(result.totalTrades, 0);

  assert.ok(result.openTrade);

  assert.strictEqual(result.openTrade.direction, "BUY");

});

// Test 8: WAIT signals never open trades.

test("WAIT signals never open trades", function () {

  // Build historical data first.

  const data = makeData("BUY", "OPEN");

  // Override the BUY integration with WAIT.

  window.GoldGuardHistoricalIntegration = {

    analyze: function () {

      return {

        result: { status: "WAIT" }

      };

    }

  };

  const result = window.GoldGuardBacktest.run(data);

  assert.strictEqual(result.valid, true);

  assert.strictEqual(result.totalTrades, 0);

  assert.strictEqual(result.openTrade, null);

  assert.ok(result.statistics.waitSignals > 0);

});

// Final report.

console.log("\n==================================");

console.log(" GOLDGUARD TEST REPORT");

console.log("==================================");

console.log("PASSED:", passed);

console.log("FAILED:", failed);

console.log("TOTAL:", passed + failed);

if (failed > 0) {

  console.error("\nGOLDGUARD TESTS FAILED");

  process.exitCode = 1;

} else {

  console.log("\nALL GOLDGUARD TESTS PASSED");

}
