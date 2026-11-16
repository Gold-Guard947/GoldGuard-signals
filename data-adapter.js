

/*

 GOLDGUARD DATA ADAPTER V1.1

 Strict historical candle validation.

 Historical data is NOT live market data.

 No fabricated prices. No trade execution.

*/

(function () {

  "use strict";

  function parseTimestamp(value) {

    if (typeof value !== "string") return null;

    const match = value.match(

      /^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2}):(\d{2})$/

    );

    if (!match) return null;

    const p = match.slice(1).map(Number);

    const date = new Date(0);

    date.setUTCFullYear(p[0], p[1] - 1, p[2]);

    date.setUTCHours(p[3], p[4], p[5], 0);

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

  function convertCandles(candles) {

    if (

      !Array.isArray(candles) ||

      candles.length === 0

    ) {

      return {

        valid: false,

        reason: "Candle data missing or empty"

      };

    }

    const converted = [];

    let previousTime = null;

    for (let i = 0; i < candles.length; i++) {

      const candle = candles[i];

      if (!candle || typeof candle !== "object") {

        return {

          valid: false,

          reason: "Invalid candle at index " + i

        };

      }

      const timestamp = candle.Timestamp;

      const open = candle.Open;

      const high = candle.High;

      const low = candle.Low;

      const close = candle.Close;

      if (

        typeof timestamp !== "string" ||

        !Number.isFinite(open) ||

        !Number.isFinite(high) ||

        !Number.isFinite(low) ||

        !Number.isFinite(close)

      ) {

        return {

          valid: false,

          reason: "Invalid candle fields at index " + i

        };

      }

      const timestampMs = parseTimestamp(timestamp);

      if (timestampMs === null) {

        return {

          valid: false,

          reason: "Invalid timestamp at index " + i

        };

      }

      if (

        previousTime !== null &&

        timestampMs <= previousTime

      ) {

        return {

          valid: false,

          reason: "Duplicate or non-chronological timestamp"

        };

      }

      if (

        open <= 0 ||

        high <= 0 ||

        low <= 0 ||

        close <= 0

      ) {

        return {

          valid: false,

          reason: "Prices must be positive"

        };

      }

      if (

        high < Math.max(open, close) ||

        low > Math.min(open, close) ||

        high < low

      ) {

        return {

          valid: false,

          reason: "Invalid OHLC values at index " + i

        };

      }

      const tickVolume = candle.TickVolume;

      const spread = candle.Spread;

      if (

        tickVolume !== undefined &&

        tickVolume !== null &&

        (

          !Number.isFinite(tickVolume) ||

          tickVolume < 0

        )

      ) {

        return {

          valid: false,

          reason: "Invalid tick volume at index " + i

        };

      }

      if (

        spread !== undefined &&

        spread !== null &&

        (

          !Number.isFinite(spread) ||

          spread < 0

        )

      ) {

        return {

          valid: false,

          reason: "Invalid spread at index " + i

        };

      }

      converted.push({

        timestamp: timestamp,

        timestampMs: timestampMs,

        open: open,

        high: high,

        low: low,

        close: close,

        tickVolume: tickVolume,

        spread: spread

      });

      previousTime = timestampMs;

    }

    return {

      valid: true,

      candles: converted

    };

  }

  window.GoldGuardDataAdapter = {

    convertCandles: convertCandles,

    version: "1.1",

    mode: "HISTORICAL VALIDATION ONLY"

  };

  console.log(

    "GoldGuard Data Adapter V1.1 loaded."

  );

})();
