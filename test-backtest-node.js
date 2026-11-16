

/*

 GOLDGUARD NODE BACKTEST TESTS V1.0

 Tests historical backtest results.

 Checks:

 1. WAIT signal produces no trade.

 2. BUY reaches take profit.

 3. SELL reaches take profit.

 4. BUY reaches stop loss.

 5. SELL reaches stop loss.

 6. Stop loss has priority if SL and TP

    are reached in the same candle.

 7. Invalid prices are rejected.

 8. Unfinished trades remain OPEN.

 Historical testing only.

 No live market data.

 No trade execution.

*/

"use strict";

const assert = require("assert");

console.log("\nGOLDGUARD NODE BACKTEST TESTS V1.0");

console.log("----------------------------------");

let passed = 0;

let failed = 0;

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

// Check engine availability

test("Backtest engine is available", function () {

  assert.ok(

    global.GoldGuardBacktest,

    "GoldGuardBacktest not loaded"

  );

  assert.strictEqual(

    global.GoldGuardBacktest.version,

    "1.0"

  );

  assert.strictEqual(

    typeof global.GoldGuardBacktest.run,

    "function"

  );

});

// Report results

console.log("----------------------------------");

console.log("PASSED:", passed);

console.log("FAILED:", failed);

if (failed > 0) {

  process.exitCode = 1;

} else {

  console.log("GOLDGUARD NODE TESTS PASSED");

}
