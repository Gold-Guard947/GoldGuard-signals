

/*

 GOLDGUARD NODE BACKTEST TESTS V1.2

 Historical results validation.

 Tests:

 - Engine availability

 - BUY and SELL outcomes

 - Win/loss statistics

 - Win rate

 - Compounded equity

 - Net return

 - Maximum drawdown

 - Zero closed trades

 - Open trade exclusion

 - Multiple consecutive trades

 Controlled test candles only.

 No live market data.

 No real trade execution.

*/

"use strict";

const assert = require("assert");

global.window = global;

require("./data-adapter.js");

require("./backtest-engine.js");

let passed = 0;

let failed = 0;

console.log("\n==================================");

console.log(" GOLDGUARD BACKTEST TESTS V1.2");

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

// Controlled chronological historical data.

function makeData(tradePlans) {

  const base = Date.UTC(2025, 0, 1, 0, 0, 0);

  const h1 = [];

  const m15 = [];

  const m5 = [];

  for (let i = 0; i < 50; i++) {

    h1.push(candle(

      base - (50 - i) * 60 * 60 * 1000,

      100, 101, 99, 100

    ));

  }

  for (let i = 0; i < 12; i++) {

    m15.push(candle(

      base - (12 - i) * 15 * 60 * 1000,

      100, 101, 99, 100

    ));

  }

  // Three initial candles establish signal readiness.

  // Each trade receives one signal candle and one exit candle.

  const totalCandles = tradePlans.length * 2 + 3;

  for (let i = 0; i < totalCandles; i++) {

    let high = 100.5;

    let low = 99.5;

    // Exit candle for each planned trade.

    const tradeIndex = Math.floor((i - 3) / 2);

    if (

      i >= 3 &&

      i % 2 === 1 &&

      tradeIndex >= 0 &&

      tradeIndex < tradePlans.length

    ) {

      const plan = tradePlans[tradeIndex];

      if (plan.outcome === "TP") {

        if (plan.direction === "BUY") {

          high = 102;

        } else {

          low = 98;

        }

      }

      if (plan.outcome === "SL") {

        if (plan.direction === "BUY") {

          low = 99;

        } else {

          high = 101;

        }

      }

      // OPEN trades deliberately touch neither exit level.

    }

    m5.push(candle(

      base + i * 5 * 60 * 1000,

      100,

      high,

      low,

      100

    ));

  }

  let calls = 0;

  window.GoldGuardHistoricalIntegration = {

    analyze: function () {

      const plan = tradePlans[calls];

      calls++;

      if (!plan) {

        return { result: { status: "WAIT" } };

      }

      if (plan.direction === "BUY") {

        return {

          result: {

            status: "BUY",

            entry: 100,

            stopLoss: 99,

            takeProfit: 102

          }

        };

      }

      return {

        result: {

          status: "SELL",

          entry: 100,

          stopLoss: 101,

          takeProfit: 98

        }

      };

    }

  };

  return {

    symbol: "XAUUSD",

    h1,

    m15,

    m5,

    newsBlocked: false

  };

}

function simulate(tradePlans) {

  return window.GoldGuardBacktest.run(

    makeData(tradePlans)

  );

}

function buyTP() {

  return { direction: "BUY", outcome: "TP" };

}

function buySL() {

  return { direction: "BUY", outcome: "SL" };

}

function sellTP() {

  return { direction: "SELL", outcome: "TP" };

}

function sellSL() {

  return { direction: "SELL", outcome: "SL" };

}

// TEST 1: Engine availability.

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

// TEST 2: BUY trade count.

test("BUY trade is counted correctly", function () {

  const result = simulate([buyTP()]);

  assert.strictEqual(result.valid, true);

  assert.strictEqual(result.totalTrades, 1);

  assert.strictEqual(result.trades[0].direction, "BUY");

});

// TEST 3: BUY win.

test("BUY trade reaches take profit", function () {

  const result = simulate([buyTP()]);

  assert.strictEqual(result.trades[0].outcome, "WIN");

  assert.strictEqual(result.statistics.wins, 1);

});

// TEST 4: SELL win.

test("SELL trade reaches take profit", function () {

  const result = simulate([sellTP()]);

  assert.strictEqual(result.trades[0].direction, "SELL");

  assert.strictEqual(result.trades[0].outcome, "WIN");

  assert.strictEqual(result.statistics.wins, 1);

});

// TEST 5: BUY loss.

test("BUY trade reaches stop loss", function () {

  const result = simulate([buySL()]);

  assert.strictEqual(result.trades[0].outcome, "LOSS");

  assert.strictEqual(result.statistics.losses, 1);

});

// TEST 6: SELL loss.

test("SELL trade reaches stop loss", function () {

  const result = simulate([sellSL()]);

  assert.strictEqual(result.trades[0].outcome, "LOSS");

  assert.strictEqual(result.statistics.losses, 1);

});

// TEST 7: Risk percentage.

test("Risk percentage remains 0.5 percent", function () {

  const result = simulate([buyTP()]);

  assert.strictEqual(result.riskPercent, 0.5);

});

// TEST 8: Winning trade return.

test("Winning 2R trade returns 1 percent", function () {

  const result = simulate([buyTP()]);

  assert.strictEqual(

    result.trades[0].profitPercent,

    1

  );

});

// TEST 9: Losing trade return.

test("Losing 1R trade returns minus 0.5 percent", function () {

  const result = simulate([buySL()]);

  assert.strictEqual(

    result.trades[0].profitPercent,

    -0.5

  );

});

// TEST 10: Ending equity.

test("Ending equity after one win is correct", function () {

  const result = simulate([buyTP()]);

  assert.strictEqual(result.endingEquity, 101);

});

// TEST 11: Net return.

test("Net return after one win is 1 percent", function () {

  const result = simulate([buyTP()]);

  assert.strictEqual(result.netReturnPercent, 1);

});

// TEST 12: Maximum drawdown.

test("Maximum drawdown after one loss is correct", function () {

  const result = simulate([buySL()]);

  assert.strictEqual(

    result.maxDrawdownPercent,

    0.5

  );

});

// TEST 13: Multiple consecutive trades.

test("Multiple trades are counted correctly", function () {

  const result = simulate([

    buyTP(),

    buySL(),

    sellTP()

  ]);

  assert.strictEqual(result.totalTrades, 3);

  assert.strictEqual(result.statistics.wins, 2);

  assert.strictEqual(result.statistics.losses, 1);

  assert.strictEqual(result.winRate, 66.67);

});

// TEST 14: Compounded equity.

test("Compounded equity is calculated correctly", function () {

  const result = simulate([

    buyTP(),

    buySL(),

    buyTP()

  ]);

  assert.strictEqual(result.endingEquity, 101.5);

assert.strictEqual(result.netReturnPercent, 1.5);

});

// TEST 15: Drawdown after consecutive trades.

test("Maximum drawdown tracks peak-to-trough decline", function () {

  const result = simulate([

    buyTP(),

    buySL(),

    buyTP()

  ]);

  assert.strictEqual(

    result.maxDrawdownPercent,

    0.5

  );

});

// TEST 16: Zero closed trades.

test("Zero closed trades produce zero win rate", function () {

  const result = simulate([]);

  assert.strictEqual(result.valid, true);

  assert.strictEqual(result.totalTrades, 0);

  assert.strictEqual(result.winRate, 0);

  assert.strictEqual(result.netReturnPercent, 0);

});

// TEST 17: Open trade exclusion.

test("Open trades are excluded from closed statistics", function () {

  const result = simulate([

    { direction: "BUY", outcome: "OPEN" }

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

// FINAL REPORT.

console.log("\n==================================");

console.log(" GOLDGUARD V1.2 TEST REPORT");

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
