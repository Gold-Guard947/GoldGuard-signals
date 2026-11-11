/*

 GOLDGUARD ENGINE TEST V1.0

 Tests the separate signal engine.

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

  test(

    "Engine exists",

    !!engine && typeof engine.analyze === "function"

  );
  
// GOLDGUARD DATA ADAPTER TESTS V1.0

  const adapter = window.GoldGuardDataAdapter;

  test(

    "Data adapter exists",

    !!adapter &&

    typeof adapter.convertCandles === "function"

  );

  const adapterResult = adapter

    ? adapter.convertCandles([{

        Timestamp: "2026.10.30 20:55:00",

        Open: 100,

        High: 102,

        Low: 98,

        Close: 101,

        TickVolume: 500,

        Spread: 240

      }])

    : null;

  test(

    "Adapter converts uppercase OHLC",

    !!adapterResult &&

    adapterResult.valid === true &&

    adapterResult.candles[0].open === 100 &&

    adapterResult.candles[0].close === 101

  );

  const invalidResult = adapter

    ? adapter.convertCandles([{

        Timestamp: "2026.10.30 20:55:00",

        Open: 100,

        High: 99,

        Low: 98,

        Close: 101

      }])

    : null;

  test(

    "Adapter rejects invalid OHLC",

    !!invalidResult &&

    invalidResult.valid === false

  );
  console.table(results);

  document.body.insertAdjacentHTML(

    "beforeend",

    "<pre>" +

    results.map(item => item.test + ': ' + item.result).join('\n') +

    "</pre>"

  );

  return;
}



    

    



  test(

    "Correct version",

    engine.version === "1.0"

  );

  const missing = engine.analyze({});

  test(

    "Missing data returns WAIT",

    missing.status === "WAIT"

  );

  const insufficient = engine.analyze({

    h1: [],

    m15: [],

    m5: [],

    newsBlocked: false

  });

  test(

    "Insufficient data returns WAIT",

    insufficient.status === "WAIT"

  );
// V1.1 SAFETY TEST DATA

  const makeCandles = (count) =>

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

    "Unverified news status returns WAIT",

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

    "Invalid candle data returns WAIT",

    engine.analyze({

      ...validMarketData,

      h1: [

        ...validMarketData.h1.slice(0, 49),

        { open: 100, high: 99, low: 98, close: 101 }

      ]

    }).status === "WAIT"

  );

  test(

    "Neutral H1 direction returns WAIT",

    engine.analyze(validMarketData).status === "WAIT"

  );
  console.table(results);
document.body.insertAdjacentHTML(

  "beforeend",

  "<pre id='goldguard-test-results'>" +

  results.map(item => item.test + ': ' + item.result).join('\n') +

  "</pre>"

);

  const passed = results.filter(

    item => item.result === "PASS"

  ).length;

  console.log(

    "GoldGuard tests: " +

    passed + "/" + results.length + " passed"
);
})();
