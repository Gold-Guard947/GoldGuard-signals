

/*

 GOLDGUARD DASHBOARD CONNECTION V1.3

 Connects dashboard to historical market data

 and activates the Historical Data Test button.

 Historical data only.

 No fabricated prices.

 No live trading.

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

        : "Historical analysis only. Not a live signal.";

    metrics[0].textContent = formatPrice(result.entry);

    metrics[1].textContent = formatPrice(result.stopLoss);

    metrics[2].textContent = formatPrice(result.takeProfit);

    metrics[3].textContent =

      Number.isFinite(result.riskPercent)

        ? result.riskPercent + "% maximum"

        : "0.5% maximum";

  }

  function connectHistoricalTest() {

    const button = document.getElementById(

      "run-historical-test"

    );

    const fromInput = document.getElementById(

      "test-from"

    );

    const toInput = document.getElementById(

      "test-to"

    );

    const status = document.getElementById(

      "historical-test-status"

    );

    if (!button || !fromInput || !toInput || !status) {

      console.error("Historical test panel elements missing.");

      return;

    }

    button.addEventListener("click", async function () {

      const from = fromInput.value;

      const to = toInput.value;

      if (!from || !to) {

        status.textContent = "Please select both dates.";

        return;

      }

      if (to < from) {

        status.textContent = "End date must be after start date.";

        return;

      }

      button.disabled = true;

      status.textContent =

        "Loading historical H1, M15 and M5 data...";

      try {

        const response =

          await window.GoldGuardDashboard.loadHistorical(

            from,

            to,

            true

          );

        if (!response || !response.valid) {

          status.textContent =

            "Test failed: " +

            (response && response.reason

              ? response.reason

              : "Unknown error");

          return;

        }

        const analysis = response.analysis;

        const result =

          analysis && analysis.result

            ? analysis.result

            : analysis;

        const signalStatus =

          result && result.status

            ? result.status

            : "WAIT";

        const reason =

          result && result.reason

            ? result.reason

            : "No additional analysis reason provided.";

        status.textContent =

          "Historical test completed. Engine status: " +

          signalStatus +

          ". " +

          reason +

          " News block was forced ON. Historical data only; not a live signal.";

      } catch (error) {

        status.textContent =

          "Test error: " + error.message;

      } finally {

        button.disabled = false;

      }

    });

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

    connectHistoricalTest();

    window.GoldGuardDashboard.update({});

    console.log(

      "GoldGuard Dashboard V1.3 connected."

    );

  }

  if (document.readyState === "loading") {

    document.addEventListener("DOMContentLoaded", start);

  } else {

    start();

  }

})();
