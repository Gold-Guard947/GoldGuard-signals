

/*

 GOLDGUARD ENGINE TEST V1.1

 Tests the signal engine and strict data adapter.

 Historical/demo research only.

 No trading. No execution.

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

  const engine = window.GoldGuardEngine;

  const adapter = window.GoldGuardDataAdapter;

  // SIGNAL ENGINE TESTS

  test(

    "Engine exists",

    !!engine &&

    typeof engine.analyze === "function"

  );

  if (engine && typeof engine.analyze === "function") {

    test(

      "Signal engine version 1.0",

      engine.version === "1.0"

    );

    test(

      "Missing data returns WAIT",

      engine.analyze({}).status === "WAIT"

    );

    const makeCandles = count =>

      Array.from({ length: count }, () => ({

        open: 100,

        high: 102,

        low: 98,

        close: 101

      }));

    const validMarketData = {

      h1: makeCandles(50),

      m15: makeCandles(12),

      m5: makeCandles(3),

      newsBlocked: false

    };

    test(

      "Insufficient data returns WAIT",

      engine.analyze({

        h1: [],

        m15: [],

        m5: [],

        newsBlocked: false

      }).status === "WAIT"

    );

    test(

      "Unverified news returns WAIT",

      engine.analyze({

        ...validMarketData,

        newsBlocked: undefined

      }).status === "WAIT"

    );

    test(

      "Major news protection returns WAIT",

      engine.analyze({

        ...validMarketData,

        newsBlocked: true

      }).status === "WAIT"

    );

    test(

      "Invalid OHLC returns WAIT",

      engine.analyze({

        ...validMarketData,

        h1: [

          ...validMarketData.h1.slice(0, 49),

          {

            open: 100,

            high: 99,

            low: 98,

            close: 101

          }

        ]

      }).status === "WAIT"

    );

    test(

      "Neutral H1 direction returns WAIT",

      engine.analyze(validMarketData).status === "WAIT"

    );

  }

  // DATA ADAPTER V1.1 TESTS

  test(

    "Data adapter exists",

    !!adapter &&

    typeof adapter.convertCandles === "function"

  );

  if (

    adapter &&

    typeof adapter.convertCandles === "function"

  ) {

    test(

      "Data adapter version 1.1",

      adapter.version === "1.1"

    );

    function candle(timestamp, overrides) {

      return Object.assign({

        Timestamp: timestamp,

        Open: 100,

        High: 102,

        Low: 98,

        Close: 101,

        TickVolume: 500,

        Spread: 240

      }, overrides || {});

    }

    function convert(data) {

      return adapter.convertCandles(data);

    }

    const valid = convert([

      candle("2026.10.30 20:55:00")

    ]);

    test(

      "Uppercase OHLC converts correctly",

      valid.valid === true &&

      valid.candles[0].open === 100 &&

      valid.candles[0].close === 101

    );

    test(

      "Timestamp milliseconds generated",

      valid.valid === true &&

      Number.isFinite(valid.candles[0].timestampMs)

    );

    test(

      "Empty dataset rejected",

      convert([]).valid === false

    );

    test(

      "Missing dataset rejected",

      convert(null).valid === false

    );

    test(

      "Invalid OHLC rejected",

      convert([

        candle("2026.10.30 20:55:00", {

          High: 99

        })

      ]).valid === false

    );

    test(

      "Zero prices rejected",

      convert([

        candle("2026.10.30 20:55:00", {

          Open: 0

        })

      ]).valid === false

    );

    test(

      "Negative prices rejected",

      convert([

        candle("2026.10.30 20:55:00", {

          Close: -1

        })

      ]).valid === false

    );

    test(

      "Invalid calendar date rejected",

      convert([

        candle("2026.02.30 20:55:00")

      ]).valid === false

    );

    test(

      "Invalid timestamp format rejected",

      convert([

        candle("30-10-2026 20:55:00")

      ]).valid === false

    );

    test(

      "Duplicate timestamps rejected",

      convert([

        candle("2026.10.30 20:55:00"),

        candle("2026.10.30 20:55:00")

      ]).valid === false

    );

    test(

      "Out-of-order timestamps rejected",

      convert([

        candle("2026.10.30 20:55:00"),

        candle("2026.10.30 20:50:00")

      ]).valid === false

    );

    test(

      "Negative tick volume rejected",

      convert([

        candle("2026.10.30 20:55:00", {

          TickVolume: -1

        })

      ]).valid === false

    );

    test(

      "Negative spread rejected",

      convert([

        candle("2026.10.30 20:55:00", {

          Spread: -1

        })

      ]).valid === false

    );

    test(

      "Non-numeric tick volume rejected",

      convert([

        candle("2026.10.30 20:55:00", {

          TickVolume: "invalid"

        })

      ]).valid === false

    );

    test(

      "Non-numeric spread rejected",

      convert([

        candle("2026.10.30 20:55:00", {

          Spread: "invalid"

        })

      ]).valid === false

    );

    test(

      "Missing optional volume and spread accepted",

      convert([

        candle("2026.10.30 20:55:00", {

          TickVolume: undefined,

          Spread: undefined

        })

      ]).valid === true

    );

    test(

      "Valid chronological candles accepted",

      convert([

        candle("2026.10.30 20:50:00"),

        candle("2026.10.30 20:55:00"),

        candle("2026.10.30 21:00:00")

      ]).valid === true

    );

  }

  // DISPLAY RESULTS

  const passed = results.filter(

    item => item.result === "PASS"

  ).length;

  const failed = results.length - passed;

  console.table(results);

  let output = document.getElementById(

    "goldguard-test-results"

  );

  if (!output) {

    output = document.createElement("pre");

    output.id = "goldguard-test-results";

    document.body.appendChild(output);

  }

  output.textContent =

    "GOLDGUARD TEST SUITE V1.1\n\n" +

    results.map(item =>

      item.test + ": " + item.result

    ).join("\n") +

    "\n\nTOTAL: " + passed + "/" + results.length +

    " PASSED\nFAILED: " + failed;

  console.log(

    "GoldGuard V1.1 tests: " +

    passed + "/" + results.length + " passed."

  );

})();
