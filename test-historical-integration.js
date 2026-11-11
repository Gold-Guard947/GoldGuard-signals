

/*

 GOLDGUARD HISTORICAL INTEGRATION TEST V1.1

 Tests historical validation and engine hand-off.

 No live data. No trade execution.

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

  test(

    "Historical integration exists",

    !!integration && typeof integration.analyze === "function"

  );

  test(

    "Correct integration version",

    !!integration && integration.version === "1.1"

  );

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

  if (integration && typeof integration.analyze === "function") {

    test(

      "Missing data returns WAIT",

      integration.analyze(null).status === "WAIT"

    );

    test(

      "Missing timeframe returns WAIT",

      integration.analyze({

        h1: [],

        m15: [],

        newsBlocked: false

      }).status === "WAIT"

    );

    test(

      "Unverified news returns WAIT",

      integration.analyze({

        h1: [],

        m15: [],

        m5: [],

        newsBlocked: undefined

      }).status === "WAIT"

    );

    const invalidCandles = integration.analyze({

      h1: [{

        Timestamp: "2026.11.11 10:00:00",

        Open: 100,

        High: 99,

        Low: 98,

        Close: 101

      }],

      m15: [],

      m5: [],

      newsBlocked: false

    });

    test(

      "Invalid OHLC candles return WAIT",

      invalidCandles.status === "WAIT"

    );

    const shortData = integration.analyze({

      h1: makeCandles(10, Date.UTC(2026, 10, 10)),

      m15: makeCandles(12, Date.UTC(2026, 10, 11)),

      m5: makeCandles(3, Date.UTC(2026, 10, 12)),

      newsBlocked: false

    });

    test(

      "Insufficient H1 candles return WAIT",

      shortData.status === "WAIT" &&

      shortData.reason === "H1 has insufficient candles"

    );

    const invalidTimestampData = {

      h1: makeCandles(50, Date.UTC(2026, 10, 10)),

      m15: makeCandles(12, Date.UTC(2026, 10, 11)),

      m5: makeCandles(3, Date.UTC(2026, 10, 12)),

      newsBlocked: false

    };

    invalidTimestampData.h1[0].Timestamp = "invalid-date";

    const timestampResult = integration.analyze(invalidTimestampData);

    test(

      "Invalid timestamps return WAIT",

      timestampResult.status === "WAIT" &&

      timestampResult.reason === "H1 contains an invalid timestamp"

    );

    const unorderedData = {

      h1: makeCandles(50, Date.UTC(2026, 10, 10)),

      m15: makeCandles(12, Date.UTC(2026, 10, 11)),

      m5: makeCandles(3, Date.UTC(2026, 10, 12)),

      newsBlocked: false

    };

    unorderedData.m15[5].Timestamp =

      unorderedData.m15[4].Timestamp;

    const orderResult = integration.analyze(unorderedData);

    test(

      "Out-of-order candles return WAIT",

      orderResult.status === "WAIT" &&

      orderResult.reason === "M15 candles are not in chronological order"

    );

    const validData = {

      h1: makeCandles(50, Date.UTC(2026, 10, 10)),

      m15: makeCandles(12, Date.UTC(2026, 10, 11)),

      m5: makeCandles(3, Date.UTC(2026, 10, 12)),

      newsBlocked: false,

      symbol: "XAUUSD"

    };

    const validResult = integration.analyze(validData);

    test(

      "Valid historical data reaches signal engine",

      validResult.status === "WAIT" &&

      validResult.reason === "No clear H1 direction" &&

      validResult.result !== undefined

    );

  }

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

  console.log(

    "Historical integration tests: " +

    passed + "/" + results.length + " passed"

  );

})();
