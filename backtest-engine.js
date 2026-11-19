
/*

 GOLDGUARD BACKTEST ENGINE V1.2

 Chronological historical candle replay.

 V1.2 execution-cost integration:
 - Historical Bid OHLC candles.
 - Historical spread per M5 candle.
 - Reconstructed Ask prices.
 - BUY and SELL execution pricing.
 - Adverse entry and exit slippage.
 - Explicit broker and symbol point size.
 - Commission tracking.
 - Conservative SL-first handling.
 - Conservative gap execution.

 Historical simulation only.

 No live market feed.
 No fabricated prices.
 No real trade execution.

*/

(function () {

  "use strict";

  const VERSION = "1.2";

  const RISK_PERCENT = 0.5;
  const REWARD_RISK_RATIO = 2;

  const TIMEFRAMES = {
    H1: 60 * 60 * 1000,
    M15: 15 * 60 * 1000,
    M5: 5 * 60 * 1000
  };

  function invalid(reason) {
    return {
      valid: false,
      reason: reason,
      version: VERSION,
      mode: "HISTORICAL SIMULATION ONLY"
    };
  }

  function parseTimestamp(value) {

    if (typeof value !== "string") return null;

    const match = value.match(
      /^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
    );

    if (!match) return null;

    const p = match.slice(1).map(Number);

    const date = new Date(Date.UTC(
      p[0], p[1] - 1, p[2],
      p[3], p[4], p[5]
    ));

    if (
      date.getUTCFullYear() !== p[0] ||
      date.getUTCMonth() !== p[1] - 1 ||
      date.getUTCDate() !== p[2] ||
      date.getUTCHours() !== p[3] ||
      date.getUTCMinutes() !== p[4] ||
      date.getUTCSeconds() !== p[5]
    ) return null;

    return date.getTime();
  }

  function validateTimeframe(candles, timeframe) {

    const adapter = window.GoldGuardDataAdapter;

    if (!Array.isArray(candles) || !adapter) {
      return {
        valid: false,
        reason: timeframe + " data or adapter missing"
      };
    }

    const converted = adapter.convertCandles(candles);

    if (!converted.valid) {
      return {
        valid: false,
        reason: timeframe + ": " + converted.reason
      };
    }

    let previous = null;

    for (const candle of converted.candles) {

      const time = parseTimestamp(candle.timestamp);

      if (time === null) {
        return {
          valid: false,
          reason: timeframe + " invalid timestamp"
        };
      }

      if (previous !== null && time <= previous) {
        return {
          valid: false,
          reason: timeframe + " not chronological"
        };
      }

      previous = time;
    }

    return {
      valid: true,
      raw: candles,
      candles: converted.candles
    };
  }

  function closedCandles(source, timeframe, decisionTime) {

    const duration = TIMEFRAMES[timeframe];

    return source.raw.filter(candle => {

      const time = parseTimestamp(candle.Timestamp);

      return time !== null &&
        time + duration <= decisionTime;

    });
  }

  function validateExecutionCosts(config) {

    const calculator = window.GoldGuardExecutionCost;

    if (
      !calculator ||
      typeof calculator.create !== "function" ||
      typeof calculator.calculateExecution !== "function" ||
      typeof calculator.calculateCommission !== "function"
    ) {
      return {
        valid: false,
        reason: "Execution cost calculator missing"
      };
    }

    if (!config || typeof config !== "object") {
      return {
        valid: false,
        reason: "Explicit executionCosts configuration required"
      };
    }

    const requiredNumbers = [
      "pointSize",
      "spreadPoints",
      "slippagePoints",
      "commissionPerLot",
      "lots"
    ];

    for (const key of requiredNumbers) {

      if (!Number.isFinite(config[key])) {
        return {
          valid: false,
          reason: "Execution cost configuration missing or invalid: " + key
        };
      }
    }

    if (
      config.pointSize <= 0 ||
      config.spreadPoints < 0 ||
      config.slippagePoints < 0 ||
      config.commissionPerLot < 0 ||
      config.lots <= 0
    ) {
      return {
        valid: false,
        reason: "Invalid execution cost configuration values"
      };
    }

    if (
      typeof config.commissionCurrency !== "string" ||
      !config.commissionCurrency.trim()
    ) {
      return {
        valid: false,
        reason: "Commission currency must be specified"
      };
    }

    if (
      !["PER_SIDE", "ROUND_TURN"].includes(
        config.commissionMode
      )
    ) {
      return {
        valid: false,
        reason: "Commission mode must be PER_SIDE or ROUND_TURN"
      };
    }

    let created;

    try {
      created = calculator.create(config);
    } catch (error) {
      return {
        valid: false,
        reason: "Execution cost configuration failed: " + error.message
      };
    }

    if (!created || created.valid === false) {
      return {
        valid: false,
        reason:
          created && created.reason
            ? created.reason
            : "Execution cost configuration rejected"
      };
    }

    return {
      valid: true,
      calculator: calculator,
      settings: created.settings || created,
      config: config
    };
  }

  function run(data) {

    const integration =
      window.GoldGuardHistoricalIntegration;

    if (
      !integration ||
      typeof integration.analyze !== "function"
    ) {
      return invalid("Historical integration missing");
    }

    if (!data || typeof data !== "object") {
      return invalid("Historical data missing");
    }

    if (typeof data.newsBlocked !== "boolean") {
      return invalid("News status must be verified");
    }

    const h1 = validateTimeframe(data.h1, "H1");
    const m15 = validateTimeframe(data.m15, "M15");
    const m5 = validateTimeframe(data.m5, "M5");

    if (!h1.valid || !m15.valid || !m5.valid) {
      return invalid(
        !h1.valid ? h1.reason :
        !m15.valid ? m15.reason :
        m5.reason
      );
    }

    const costResult =
      validateExecutionCosts(data.executionCosts);

    if (!costResult.valid) {
      return invalid(costResult.reason);
    }

    const costCalculator = costResult.calculator;
    const costSettings = costResult.settings;
    const costConfig = costResult.config;

    const pointSize = costConfig.pointSize;
    const lots = costConfig.lots;

    // Every M5 candle used for execution must
    // contain its actual historical spread.

    for (let i = 0; i < m5.candles.length; i++) {

      if (
        !Number.isFinite(m5.candles[i].spread) ||
        m5.candles[i].spread < 0
      ) {
        return invalid(
          "Historical M5 spread missing or invalid at index " + i
        );
      }
    }

    function spreadPrice(candle) {
      return candle.spread * pointSize;
    }

    function askPrice(bidPrice, candle) {
      return bidPrice + spreadPrice(candle);
    }

    function calculateExecution(
      action,
      direction,
      bidPrice,
      candle
    ) {

      const result = costCalculator.calculateExecution(
        action,
        direction,
        bidPrice,
        costSettings,
        candle.spread
      );

      if (
        !result ||
        !Number.isFinite(result.executionPrice) ||
        result.executionPrice <= 0
      ) {
        throw new Error("Invalid calculated execution price");
      }

      return result;
    }

function calculateCommission(action) {

  const result = costCalculator.calculateCommission(
    lots,
    costSettings,
    action
  );

  if (
    !result ||
    result.valid !== true ||
    !Number.isFinite(result.commission) ||
    result.commission < 0
  ) {
    throw new Error("Invalid calculated commission");
  }

  if (
    result.currency !== costConfig.commissionCurrency
  ) {
    throw new Error("Commission currency mismatch");
  }

  return result.commission;
}


    const trades = [];

    const statistics = {

      candlesProcessed: 0,
      signalsChecked: 0,
      waitSignals: 0,
      invalidSignals: 0,
      unfilledSignals: 0,
      wins: 0,
      losses: 0

    };

    let openTrade = null;
    let pendingEntry = null;

    let equity = 100;
    let peakEquity = 100;
    let maxDrawdown = 0;

    let totalCommission = 0;

    function closeTrade(candle, bidReference, outcome) {

      const trade = openTrade;

      const exitExecution = calculateExecution(
        "EXIT",
        trade.direction,
        bidReference,
        candle
      );

      const exitPrice = exitExecution.executionPrice;

      const riskDistance = Math.abs(
        trade.entry - trade.stopLoss
      );

      if (riskDistance <= 0) {
        throw new Error("Invalid trade risk distance");
      }

      const rMultiple = trade.direction === "BUY"

        ? (exitPrice - trade.entry) / riskDistance

        : (trade.entry - exitPrice) / riskDistance;

      const profitPercent = rMultiple * RISK_PERCENT;

      // This equity model includes price-based spread
      // and slippage through the executable fill prices.
      // Monetary commission is reported separately.

      equity *= 1 + profitPercent / 100;

      peakEquity = Math.max(peakEquity, equity);

      const drawdown =
        (peakEquity - equity) / peakEquity * 100;

      maxDrawdown = Math.max(maxDrawdown, drawdown);

      const exitCommission = calculateCommission("EXIT");

      totalCommission += exitCommission;

      const actualOutcome = rMultiple > 0 ? "WIN" : "LOSS";

      if (actualOutcome === "WIN") {
        statistics.wins++;
      } else {
        statistics.losses++;
      }

      trades.push({

        direction: trade.direction,

        signalTime: trade.signalTime,
        entryTime: trade.entryTime,
        exitTime: candle.timestamp,

        entry: trade.entry,
        stopLoss: trade.stopLoss,
        takeProfit: trade.takeProfit,

        exitPrice: exitPrice,

        outcome: actualOutcome,

        exitReason: outcome,

        rMultiple: Number(rMultiple.toFixed(4)),

        profitPercent: Number(
          profitPercent.toFixed(4)
        ),

        entrySpreadPoints: trade.entrySpreadPoints,
        exitSpreadPoints: candle.spread,

        entrySlippagePrice: trade.entrySlippagePrice,
        exitSlippagePrice: exitExecution.slippageCost,

        entryCommission: trade.entryCommission,
        exitCommission: exitCommission,

        totalCommission: Number(
          (trade.entryCommission + exitCommission).toFixed(8)
        ),

        commissionCurrency: costConfig.commissionCurrency

      });

      openTrade = null;
    }

    function manageTrade(candle) {

      const trade = openTrade;

      const bidOpen = candle.open;
      const bidHigh = candle.high;
      const bidLow = candle.low;

      const askOpen = askPrice(bidOpen, candle);
      const askHigh = askPrice(bidHigh, candle);
      const askLow = askPrice(bidLow, candle);

      let hitSL = false;
      let hitTP = false;

      let exitReference = null;
      let exitReason = null;

      if (trade.direction === "BUY") {

        // BUY positions close against Bid.

        if (bidOpen <= trade.stopLoss) {

          exitReference = bidOpen;
          exitReason = "STOP_LOSS_GAP";

        } else if (bidOpen >= trade.takeProfit) {

          // Do not grant favourable TP gap improvement.

          exitReference = trade.takeProfit;
          exitReason = "TAKE_PROFIT_GAP";

        } else {

          hitSL = bidLow <= trade.stopLoss;
          hitTP = bidHigh >= trade.takeProfit;

          if (hitSL) {
            exitReference = trade.stopLoss;
            exitReason = "STOP_LOSS";
          } else if (hitTP) {
            exitReference = trade.takeProfit;
            exitReason = "TAKE_PROFIT";
          }
        }

      } else {

        // SELL positions close against Ask.

        if (askOpen >= trade.stopLoss) {

          exitReference = askOpen;
          exitReason = "STOP_LOSS_GAP";

        } else if (askOpen <= trade.takeProfit) {

          // Do not grant favourable TP gap improvement.

          exitReference =
            trade.takeProfit - spreadPrice(candle);

          exitReason = "TAKE_PROFIT_GAP";

        } else {

          hitSL = askHigh >= trade.stopLoss;
          hitTP = askLow <= trade.takeProfit;

          if (hitSL) {

            exitReference =
              trade.stopLoss - spreadPrice(candle);

            exitReason = "STOP_LOSS";

          } else if (hitTP) {

            exitReference =
              trade.takeProfit - spreadPrice(candle);

            exitReason = "TAKE_PROFIT";

          }
        }
      }

      // SL-first is retained if both intrabar
      // levels are reached within the same candle.

      if (exitReference !== null) {
        closeTrade(candle, exitReference, exitReason);
      }
    }

    function executePendingEntry(candle) {

      const signal = pendingEntry;
      pendingEntry = null;

      const entryExecution = calculateExecution(
        "ENTRY",
        signal.direction,
        candle.open,
        candle
      );

      const entry = entryExecution.executionPrice;
      const stopLoss = signal.stopLoss;

      if (
        !Number.isFinite(entry) ||
        entry <= 0 ||
        !Number.isFinite(stopLoss) ||
        stopLoss <= 0
      ) {
        statistics.invalidSignals++;
        return;
      }

      if (
        signal.direction === "BUY" &&
        stopLoss >= entry
      ) {
        statistics.invalidSignals++;
        return;
      }

      if (
        signal.direction === "SELL" &&
        stopLoss <= entry
      ) {
        statistics.invalidSignals++;
        return;
      }

      const riskDistance = Math.abs(
        entry - stopLoss
      );

      if (
        !Number.isFinite(riskDistance) ||
        riskDistance <= 0
      ) {
        statistics.invalidSignals++;
        return;
      }

      const rewardDistance =
        riskDistance * REWARD_RISK_RATIO;

      const takeProfit = signal.direction === "BUY"

        ? entry + rewardDistance

        : entry - rewardDistance;

      const entryCommission = calculateCommission("ENTRY");

      totalCommission += entryCommission;

      openTrade = {

        direction: signal.direction,

        signalTime: signal.signalTime,
        entryTime: candle.timestamp,

        entry: entry,
        stopLoss: stopLoss,
        takeProfit: takeProfit,

        entrySpreadPoints: candle.spread,

        entrySlippagePrice: entryExecution.slippageCost,

        entryCommission: entryCommission

      };

      // Check the entry candle using executable
      // Bid/Ask prices and the same candle spread.

      manageTrade(candle);
    }

    for (let i = 0; i < m5.candles.length; i++) {

      const current = m5.candles[i];

      const decisionTime =
        current.timestampMs + TIMEFRAMES.M5;

      statistics.candlesProcessed++;

      if (openTrade) {
        manageTrade(current);
        continue;
      }

      if (pendingEntry) {
        executePendingEntry(current);
        continue;
      }

      const closedH1 =
        closedCandles(h1, "H1", decisionTime);

      const closedM15 =
        closedCandles(m15, "M15", decisionTime);

      const closedM5 =
        closedCandles(m5, "M5", decisionTime);

      if (
        closedH1.length < 50 ||
        closedM15.length < 12 ||
        closedM5.length < 3
      ) {
        continue;
      }

      statistics.signalsChecked++;

      const analysis = integration.analyze({

        symbol: data.symbol || "XAUUSD",

        h1: closedH1,
        m15: closedM15,
        m5: closedM5,

        newsBlocked: data.newsBlocked

      });

      if (
        !analysis ||
        !analysis.result ||
        !["BUY", "SELL"].includes(
          analysis.result.status
        )
      ) {
        statistics.waitSignals++;
        continue;
      }

      const signal = analysis.result;

      const entry = signal.entry;
      const stopLoss = signal.stopLoss;
      const takeProfit = signal.takeProfit;

      if (
        !Number.isFinite(entry) ||
        !Number.isFinite(stopLoss) ||
        !Number.isFinite(takeProfit) ||
        entry <= 0 ||
        stopLoss <= 0 ||
        takeProfit <= 0
      ) {
        statistics.invalidSignals++;
        continue;
      }

      if (
        signal.status === "BUY" &&
        !(stopLoss < entry && takeProfit > entry)
      ) {
        statistics.invalidSignals++;
        continue;
      }

      if (
        signal.status === "SELL" &&
        !(stopLoss > entry && takeProfit < entry)
      ) {
        statistics.invalidSignals++;
        continue;
      }

      pendingEntry = {

        direction: signal.status,

        signalTime: current.timestamp,

        stopLoss: stopLoss

      };
    }

    if (pendingEntry) {
      statistics.unfilledSignals++;
    }

    const totalClosed =
      statistics.wins + statistics.losses;

    const winRate = totalClosed > 0
      ? statistics.wins / totalClosed * 100
      : 0;

    const grossReturnPercent = Number(
      (equity - 100).toFixed(4)
    );

    // Commission is deliberately not deducted from
    // percentage equity without a verified conversion
    // between commission currency and account risk money.

    const netReturnPercent =
      totalCommission === 0
        ? grossReturnPercent
        : null;

    return {

      valid: true,

      status: "COMPLETED",

      version: VERSION,

      mode: "HISTORICAL SIMULATION ONLY",

      symbol: data.symbol || "XAUUSD",

      riskPercent: RISK_PERCENT,

      rewardRiskRatio: "1:2",

      executionModel: "NEXT M5 CANDLE OPEN",

      priceBasis: "HISTORICAL BID OHLC",

      executionCosts: {

        enabled: true,

        pointSize: pointSize,

        slippagePoints: costConfig.slippagePoints,

        commissionMode: costConfig.commissionMode,

        commissionCurrency: costConfig.commissionCurrency,

        lots: lots,

        commissionTotal: Number(
          totalCommission.toFixed(8)
        ),

        commissionIncludedInEquity: false

      },

      statistics: statistics,

      totalTrades: trades.length,

      winRate: Number(winRate.toFixed(2)),

      grossReturnPercent: grossReturnPercent,

      netReturnPercent: netReturnPercent,

      maxDrawdownPercent: Number(
        maxDrawdown.toFixed(4)
      ),

      startingEquity: 100,

      endingEquity: Number(equity.toFixed(4)),

      trades: trades,

      openTrade: openTrade,

      assumptions: [

        "Historical OHLC candles are Bid prices.",

        "Historical M5 spread is supplied in broker points.",

        "Ask prices are reconstructed using historical spread and configured point size.",

        "BUY entries execute at Ask with adverse slippage.",

        "SELL entries execute at Bid with adverse slippage.",

        "BUY exits execute at Bid with adverse slippage.",

        "SELL exits execute at Ask with adverse slippage.",

        "Historical spread is applied once through executable prices.",

        "Signals use only fully closed historical candles.",

        "Entry uses the next M5 candle open.",

        "Original signal stop loss is preserved.",

        "Take profit is recalculated at 2R from actual entry.",

        "Entry candle is checked for stop loss and take profit.",

        "Gap-through stop losses use the adverse opening price.",

        "Favourable take-profit gaps do not improve the TP fill.",

        "Stop loss is prioritised if both intrabar exit levels are touched.",

        "Commission is reported separately and is not deducted from equity without monetary conversion inputs.",

        "News block is constant for the entire test.",

        "One open trade maximum.",

        "Unclosed trades are excluded from closed-trade statistics.",

        "Signals without a following M5 candle remain unfilled."

      ]

    };
  }

  window.GoldGuardBacktest = {

    run: run,

    version: VERSION,

    mode: "HISTORICAL SIMULATION ONLY"

  };

  console.log(
    "GoldGuard Backtest Engine V1.2 loaded."
  );

})();
