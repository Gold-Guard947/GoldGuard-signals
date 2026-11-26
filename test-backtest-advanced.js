
/*

 GOLDGUARD ADVANCED BACKTEST TESTS V1.2

 Advanced historical simulation validation.

 Tests:
 - Backtest engine availability
 - Missing historical data
 - Missing integration
 - Missing news verification
 - Invalid signal prices
 - Incorrect BUY/SELL price relationships
 - Chronological candle validation
 - Incomplete candle protection
 - Simultaneous SL/TP priority
 - Consecutive losing trades
 - Compounded equity
 - Maximum drawdown
 - Consecutive winning trades
 - Open trade protection
 - Invalid timeframe data

 Controlled test candles only.
 No live market data.
 No real trade execution.

*/

"use strict";

const assert = require("assert");

global.window = global;

// Load browser-compatible components in the correct order.

require("./data-adapter.js");
require("./execution-cost.js");
require("./backtest-engine.js");

let passed = 0;
let failed = 0;

console.log("\n==================================");
console.log(" GOLDGUARD ADVANCED TESTS V1.2");
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

function makeData(plans) {
  const base = Date.UTC(2025, 0, 1);

  const h1 = [];
  const m15 = [];
  const m5 = [];

  for (let i = 0; i < 50; i++) {
    h1.push(candle(
      base - (50 - i) * 3600000,
      100, 101, 99, 100
    ));
  }

  for (let i = 0; i < 12; i++) {
    m15.push(candle(
      base - (12 - i) * 900000,
      100, 101, 99, 100
    ));
  }

  const total = plans.length * 2 + 3;

  for (let i = 0; i < total; i++) {
    let high = 100.5;
    let low = 99.5;

    const index = Math.floor((i - 3) / 2);

    if (
      i >= 3 &&
      i % 2 === 1 &&
      index >= 0 &&
      index < plans.length
    ) {
      const plan = plans[index];

      if (plan.outcome === "TP") {
        high = plan.direction === "BUY" ? 102.1 : 100.5;
        low = plan.direction === "SELL" ? 97.9 : 99.5;
      }

      if (plan.outcome === "SL") {
        high = plan.direction === "SELL" ? 101 : 100.5;
        low = plan.direction === "BUY" ? 99 : 99.5;
      }

      if (plan.outcome === "BOTH") {
        high = 102.1;
        low = 97.9;
      }
    }

    m5.push(candle(
      base + i * 300000,
      100, high, low, 100
    ));
  }

  let calls = 0;

  window.GoldGuardHistoricalIntegration = {
    analyze: function () {
      const plan = plans[calls++];

      if (!plan) {
        return { result: { status: "WAIT" } };
      }

      return {
        result: {
          status: plan.direction,
          entry: plan.entry === undefined ? 100 : plan.entry,
          stopLoss: plan.stopLoss === undefined
            ? (plan.direction === "BUY" ? 99 : 101)
            : plan.stopLoss,
          takeProfit: plan.takeProfit === undefined
            ? (plan.direction === "BUY" ? 102 : 98)
            : plan.takeProfit
        }
      };
    }
  };

  return {
    symbol: "XAUUSD",
    h1,
    m15,
    m5,
    newsBlocked: false,

    executionCosts: {
      broker: "TEST BROKER",
      account: "TEST",
      symbol: "XAUUSD",
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

function simulate(plans) {
  return window.GoldGuardBacktest.run(makeData(plans));
}

function buy(outcome) {
  return { direction: "BUY", outcome };
}

function sell(outcome) {
  return { direction: "SELL", outcome };
}

// TEST 1: Engine availability.

test("Backtest engine loads correctly", function () {
  assert.ok(window.GoldGuardBacktest);

  assert.strictEqual(
    typeof window.GoldGuardBacktest.run,
    "function"
  );
});

// TEST 2: Missing historical data.

test("Missing historical data is rejected", function () {
  const result = window.GoldGuardBacktest.run(null);

  assert.strictEqual(result.valid, false);
});

// TEST 3: Missing integration.

test("Missing historical integration is rejected", function () {
  const data = makeData([]);
  const original = window.GoldGuardHistoricalIntegration;

  try {
    delete window.GoldGuardHistoricalIntegration;

    const result = window.GoldGuardBacktest.run(data);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(
      result.reason,
      "Historical integration missing"
    );
  } finally {
    window.GoldGuardHistoricalIntegration = original;
  }
});

// TEST 4: Missing news verification.

test("Unverified news status is rejected", function () {
  const data = makeData([]);

  delete data.newsBlocked;

  const result = window.GoldGuardBacktest.run(data);

  assert.strictEqual(result.valid, false);
});

// TEST 5: Invalid BUY stop loss.

test("Invalid BUY stop loss is rejected", function () {
  const result = simulate([
    {
      direction: "BUY",
      outcome: "TP",
      stopLoss: 101
    }
  ]);

  assert.strictEqual(result.statistics.invalidSignals, 1);
  assert.strictEqual(result.totalTrades, 0);
});

// TEST 6: Invalid BUY take profit.

test("Invalid BUY take profit is rejected", function () {
  const result = simulate([
    {
      direction: "BUY",
      outcome: "TP",
      takeProfit: 99
    }
  ]);

  assert.strictEqual(result.statistics.invalidSignals, 1);
  assert.strictEqual(result.totalTrades, 0);
});

// TEST 7: Invalid SELL stop loss.

test("Invalid SELL stop loss is rejected", function () {
  const result = simulate([
    {
      direction: "SELL",
      outcome: "TP",
      stopLoss: 99
    }
  ]);

  assert.strictEqual(result.statistics.invalidSignals, 1);
  assert.strictEqual(result.totalTrades, 0);
});

// TEST 8: Invalid SELL take profit.

test("Invalid SELL take profit is rejected", function () {
  const result = simulate([
    {
      direction: "SELL",
      outcome: "TP",
      takeProfit: 101
    }
  ]);

  assert.strictEqual(result.statistics.invalidSignals, 1);
  assert.strictEqual(result.totalTrades, 0);
});

// TEST 9: Zero entry price.

test("Zero entry price is rejected", function () {
  const result = simulate([
    {
      direction: "BUY",
      outcome: "TP",
      entry: 0
    }
  ]);

  assert.strictEqual(result.statistics.invalidSignals, 1);
  assert.strictEqual(result.totalTrades, 0);
});

// TEST 10: Chronological candle validation.

test("Duplicate historical timestamps are rejected", function () {
  const data = makeData([]);

  data.h1[1].Timestamp = data.h1[0].Timestamp;

  const result = window.GoldGuardBacktest.run(data);

  assert.strictEqual(result.valid, false);
});

// TEST 11: Incomplete future candle protection.

test("Future M5 candle is excluded from signal analysis", function () {
  const data = makeData([]);

  const originalLength = data.m5.length;

  const lastTime = Date.UTC(2025, 0, 1) +
    (originalLength - 1) * 300000;

  data.m5.push(candle(
    lastTime + 300000,
    100, 105, 95, 100
  ));

  let firstAnalysis = null;

  window.GoldGuardHistoricalIntegration = {
    analyze: function (input) {
      if (firstAnalysis === null) {
        firstAnalysis = input;
      }

      return {
        result: { status: "WAIT" }
      };
    }
  };

  const result = window.GoldGuardBacktest.run(data);

  assert.strictEqual(result.valid, true);
  assert.ok(firstAnalysis);

  assert.strictEqual(
    firstAnalysis.m5.length,
    3
  );

  assert.strictEqual(
    firstAnalysis.m5[2].Timestamp,
    data.m5[2].Timestamp
  );
});

// TEST 12: Simultaneous BUY SL and TP.

test("BUY simultaneous SL and TP prioritises SL", function () {
  const result = simulate([
    buy("BOTH")
  ]);

  assert.strictEqual(result.totalTrades, 1);

  assert.strictEqual(
    result.trades[0].outcome,
    "LOSS"
  );
});

// TEST 13: Simultaneous SELL SL and TP.

test("SELL simultaneous SL and TP prioritises SL", function () {
  const result = simulate([
    sell("BOTH")
  ]);

  assert.strictEqual(result.totalTrades, 1);

  assert.strictEqual(
    result.trades[0].outcome,
    "LOSS"
  );
});

// TEST 14: Consecutive losses.

test("Three consecutive losses are counted correctly", function () {
  const result = simulate([
    buy("SL"),
    buy("SL"),
    sell("SL")
  ]);

  assert.strictEqual(result.totalTrades, 3);
  assert.strictEqual(result.statistics.losses, 3);
  assert.strictEqual(result.statistics.wins, 0);
});

// TEST 15: Consecutive loss equity.

test("Three consecutive losses compound correctly", function () {
  const result = simulate([
    buy("SL"),
    buy("SL"),
    sell("SL")
  ]);

  assert.ok(
    Math.abs(result.endingEquity - 98.5075) < 0.0001
  );
});

// TEST 16: Consecutive loss drawdown.

test("Three consecutive losses produce correct drawdown", function () {
  const result = simulate([
    buy("SL"),
    buy("SL"),
    sell("SL")
  ]);

  assert.ok(
    Math.abs(result.maxDrawdownPercent - 1.4925) < 0.0001
  );
});

// TEST 17: Multiple winning trades.

test("Three consecutive wins compound correctly", function () {
  const result = simulate([
    buy("TP"),
    buy("TP"),
    sell("TP")
  ]);

  assert.strictEqual(result.totalTrades, 3);
  assert.strictEqual(result.statistics.wins, 3);

  assert.ok(
    Math.abs(result.endingEquity - 103.0301) < 0.0001
  );
});

// TEST 18: Open trade protection.

test("Unclosed trade remains excluded from statistics", function () {
  const result = simulate([
    {
      direction: "BUY",
      outcome: "OPEN"
    }
  ]);

  assert.strictEqual(result.totalTrades, 0);
  assert.strictEqual(result.statistics.wins, 0);
  assert.strictEqual(result.statistics.losses, 0);

  assert.ok(result.openTrade);

  assert.strictEqual(
    result.openTrade.direction,
    "BUY"
  );
});

// TEST 19: Invalid timeframe data.

test("Invalid timeframe data is rejected", function () {
  const data = makeData([]);

  data.h1 = [];

  const result = window.GoldGuardBacktest.run(data);

  assert.strictEqual(result.valid, false);
});

// FINAL REPORT.

console.log("\n==================================");
console.log(" GOLDGUARD ADVANCED TEST REPORT V1.2");
console.log("==================================");

console.log("PASSED:", passed);
console.log("FAILED:", failed);
console.log("TOTAL:", passed + failed);

if (failed > 0) {
  console.error("\nGOLDGUARD ADVANCED TESTS FAILED");
  process.exitCode = 1;
} else {
  console.log("\nALL GOLDGUARD ADVANCED TESTS PASSED");
}
