

/*

 GOLDGUARD DASHBOARD CONNECTION V1.2

 Connects dashboard to historical market data.

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

        : "Historical analysis only. Demo testing.";

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

      console.error("Historical Integration missing.");

      return;

    }

    window.GoldGuardDashboard = {

      update: function (data) {

        const response =

          window.GoldGuardHistoricalIntegration.analyze(data);

        render(response);

        return response;

      },

      loadHistorical: async function (from, to, newsBlocked) {

        const marketData = window.GoldGuardMarketData;

        if (!marketData) {

          return {

            valid: false,

            reason: "Market data module missing"

          };

        }

        const response =

          await marketData.fetchAndAnalyze(

            from,

            to,

            newsBlocked

          );

        if (!response.valid) {

          return response;

        }

        render(response.analysis);

        return response;

      }

    };

    window.GoldGuardDashboard.update({});

    console.log(

      "GoldGuard Dashboard V1.2 connected."

    );

  }

  if (document.readyState === "loading") {

    document.addEventListener("DOMContentLoaded", start);

  } else {

    start();

  }

})()
