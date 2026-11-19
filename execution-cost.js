
/*

 GOLDGUARD EXECUTION COST MODEL V1.3

 Historical execution-cost calculator.

 Features:
 - Configurable MT5 symbol point size.
 - Historical spread override per execution.
 - Bid-based historical execution.
 - Correct BUY and SELL entry/exit pricing.
 - Configurable adverse slippage.
 - PER_SIDE and ROUND_TURN commission.
 - Strict cost-setting validation.

 Historical simulation only.
 No live prices.
 No trade execution.

*/

(function () {

  "use strict";

  const VERSION = "1.3";

  const DEFAULT_PROFILE = {
    broker: "Exness",
    account: "Standard",
    commissionPerLot: 0,
    commissionCurrency: "USD",
    commissionMode: "ROUND_TURN"
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

    const commissionMode =
      config.commissionMode ||
      DEFAULT_PROFILE.commissionMode;

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

    if (
      commissionMode !== "PER_SIDE" &&
      commissionMode !== "ROUND_TURN"
    ) {
      return {
        valid: false,
        reason: "Invalid commission mode"
      };
    }

    return {

      valid: true,

      broker: config.broker || DEFAULT_PROFILE.broker,

      account: config.account || DEFAULT_PROFILE.account,

      symbol: config.symbol || null,

      pointSize: pointSize,

      spreadPoints: spreadPoints,

      slippagePoints: slippagePoints,

      commissionPerLot: commissionPerLot,

      commissionCurrency:
        config.commissionCurrency ||
        DEFAULT_PROFILE.commissionCurrency,

      commissionMode: commissionMode,

      spreadPrice: spreadPoints * pointSize,

      slippagePrice: slippagePoints * pointSize

    };

  }

  function calculateExecution(
    action,
    direction,
    bidPrice,
    settings,
    spreadPointsOverride
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

    const spreadPoints =
      spreadPointsOverride === undefined
        ? settings.spreadPoints
        : spreadPointsOverride;

    if (!validNonNegative(spreadPoints)) {
      return {
        valid: false,
        reason: "Invalid execution spread points"
      };
    }

    const spread =
      spreadPoints * settings.pointSize;

    const slippage =
      settings.slippagePrice;

    const usesAsk =
      (action === "ENTRY" && direction === "BUY") ||
      (action === "EXIT" && direction === "SELL");

    let executionPrice;

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

      spreadPoints: spreadPoints,

      spreadPrice: spread,

      spreadCost: usesAsk ? spread : 0,

      slippagePoints: settings.slippagePoints,

      slippageCost: slippage,

      commissionPerLot: settings.commissionPerLot,

      commissionCurrency: settings.commissionCurrency,

      commissionMode: settings.commissionMode

    };

  }

  function calculateCommission(
    lots,
    settings,
    action
  ) {

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

    if (
      action !== undefined &&
      action !== "ENTRY" &&
      action !== "EXIT"
    ) {
      return {
        valid: false,
        reason: "Invalid commission action"
      };
    }

    let commission = 0;

    if (settings.commissionMode === "PER_SIDE") {

      if (!action) {
        return {
          valid: false,
          reason: "ENTRY or EXIT required for per-side commission"
        };
      }

      commission =
        lots * settings.commissionPerLot;

    } else if (
      settings.commissionMode === "ROUND_TURN"
    ) {

      // Charge the complete round-turn commission on EXIT.
      // Without an action, return the full trade commission
      // for backward compatibility with the V1.2 calculator.

      if (!action || action === "EXIT") {
        commission =
          lots * settings.commissionPerLot;
      }

    } else {

      return {
        valid: false,
        reason: "Invalid commission mode"
      };

    }

    return {

      valid: true,

      lots: lots,

      action: action || "ROUND_TURN",

      mode: settings.commissionMode,

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
    "GoldGuard Execution Cost Model V1.3 loaded."
  );

})();
