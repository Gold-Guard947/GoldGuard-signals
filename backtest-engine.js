
/*

 GOLDGUARD BACKTEST ENGINE V1.1

 Chronological historical candle replay.

 Uses the existing GoldGuard signal engine.

 V1.1 improvements:
 - Next M5 candle open entry.
 - Take profit recalculated from actual entry.
 - Original signal stop loss preserved.
 - Entry candle is checked for SL and TP.
 - Gap-through SL/TP execution handling.
 - Conservative SL-first intrabar handling.

 Historical simulation only.

 No live market feed.
 No fabricated prices.
 No real trade execution.

*/

(function () {

  "use strict";

  const RISK_PERCENT = 0.5;
  const REWARD_RISK_RATIO = 2;

  const TIMEFRAMES = {

    H1: 60 * 60 * 1000,
    M15: 15 * 60 * 1000,
    M5: 5 * 60 * 1000

  };

  function parseTimestamp(value) {

    if (typeof value !== "string") return null;

    const match = value.match(
      /^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
    );

    if (!match) return null;

    const p = match.slice(1).map(Number);

    const date = new Date(Date.UTC(
      p[0], p[1] - 1, p[2], p[3], p[4], p[5]
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

  function run(data) {

    const integration =
      window.GoldGuardHistoricalIntegration;

    if (
      !integration ||
      typeof integration.analyze !== "function"
    ) {

      return {
        valid: false,
        reason: "Historical integration missing"
      };

    }

    if (!data || typeof data !== "object") {

      return {
        valid: false,
        reason: "Historical data missing"
      };

    }

    if (typeof data.newsBlocked !== "boolean") {

      return {
        valid: false,
        reason: "News status must be verified"
      };

    }

    const h1 = validateTimeframe(data.h1, "H1");
    const m15 = validateTimeframe(data.m15, "M15");
    const m5 = validateTimeframe(data.m5, "M5");

    if (!h1.valid || !m15.valid || !m5.valid) {

      return {
        valid: false,
        reason:
          !h1.valid ? h1.reason :
          !m15.valid ? m15.reason :
          m5.reason
      };

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

    function closeTrade(candle, exitPrice, outcome) {

      const trade = openTrade;

      const riskDistance = Math.abs(
        trade.entry - trade.stopLoss
      );

      const rMultiple = trade.direction === "BUY"

        ? (exitPrice - trade.entry) / riskDistance

        : (trade.entry - exitPrice) / riskDistance;

      const profitPercent = rMultiple * RISK_PERCENT;

      equity *= 1 + profitPercent / 100;

      peakEquity = Math.max(peakEquity, equity);

      const drawdown =
        (peakEquity - equity) / peakEquity * 100;

      maxDrawdown = Math.max(maxDrawdown, drawdown);

      if (outcome === "WIN") {

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
        outcome: outcome,

        rMultiple: Number(rMultiple.toFixed(2)),

        profitPercent: Number(
          profitPercent.toFixed(3)
        )

      });

      openTrade = null;

    }

    function manageTrade(candle) {

      const trade = openTrade;

      const open = candle.open;
      const high = candle.high;
      const low = candle.low;

      let hitSL = false;
      let hitTP = false;

      // Check for a gap through an existing exit level.

      if (trade.direction === "BUY") {

        if (open <= trade.stopLoss) {

          closeTrade(candle, open, "LOSS");
          return;

        }

        if (open >= trade.takeProfit) {

          closeTrade(candle, open, "WIN");
          return;

        }

        hitSL = low <= trade.stopLoss;
        hitTP = high >= trade.takeProfit;

      } else {

        if (open >= trade.stopLoss) {

          closeTrade(candle, open, "LOSS");
          return;

        }

        if (open <= trade.takeProfit) {

          closeTrade(candle, open, "WIN");
          return;

        }

        hitSL = high >= trade.stopLoss;
        hitTP = low <= trade.takeProfit;

      }

      // Conservative intrabar rule:
      // Stop loss wins if both levels are touched.

      if (hitSL) {

        closeTrade(candle, trade.stopLoss, "LOSS");

      } else if (hitTP) {

        closeTrade(candle, trade.takeProfit, "WIN");

      }

    }

    function executePendingEntry(candle) {

      const signal = pendingEntry;

      pendingEntry = null;

      const entry = candle.open;
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

      // Original stop must remain on the
      // correct side of the actual entry.

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

      // Recalculate TP from actual entry.

      const rewardDistance =
        riskDistance * REWARD_RISK_RATIO;

      const takeProfit = signal.direction === "BUY"

        ? entry + rewardDistance

        : entry - rewardDistance;

      openTrade = {

        direction: signal.direction,

        signalTime: signal.signalTime,

        entryTime: candle.timestamp,

        entry: entry,

        stopLoss: stopLoss,

        takeProfit: takeProfit

      };

      // Check the entry candle for SL and TP.

      manageTrade(candle);

    }

    for (let i = 0; i < m5.candles.length; i++) {

      const current = m5.candles[i];

      const decisionTime =
        parseTimestamp(current.timestamp) +
        TIMEFRAMES.M5;

      statistics.candlesProcessed++;

      // Manage an existing trade first.

      if (openTrade) {

        manageTrade(current);
        continue;

      }

      // Execute previous signal at this candle's open.

      if (pendingEntry) {

        executePendingEntry(current);
        continue;

      }

      // Use only fully closed candles.

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

      // Queue signal for the next M5 candle open.

      pendingEntry = {

        direction: signal.status,

        signalTime: current.timestamp,

        stopLoss: stopLoss

      };

    }

    // No following candle means no entry.

    if (pendingEntry) {

      statistics.unfilledSignals++;

    }

    const totalClosed =
      statistics.wins + statistics.losses;

    const winRate = totalClosed > 0

      ? statistics.wins / totalClosed * 100

      : 0;

    return {

      valid: true,

      status: "COMPLETED",

      version: "1.1",

      mode: "HISTORICAL SIMULATION ONLY",

      symbol: data.symbol || "XAUUSD",

      riskPercent: RISK_PERCENT,

      rewardRiskRatio: "1:2",

      executionModel: "NEXT M5 CANDLE OPEN",

      statistics: statistics,

      totalTrades: trades.length,

      winRate: Number(winRate.toFixed(2)),

      netReturnPercent: Number(
        (equity - 100).toFixed(3)
      ),

      maxDrawdownPercent: Number(
        maxDrawdown.toFixed(3)
      ),

      startingEquity: 100,

      endingEquity: Number(equity.toFixed(3)),

      trades: trades,

      openTrade: openTrade,

      assumptions: [

        "Signals are generated only from fully closed candles.",

        "Entry uses the next M5 candle open.",

        "Original signal stop loss is preserved.",

        "Take profit is recalculated at 2R from actual entry.",

        "Entry candle is checked for stop loss and take profit.",

        "Gap-through exits are filled at the candle open when beyond the exit level.",

        "Stop loss is prioritised if both intrabar exit levels are touched.",

        "News block is constant for the entire test.",

        "Spread and commissions are not modelled.",

        "Slippage is not modelled.",

        "One open trade maximum.",

        "Unclosed trades are excluded from closed-trade statistics.",

        "Signals without a following M5 candle remain unfilled."

      ]

    };

  }

  window.GoldGuardBacktest = {

    run: run,

    version: "1.1",

    mode: "HISTORICAL SIMULATION ONLY"

  };

  console.log(
    "GoldGuard Backtest Engine V1.1 loaded."
  );

})();
