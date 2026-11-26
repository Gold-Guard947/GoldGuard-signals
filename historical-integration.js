

/*

 GOLDGUARD HISTORICAL INTEGRATION V1.2

 Connects validated historical candles to the signal engine.

 Adds component-function checks.

 Preserves adapter validation errors.

 Validates signal engine statuses.

 Historical data only.

 No live market feed.

 No trade execution.

*/

(function () {

  "use strict";

  function wait(reason) {

    return {

      status: "WAIT",

      reason: reason,

      mode: "HISTORICAL DATA ONLY"

    };

  }

  function parseTimestamp(value) {

    if (typeof value !== "string") return null;

    const match = value.match(

      /^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2}):(\d{2})$/

    );

    if (!match) return null;

    const parts = match.slice(1).map(Number);

    const [year, month, day, hour, minute, second] = parts;

    const date = new Date(Date.UTC(

      year, month - 1, day, hour, minute, second

    ));

    if (

      date.getUTCFullYear() !== year ||

      date.getUTCMonth() !== month - 1 ||

      date.getUTCDate() !== day ||

      date.getUTCHours() !== hour ||

      date.getUTCMinutes() !== minute ||

      date.getUTCSeconds() !== second

    ) return null;

    return date.getTime();

  }

  function validateTimeframe(candles, minimum, name) {

    if (!Array.isArray(candles) || candles.length < minimum) {

      return name + " has insufficient candles";

    }

    let previousTime = null;

    for (const candle of candles) {

      const currentTime = parseTimestamp(candle.timestamp);

      if (currentTime === null) {

        return name + " contains an invalid timestamp";

      }

      if (

        previousTime !== null &&

        currentTime <= previousTime

      ) {

        return name + " candles are not in chronological order";

      }

      previousTime = currentTime;

    }

    return null;

  }

  function analyzeHistoricalData(data) {

    const adapter = window.GoldGuardDataAdapter;

    const engine = window.GoldGuardEngine;

    if (!adapter || typeof adapter.convertCandles !== "function") {

      return wait("Historical data adapter unavailable");

    }

    if (!engine || typeof engine.analyze !== "function") {

      return wait("Signal engine unavailable");

    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {

      return wait("Historical data missing");

    }

    if (

      !Array.isArray(data.h1) ||

      !Array.isArray(data.m15) ||

      !Array.isArray(data.m5)

    ) {

      return wait("Required timeframes missing");

    }

    if (typeof data.newsBlocked !== "boolean") {

      return wait("News status not verified");

    }

    let h1;

    let m15;

    let m5;

    try {

      h1 = adapter.convertCandles(data.h1);

      m15 = adapter.convertCandles(data.m15);

      m5 = adapter.convertCandles(data.m5);

    } catch (error) {

      return wait("Historical adapter processing failed");

    }

    const conversions = [

      { result: h1, name: "H1" },

      { result: m15, name: "M15" },

      { result: m5, name: "M5" }

    ];

    for (const item of conversions) {

      if (!item.result || item.result.valid !== true) {

        const reason =

          item.result &&

          typeof item.result.reason === "string" &&

          item.result.reason.length > 0

            ? item.result.reason

            : item.name + " candle validation failed";

        return wait(reason);

      }

    }

    const checks = [

      validateTimeframe(h1.candles, 50, "H1"),

      validateTimeframe(m15.candles, 12, "M15"),

      validateTimeframe(m5.candles, 3, "M5")

    ];

    const failedCheck = checks.find(

      reason => reason !== null

    );

    if (failedCheck) {

      return wait(failedCheck);

    }

    let result;

    try {

      result = engine.analyze({

        h1: h1.candles,

        m15: m15.candles,

        m5: m5.candles,

        newsBlocked: data.newsBlocked

      });

    } catch (error) {

      return wait("Signal engine processing failed");

    }

    if (

      !result ||

      !["WAIT", "BUY", "SELL"].includes(result.status)

    ) {

      return wait("Signal engine returned an invalid status");

    }

    return {

      status: result.status,

      reason: result.reason,

      result: result,

      mode: "HISTORICAL DATA ONLY",

      symbol: data.symbol || "XAUUSD"

    };

  }

  window.GoldGuardHistoricalIntegration = {

    analyze: analyzeHistoricalData,

    version: "1.2",

    mode: "HISTORICAL ONLY"

  };

  console.log(

    "GoldGuard Historical Integration V1.2 loaded."

  );

})();
