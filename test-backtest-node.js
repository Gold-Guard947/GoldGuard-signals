
/*

 GOLDGUARD NODE BACKTEST TESTS V1.3

 Reliability regression testing.

 Preserves V1.2 tests and adds:
 - SELL stop-loss gap-through execution.
 - Correct Bid-based SELL exit reference.
 - Protection against double spread application.

 Historical candles only.
 No live market data.
 No real trade execution.

*/

"use strict";

const assert = require("assert");

// Load browser-compatible components in Node.js.

global.window = global;

require("./data-adapter.js");
require("./execution-cost.js");
require("./backtest-engine.js");

let passed = 0;
let failed = 0;

console.log("\n==================================");
console.log(" GOLDGUARD BACKTEST TESTS V1.3");
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

  // Five M5 candles.
  // Candle 3 executes the pending entry.
  // Candle 4 tests the trade exit.

  for (let i = 0; i < 5; i++) {

    let open = 100;
    let high = 100.5;
    let low = 99.5;
    let close = 100;

    // Final candle controls simulated exit.

    if (i === 4) {

      if (direction === "BUY") {

        if (exitMode === "TP") {
          high = 102.1;
          low = 99.5;
        }

        if (exitMode === "SL") {
          high = 101;
          low = 99;
        }

        if (exitMode === "BOTH") {
          high = 102.1;
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
          low = 97.9;
        }

        if (exitMode === "SL") {
          high = 101;
          low = 99.5;
        }

        if (exitMode === "BOTH") {
          high = 101;
          low = 97.9;
        }

        if (exitMode === "OPEN") {
          high = 100.5;
          low = 99;
        }

        // Regression scenario:
        // Market gaps above the SELL stop loss.
        // Bid opens at 101.20.
        // Ask opens at 101.22.
        // Expected SELL exit must be 101.22,
        // not 101.24 from double spread application.

        if (exitMode === "SELL_GAP_SL") {

          open = 101.20;
          high = 101.30;
          low = 101.10;
          close = 101.20;

        }

      }

    }

    m5.push(candle(
      base + i * 5 * 60 * 1000,
      open,
      high,
      low,
      close
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

    newsBlocked: false,

    // Explicit test-only broker configuration.

    executionCosts: {

      broker: "TEST BROKER",
      account: "TEST",

      pointSize: 0.01,

      spreadPoints: 2,

      slippagePoints: 0,

      commissionPerLot: 0,

      commissionCurrency: "USD",

      commissionMode: "ROUND_TURN",

      lots: 0.01

    }

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
    "1.2"
  );

  assert.strictEqual(
    typeof window.GoldGuardBacktest.run,
    "function"
  );

});

// Test 2: Execution cost calculator loads.

test("Execution cost calculator loads correctly", function () {

  assert.ok(window.GoldGuardExecutionCost);

  assert.strictEqual(
    typeof window.GoldGuardExecutionCost.calculateExecution,
    "function"
  );

});

// Test 3: BUY reaches take profit.

test("BUY trade reaches take profit", function () {

  const result = simulate("BUY", "TP");

  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.totalTrades, 1);
  assert.strictEqual(result.trades[0].direction, "BUY");
  assert.strictEqual(result.trades[0].outcome, "WIN");
  assert.strictEqual(result.statistics.wins, 1);

});

// Test 4: SELL reaches take profit.

test("SELL trade reaches take profit", function () {

  const result = simulate("SELL", "TP");

  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.totalTrades, 1);
  assert.strictEqual(result.trades[0].direction, "SELL");
  assert.strictEqual(result.trades[0].outcome, "WIN");
  assert.strictEqual(result.statistics.wins, 1);

});

// Test 5: BUY reaches stop loss.

test("BUY trade reaches stop loss", function () {

  const result = simulate("BUY", "SL");

  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.totalTrades, 1);
  assert.strictEqual(result.trades[0].outcome, "LOSS");
  assert.strictEqual(result.statistics.losses, 1);

});

// Test 6: SELL reaches stop loss.

test("SELL trade reaches stop loss", function () {

  const result = simulate("SELL", "SL");

  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.totalTrades, 1);
  assert.strictEqual(result.trades[0].outcome, "LOSS");
  assert.strictEqual(result.statistics.losses, 1);

});

// Test 7: SL has priority when both levels are touched.

test("Stop loss wins when SL and TP hit together", function () {

  const result = simulate("BUY", "BOTH");

  assert.strictEqual(result.totalTrades, 1);
  assert.strictEqual(result.trades[0].outcome, "LOSS");
  assert.strictEqual(result.trades[0].exitPrice, 99);

});

// Test 8: Unfinished trade stays open.

test("Unfinished trade remains open", function () {

  const result = simulate("BUY", "OPEN");

  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.totalTrades, 0);
  assert.ok(result.openTrade);
  assert.strictEqual(result.openTrade.direction, "BUY");

});

// Test 9: WAIT signals never open trades.

test("WAIT signals never open trades", function () {

  const data = makeData("BUY", "OPEN");

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

// Test 10: Missing execution configuration is rejected.

test("Missing execution costs are rejected", function () {

  const data = makeData("BUY", "TP");

  delete data.executionCosts;

  const result = window.GoldGuardBacktest.run(data);

  assert.strictEqual(result.valid, false);

  assert.ok(
    result.reason.includes("executionCosts")
  );

});

// Test 11: BUY entry uses Ask plus spread.

test("BUY entry includes historical spread", function () {

  const result = simulate("BUY", "OPEN");

  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.openTrade.entry, 100.02);

  assert.strictEqual(
    result.openTrade.entrySpreadPoints,
    2
  );

});

// Test 12: SELL entry uses Bid.

test("SELL entry uses historical Bid", function () {

  const result = simulate("SELL", "OPEN");

  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.openTrade.entry, 100);

});

// Test 13: Execution cost configuration is reported.

test("Execution cost configuration is reported", function () {

  const result = simulate("BUY", "OPEN");

  assert.strictEqual(result.valid, true);

  assert.strictEqual(
    result.executionCosts.enabled,
    true
  );

  assert.strictEqual(
    result.executionCosts.pointSize,
    0.01
  );

  assert.strictEqual(
    result.executionCosts.slippagePoints,
    0
  );

});

// Test 14: SELL gap-through stop loss uses Bid reference.

test("SELL gap stop loss does not apply spread twice", function () {

  const result = simulate("SELL", "SELL_GAP_SL");

  assert.strictEqual(result.valid, true);

  assert.strictEqual(result.totalTrades, 1);

  const trade = result.trades[0];

  assert.strictEqual(trade.direction, "SELL");

  assert.strictEqual(trade.exitReason, "STOP_LOSS_GAP");

  assert.strictEqual(trade.outcome, "LOSS");

  // Historical Bid opening price: 101.20
  // Historical spread: 0.02
  // Expected executable Ask exit: 101.22
  // Double-spread error would produce 101.24.

  assert.strictEqual(
    trade.exitPrice,
    101.22,
    "SELL gap stop loss applied historical spread more than once"
  );

});

// Final report.

console.log("\n==================================");
console.log(" GOLDGUARD V1.3 REGRESSION REPORT");
console.log("==================================");

console.log("PASSED:", passed);
console.log("FAILED:", failed);
console.log("TOTAL:", passed + failed);

if (failed > 0) {

  console.error("\nGOLDGUARD REGRESSION TESTS FAILED");

  process.exitCode = 1;

} else {

  console.log("\nALL GOLDGUARD REGRESSION TESTS PASSED");

}
