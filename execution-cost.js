
/*

 GOLDGUARD EXECUTION COST MODEL V1.2

 Historical execution-cost calculator.

 Features:
 - MT5 spread points to price conversion.
 - Bid-based historical execution.
 - Correct BUY and SELL entry/exit pricing.
 - Configurable adverse slippage.
 - Configurable commission.

 Historical simulation only.
 No live prices.
 No trade execution.

*/

(function () {

  "use strict";

  const VERSION = "1.2";

  const DEFAULT_PROFILE = {
    broker: "Exness",
    account: "Standard",
    commissionPerLot: 0,
    commissionCurrency: "USD"
  };

  function validPositive(value) {
    return Number.isFinite(value) && value > 0;
  }

  function validNonNegative(value) {
    return Number.isFinite(value) && value >= 0;
  }

  function create(config) {

    if (!config || typeof config !== "object") {
      return {
        valid: false,
        reason: "Cost configuration missing"
      };
    }

    const pointSize = config.pointSize;
    const spreadPoints = config.spreadPoints;
    const slippagePoints = config.slippagePoints;
    const commissionPerLot = config.commissionPerLot;

    if (!validPositive(pointSize)) {
      return {
        valid: false,
        reason: "Invalid symbol point size"
      };
    }

    if (!validNonNegative(spreadPoints)) {
      return {
        valid: false,
        reason: "Invalid spread points"
      };
    }

    if (!validNonNegative(slippagePoints)) {
      return {
        valid: false,
        reason: "Invalid slippage points"
      };
    }

    if (!validNonNegative(commissionPerLot)) {
      return {
        valid: false,
        reason: "Invalid commission per lot"
      };
    }

    return {
      valid: true,

      broker: config.broker || DEFAULT_PROFILE.broker,

      account: config.account || DEFAULT_PROFILE.account,

      pointSize: pointSize,

      spreadPoints: spreadPoints,

      slippagePoints: slippagePoints,

      commissionPerLot: commissionPerLot,

      commissionCurrency:
        config.commissionCurrency ||
        DEFAULT_PROFILE.commissionCurrency,

      spreadPrice: spreadPoints * pointSize,

      slippagePrice: slippagePoints * pointSize
    };

  }

  function calculateExecution(
    action,
    direction,
    bidPrice,
    settings
  ) {

    if (!settings || settings.valid !== true) {
      return {
        valid: false,
        reason: "Valid cost settings required"
      };
    }

    if (!validPositive(bidPrice)) {
      return {
        valid: false,
        reason: "Invalid Bid market price"
      };
    }

    if (
      action !== "ENTRY" &&
      action !== "EXIT"
    ) {
      return {
        valid: false,
        reason: "Invalid execution action"
      };
    }

    if (
      direction !== "BUY" &&
      direction !== "SELL"
    ) {
      return {
        valid: false,
        reason: "Invalid trade direction"
      };
    }

    const spread = settings.spreadPrice;
    const slippage = settings.slippagePrice;

    let executionPrice;

    const usesAsk =
      (action === "ENTRY" && direction === "BUY") ||
      (action === "EXIT" && direction === "SELL");

    if (usesAsk) {

      executionPrice =
        bidPrice + spread + slippage;

    } else {

      executionPrice =
        bidPrice - slippage;

    }

    if (!validPositive(executionPrice)) {
      return {
        valid: false,
        reason: "Execution price is invalid"
      };
    }

    return {
      valid: true,

      action: action,

      direction: direction,

      marketPrice: bidPrice,

      executionSide: usesAsk ? "ASK" : "BID",

      executionPrice: Number(
        executionPrice.toFixed(10)
      ),

      spreadCost: usesAsk ? spread : 0,

      slippageCost: slippage,

      commissionPerLot: settings.commissionPerLot,

      commissionCurrency: settings.commissionCurrency
    };

  }

  function calculateCommission(lots, settings) {

    if (!settings || settings.valid !== true) {
      return {
        valid: false,
        reason: "Valid cost settings required"
      };
    }

    if (!validPositive(lots)) {
      return {
        valid: false,
        reason: "Invalid lot size"
      };
    }

    const commission =
      lots * settings.commissionPerLot;

    return {
      valid: true,

      lots: lots,

      commission: Number(
        commission.toFixed(8)
      ),

      currency: settings.commissionCurrency
    };

  }

  window.GoldGuardExecutionCost = {

    version: VERSION,

    mode: "HISTORICAL COST SIMULATION ONLY",

    defaultProfile: DEFAULT_PROFILE,

    create: create,

    calculateExecution: calculateExecution,

    calculateCommission: calculateCommission

  };

  console.log(
    "GoldGuard Execution Cost Model V1.2 loaded."
  );

})();
