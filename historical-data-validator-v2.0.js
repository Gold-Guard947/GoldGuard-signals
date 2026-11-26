
/*
 GOLDGUARD HISTORICAL DATA VALIDATOR V2.0

 Conservative validation of normalized historical OHLC candles.

 Accepted candle shape:
 {
   timestampMs,
   open,
   high,
   low,
   close,
   spread?,
   tickVolume?
 }

 timestampMs must already be an epoch-millisecond number.
 Provider timestamp strings are deliberately not parsed because
 their timezone has not yet been verified.

 Historical data only.
 No live feed.
 No trading or execution.
*/

(function (root) {
  "use strict";

  var VERSION = "2.0";
  var MODE = "HISTORICAL DATA ONLY";

  var TIMEFRAMES = Object.freeze({
    H1: 3600000,
    M15: 900000,
    M5: 300000
  });

  var DEFAULT_CONFIG = {
    timezone: "UTC",

    weekend: {
      enabled: true,
      fridayCloseHour: 22,
      sundayOpenHour: 22
    },

    marketClosures: [],

    maxGapChecks: 100000,
    maxIssues: 100,

    requireSpread: false,
    maximumSpread: null,

    requireTickVolume: false,

    checkAlignment: false,
    alignmentOffsetMs: 0
  };

  function isPlainObject(value) {
    return value !== null &&
      typeof value === "object" &&
      !Array.isArray(value);
  }

  function cloneConfig(config) {
    var source = config === undefined ? {} : config;

    if (!isPlainObject(source)) {
      throw new TypeError("Configuration must be an object.");
    }

    var result = {
      timezone: source.timezone === undefined
        ? DEFAULT_CONFIG.timezone
        : source.timezone,

      weekend: source.weekend === undefined
        ? Object.assign({}, DEFAULT_CONFIG.weekend)
        : isPlainObject(source.weekend)
          ? Object.assign({}, DEFAULT_CONFIG.weekend, source.weekend)
          : source.weekend,

      marketClosures: Array.isArray(source.marketClosures)
        ? source.marketClosures.map(function (item) {
            return isPlainObject(item)
              ? {
                  startMs: item.startMs,
                  endMs: item.endMs
                }
              : item;
          })
        : source.marketClosures === undefined
          ? []
          : source.marketClosures,

      maxGapChecks: source.maxGapChecks === undefined
        ? DEFAULT_CONFIG.maxGapChecks
        : source.maxGapChecks,

      maxIssues: source.maxIssues === undefined
        ? DEFAULT_CONFIG.maxIssues
        : source.maxIssues,

      requireSpread: source.requireSpread === undefined
        ? DEFAULT_CONFIG.requireSpread
        : source.requireSpread,

      maximumSpread: source.maximumSpread === undefined
        ? DEFAULT_CONFIG.maximumSpread
        : source.maximumSpread,

      requireTickVolume: source.requireTickVolume === undefined
        ? DEFAULT_CONFIG.requireTickVolume
        : source.requireTickVolume,

      checkAlignment: source.checkAlignment === undefined
        ? DEFAULT_CONFIG.checkAlignment
        : source.checkAlignment,

      alignmentOffsetMs: source.alignmentOffsetMs === undefined
        ? DEFAULT_CONFIG.alignmentOffsetMs
        : source.alignmentOffsetMs
    };

    return result;
  }

  function validateConfig(config) {
    var errors = [];

    if (config.timezone !== "UTC") {
      errors.push(
        "Only UTC timezone is supported until provider timezone semantics are verified."
      );
    }

    if (!isPlainObject(config.weekend)) {
      errors.push("weekend configuration must be an object.");
    } else {
      if (typeof config.weekend.enabled !== "boolean") {
        errors.push("weekend.enabled must be boolean.");
      }

      ["fridayCloseHour", "sundayOpenHour"].forEach(function (key) {
        if (
          !Number.isInteger(config.weekend[key]) ||
          config.weekend[key] < 0 ||
          config.weekend[key] > 23
        ) {
          errors.push(
            "weekend." + key + " must be an integer from 0 to 23."
          );
        }
      });
    }

    if (!Array.isArray(config.marketClosures)) {
      errors.push("marketClosures must be an array.");
    } else {
      config.marketClosures.forEach(function (closure, index) {
        if (
          !isPlainObject(closure) ||
          !Number.isFinite(closure.startMs) ||
          !Number.isFinite(closure.endMs) ||
          !Number.isInteger(closure.startMs) ||
          !Number.isInteger(closure.endMs) ||
          closure.startMs <= 0 ||
          closure.endMs < closure.startMs
        ) {
          errors.push(
            "marketClosures[" + index +
            "] must contain valid integer startMs/endMs with endMs >= startMs."
          );
        }
      });
    }

    ["maxGapChecks", "maxIssues"].forEach(function (key) {
      if (!Number.isInteger(config[key]) || config[key] < 1) {
        errors.push(key + " must be a positive integer.");
      }
    });

    [
      "requireSpread",
      "requireTickVolume",
      "checkAlignment"
    ].forEach(function (key) {
      if (typeof config[key] !== "boolean") {
        errors.push(key + " must be boolean.");
      }
    });

    if (
      config.maximumSpread !== null &&
      (!Number.isFinite(config.maximumSpread) ||
        config.maximumSpread < 0)
    ) {
      errors.push(
        "maximumSpread must be null or a finite non-negative number."
      );
    }

    if (!Number.isInteger(config.alignmentOffsetMs)) {
      errors.push("alignmentOffsetMs must be an integer.");
    }

    return errors;
  }

  function isMarketClosed(timestampMs, config) {
    if (config.weekend.enabled) {
      var date = new Date(timestampMs);
      var day = date.getUTCDay();
      var hour = date.getUTCHours();

      if (day === 6) return true;

      if (
        day === 5 &&
        hour >= config.weekend.fridayCloseHour
      ) {
        return true;
      }

      if (
        day === 0 &&
        hour <= config.weekend.sundayOpenHour
      ) {
        return true;
      }
    }

    for (var i = 0; i < config.marketClosures.length; i += 1) {
      var closure = config.marketClosures[i];

      if (
        timestampMs >= closure.startMs &&
        timestampMs <= closure.endMs
      ) {
        return true;
      }
    }

    return false;
  }

  function validate(candles, timeframe, options) {
    var config;

    try {
      config = cloneConfig(options);
    } catch (error) {
      return {
        valid: false,
        complete: false,
        status: "FAIL",
        version: VERSION,
        mode: MODE,
        errors: [error.message],
        warnings: [],
        stats: null
      };
    }

    var configErrors = validateConfig(config);

    if (configErrors.length) {
      return {
        valid: false,
        complete: false,
        status: "FAIL",
        version: VERSION,
        mode: MODE,
        errors: configErrors,
        warnings: [],
        stats: null
      };
    }

    var interval = TIMEFRAMES[timeframe];

    if (!interval) {
      return {
        valid: false,
        complete: false,
        status: "FAIL",
        version: VERSION,
        mode: MODE,
        errors: [
          "Unsupported timeframe. Use H1, M15, or M5."
        ],
        warnings: [],
        stats: null
      };
    }

    if (!Array.isArray(candles) || candles.length === 0) {
      return {
        valid: false,
        complete: false,
        status: "FAIL",
        version: VERSION,
        mode: MODE,
        errors: ["Candles must be a non-empty array."],
        warnings: [],
        stats: null
      };
    }

    var errors = [];
    var warnings = [];
    var gaps = [];

    var errorCount = 0;
    var warningCount = 0;
    var gapChecks = 0;
    var detectedGapCount = 0;
    var truncated = false;

    function addError(message) {
      errorCount += 1;

      if (errors.length < config.maxIssues) {
        errors.push(message);
      }
    }

    function addWarning(message) {
      warningCount += 1;

      if (warnings.length < config.maxIssues) {
        warnings.push(message);
      }
    }

    var seen = Object.create(null);
    var previousTimestamp = null;

    var validCandles = 0;
    var duplicateTimestamps = 0;
    var outOfOrderTimestamps = 0;

    var missingSpread = 0;
    var missingTickVolume = 0;

    candles.forEach(function (candle, index) {
      if (!isPlainObject(candle)) {
        addError("Candle " + index + " must be an object.");
        return;
      }

      var timestamp = candle.timestampMs;

      var timestampOK =
        Number.isFinite(timestamp) &&
        Number.isInteger(timestamp) &&
        timestamp > 0;

      if (!timestampOK) {
        addError(
          "Candle " + index +
          " has invalid timestampMs; expected positive epoch milliseconds."
        );
      } else {
        var key = String(timestamp);

        if (seen[key]) {
          duplicateTimestamps += 1;
          addError("Duplicate timestamp at candle " + index + ".");
        }

        seen[key] = true;

        if (
          previousTimestamp !== null &&
          timestamp < previousTimestamp
        ) {
          outOfOrderTimestamps += 1;
          addError("Out-of-order timestamp at candle " + index + ".");
        }

        if (
          config.checkAlignment &&
          ((timestamp - config.alignmentOffsetMs) % interval !== 0)
        ) {
          addError(
            "Candle " + index +
            " timestamp is not aligned to the configured timeframe boundary."
          );
        }

        previousTimestamp = timestamp;
      }

      var fields = ["open", "high", "low", "close"];
      var pricesOK = true;

      fields.forEach(function (field) {
        if (
          typeof candle[field] !== "number" ||
          !Number.isFinite(candle[field]) ||
          candle[field] <= 0
        ) {
          pricesOK = false;

          addError(
            "Candle " + index +
            " has invalid positive finite " + field + "."
          );
        }
      });

      if (
        pricesOK &&
        (
          candle.high < Math.max(candle.open, candle.close) ||
          candle.low > Math.min(candle.open, candle.close) ||
          candle.high < candle.low
        )
      ) {
        pricesOK = false;
        addError(
          "Candle " + index +
          " has inconsistent OHLC relationships."
        );
      }

      if (
        candle.spread === undefined ||
        candle.spread === null
      ) {
        missingSpread += 1;

        if (config.requireSpread) {
          addError("Candle " + index + " is missing required spread.");
        } else {
          addWarning("Candle " + index + " is missing spread.");
        }
      } else if (
        typeof candle.spread !== "number" ||
        !Number.isFinite(candle.spread) ||
        candle.spread < 0
      ) {
        addError("Candle " + index + " has invalid spread.");
      } else if (
        config.maximumSpread !== null &&
        candle.spread > config.maximumSpread
      ) {
        addWarning(
          "Candle " + index + " spread exceeds maximumSpread."
        );
      }

      if (
        candle.tickVolume === undefined ||
        candle.tickVolume === null
      ) {
        missingTickVolume += 1;

        if (config.requireTickVolume) {
          addError(
            "Candle " + index + " is missing required tickVolume."
          );
        } else {
          addWarning("Candle " + index + " is missing tickVolume.");
        }
      } else if (
        typeof candle.tickVolume !== "number" ||
        !Number.isFinite(candle.tickVolume) ||
        candle.tickVolume < 0
      ) {
        addError("Candle " + index + " has invalid tickVolume.");
      }

      if (timestampOK && pricesOK) {
        validCandles += 1;
      }
    });

    // Inspect gaps only between strictly chronological candles.

    for (var i = 1; i < candles.length; i += 1) {
      var previous = candles[i - 1];
      var current = candles[i];

      if (
        !isPlainObject(previous) ||
        !isPlainObject(current) ||
        !Number.isInteger(previous.timestampMs) ||
        !Number.isInteger(current.timestampMs) ||
        current.timestampMs <= previous.timestampMs
      ) {
        continue;
      }

      for (
        var expected = previous.timestampMs + interval;
        expected < current.timestampMs;
        expected += interval
      ) {
        if (gapChecks >= config.maxGapChecks) {
          truncated = true;
          break;
        }

        gapChecks += 1;

        if (!isMarketClosed(expected, config)) {
          var gap = {
            timestampMs: expected,
            afterIndex: i - 1,
            beforeIndex: i
          };

          detectedGapCount += 1;

          if (gaps.length < config.maxIssues) {
            gaps.push(gap);
          }
        }
      }

      if (truncated) break;
    }

    if (detectedGapCount) {
      addWarning(
        detectedGapCount +
        " missing expected candle interval(s) detected; gap list is capped by maxIssues."
      );
    }

    if (truncated) {
      addWarning(
        "Gap inspection stopped at maxGapChecks; validation is incomplete."
      );
    }

    var status =
      errorCount > 0
        ? "FAIL"
        : truncated
          ? "INCOMPLETE"
          : warningCount > 0
            ? "WARNING"
            : "PASS";

    var first =
      candles[0] &&
      Number.isFinite(candles[0].timestampMs)
        ? candles[0].timestampMs
        : null;

    var lastCandle = candles[candles.length - 1];

    var last =
      lastCandle &&
      Number.isFinite(lastCandle.timestampMs)
        ? lastCandle.timestampMs
        : null;

    return {
      valid: errorCount === 0,
      complete: !truncated,
      status: status,
      version: VERSION,
      mode: MODE,
      timeframe: timeframe,

      errors: errors,
      warnings: warnings,

      stats: {
        candleCount: candles.length,
        validCandles: validCandles,
        invalidCandles: candles.length - validCandles,

        duplicateTimestamps: duplicateTimestamps,
        outOfOrderTimestamps: outOfOrderTimestamps,

        missingSpread: missingSpread,
        missingTickVolume: missingTickVolume,

        detectedGaps: detectedGapCount,
        checkedIntervals: gapChecks,
        gapInspectionTruncated: truncated,

        firstTimestampMs: first,
        lastTimestampMs: last
      },

      gaps: gaps
    };
  }

  var api = Object.freeze({
    VERSION: VERSION,
    MODE: MODE,
    TIMEFRAMES: TIMEFRAMES,

    DEFAULT_CONFIG: Object.freeze({
      timezone: "UTC",

      weekend: Object.freeze({
        enabled: true,
        fridayCloseHour: 22,
        sundayOpenHour: 22
      }),

      marketClosures: Object.freeze([]),

      maxGapChecks: 100000,
      maxIssues: 100,

      requireSpread: false,
      maximumSpread: null,

      requireTickVolume: false,

      checkAlignment: false,
      alignmentOffsetMs: 0
    }),

    isMarketClosed: function (timestampMs, options) {
      var config = cloneConfig(options);
      var configErrors = validateConfig(config);

      if (configErrors.length) {
        throw new TypeError(configErrors.join(" "));
      }

      if (
        !Number.isFinite(timestampMs) ||
        !Number.isInteger(timestampMs) ||
        timestampMs <= 0
      ) {
        throw new TypeError(
          "timestampMs must be a positive integer."
        );
      }

      return isMarketClosed(timestampMs, config);
    },

    validate: validate
  });

  Object.defineProperty(
    root,
    "GoldGuardHistoricalDataValidatorV20",
    {
      value: api,
      writable: false,
      configurable: false,
      enumerable: true
    }
  );

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (
    root.console &&
    typeof root.console.log === "function"
  ) {
    root.console.log(
      "GoldGuard Historical Data Validator V" + VERSION + " loaded."
    );
  }

})(typeof globalThis !== "undefined" ? globalThis : this);
