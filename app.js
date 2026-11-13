/*

 GOLDGUARD DASHBOARD CONNECTION V1.1

 Connects dashboard through Historical Integration.

 Historical data only.

 No fabricated prices.

 No trade execution.

*/

(function () {

  "use strict";

  function formatPrice(value) {

    return Number.isFinite(value)

      ? value.toFixed(2)

      : "Not set";

  }

  function render(response) {

    const result = response.result || response;

    const signal = document.querySelector(".wait");

    const reason = document.querySelector(".wait + .sub");

    const metrics = document.querySelectorAll(

      ".grid .metric strong"

    );

    if (!signal || !reason || metrics.length < 4) {

      return;

    }

    signal.textContent = result.status || "WAIT";

    reason.textContent =

      result.status === "WAIT"

        ? result.reason || response.reason || "No verified setup"

        : "Engine conditions confirmed. Demo analysis only.";

    metrics[0].textContent = formatPrice(result.entry);

    metrics[1].textContent = formatPrice(result.stopLoss);

    metrics[2].textContent = formatPrice(result.takeProfit);

    metrics[3].textContent =

      Number.isFinite(result.riskPercent)

        ? result.riskPercent + "% maximum"

        : "0.5% maximum";

  }

  function start() {

    if (!window.GoldGuardHistoricalIntegration) {

      console.error(

        "GoldGuard Historical Integration not found."

      );

      return;

    }

    window.GoldGuardDashboard = {

      update: function (data) {

        const response =

          window.GoldGuardHistoricalIntegration.analyze(data);

        render(response);

        return response;

      }

    };

    // Safe initial state.

    // No market data is fabricated or assumed.

    window.GoldGuardDashboard.update({});

    console.log(

      "GoldGuard Dashboard V1.1 connected."

    );

  }

  if (document.readyState === "loading") {

    document.addEventListener("DOMContentLoaded", start);

  } else {

    start();

  }

})();
