/*

 GOLDGUARD DATA ADAPTER V1.0

 Converts and validates historical candle data.

 Historical data is NOT live market data.

 No fabricated prices. No trade execution.

*/

(function () {

  "use strict";

  function convertCandles(candles) {

    if (!Array.isArray(candles)) {

      return {

        valid: false,

        reason: "Candle data missing"

      };

    }

    const converted = [];

    for (const candle of candles) {

      if (

        !candle ||

        !candle.Timestamp ||

        !Number.isFinite(candle.Open) ||

        !Number.isFinite(candle.High) ||

        !Number.isFinite(candle.Low) ||

        !Number.isFinite(candle.Close)

      ) {

        return {

          valid: false,

          reason: "Invalid candle data"

        };

      }

      if (

        candle.High < Math.max(candle.Open, candle.Close) ||

        candle.Low > Math.min(candle.Open, candle.Close) ||

        candle.High < candle.Low

      ) {

        return {

          valid: false,

          reason: "Invalid OHLC values"

        };

      }

      converted.push({

        timestamp: candle.Timestamp,

        open: candle.Open,

        high: candle.High,

        low: candle.Low,

        close: candle.Close,

        tickVolume: candle.TickVolume,

        spread: candle.Spread

      });

    }

    return {

      valid: true,

      candles: converted

    };

  }

  window.GoldGuardDataAdapter = {

    convertCandles: convertCandles,

    version: "1.0",

    mode: "HISTORICAL VALIDATION ONLY"

  };

  console.log(

    "GoldGuard Data Adapter V1.0 loaded."

  );

})();
