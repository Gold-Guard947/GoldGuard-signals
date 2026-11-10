/*

 GOLDGUARD SIGNAL ENGINE V1.0

 Strategy: H1 trend + M15 liquidity sweep + M5 confirmation

 Demo/research only. No trade execution.

*/

(function () {

  "use strict";

  function ema(candles, period) {

    const closes = candles.map(c => c.close);

    const multiplier = 2 / (period + 1);

    let value = closes[0];

    for (let i = 1; i < closes.length; i++) {

      value = closes[i] * multiplier +

        value * (1 - multiplier);

    }

    return value;

  }

  function validCandles(candles, minimum) {

    return Array.isArray(candles) &&

      candles.length >= minimum &&

      candles.every(c =>

        [c.open, c.high, c.low, c.close].every(

          Number.isFinite

        ) &&

        c.high >= Math.max(c.open, c.close) &&

        c.low <= Math.min(c.open, c.close) &&

        c.high >= c.low

      );

  }

  function wait(reason) {

    return {

      status: "WAIT",

      reason: reason,

      entry: null,

      stopLoss: null,

      takeProfit: null,

      riskPercent: 0.5

    };

  }

  function analyze(data) {

    if (!data || !data.h1 ||

        !data.m15 || !data.m5) {

      return wait("Market data missing");

    }

    if (!validCandles(data.h1, 50) ||

        !validCandles(data.m15, 12) ||

        !validCandles(data.m5, 3)) {

      return wait("Insufficient or invalid candles");

    }

    if (typeof data.newsBlocked !== "boolean") {

      return wait("News status not verified");

    }

    if (data.newsBlocked) {

      return wait("Major economic news protection");

    }

    const h1 = data.h1;

    const m15 = data.m15;

    const m5 = data.m5;

    // H1 directional bias

    const fastEMA = ema(h1, 20);

    const slowEMA = ema(h1, 50);

    const lastH1 = h1[h1.length - 1];

    let bias = "NEUTRAL";

    if (fastEMA > slowEMA &&

        lastH1.close > fastEMA) {

      bias = "BULLISH";

    }

    if (fastEMA < slowEMA &&

        lastH1.close < fastEMA) {

      bias = "BEARISH";

    }

    if (bias === "NEUTRAL") {

      return wait("No clear H1 direction");

    }

    // M15 liquidity sweep

    const previous = m15.slice(-11, -1);

    const current = m15[m15.length - 1];

    const previousLow = Math.min(

      ...previous.map(c => c.low)

    );

    const previousHigh = Math.max(

      ...previous.map(c => c.high)

    );

    const bullishSweep =

      current.low < previousLow &&

      current.close > previousLow;

    const bearishSweep =

      current.high > previousHigh &&

      current.close < previousHigh;

    // M5 entry confirmation

    const previousM5 = m5[m5.length - 2];

    const currentM5 = m5[m5.length - 1];

    const bullishConfirmation =

      currentM5.close > currentM5.open &&

      currentM5.close > previousM5.high;

    const bearishConfirmation =

      currentM5.close < currentM5.open &&

      currentM5.close < previousM5.low;

    let direction = null;

    let stopLoss = null;

    if (bias === "BULLISH" &&

        bullishSweep &&

        bullishConfirmation) {

      direction = "BUY";

      stopLoss = current.low;

    }

    if (bias === "BEARISH" &&

        bearishSweep &&

        bearishConfirmation) {

      direction = "SELL";

      stopLoss = current.high;

    }

    if (!direction) {

      return wait("SMC conditions not fully confirmed");

    }

    // Risk and reward calculation

    const entry = currentM5.close;

    const risk = Math.abs(entry - stopLoss);

    if (!Number.isFinite(risk) || risk <= 0) {

      return wait("Invalid stop loss distance");

    }

    const reward = risk * 2;

    const takeProfit = direction === "BUY"

      ? entry + reward

      : entry - reward;

    return {

      status: direction,

      symbol: "XAUUSD",

      entry: entry,

      stopLoss: stopLoss,

      takeProfit: takeProfit,

      riskPercent: 0.5,

      rewardRiskRatio: "1:2",

      h1Bias: bias,

      m15Sweep: true,

      m5Confirmation: true,

      newsBlocked: false,

      execution: "MANUAL DEMO ONLY",

      timestamp: new Date().toISOString()

    };

  }

  window.GoldGuardEngine = {

    analyze: analyze,

    version: "1.0"

  };

})();
