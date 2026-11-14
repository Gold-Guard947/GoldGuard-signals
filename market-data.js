

/*

 GOLDGUARD MARKET DATA V1.2

 Historical XAUUSD market-data connection.

 Provider: AlgoSpecial

 Timeframes: H1, M15, M5

 Historical data only.

 No live feed.

 No fabricated prices.

 No trade execution.

*/

(function () {

  "use strict";

  const API_URL =

    "https://www.algospecial.com/api/ohlc.php";

  function validateDates(from, to) {

    if (

      typeof from !== "string" ||

      typeof to !== "string" ||

      !/^\d{4}-\d{2}-\d{2}$/.test(from) ||

      !/^\d{4}-\d{2}-\d{2}$/.test(to)

    ) {

      throw new Error("Invalid date format");

    }

    const start = Date.parse(from + "T00:00:00Z");

    const end = Date.parse(to + "T00:00:00Z");

    if (

      !Number.isFinite(start) ||

      !Number.isFinite(end) ||

      end < start ||

      (end - start) / 86400000 > 30

    ) {

      throw new Error("Date range must be 31 days or less");

    }

  }

  function validateCandles(candles, timeframe) {

    if (!Array.isArray(candles) || candles.length === 0) {

      throw new Error(timeframe + " data missing");

    }

    if (candles.length > 2000) {

      throw new Error(timeframe + " exceeds preview row limit");

    }

    for (const candle of candles) {

      if (

        !candle ||

        typeof candle.Timestamp !== "string" ||

        !/^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2}$/.test(candle.Timestamp)

      ) {

        throw new Error(timeframe + " invalid timestamp");

      }

      for (const field of [

        "Open", "High", "Low", "Close"

      ]) {

        if (

          !Number.isFinite(Number(candle[field])) ||

          Number(candle[field]) <= 0

        ) {

          throw new Error(timeframe + " invalid " + field);

        }

      }

      const open = Number(candle.Open);

      const high = Number(candle.High);

      const low = Number(candle.Low);

      const close = Number(candle.Close);

      if (

        high < Math.max(open, close) ||

        low > Math.min(open, close) ||

        high < low

      ) {

        throw new Error(timeframe + " invalid OHLC values");

      }

    }

    return candles.map(candle => ({

      Timestamp: candle.Timestamp,

      Open: Number(candle.Open),

      High: Number(candle.High),

      Low: Number(candle.Low),

      Close: Number(candle.Close),

      TickVolume: Number(candle.TickVolume || 0),

      Spread: Number(candle.Spread || 0)

    }));

  }

  async function fetchTimeframe(tf, from, to) {

    const url = new URL(API_URL);

    url.searchParams.set("symbol", "XAUUSD");

    url.searchParams.set("tf", tf);

    url.searchParams.set("from", from);

    url.searchParams.set("to", to);

    url.searchParams.set("format", "json");

    const response = await fetch(url.toString());

    if (!response.ok) {

      throw new Error(

        tf + " request failed: HTTP " + response.status

      );

    }

    const payload = await response.json();

    if (!payload || !Array.isArray(payload.data)) {

      throw new Error(tf + " invalid API response");

    }

    return validateCandles(payload.data, tf);

  }

  async function fetchHistorical(from, to, newsBlocked) {

    try {

      validateDates(from, to);

      if (typeof newsBlocked !== "boolean") {

        throw new Error("News status must be verified");

      }

      const results = await Promise.all([

        fetchTimeframe("H1", from, to),

        fetchTimeframe("M15", from, to),

        fetchTimeframe("M5", from, to)

      ]);

      const historicalData = {

        symbol: "XAUUSD",

        h1: results[0],

        m15: results[1],

        m5: results[2],

        newsBlocked: newsBlocked

      };

      return {

        valid: true,

        data: historicalData,

        mode: "HISTORICAL DATA ONLY"

      };

    } catch (error) {

      return {

        valid: false,

        reason: error.message,

        mode: "HISTORICAL DATA ONLY"

      };

    }

  }

  async function fetchAndAnalyze(from, to, newsBlocked) {

    const fetched = await fetchHistorical(

      from,

      to,

      newsBlocked

    );

    if (!fetched.valid) {

      return fetched;

    }

    const integration =

      window.GoldGuardHistoricalIntegration;

    if (!integration || typeof integration.analyze !== "function") {

      return {

        valid: false,

        reason: "Historical integration missing",

        mode: "HISTORICAL DATA ONLY"

      };

    }

    return {

      valid: true,

      analysis: integration.analyze(fetched.data),

      mode: "HISTORICAL DATA ONLY"

    };

  }

  window.GoldGuardMarketData = {

    fetchHistorical: fetchHistorical,

    fetchAndAnalyze: fetchAndAnalyze,

    version: "1.2",

    mode: "HISTORICAL DATA ONLY"

  };

  console.log(

    "GoldGuard Market Data V1.2 loaded."

  );

})();
