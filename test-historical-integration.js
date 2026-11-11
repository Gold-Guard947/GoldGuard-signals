

/*

 GOLDGUARD HISTORICAL INTEGRATION TEST V1.0

 Tests historical data integration.

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

  const integration =

    window.GoldGuardHistoricalIntegration;

  test(

    "Historical integration exists",

    !!integration &&

    typeof integration.analyze === "function"

  );

  test(

    "Correct integration version",

    !!integration &&

    integration.version === "1.0"

  );

  if (integration &&

      typeof integration.analyze === "function") {

    const missing = integration.analyze(null);

    test(

      "Missing data returns WAIT",

      missing.status === "WAIT"

    );

    const missingTimeframes = integration.analyze({

      h1: [],

      m15: [],

      newsBlocked: false

    });

    test(

      "Missing timeframe returns WAIT",

      missingTimeframes.status === "WAIT"

    );

    const invalidNews = integration.analyze({

      h1: [],

      m15: [],

      m5: [],

      newsBlocked: undefined

    });

    test(

      "Unverified news returns WAIT",

      invalidNews.status === "WAIT"

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

      "Invalid historical candles return WAIT",

      invalidCandles.status === "WAIT"

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

})()
