

/*

 GOLDGUARD HISTORICAL INTEGRATION TEST V1.2

 Tests historical validation, component safeguards,

 and signal engine hand-off.

 No live data.

 No trade execution.

*/

(function () {

  "use strict";

  const results = [];

  function test(name, condition) {

    results.push({

      test: name,

      result: condition ? "PASS" : "FAIL"

    });

  }

  const integration = window.GoldGuardHistoricalIntegration;

  const originalAdapter = window.GoldGuardDataAdapter;

  const originalEngine = window.GoldGuardEngine;

  function runSafely(name, callback) {

    try {

      test(name, callback());

    } catch (error) {

      test(name, false);

      console.error(name, error);

    }

  }

  function makeCandles(count, startTime) {

    const candles = [];

    for (let i = 0; i < count; i++) {

      const date = new Date(startTime + i * 60000);

      const timestamp =

        date.getUTCFullYear() + "." +

        String(date.getUTCMonth() + 1).padStart(2, "0") + "." +

        String(date.getUTCDate()).padStart(2, "0") + " " +

        String(date.getUTCHours()).padStart(2, "0") + ":" +

        String(date.getUTCMinutes()).padStart(2, "0") + ":00";

      candles.push({

        Timestamp: timestamp,

        Open: 100,

        High: 101,

        Low: 99,

        Close: 100

      });

    }

    return candles;

  }

  function makeValidData() {

    return {

      h1: makeCandles(50, Date.UTC(2026, 10, 10)),

      m15: makeCandles(12, Date.UTC(2026, 10, 11)),

      m5: makeCandles(3, Date.UTC(2026, 10, 12)),

      newsBlocked: false,

      symbol: "XAUUSD"

    };

  }

  runSafely(

    "Historical integration exists",

    () => !!integration &&

      typeof integration.analyze === "function"

  );

  runSafely(

    "Correct integration version",

    () => !!integration &&

      integration.version === "1.2"

  );

  if (integration && typeof integration.analyze === "function") {

    runSafely(

      "Missing data returns WAIT",

      () => integration.analyze(null).status === "WAIT"

    );

    runSafely(

      "Missing timeframe returns WAIT",

      () => integration.analyze({

        h1: [],

        m15: [],

        newsBlocked: false

      }).status === "WAIT"

    );

    runSafely(

      "Unverified news returns WAIT",

      () => integration.analyze({

        h1: [],

        m15: [],

        m5: [],

        newsBlocked: undefined

      }).status === "WAIT"

    );

    runSafely(

      "Missing adapter returns WAIT",

      () => {

        try {

          window.GoldGuardDataAdapter = null;

          return integration.analyze(makeValidData()).status === "WAIT";

        } finally {

          window.GoldGuardDataAdapter = originalAdapter;

        }

      }

    );

    runSafely(

      "Missing engine returns WAIT",

      () => {

        try {

          window.GoldGuardEngine = null;

          return integration.analyze(makeValidData()).status === "WAIT";

        } finally {

          window.GoldGuardEngine = originalEngine;

        }

      }

    );

    runSafely(

      "Invalid OHLC candles return WAIT",

      () => {

        const data = makeValidData();

        data.h1[0] = {

          Timestamp: "2026.11.11 10:00:00",

          Open: 100,

          High: 99,

          Low: 98,

          Close: 101

        };

        return integration.analyze(data).status === "WAIT";

      }

    );

    runSafely(

      "Insufficient H1 candles return WAIT",

      () => {

        const data = makeValidData();

        data.h1 = makeCandles(

          10,

          Date.UTC(2026, 10, 10)

        );

        const result = integration.analyze(data);

        return result.status === "WAIT" &&

          result.reason === "H1 has insufficient candles";

      }

    );

    runSafely(

      "Insufficient M15 candles return WAIT",

      () => {

        const data = makeValidData();

        data.m15 = makeCandles(

          11,

          Date.UTC(2026, 10, 11)

        );

        const result = integration.analyze(data);

        return result.status === "WAIT" &&

          result.reason === "M15 has insufficient candles";

      }

    );

    runSafely(

      "Insufficient M5 candles return WAIT",

      () => {

        const data = makeValidData();

        data.m5 = makeCandles(

          2,

          Date.UTC(2026, 10, 12)

        );

        const result = integration.analyze(data);

        return result.status === "WAIT" &&

          result.reason === "M5 has insufficient candles";

      }

    );

    runSafely(

      "Invalid timestamps return WAIT",

      () => {

        const data = makeValidData();

        data.h1[0].Timestamp = "invalid-date";

        const result = integration.analyze(data);

        return result.status === "WAIT" &&

          result.reason === "H1 contains an invalid timestamp";

      }

    );

    runSafely(

      "Out-of-order candles return WAIT",

      () => {

        const data = makeValidData();

        data.m15[5].Timestamp =

          data.m15[4].Timestamp;

        const result = integration.analyze(data);

        return result.status === "WAIT" &&

          result.reason ===

            "M15 candles are not in chronological order";

      }

    );

    runSafely(

      "Adapter validation reason is preserved",

      () => {

        try {

          window.GoldGuardDataAdapter = {

            convertCandles: function () {

              return {

                valid: false,

                reason: "TEST ADAPTER VALIDATION ERROR"

              };

            }

          };

          const result = integration.analyze(makeValidData());

          return result.status === "WAIT" &&

            result.reason === "TEST ADAPTER VALIDATION ERROR";

        } finally {

          window.GoldGuardDataAdapter = originalAdapter;

        }

      }

    );

    runSafely(

      "Invalid engine status returns WAIT",

      () => {

        try {

          window.GoldGuardEngine = {

            analyze: function () {

              return {

                status: "HOLD"

              };

            }

          };

          const result = integration.analyze(makeValidData());

          return result.status === "WAIT" &&

            result.reason ===

              "Signal engine returned an invalid status";

        } finally {

          window.GoldGuardEngine = originalEngine;

        }

      }

    );

    runSafely(

      "Engine processing error returns WAIT",

      () => {

        try {

          window.GoldGuardEngine = {

            analyze: function () {

              throw new Error("TEST ENGINE ERROR");

            }

          };

          return integration.analyze(makeValidData()).status === "WAIT";

        } finally {

          window.GoldGuardEngine = originalEngine;

        }

      }

    );

    runSafely(

      "Valid historical data reaches signal engine",

      () => {

        const result = integration.analyze(makeValidData());

        return result.status === "WAIT" &&

          result.reason === "No clear H1 direction" &&

          result.result !== undefined;

      }

    );

  }

  window.GoldGuardDataAdapter = originalAdapter;

  window.GoldGuardEngine = originalEngine;

  console.table(results);

  document.body.insertAdjacentHTML(

    "beforeend",

    "<pre>" +

    results.map(item =>

      item.test + ": " + item.result

    ).join("\n") +

    "</pre>"

  );

  const passed = results.filter(

    item => item.result === "PASS"

  ).length;

  const failed = results.filter(

    item => item.result === "FAIL"

  ).length;

  console.log(

    "Historical integration tests V1.2: " +

    passed + "/" + results.length +

    " passed. FAILURES: " + failed

  );

})();
