
/*

 GOLDGUARD EXECUTION COST TESTS V1.2

 Tests the independent execution-cost component.

 Covers:
 - Component loading
 - Version verification
 - Spread conversion
 - BUY entry and exit
 - SELL entry and exit
 - Commission calculation
 - Invalid configuration rejection
 - Invalid execution rejection

 Historical simulation only.
 No live trading.

*/

"use strict";

const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const context = {
  window: {},
  console: console
};

const source = fs.readFileSync(
  "execution-cost.js",
  "utf8"
);

vm.runInNewContext(source, context);

const cost = context.window.GoldGuardExecutionCost;

let passed = 0;
let failed = 0;

function test(name, callback) {

  try {

    callback();

    passed++;

    console.log("PASS: " + name);

  } catch (error) {

    failed++;

    console.log(
      "FAIL: " + name + " - " + error.message
    );

  }

}

console.log("");
console.log("==================================");
console.log(" GOLDGUARD EXECUTION COST TESTS V1.2");
console.log("==================================");

// TEST 1: Component availability.

test("Execution cost component loads correctly", function () {

  assert.ok(cost);

});

// TEST 2: Version verification.

test("Execution cost version is 1.2", function () {

  assert.strictEqual(cost.version, "1.2");

});

// TEST 3: Historical-only mode.

test("Historical-only mode is declared", function () {

  assert.strictEqual(
    cost.mode,
    "HISTORICAL COST SIMULATION ONLY"
  );

});

// TEST 4: Valid configuration.

const settings = cost.create({

  broker: "Exness",

  account: "Standard",

  pointSize: 0.01,

  spreadPoints: 20,

  slippagePoints: 2,

  commissionPerLot: 0,

  commissionCurrency: "USD"

});

test("Valid cost configuration is accepted", function () {

  assert.strictEqual(settings.valid, true);

});

// TEST 5: Spread conversion.

test("Spread points convert correctly into price", function () {

  assert.strictEqual(settings.spreadPrice, 0.2);

});

// TEST 6: Slippage conversion.

test("Slippage points convert correctly into price", function () {

  assert.strictEqual(settings.slippagePrice, 0.02);

});

// TEST 7: BUY entry.

test("BUY entry executes at Ask plus slippage", function () {

  const result = cost.calculateExecution(
    "ENTRY",
    "BUY",
    4000,
    settings
  );

  assert.strictEqual(result.valid, true);

  assert.strictEqual(result.executionSide, "ASK");

  assert.strictEqual(result.executionPrice, 4000.22);

});

// TEST 8: BUY exit.

test("BUY exit executes at Bid minus slippage", function () {

  const result = cost.calculateExecution(
    "EXIT",
    "BUY",
    4000,
    settings
  );

  assert.strictEqual(result.valid, true);

  assert.strictEqual(result.executionSide, "BID");

  assert.strictEqual(result.executionPrice, 3999.98);

});

// TEST 9: SELL entry.

test("SELL entry executes at Bid minus slippage", function () {

  const result = cost.calculateExecution(
    "ENTRY",
    "SELL",
    4000,
    settings
  );

  assert.strictEqual(result.valid, true);

  assert.strictEqual(result.executionSide, "BID");

  assert.strictEqual(result.executionPrice, 3999.98);

});

// TEST 10: SELL exit.

test("SELL exit executes at Ask plus slippage", function () {

  const result = cost.calculateExecution(
    "EXIT",
    "SELL",
    4000,
    settings
  );

  assert.strictEqual(result.valid, true);

  assert.strictEqual(result.executionSide, "ASK");

  assert.strictEqual(result.executionPrice, 4000.22);

});

// TEST 11: Zero commission.

test("Exness Standard reference commission is zero", function () {

  const result = cost.calculateCommission(
    1,
    settings
  );

  assert.strictEqual(result.valid, true);

  assert.strictEqual(result.commission, 0);

});

// TEST 12: Non-zero commission calculation.

const commissionSettings = cost.create({

  pointSize: 0.01,

  spreadPoints: 20,

  slippagePoints: 2,

  commissionPerLot: 3.5,

  commissionCurrency: "USD"

});

test("Commission calculation uses lot size correctly", function () {

  const result = cost.calculateCommission(
    2,
    commissionSettings
  );

  assert.strictEqual(result.valid, true);

  assert.strictEqual(result.commission, 7);

});

// TEST 13: Missing configuration.

test("Missing cost configuration is rejected", function () {

  const result = cost.create(null);

  assert.strictEqual(result.valid, false);

});

// TEST 14: Invalid point size.

test("Invalid point size is rejected", function () {

  const result = cost.create({

    pointSize: 0,

    spreadPoints: 20,

    slippagePoints: 2,

    commissionPerLot: 0

  });

  assert.strictEqual(result.valid, false);

});

// TEST 15: Missing spread.

test("Missing spread data is rejected", function () {

  const result = cost.create({

    pointSize: 0.01,

    slippagePoints: 2,

    commissionPerLot: 0

  });

  assert.strictEqual(result.valid, false);

});

// TEST 16: Invalid slippage.

test("Negative slippage is rejected", function () {

  const result = cost.create({

    pointSize: 0.01,

    spreadPoints: 20,

    slippagePoints: -1,

    commissionPerLot: 0

  });

  assert.strictEqual(result.valid, false);

});

// TEST 17: Invalid direction.

test("Invalid trade direction is rejected", function () {

  const result = cost.calculateExecution(
    "ENTRY",
    "HOLD",
    4000,
    settings
  );

  assert.strictEqual(result.valid, false);

});

// TEST 18: Invalid action.

test("Invalid execution action is rejected", function () {

  const result = cost.calculateExecution(
    "OPEN",
    "BUY",
    4000,
    settings
  );

  assert.strictEqual(result.valid, false);

});

// TEST 19: Invalid market price.

test("Invalid market price is rejected", function () {

  const result = cost.calculateExecution(
    "ENTRY",
    "BUY",
    0,
    settings
  );

  assert.strictEqual(result.valid, false);

});

// TEST 20: Invalid lot size.

test("Zero lot size is rejected", function () {

  const result = cost.calculateCommission(
    0,
    settings
  );

  assert.strictEqual(result.valid, false);

});

console.log("");
console.log("==================================");
console.log(" GOLDGUARD EXECUTION COST REPORT");
console.log("==================================");

console.log("PASSED: " + passed);
console.log("FAILED: " + failed);
console.log("TOTAL: " + (passed + failed));

if (failed === 0) {

  console.log("");
  console.log("ALL EXECUTION COST TESTS PASSED");

} else {

  console.log("");
  console.log("EXECUTION COST TESTS FAILED");

  process.exitCode = 1;

}
