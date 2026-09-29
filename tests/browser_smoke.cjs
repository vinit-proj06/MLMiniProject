/* Start the Python server first. These tests exercise the real UI and API.
   Run npm install, then npm run test:ui (requires Google Chrome). */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = process.env.APP_URL || "http://127.0.0.1:8000";
const outputDirectory = path.join(__dirname, "..", "test-results");

async function runTests() {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const report = [];
  const record = (message) => {
    report.push(message);
    console.log("PASS", message);
  };

  async function visit(route) {
    await page.goto(`${baseUrl}/#${route}`);
    await page.locator("main h1").waitFor();
  }
  async function snapshot(name) {
    await page.screenshot({
      path: path.join(outputDirectory, name + ".png"),
      fullPage: true,
    });
  }

  try {
    await visit("/result");
    assert.match(await page.locator("main").innerText(), /prediction|predict/i);
    record("Result page handles an empty session");

    await visit("/");
    assert.match(await page.locator("main").innerText(), /2,000/);
    await snapshot("home-desktop");

    for (const model of ["random_forest", "svm"]) {
      await visit("/predict");
      assert.equal(
        await page
          .locator(
            "#prediction-form input[type=number], #prediction-form select",
          )
          .count(),
        20,
      );
      await page.locator("#predict-ram").fill("3072");
      await page.locator(`input[name=model][value=${model}]`).check();
      const responsePromise = page.waitForResponse((response) =>
        response.url().endsWith("/api/predict"),
      );
      await page.locator("#prediction-form button[type=submit]").click();
      const response = await responsePromise;
      assert.equal(response.status(), 200);
      const result = await response.json();
      assert.equal(result.model, model);
      assert.equal(result.features.ram, 3072);
      await page.waitForURL("**/#/result");
      const resultText = await page.locator("main").innerText();
      assert.ok(resultText.includes(result.label));
      assert.ok(resultText.includes(result.model_name));
      assert.ok(resultText.includes("3,072"));
      await snapshot(`result-${model}`);
      await page.reload();
      await page.locator("#edit-prediction").waitFor();
      assert.ok(
        (await page.locator("main").innerText()).includes(result.label),
      );
      record(`${model}: input → API → saved model → result, including reload`);
    }

    await visit("/models");
    const metrics = await (
      await page.request.get(`${baseUrl}/api/metrics`)
    ).json();
    const modelsText = await page.locator("main").innerText();
    for (const model of Object.values(metrics.models)) {
      for (const metric of ["accuracy", "precision", "recall", "f1"]) {
        assert.ok(modelsText.includes((model[metric] * 100).toFixed(2) + "%"));
      }
    }
    await snapshot("models-desktop");
    record("All eight displayed metrics match actual API evaluation values");

    for (const model of ["random_forest", "svm"]) {
      await visit("/compare");
      await page.locator("#compare-model").selectOption(model);
      assert.equal(
        await page.locator("#compare-form input[type=number]").count(),
        28,
      );
      await page.locator("#mobile-0-name").fill("Entry phone");
      await page.locator("#mobile-1-name").fill("Power phone");
      await page.locator("#mobile-0-ram").fill("512");
      await page.locator("#mobile-1-ram").fill("3800");
      const responsePromise = page.waitForResponse((response) =>
        response.url().endsWith("/api/compare"),
      );
      await page.locator("#compare-form button[type=submit]").click();
      const response = await responsePromise;
      assert.equal(response.status(), 200);
      const comparison = await response.json();
      await page.locator(".comparison-overview").waitFor();
      const text = await page.locator("#comparison-results").innerText();
      for (const mobile of comparison.mobiles) {
        assert.ok(text.includes(mobile.name));
        assert.ok(text.includes(mobile.label));
      }
      assert.equal(comparison.mobiles[0].features.ram, 512);
      assert.equal(comparison.mobiles[1].features.ram, 3800);
      await snapshot(`comparison-${model}`);
      await page.locator("#mobile-0-ram").fill("1024");
      assert.equal(
        (await page.locator("#comparison-results").innerText()).trim(),
        "",
      );
      record(
        `${model}: two-phone comparison, submitted values, and stale-result clearing`,
      );
    }

    // A response from a form the user left must not overwrite a newer result.
    await visit("/predict");
    let releaseOldRequest;
    let firstRequestStarted;
    const firstRequest = new Promise((resolve) => {
      firstRequestStarted = resolve;
    });
    let holdFirstRequest = true;
    await page.route("**/api/predict", async (route) => {
      if (holdFirstRequest) {
        holdFirstRequest = false;
        await new Promise((resolve) => {
          releaseOldRequest = resolve;
          firstRequestStarted();
        });
      }
      await route.continue();
    });
    await page.locator("#predict-ram").fill("512");
    await page.locator("#prediction-form button[type=submit]").click();
    await firstRequest;
    await page.locator(".brand").first().click();
    await page.locator(".hero").waitFor();
    await page.locator("#main-navigation a[href='#/predict']").click();
    await page.locator("#predict-ram").fill("3800");
    await page.locator("input[name=model][value=svm]").check();
    await page.locator("#prediction-form button[type=submit]").click();
    await page.waitForURL("**/#/result");
    const oldResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/predict") &&
        response.request().postDataJSON().features.ram === 512,
    );
    releaseOldRequest();
    await (await oldResponse).finished();
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await page.locator("#edit-prediction").click();
    assert.equal(await page.locator("#predict-ram").inputValue(), "3800");
    assert.equal(
      await page.locator("input[name=model][value=svm]").isChecked(),
      true,
    );
    await page.unroute("**/api/predict");
    record(
      "A delayed response from an abandoned form cannot overwrite a newer result",
    );

    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ["/", "/predict", "/result", "/models", "/compare"]) {
        await visit(route);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1,
        );
        assert.equal(
          overflow,
          false,
          `Horizontal overflow at ${width}px on ${route}`,
        );
      }
      await visit("/");
      await snapshot(`home-${width}`);
      if (width < 640) {
        await page.locator(".menu-toggle").click();
        assert.equal(
          await page.locator(".menu-toggle").getAttribute("aria-expanded"),
          "true",
        );
        await page.locator("#main-navigation a[href='#/predict']").click();
        await page.locator("#prediction-form").waitFor();
        assert.equal(
          await page.locator(".menu-toggle").getAttribute("aria-expanded"),
          "false",
        );
      }
      record(
        `All five pages fit ${width}px; mobile navigation works where applicable`,
      );
    }

    await visit("/predict");
    await page.locator("#predict-ram").fill("9000");
    await page.locator("#prediction-form button[type=submit]").click();
    assert.equal(
      await page
        .locator("#predict-ram")
        .evaluate((input) => input.validity.rangeOverflow),
      true,
    );
    assert.ok(page.url().endsWith("#/predict"));
    record("Browser validation prevents out-of-range submissions");
    assert.deepEqual(errors, [], "Unexpected browser console/runtime errors");
    record("No browser console or runtime errors during normal flows");

    // Simulate a server outage to check the visible recovery path.
    await page.locator("#predict-ram").fill("2048");
    await page.route("**/api/predict", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Models are temporarily unavailable.",
          details: [],
        }),
      }),
    );
    await page.locator("#prediction-form button[type=submit]").click();
    await page
      .locator("#prediction-error")
      .filter({ hasText: "temporarily unavailable" })
      .waitFor();
    assert.equal(
      await page.locator("#prediction-form button[type=submit]").isEnabled(),
      true,
    );
    await page.unroute("**/api/predict");
    await page.locator("#prediction-form button[type=submit]").click();
    await page.waitForURL("**/#/result");
    record("API error is shown clearly and the same form successfully retries");

    fs.writeFileSync(
      path.join(outputDirectory, "browser-report.json"),
      JSON.stringify(
        {
          passed: report,
          unexpectedErrors: [],
          note: "One deliberate HTTP 503 was injected to test error recovery.",
        },
        null,
        2,
      ),
    );
    console.log(
      `Browser checks complete. Screenshots and report: ${outputDirectory}`,
    );
  } finally {
    await browser.close();
  }
}

runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
