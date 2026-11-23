
/*
 GOLDGUARD HISTORICAL DATA VALIDATOR V1.1

 Reliability upgrade of V1.0.

 Fixes:
 - Global gap inspection limit.
 - Strict nested configuration validation.
 - Malformed market closure rejection.
 - Reversed market closure boundary rejection.

 Historical data only.
 No live market feed.
 No trade execution.

 V1.0 remains unchanged.
*/

(function () {
  "use strict";

  const VERSION = "1.1";
  const MODE = "HISTORICAL DATA ONLY";

  const TIMEFRAMES = Object.freeze({
    H1: 60 * 60 * 1000,
    M15: 15 * 60 * 1000,
    M5: 5 * 60 * 1000
  });

  const DEFAULT_CONFIG = {
    timezone: "UTC",

    weekendClosure: {
      enabled: true,
      fridayCloseHour: 22,
      sundayOpenHour: 22
    },

    marketClosures: [],
    maxGapChecks: 100000,

    spread: {
      required: false,
      maximum: null
    },

    tickVolume: {
      required: false
    }
  };

  // ----------------------------------
  // GENERAL HELPERS
  // ----------------------------------

  function isObject(value) {
    return (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    );
  }

  function isFiniteNumber(value) {
    return (
      typeof value === "number" &&
      Number.isFinite(value)
    );
  }

  function cloneNestedConfig(
    supplied,
    defaults
  ) {
    if (supplied === undefined) {
      return { ...defaults };
    }

    if (!isObject(supplied)) {
      return supplied;
    }

    return {
      ...defaults,
      ...supplied
    };
  }

  function cloneConfig(config) {
    if (config === undefined) {
      config = {};
    }

    if (!isObject(config)) {
      return config;
    }

    const result = {
      ...DEFAULT_CONFIG,
      ...config
    };

    result.weekendClosure =
      cloneNestedConfig(
        config.weekendClosure,
        DEFAULT_CONFIG.weekendClosure
      );

    result.spread =
      cloneNestedConfig(
        config.spread,
        DEFAULT_CONFIG.spread
      );

    result.tickVolume =
      cloneNestedConfig(
        config.tickVolume,
        DEFAULT_CONFIG.tickVolume
      );

    if (config.marketClosures === undefined) {
      result.marketClosures = [];
    } else if (Array.isArray(config.marketClosures)) {
      result.marketClosures =
        config.marketClosures.slice();
    } else {
      result.marketClosures =
        config.marketClosures;
    }

    return result;
  }

  function createResult(
    status,
    timeframe,
    statistics,
    errors,
    warnings
  ) {
    return {
      status: status,
      version: VERSION,
      mode: MODE,
      timeframe: timeframe,
      valid: status !== "FAIL",
      statistics: statistics,
      errors: errors,
      warnings: warnings
    };
  }

  function determineStatus(errors, warnings) {
    if (errors.length > 0) {
      return "FAIL";
    }

    if (warnings.length > 0) {
      return "WARNING";
    }

    return "PASS";
  }

  // ----------------------------------
  // CONFIGURATION VALIDATION
  // ----------------------------------

  function validateConfig(config) {
    const errors = [];

    if (!isObject(config)) {
      return [
        "Configuration must be an object."
      ];
    }

    if (
      typeof config.timezone !== "string" ||
      config.timezone.trim() === ""
    ) {
      errors.push(
        "Timezone must be a non-empty string."
      );
    }

    const weekend = config.weekendClosure;

    if (!isObject(weekend)) {
      errors.push(
        "Weekend closure configuration must be an object."
      );
    } else {
      if (typeof weekend.enabled !== "boolean") {
        errors.push(
          "Weekend closure enabled must be boolean."
        );
      }

      if (
        !Number.isInteger(weekend.fridayCloseHour) ||
        weekend.fridayCloseHour < 0 ||
        weekend.fridayCloseHour > 23
      ) {
        errors.push(
          "Invalid Friday market closing hour."
        );
      }

      if (
        !Number.isInteger(weekend.sundayOpenHour) ||
        weekend.sundayOpenHour < 0 ||
        weekend.sundayOpenHour > 23
      ) {
        errors.push(
          "Invalid Sunday market opening hour."
        );
      }
    }

    if (!Array.isArray(config.marketClosures)) {
      errors.push(
        "Market closures must be an array."
      );
    } else {
      for (
        let i = 0;
        i < config.marketClosures.length;
        i++
      ) {
        const closure = config.marketClosures[i];

        if (!isObject(closure)) {
          errors.push(
            "Market closure " + i +
            " must be an object."
          );
          continue;
        }

        if (
          !isFiniteNumber(closure.startMs) ||
          !isFiniteNumber(closure.endMs)
        ) {
          errors.push(
            "Market closure " + i +
            " has invalid startMs or endMs."
          );
          continue;
        }

        if (closure.endMs < closure.startMs) {
          errors.push(
            "Market closure " + i +
            " has an end boundary before its start boundary."
          );
        }
      }
    }

    if (
      !Number.isInteger(config.maxGapChecks) ||
      config.maxGapChecks < 1
    ) {
      errors.push(
        "maxGapChecks must be a positive integer."
      );
    }

    if (!isObject(config.spread)) {
      errors.push(
        "Spread configuration must be an object."
      );
    } else {
      if (typeof config.spread.required !== "boolean") {
        errors.push(
          "Spread required setting must be boolean."
        );
      }

      if (
        config.spread.maximum !== null &&
        (
          !isFiniteNumber(config.spread.maximum) ||
          config.spread.maximum < 0
        )
      ) {
        errors.push(
          "Spread maximum must be null or a non-negative finite number."
        );
      }
    }

    if (!isObject(config.tickVolume)) {
      errors.push(
        "Tick volume configuration must be an object."
      );
    } else if (
      typeof config.tickVolume.required !== "boolean"
    ) {
      errors.push(
        "Tick volume required setting must be boolean."
      );
    }

    return errors;
  }

  // ----------------------------------
  // MARKET CLOSURE DETECTION
  // ----------------------------------

  function isWeekendClosure(timestamp, config) {
    if (!config.weekendClosure.enabled) {
      return false;
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return false;
    }

    const day = date.getUTCDay();
    const hour = date.getUTCHours();

    if (day === 6) {
      return true;
    }

    if (
      day === 0 &&
      hour <= config.weekendClosure.sundayOpenHour
    ) {
      return true;
    }

    if (
      day === 5 &&
      hour >= config.weekendClosure.fridayCloseHour
    ) {
      return true;
    }

    return false;
  }

  function isConfiguredClosure(timestamp, config) {
    for (
      let i = 0;
      i < config.marketClosures.length;
      i++
    ) {
      const closure = config.marketClosures[i];

      if (
        timestamp >= closure.startMs &&
        timestamp <= closure.endMs
      ) {
        return true;
      }
    }

    return false;
  }

  function isMarketClosed(timestamp, config) {
    return (
      isWeekendClosure(timestamp, config) ||
      isConfiguredClosure(timestamp, config)
    );
  }

  // ----------------------------------
  // CANDLE VALIDATION
  // ----------------------------------

  function validateCandle(candle, index, config) {
    const errors = [];
    const warnings = [];

    if (!isObject(candle)) {
      errors.push(
        "Candle " + index + " must be an object."
      );

      return { errors, warnings };
    }

    if (
      !isFiniteNumber(candle.timestampMs) ||
      candle.timestampMs <= 0
    ) {
      errors.push(
        "Candle " + index +
        " has an invalid timestampMs."
      );
    }

    const fields = [
      "open",
      "high",
      "low",
      "close"
    ];

    for (const field of fields) {
      if (!isFiniteNumber(candle[field])) {
        errors.push(
          "Candle " + index +
          " has an invalid " + field + " value."
        );
      }
    }

    if (
      fields.every(function (field) {
        return isFiniteNumber(candle[field]);
      })
    ) {
      const open = candle.open;
      const high = candle.high;
      const low = candle.low;
      const close = candle.close;

      if (high < low) {
        errors.push(
          "Candle " + index +
          " has high below low."
        );
      }

      if (high < open || high < close) {
        errors.push(
          "Candle " + index +
          " has an invalid high value."
        );
      }

      if (low > open || low > close) {
        errors.push(
          "Candle " + index +
          " has an invalid low value."
        );
      }
    }

    // Spread

    if (
      candle.spread === undefined ||
      candle.spread === null
    ) {
      if (config.spread.required) {
        errors.push(
          "Candle " + index +
          " is missing required spread information."
        );
      } else {
        warnings.push(
          "Candle " + index +
          " is missing spread information."
        );
      }
    } else if (
      !isFiniteNumber(candle.spread) ||
      candle.spread < 0
    ) {
      errors.push(
        "Candle " + index +
        " has an invalid spread value."
      );
    } else if (
      isFiniteNumber(config.spread.maximum) &&
      candle.spread > config.spread.maximum
    ) {
      warnings.push(
        "Candle " + index +
        " spread exceeds configured maximum."
      );
    }

    // Tick volume

    if (
      candle.tickVolume === undefined ||
      candle.tickVolume === null
    ) {
      if (config.tickVolume.required) {
        errors.push(
          "Candle " + index +
          " is missing required tick volume."
        );
      } else {
        warnings.push(
          "Candle " + index +
          " is missing tick volume."
        );
      }
    } else if (
      !isFiniteNumber(candle.tickVolume) ||
      candle.tickVolume < 0
    ) {
      errors.push(
        "Candle " + index +
        " has invalid tick volume."
      );
    }

    return {
      errors: errors,
      warnings: warnings
    };
  }

  // ----------------------------------
  // TIMESTAMP VALIDATION
  // ----------------------------------

  function validateTimestamps(candles) {
    const errors = [];
    const seen = new Set();

    let outOfOrder = 0;
    let duplicates = 0;

    for (let i = 0; i < candles.length; i++) {
      const current = candles[i];

      if (!isObject(current)) {
        continue;
      }

      const timestamp = current.timestampMs;

      if (!isFiniteNumber(timestamp)) {
        continue;
      }

      if (seen.has(timestamp)) {
        duplicates++;

        errors.push(
          "Duplicate timestamp detected at candle " + i + "."
        );
      } else {
        seen.add(timestamp);
      }

      if (i > 0) {
        const previous = candles[i - 1];

        const previousTimestamp =
          isObject(previous)
            ? previous.timestampMs
            : null;

        if (
          isFiniteNumber(previousTimestamp) &&
          timestamp < previousTimestamp
        ) {
          outOfOrder++;

          errors.push(
            "Out-of-order timestamp detected at candle " + i + "."
          );
        }
      }
    }

    return {
      errors: errors,
      duplicates: duplicates,
      outOfOrder: outOfOrder
    };
  }

  // ----------------------------------
  // MISSING CANDLE DETECTION
  // ----------------------------------

  function detectMissingCandles(
    candles,
    interval,
    config
  ) {
    const gaps = [];
    const warnings = [];

    let expectedMissing = 0;
    let checkedIntervals = 0;

    let inspectionLimitReached = false;

    // The inspection counter is global across
    // the complete dataset, not reset per gap.

    for (
      let i = 1;
      i < candles.length;
      i++
    ) {
      if (inspectionLimitReached) {
        break;
      }

      const previous = candles[i - 1];
      const current = candles[i];

      if (
        !isObject(previous) ||
        !isObject(current)
      ) {
        continue;
      }

      if (
        !isFiniteNumber(previous.timestampMs) ||
        !isFiniteNumber(current.timestampMs)
      ) {
        continue;
      }

      const previousTime = previous.timestampMs;
      const currentTime = current.timestampMs;

      if (currentTime <= previousTime) {
        continue;
      }

      if (
        currentTime - previousTime <= interval
      ) {
        continue;
      }

      let missing = 0;
      let closedIntervals = 0;

      let timestamp = previousTime + interval;

      while (timestamp < currentTime) {
        if (
          checkedIntervals >= config.maxGapChecks
        ) {
          inspectionLimitReached = true;

          warnings.push(
            "Global gap inspection limit reached. " +
            "Further gap inspection was stopped."
          );

          break;
        }

        checkedIntervals++;

        if (isMarketClosed(timestamp, config)) {
          closedIntervals++;
        } else {
          missing++;
        }

        timestamp += interval;
      }

      if (missing > 0) {
        expectedMissing += missing;

        gaps.push({
          afterCandle: i - 1,
          beforeCandle: i,
          missingCandles: missing,
          closedIntervals: closedIntervals,
          classification: "UNEXPLAINED GAP"
        });

        warnings.push(
          "Unexplained gap detected between candles " +
          (i - 1) + " and " + i +
          ". Missing expected candles: " + missing + "."
        );
      } else if (
        closedIntervals > 0 &&
        !inspectionLimitReached
      ) {
        gaps.push({
          afterCandle: i - 1,
          beforeCandle: i,
          missingCandles: 0,
          closedIntervals: closedIntervals,
          classification: "MARKET CLOSURE"
        });
      }
    }

    return {
      gaps: gaps,
      warnings: warnings,
      expectedMissing: expectedMissing,
      checkedIntervals: checkedIntervals
    };
  }

  // ----------------------------------
  // MAIN VALIDATOR
  // ----------------------------------

  function validateHistoricalData(
    candles,
    timeframe,
    userConfig
  ) {
    const errors = [];
    const warnings = [];

    const statistics = {
      candleCount: 0,
      validCandles: 0,
      invalidCandles: 0,
      duplicateTimestamps: 0,
      outOfOrderTimestamps: 0,
      expectedMissingCandles: 0,
      detectedGaps: 0,
      checkedIntervals: 0
    };

    if (!Array.isArray(candles)) {
      errors.push(
        "Historical candles must be supplied as an array."
      );

      return createResult(
        "FAIL",
        timeframe,
        statistics,
        errors,
        warnings
      );
    }

    statistics.candleCount = candles.length;

    if (!TIMEFRAMES[timeframe]) {
      errors.push(
        "Unsupported timeframe. Use H1, M15 or M5."
      );

      return createResult(
        "FAIL",
        timeframe,
        statistics,
        errors,
        warnings
      );
    }

    if (candles.length < 2) {
      errors.push(
        "At least two candles are required."
      );

      return createResult(
        "FAIL",
        timeframe,
        statistics,
        errors,
        warnings
      );
    }

    const config = cloneConfig(userConfig);

    const configErrors = validateConfig(config);

    if (configErrors.length > 0) {
      return createResult(
        "FAIL",
        timeframe,
        statistics,
        configErrors,
        warnings
      );
    }

    // Validate every candle.

    for (let i = 0; i < candles.length; i++) {
      const result = validateCandle(
        candles[i],
        i,
        config
      );

      if (result.errors.length > 0) {
        statistics.invalidCandles++;

        errors.push.apply(
          errors,
          result.errors
        );
      } else {
        statistics.validCandles++;
      }

      warnings.push.apply(
        warnings,
        result.warnings
      );
    }

    // Validate timestamps.

    const timestampResult = validateTimestamps(
      candles
    );

    errors.push.apply(
      errors,
      timestampResult.errors
    );

    statistics.duplicateTimestamps =
      timestampResult.duplicates;

    statistics.outOfOrderTimestamps =
      timestampResult.outOfOrder;

    // Inspect gaps only when candle integrity
    // and timestamp ordering are valid.

    if (
      timestampResult.errors.length === 0 &&
      statistics.invalidCandles === 0
    ) {
      const gapResult = detectMissingCandles(
        candles,
        TIMEFRAMES[timeframe],
        config
      );

      warnings.push.apply(
        warnings,
        gapResult.warnings
      );

      statistics.expectedMissingCandles =
        gapResult.expectedMissing;

      statistics.detectedGaps =
        gapResult.gaps.filter(function (gap) {
          return gap.missingCandles > 0;
        }).length;

      statistics.checkedIntervals =
        gapResult.checkedIntervals;

      statistics.gaps = gapResult.gaps;
    } else {
      statistics.gaps = [];

      warnings.push(
        "Gap inspection skipped because candle integrity checks failed."
      );
    }

    const status = determineStatus(
      errors,
      warnings
    );

    return createResult(
      status,
      timeframe,
      statistics,
      errors,
      warnings
    );
  }

  // ----------------------------------
  // PUBLIC COMPONENT API
  // ----------------------------------

  const HistoricalDataValidator = {
    version: VERSION,

    mode: MODE,

    timeframes: Object.freeze({
      H1: TIMEFRAMES.H1,
      M15: TIMEFRAMES.M15,
      M5: TIMEFRAMES.M5
    }),

    validate: validateHistoricalData,

    isMarketClosed: function (
      timestamp,
      userConfig
    ) {
      if (!isFiniteNumber(timestamp)) {
        return false;
      }

      const config = cloneConfig(userConfig);

      if (validateConfig(config).length > 0) {
        return false;
      }

      return isMarketClosed(
        timestamp,
        config
      );
    }
  };

  // ----------------------------------
  // GLOBAL REGISTRATION
  // ----------------------------------

  if (typeof globalThis !== "undefined") {
    if (
      globalThis.GoldGuardHistoricalDataValidatorV11
    ) {
      throw new Error(
        "GoldGuard Historical Data Validator V1.1 already exists."
      );
    }

    Object.defineProperty(
      globalThis,
      "GoldGuardHistoricalDataValidatorV11",
      {
        value: Object.freeze(HistoricalDataValidator),
        writable: false,
        configurable: false,
        enumerable: true
      }
    );
  }

  // ----------------------------------
  // COMMONJS EXPORT
  // ----------------------------------

  if (
    typeof module !== "undefined" &&
    module.exports
  ) {
    module.exports = HistoricalDataValidator;
  }

  console.log(
    "GoldGuard Historical Data Validator V1.1 loaded."
  );

  console.log(
    "Mode: " + MODE
  );

})();
