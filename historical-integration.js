

/*

 GOLDGUARD HISTORICAL INTEGRATION V1.0

 Connects historical candle data to:

 1. Data Adapter

 2. Signal Engine

 Historical data only.

 No live market feed.

 No trade execution.

*/

(function () {

  "use strict";

  function analyzeHistoricalData(data) {

    const adapter = window.GoldGuardDataAdapter;

    const engine = window.GoldGuardEngine;

    if (!adapter || !engine) {

      return {

        status: "WAIT",

        reason: "GoldGuard components missing"

      };

    }

    if (!data || typeof data !== "object") {

      return {

        status: "WAIT",

        reason: "Historical data missing"

      };

    }

    if (

      !Array.isArray(data.h1) ||

      !Array.isArray(data.m15) ||

      !Array.isArray(data.m5)

    ) {

      return {

        status: "WAIT",

        reason: "Required timeframes missing"

      };

    }

    if (typeof data.newsBlocked !== "boolean") {

      return {

        status: "WAIT",

        reason: "News status not verified"

      };

    }

    const h1 = adapter.convertCandles(data.h1);

    const m15 = adapter.convertCandles(data.m15);

    const m5 = adapter.convertCandles(data.m5);

    if (!h1.valid || !m15.valid || !m5.valid) {

      return {

        status: "WAIT",

        reason: "Historical candle validation failed"

      };

    }

    const result = engine.analyze({

      h1: h1.candles,

      m15: m15.candles,

      m5: m5.candles,

      newsBlocked: data.newsBlocked

    });

    return {

      status: result.status,

      result: result,

      mode: "HISTORICAL DATA ONLY",

      symbol: data.symbol || "XAUUSD"

    };

  }

  window.GoldGuardHistoricalIntegration = {

    analyze: analyzeHistoricalData,

    version: "1.0",

    mode: "HISTORICAL ONLY"

  };

  console.log(

    "GoldGuard Historical Integration V1.0 loaded."

  );

})()
