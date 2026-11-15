

/*

 GOLDGUARD BACKTEST LOAD TEST V1.0

 Checks whether the backtest engine

 is correctly loaded.

 No trading.

 No market data requests.

 No trade execution.

*/

(function () {

  "use strict";

  const panel = document.createElement("div");

  panel.style.padding = "14px";

  panel.style.margin = "12px";

  panel.style.border = "1px solid #d4a72c";

  panel.style.borderRadius = "10px";

  panel.style.background = "#11151c";

  panel.style.color = "#ffffff";

  panel.style.fontSize = "14px";

  const engine = window.GoldGuardBacktest;

  if (

    engine &&

    typeof engine.run === "function" &&

    engine.version === "1.0"

  ) {

    panel.textContent =

      "BACKTEST ENGINE: LOADED ✓ | Version 1.0 | Historical simulation only.";

  } else {

    panel.textContent =

      "BACKTEST ENGINE: NOT LOADED ✗ | Check script connection.";

  }

  document.body.appendChild(panel);

})();
