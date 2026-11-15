

/*

 GOLDGUARD BACKTEST ENGINE V1.0

 Chronological historical candle replay.

 Uses the existing GoldGuard signal engine.

 Historical simulation only.

 No live market feed.

 No fabricated prices.

 No real trade execution.

*/

(function () {

  "use strict";

  const RISK_PERCENT = 0.5;

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

    if (!integration ||

        typeof integration.analyze !== "function") {

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

      wins: 0,

      losses: 0

    };

    let openTrade = null;

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

        entryTime: trade.entryTime,

        exitTime: candle.Timestamp,

        entry: trade.entry,

        stopLoss: trade.stopLoss,

        takeProfit: trade.takeProfit,

        exitPrice: exitPrice,

        outcome: outcome,

        rMultiple: Number(rMultiple.toFixed(2)),

        profitPercent: Number(profitPercent.toFixed(3))

      });

      openTrade = null;

    }

    for (let i = 0; i < m5.candles.length; i++) {

      const current = m5.candles[i];

      const decisionTime =

        parseTimestamp(current.timestamp) +

        TIMEFRAMES.M5;

      statistics.candlesProcessed++;

      // Manage an existing trade first.

      if (openTrade) {

        const candle = current;

        let hitSL = false;

        let hitTP = false;

        if (openTrade.direction === "BUY") {

          hitSL = candle.low <= openTrade.stopLoss;

          hitTP = candle.high >= openTrade.takeProfit;

        } else {

          hitSL = candle.high >= openTrade.stopLoss;

          hitTP = candle.low <= openTrade.takeProfit;

        }

        // Conservative rule:

        // If both are touched, count SL first.

        if (hitSL) {

          closeTrade(

            { Timestamp: current.timestamp },

            openTrade.stopLoss,

            "LOSS"

          );

        } else if (hitTP) {

          closeTrade(

            { Timestamp: current.timestamp },

            openTrade.takeProfit,

            "WIN"

          );

        }

        // Never open another trade on this same candle.

        continue;

      }

      // Use only candles that have fully closed.

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

        !["BUY", "SELL"].includes(analysis.result.status)

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

      openTrade = {

        direction: signal.status,

        entryTime: current.timestamp,

        entry: entry,

        stopLoss: stopLoss,

        takeProfit: takeProfit

      };

    }

    const totalClosed =

      statistics.wins + statistics.losses;

    const winRate = totalClosed > 0

      ? statistics.wins / totalClosed * 100

      : 0;

    return {

      valid: true,

      status: "COMPLETED",

      version: "1.0",

      mode: "HISTORICAL SIMULATION ONLY",

      symbol: data.symbol || "XAUUSD",

      riskPercent: RISK_PERCENT,

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

        "News block is constant for the entire test.",

        "Spread and commissions are not modelled.",

        "Entry is simulated at the signal candle close.",

        "Stop loss is prioritised if both exit levels are touched.",

        "One open trade maximum.",

        "Unclosed trades are excluded from closed-trade statistics."

      ]

    };

  }

  window.GoldGuardBacktest = {

    run: run,

    version: "1.0",

    mode: "HISTORICAL SIMULATION ONLY"

  };

  console.log(

    "GoldGuard Backtest Engine V1.0 loaded."

  );

})();
