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
