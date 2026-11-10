/*

 GOLDGUARD DASHBOARD CONNECTION V1.0

 Connects dashboard to GoldGuard Signal Engine.

 No fabricated market data. No trade execution.

*/

(function () {

  "use strict";

  function formatPrice(value) {

    return Number.isFinite(value)

      ? value.toFixed(2)

      : "Not set";

  }

  function render(result) {

    const signal = document.querySelector(".wait");

    const reason = document.querySelector(".wait + .sub");

    const metrics = document.querySelectorAll(

      ".grid .metric strong"

    );

    if (!signal || !reason || metrics.length < 4) {

      return;

    }

    signal.textContent = result.status;

    reason.textContent = result.status === "WAIT"

      ? result.reason

      : "Engine conditions confirmed. Demo analysis only.";

    metrics[0].textContent = formatPrice(result.entry);

    metrics[1].textContent = formatPrice(result.stopLoss);

    metrics[2].textContent = formatPrice(result.takeProfit);

    metrics[3].textContent =

      result.riskPercent + "% maximum";

  }

  function start() {

    if (!window.GoldGuardEngine) {

      console.error("GoldGuard Engine not found.");

      return;

    }

    window.GoldGuardDashboard = {

      update: function (data) {

        const result = window.GoldGuardEngine.analyze(data);

        render(result);

        return result;

      }

    };

    // No market data connected yet.

    // Safely display WAIT until verified data is supplied.

    window.GoldGuardDashboard.update({});

    

    console.log("GoldGuard Dashboard V1.0 connected.");

  }

  if (document.readyState === "loading") {

    document.addEventListener("DOMContentLoaded", start);

  } else {

    start();

  }

})();
