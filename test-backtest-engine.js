
/*

 GOLDGUARD BACKTEST TEST SUITE V1.2

 Tests historical backtest engine validation
 and simulation output.

 Compatible with:
 - Backtest Engine V1.2
 - Execution Cost Model V1.3

 Node.js and browser compatible.

 Historical simulation only.
 No live market feed.
 No real trade execution.

*/

(function () {

  "use strict";

  const root = globalThis;

  const isNode =
    typeof process !== "undefined" &&
    !!process.versions &&
    !!process.versions.node;

  // Node.js compatibility
  if (isNode) {

    root.window = root;

    if (!root.document) {

      root.document = {

        createElement: function () {

          return {
            style: {},
            textContent: "",
            innerHTML: ""
          };

        },

        body: {
          appendChild: function () {}
        }

      };

    }

    // Load browser-global project files in dependency order.
    require("./data-adapter.js");
    require("./signal-engine.js");
    require("./historical-integration.js");
    require("./execution-cost.js");
    require("./backtest-engine.js");

  }

  const panel = document.createElement("div");

  panel.style.padding = "14px";
  panel.style.margin = "12px";
  panel.style.border = "1px solid #d4a72c";
  panel.style.borderRadius = "10px";
  panel.style.background = "#11151c";
  panel.style.color = "#ffffff";
  panel.style.fontSize = "14px";

  const results = [];

  function test(name, condition) {

    results.push({
      name: name,
      passed: condition === true
    });

  }

  function makeCandles(count, startTime, interval) {

    const candles = [];

    for (let i = 0; i < count; i++) {

      const date = new Date(
        startTime + i * interval
      );

      const timestamp =

        date.getUTCFullYear() + "." +

        String(date.getUTCMonth() + 1).padStart(2, "0") + "." +

        String(date.getUTCDate()).padStart(2, "0") + " " +

        String(date.getUTCHours()).padStart(2, "0") + ":" +

        String(date.getUTCMinutes()).padStart(2, "0") + ":" +

        String(date.getUTCSeconds()).padStart(2, "0");

      candles.push({

        Timestamp: timestamp,

        Open: 4000,
        High: 4002,
        Low: 3998,
        Close: 4001,

        TickVolume: 100,
        Spread: 20

      });

    }

    return candles;

  }

  function makeExecutionCosts() {

    return {

      broker: "Exness",
      account: "Standard",

      pointSize: 0.01,

      spreadPoints: 20,

      slippagePoints: 0,

      commissionPerLot: 0,

      commissionCurrency: "USD",

      commissionMode: "ROUND_TURN",

      lots: 0.01

    };

  }

  function finish() {

    const passed = results.filter(
      item => item.passed
    ).length;

    const failed = results.length - passed;

    const total = results.length;

    const output = [

      "GOLDGUARD BACKTEST TEST SUITE V1.2",

      "",

      ...results.map(item =>

        (item.passed ? "PASS: " : "FAIL: ") +
        item.name

      ),

      "",

      "PASSED: " + passed,
      "FAILED: " + failed,
      "TOTAL: " + total,

      "",

      "Historical simulation tests only."

    ].join("\n");

    panel.innerHTML = output.replace(/\n/g, "<br>");

    document.body.appendChild(panel);

    console.log(output);

    if (isNode && failed > 0) {
      process.exitCode = 1;
    }

  }

  const engine = window.GoldGuardBacktest;

  const originalIntegration =
    window.GoldGuardHistoricalIntegration;

  test(
    "Backtest engine exists",
    !!engine && typeof engine.run === "function"
  );

  test(
    "Correct backtest version",
    !!engine && engine.version === "1.2"
  );

  if (!engine || typeof engine.run !== "function") {

    console.error(
      "BACKTEST TESTS STOPPED: Engine unavailable."
    );

    finish();

    return;

  }

  // Missing integration test

  try {

    window.GoldGuardHistoricalIntegration = undefined;

    const result = engine.run({

      h1: [],
      m15: [],
      m5: [],

      newsBlocked: false

    });

    test(
      "Missing integration safely rejected",
      result.valid === false
    );

  } catch (error) {

    test(
      "Missing integration safely rejected",
      false
    );

  }

  // Restore integration

  window.GoldGuardHistoricalIntegration =
    originalIntegration;

  // Missing data test

  try {

    const result = engine.run(null);

    test(
      "Missing historical data rejected",
      result.valid === false
    );

  } catch (error) {

    test(
      "Missing historical data rejected",
      false
    );

  }

  // Unverified news test

  try {

    const result = engine.run({

      h1: [],
      m15: [],
      m5: [],

      newsBlocked: null

    });

    test(
      "Unverified news status rejected",
      result.valid === false &&
      result.reason === "News status must be verified"
    );

  } catch (error) {

    test(
      "Unverified news status rejected",
      false
    );

  }

  // Invalid candle data test

  try {

    const result = engine.run({

      h1: [
        { Timestamp: "invalid" }
      ],

      m15: [],
      m5: [],

      newsBlocked: false

    });

    test(
      "Invalid candle data rejected",
      result.valid === false
    );

  } catch (error) {

    test(
      "Invalid candle data rejected",
      false
    );

  }

  // Chronological order test

  try {

    const start = Date.UTC(2026, 0, 1);

    const h1 = makeCandles(
      50,
      start,
      60 * 60 * 1000
    );

    h1.reverse();

    const result = engine.run({

      symbol: "XAUUSD",

      h1: h1,

      m15: makeCandles(
        12,
        start,
        15 * 60 * 1000
      ),

      m5: makeCandles(
        3,
        start,
        5 * 60 * 1000
      ),

      newsBlocked: false,

      executionCosts: makeExecutionCosts()

    });

    test(
      "Out-of-order candles rejected",
      result.valid === false
    );

  } catch (error) {

    test(
      "Out-of-order candles rejected",
      false
    );

  }

  // Controlled historical simulation test

  try {

    window.GoldGuardHistoricalIntegration = {

      version: "TEST",

      analyze: function () {

        return {

          status: "WAIT",

          result: {
            status: "WAIT"
          }

        };

      }

    };

    const start = Date.UTC(2026, 0, 1);

    const result = engine.run({

      symbol: "XAUUSD",

      h1: makeCandles(
        60,
        start,
        60 * 60 * 1000
      ),

      m15: makeCandles(
        60,
        start,
        15 * 60 * 1000
      ),

      m5: makeCandles(
        100,
        start,
        5 * 60 * 1000
      ),

      newsBlocked: false,

      executionCosts: makeExecutionCosts()

    });

    test(
      "Valid historical simulation completes",
      result.valid === true &&
      result.status === "COMPLETED"
    );

    test(
      "Simulation reports historical-only mode",
      result.mode === "HISTORICAL SIMULATION ONLY"
    );

    test(
      "Simulation returns statistics",
      !!result.statistics &&
      Number.isFinite(
        result.statistics.candlesProcessed
      )
    );

    test(
      "WAIT signals do not create trades",
      result.totalTrades === 0
    );

    test(
      "Simulation reports assumptions",
      Array.isArray(result.assumptions) &&
      result.assumptions.length > 0
    );

  } catch (error) {

    test(
      "Valid historical simulation completes",
      false
    );

    console.error(
      "Historical simulation test error:",
      error
    );

  } finally {

    window.GoldGuardHistoricalIntegration =
      originalIntegration;

  }

  // Print results

  finish();

})();
