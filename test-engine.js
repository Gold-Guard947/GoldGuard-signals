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

  if (!engine) {

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
