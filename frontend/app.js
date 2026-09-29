/* MobileIQ uses one small JavaScript file and hash-based page navigation.
   The API owns the feature schema, predictions, and measured model metrics. */
"use strict";

const main = document.querySelector("#main-content");
const liveStatus = document.querySelector("#live-status");
const navigation = document.querySelector("#main-navigation");
const menuToggle = document.querySelector(".menu-toggle");
const DATASET_URL =
  "https://www.kaggle.com/datasets/navjotkaushal/mobile-price-classification-dataset";
const state = {
  metadata: null,
  metrics: null,
  selectedModel: "random_forest",
  predictionFeatures: null,
  compareModel: "random_forest",
  compareMobiles: null,
  comparison: null,
  result: readSavedResult(),
};

// Escape values before inserting them into HTML, including user-entered names.
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

function icon(name) {
  const paths = {
    arrow: '<path d="M4 12h16M14 6l6 6-6 6"/>',
    external: '<path d="M7 17 17 7M7 7h10v10"/>',
    phone:
      '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4M11 18h2"/>',
    chart: '<path d="M4 4v16h17M8 16v-5M13 16V7M18 16v-8"/>',
    compare:
      '<rect x="3" y="5" width="6" height="14" rx="1.5"/><rect x="15" y="5" width="6" height="14" rx="1.5"/><path d="M11 9h2M11 15h2"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
    layers:
      '<path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    shield:
      '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
    tree: '<path d="M12 3v5M5 12V8h14v4M5 16v5M19 16v5"/><circle cx="12" cy="3" r="2"/><rect x="3" y="12" width="4" height="4" rx="1"/><rect x="17" y="12" width="4" height="4" rx="1"/>',
    boundary:
      '<path d="m4 20 16-16"/><circle cx="6" cy="6" r="2"/><circle cx="5" cy="13" r="1.5"/><circle cx="17" cy="17" r="2"/><circle cx="18" cy="10" r="1.5"/>',
    database:
      '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 4 16 4 16 0V5M4 12v7c0 4 16 4 16 0v-7"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.phone}</svg>`;
}

async function apiRequest(path, body) {
  let response;
  try {
    response = await fetch(
      path,
      body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {},
    );
  } catch {
    throw new Error(
      "Could not connect to the Python server. Check that it is running, then try again.",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The server returned an unreadable response. Please try again.",
    );
  }
  if (!response.ok) {
    const error = new Error(
      data.error || "This request could not be completed.",
    );
    error.details = Array.isArray(data.details) ? data.details : [];
    throw error;
  }
  return data;
}

function readSavedResult() {
  try {
    const result = JSON.parse(sessionStorage.getItem("mobileiq-result"));
    return result &&
      Number.isInteger(result.price_range) &&
      result.features &&
      result.model_name
      ? result
      : null;
  } catch {
    return null;
  }
}

function saveResult(result) {
  state.result = result;
  try {
    sessionStorage.setItem("mobileiq-result", JSON.stringify(result));
  } catch {
    // A prediction still works when browser storage is disabled.
  }
}

function formatNumber(value) {
  return typeof value === "number" ? value.toLocaleString("en-US") : "—";
}

function percent(value) {
  return Number.isFinite(value)
    ? `${(value * 100).toFixed(2)}%`
    : "Unavailable";
}

function featureGroups() {
  const preferredOrder = [
    "Performance",
    "Display",
    "Camera",
    "Connectivity",
    "Battery & design",
  ];
  const groups = [
    ...new Set(state.metadata.features.map((feature) => feature.group)),
  ];
  return [
    ...preferredOrder.filter((group) => groups.includes(group)),
    ...groups.filter((group) => !preferredOrder.includes(group)),
  ];
}

function sampleFeatures(enhanced = false) {
  const values = {};
  state.metadata.features.forEach((feature) => {
    values[feature.name] =
      enhanced &&
      ["ram", "int_memory", "battery_power", "px_width"].includes(feature.name)
        ? feature.max
        : feature.default;
  });
  return values;
}

function pageHeading(eyebrow, title, description) {
  return `<div class="breadcrumb"><a href="#/">Overview</a><span aria-hidden="true">/</span><span>${escapeHtml(eyebrow)}</span></div>
    <div class="page-heading"><div class="eyebrow">${escapeHtml(eyebrow)}</div><h1 tabindex="-1">${title}</h1><p>${description}</p></div>`;
}

function renderHome() {
  const dataset = state.metadata.dataset || {};
  return `<div class="page home-page">
    <section class="hero" aria-label="Introduction">
      <div class="hero-content"><div class="eyebrow">A MACHINE LEARNING MINI PROJECT</div>
        <h1>Small specs.<br>Big <em>possibilities.</em></h1>
        <p class="hero-description">What makes a phone low-cost or premium? Explore the story behind the specs with machine learning that predicts its price range.</p>
        <div class="hero-buttons"><a class="button button-primary" href="#/predict">Predict a price range ${icon("arrow")}</a><a class="button button-secondary" href="#/models">Explore the models ${icon("external")}</a></div>
        <div class="hero-meta"><span class="tiny-icon">${icon("check")}</span>Real data. Real predictions.<span class="divider"></span>Powered by scikit-learn</div>
      </div>
      <div class="hero-visual" role="img" aria-label="An illustration of a mobile phone: its specifications map to four price categories, from 0 to 3.">
        <div class="visual-grid"></div><div class="visual-orbit"></div><div class="visual-orbit second"></div>
        <span class="visual-corner">FROM SPECS TO INSIGHT</span><span class="visual-status">Machine learning, in action</span>
        <div class="phone"><div class="phone-screen"><div class="phone-island"></div><div class="phone-caption">PRICE RANGE</div><div class="phone-mark">0–3</div><div class="phone-range">Four possibilities</div><div class="phone-bars"><span></span><span></span><span></span><span></span></div><div class="phone-bottom"></div></div></div>
        <div class="float-card float-ram"><span class="float-icon">${icon("chip")}</span><div><small>THE INPUT</small><strong>${state.metadata.features.length} mobile features</strong></div></div>
        <div class="float-card float-predict"><span class="float-icon">${icon("layers")}</span><div><small>THE OUTPUT</small><strong>A smarter prediction</strong></div></div>
        <div class="visual-bottom">SPECIFICATIONS <span>→</span> MODEL <span>→</span> PRICE RANGE</div>
      </div>
    </section>
    <section class="proof-strip" aria-label="Project at a glance">
      <div class="proof-item"><span class="proof-number">${formatNumber(dataset.rows)}</span><span class="proof-copy"><strong>Mobile records</strong>Kaggle dataset</span></div>
      <div class="proof-item"><span class="proof-number">${state.metadata.features.length}</span><span class="proof-copy"><strong>Input features</strong>every spec matters</span></div>
      <div class="proof-item"><span class="proof-number">${state.metadata.models.length}</span><span class="proof-copy"><strong>ML algorithms</strong>two perspectives</span></div>
      <div class="proof-item"><span class="proof-number">${state.metadata.price_ranges.length}</span><span class="proof-copy"><strong>Price categories</strong>low to very high</span></div>
    </section>
    <div class="section-heading"><div><div class="eyebrow">YOUR NEXT DISCOVERY</div><h2>A little curiosity goes a long way.</h2></div><p>Make a prediction, understand the models,<br>or put two phones side by side.</p></div>
    <section class="feature-grid" aria-label="Explore MobileIQ">
      <a class="feature-card" href="#/predict"><span class="feature-icon">${icon("phone")}</span><h3>Meet your phone’s potential.</h3><p>Enter the specifications. Choose a model. Discover which price range your mobile belongs to.</p><span class="text-link">Make a prediction ${icon("arrow")}</span></a>
      <a class="feature-card" href="#/models"><span class="feature-icon">${icon("chart")}</span><h3>Two models. The full picture.</h3><p>See how Random Forest and SVM perform with accuracy, precision, recall, and F1-score.</p><span class="text-link">Compare the models ${icon("arrow")}</span></a>
      <a class="feature-card" href="#/compare"><span class="feature-icon">${icon("compare")}</span><h3>Good specs meet good context.</h3><p>Compare two mobiles side by side to see their specifications and predicted price ranges.</p><span class="text-link">Compare mobiles ${icon("arrow")}</span></a>
    </section>
    <div class="dataset-note">${icon("database")}<span>Built on the <a href="${DATASET_URL}" target="_blank" rel="noopener noreferrer">Mobile Price Classification dataset on Kaggle ${icon("external")}</a>. Trained once, evaluated on unseen data, ready to explore.</span></div>
  </div>`;
}

function renderFeatureFields(prefix, values) {
  return featureGroups()
    .map(
      (group, index) =>
        `<fieldset class="field-group"><legend><span class="group-number">${index + 1}</span>${escapeHtml(group)}</legend><div class="fields-grid">${state.metadata.features
          .filter((feature) => feature.group === group)
          .map((feature) => {
            const id = `${prefix}-${feature.name}`;
            const value = values[feature.name] ?? "";
            const label = `<label for="${id}">${escapeHtml(feature.label)}${feature.unit ? `<span class="unit">${escapeHtml(feature.unit)}</span>` : ""}</label>`;
            const input =
              feature.type === "binary"
                ? `<select id="${id}" name="${id}" aria-describedby="${id}-help" required><option value="1" ${Number(value) === 1 ? "selected" : ""}>Yes</option><option value="0" ${Number(value) === 0 ? "selected" : ""}>No</option></select>`
                : `<input id="${id}" name="${id}" type="number" inputmode="${feature.type === "number" ? "decimal" : "numeric"}" min="${feature.min}" max="${feature.max}" step="${feature.step}" value="${escapeHtml(value)}" aria-describedby="${id}-help" required>`;
            const hint =
              feature.type === "binary"
                ? feature.description
                : `${feature.min}–${feature.max}${feature.unit ? ` ${feature.unit}` : ""}${feature.name === "ram" ? " · Use MB, not GB" : ""}`;
            return `<div class="field">${label}${input}<p class="field-help" id="${id}-help">${escapeHtml(hint)}</p></div>`;
          })
          .join("")}</div></fieldset>`,
    )
    .join("");
}

function modelChoices() {
  return state.metadata.models
    .map(
      (model) =>
        `<label class="model-choice"><input type="radio" name="model" value="${escapeHtml(model.id)}" ${state.selectedModel === model.id ? "checked" : ""} required><span><strong>${escapeHtml(model.name)}</strong><small>${escapeHtml(model.description)}</small></span></label>`,
    )
    .join("");
}

function renderPredict() {
  return `<div class="page">${pageHeading("PREDICT A PRICE", "Every spec tells a story.", "Tell us about your mobile. Our trained models will find its place across four price ranges: Low, Medium, High, and Very High.")}
    <form id="prediction-form"><div id="prediction-error" class="form-error" role="alert" tabindex="-1"></div><div class="form-layout">
      <div class="form-main"><section class="panel"><div class="panel-title"><div><h2>Mobile specifications</h2><p>All ${state.metadata.features.length} features are required.</p></div><button class="small-button" id="reset-prediction" type="button">Reset sample</button></div>${renderFeatureFields("predict", state.predictionFeatures)}</section>
      <div class="section-intro">${icon("info")}Sample values are filled in to get you started. Input limits match this dataset’s scale.</div></div>
      <aside class="panel model-panel"><h2>Choose your model.</h2><p>Two approaches, one question.<br>Which price range fits?</p>${modelChoices()}<button class="button button-primary full-width" type="submit">Predict price range ${icon("arrow")}</button><p class="model-note">${icon("shield")}Your prediction uses a saved, trained model. No retraining is needed.</p><a class="text-link" style="margin-top:19px" href="#/models">See model performance ${icon("external")}</a></aside>
    </div></form></div>`;
}

function formatFeature(feature, value) {
  if (feature.type === "binary") return Number(value) === 1 ? "Yes" : "No";
  return `${Number(value).toLocaleString("en-US")}${feature.unit ? ` ${feature.unit}` : ""}`;
}

function renderSpecificationTable(values) {
  return `<table class="spec-table"><caption class="sr-only">Specifications used for the prediction</caption><tbody>${featureGroups()
    .map(
      (group) =>
        `<tr class="spec-group"><td colspan="2">${escapeHtml(group)}</td></tr>${state.metadata.features
          .filter((feature) => feature.group === group)
          .map(
            (feature) =>
              `<tr><th scope="row">${escapeHtml(feature.label)}</th><td>${escapeHtml(formatFeature(feature, values[feature.name]))}</td></tr>`,
          )
          .join("")}`,
    )
    .join("")}</tbody></table>`;
}

function renderResult() {
  const result = state.result;
  if (!result)
    return `<div class="page"><section class="empty-state"><span class="empty-icon">${icon("phone")}</span><h1>Your next insight starts here.</h1><p>Enter a mobile’s specifications and choose a model to see its predicted price range.</p><a class="button button-primary" href="#/predict">Make a prediction ${icon("arrow")}</a></section></div>`;
  return `<div class="page">${pageHeading("YOUR PREDICTION", "The specs are in. Here’s the insight.", "A price category predicted from your mobile’s specifications, using the trained model you selected.")}
    <div class="result-layout"><div><section class="result-hero"><div class="eyebrow">PREDICTED PRICE RANGE</div><div class="result-label">${escapeHtml(result.label)}</div><div class="result-class">Class ${result.price_range} of 0–3</div><p>${escapeHtml(result.description)}</p>
      <div class="range-track" aria-hidden="true">${state.metadata.price_ranges.map((range) => `<span class="${range.value === result.price_range ? "active" : ""}"></span>`).join("")}</div><div class="range-labels">${state.metadata.price_ranges.map((range) => `<span>${escapeHtml(range.label)}</span>`).join("")}</div>
      <div class="result-model"><small>MODEL USED</small><strong>${escapeHtml(result.model_name)}</strong></div><p class="result-notice">This is a relative category within the dataset, not a retail price or a guarantee of a phone’s value.</p></section>
      <div class="result-actions"><a class="button button-primary" id="edit-prediction" href="#/predict">Edit specifications ${icon("arrow")}</a><a class="button button-secondary" href="#/compare">Compare mobiles</a></div><p class="result-explanation">Curious about another model? Edit your specifications, select ${result.model === "svm" ? "Random Forest" : "SVM"}, and predict again.</p>
    </div><section class="panel"><div class="panel-title"><div><h2>What went into the prediction</h2><p>${state.metadata.features.length} mobile features, exactly as you entered them.</p></div></div>${renderSpecificationTable(result.features)}</section></div></div>`;
}

function metricBar(label, value) {
  const width = Number.isFinite(value)
    ? Math.max(0, Math.min(100, value * 100))
    : 0;
  return `<div class="metric-row"><span>${label}</span><div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:${width}%"></div></div><strong>${percent(value)}</strong></div>`;
}

function renderModels(metrics) {
  const dataset = metrics.dataset;
  const splitDescription = `${formatNumber(dataset.train_rows)} training rows · ${formatNumber(dataset.test_rows)} test rows`;
  return `<div class="page">${pageHeading("MODEL INSIGHTS", "Two approaches. Real results.", "Random Forest and SVM, evaluated on the same unseen test data. Explore how each model turns mobile specifications into price categories.")}
    <section class="metrics-summary" aria-label="Evaluation dataset"><div class="mini-stat"><span>DATASET RECORDS</span><strong>${formatNumber(dataset.rows)}</strong></div><div class="mini-stat"><span>TRAINING SAMPLES</span><strong>${formatNumber(dataset.train_rows)}</strong></div><div class="mini-stat"><span>TEST SAMPLES</span><strong>${formatNumber(dataset.test_rows)}</strong></div><div class="mini-stat"><span>INPUT FEATURES</span><strong>${formatNumber(dataset.features)}</strong><small>per mobile</small></div></section>
    <section class="model-cards" aria-label="Model evaluation results">${state.metadata.models
      .map((model) => {
        const measured = metrics.models[model.id];
        return `<article class="panel model-card"><div class="model-card-head"><span class="feature-icon">${icon(model.id === "svm" ? "boundary" : "tree")}</span><div><h2>${escapeHtml(model.name)}</h2><p>${model.id === "svm" ? "SUPPORT VECTOR MACHINE" : "ENSEMBLE CLASSIFIER"}</p></div></div><p class="model-card-description">${escapeHtml(model.description)}</p><div class="accuracy-block"><strong>${percent(measured.accuracy)}</strong><span>test accuracy</span></div>${metricBar("Precision", measured.precision)}${metricBar("Recall", measured.recall)}${metricBar("F1-score", measured.f1)}<div class="model-card-bottom">${icon("shield")}${model.id === "svm" ? "StandardScaler fitted on training data only" : "Decision trees trained on the training split only"}</div></article>`;
      })
      .join("")}</section>
    <section class="panel metrics-table-panel"><div class="panel-title"><div><h2>The numbers, side by side.</h2><p>Precision, recall, and F1 use ${escapeHtml(metrics.metric_average || "macro")} averaging across all four classes.</p></div></div><div class="table-scroll"><table class="metrics-table"><caption class="sr-only">Random Forest and SVM test metrics</caption><thead><tr><th scope="col">Model</th><th scope="col">Accuracy</th><th scope="col">Precision</th><th scope="col">Recall</th><th scope="col">F1-score</th></tr></thead><tbody>${state.metadata.models.map((model) => `<tr><td>${escapeHtml(model.name)}</td>${["accuracy", "precision", "recall", "f1"].map((metric) => `<td>${percent(metrics.models[model.id][metric])}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>
    <section class="methodology"><div><h3>A fair comparison starts with a clean split.</h3><p>${splitDescription}. Both models use the same ${dataset.stratified ? "stratified " : ""}split with random state ${escapeHtml(dataset.random_state)}. Preprocessing is fitted only on the training data. Test rows are held back for evaluation.</p><a class="text-link" href="${DATASET_URL}" target="_blank" rel="noopener noreferrer">Explore the Kaggle dataset ${icon("external")}</a></div><div><h3>Reading the metrics</h3><ul><li><strong>Accuracy:</strong> the fraction of all predictions that are correct.</li><li><strong>Precision:</strong> how often a predicted category is correct.</li><li><strong>Recall:</strong> how many actual members of a category are found.</li><li><strong>F1-score:</strong> the balance between precision and recall.</li></ul><p style="margin-top:9px">Macro averaging gives each price category equal weight.</p></div></section>
    <p class="timestamp">Measured during training${metrics.trained_at ? ` · ${escapeHtml(new Date(metrics.trained_at).toLocaleString())}` : ""}. These values come directly from the saved evaluation results.</p></div>`;
}

function renderCompare() {
  return `<div class="page">${pageHeading("COMPARE MOBILES", "A little side-by-side perspective.", "Give two mobiles a name, enter their specifications, and compare their predicted price ranges using the same model.")}
    <form id="compare-form"><div id="compare-error" class="form-error" role="alert" tabindex="-1"></div><div class="panel compare-toolbar"><div class="compare-toolbar-label">One model. Two mobile profiles.<small>Use the same model for a consistent comparison.</small></div><div class="inline-model-select"><label for="compare-model">Prediction model</label><select id="compare-model" name="model">${state.metadata.models.map((model) => `<option value="${escapeHtml(model.id)}" ${model.id === state.compareModel ? "selected" : ""}>${escapeHtml(model.name)}</option>`).join("")}</select></div></div>
    <div class="compare-forms">${state.compareMobiles.map((mobile, index) => `<section class="panel compare-mobile"><div class="mobile-card-heading"><span class="feature-icon">${icon("phone")}</span><div><h2>Mobile ${index === 0 ? "A" : "B"}</h2><p>${index === 0 ? "Start with your first mobile." : "Meet its comparison partner."}</p></div><button class="small-button reset-mobile" data-mobile="${index}" type="button">Reset sample</button></div><div class="field mobile-card-name"><label for="mobile-${index}-name">Mobile name</label><input class="name-input" id="mobile-${index}-name" name="mobile-${index}-name" type="text" maxlength="50" value="${escapeHtml(mobile.name)}" required></div>${renderFeatureFields(`mobile-${index}`, mobile.features)}</section>`).join("")}</div>
    <div class="compare-submit"><p>Sample profiles are prefilled: Mobile B starts with more RAM, storage, battery capacity, and pixel width. Edit any value to explore your own comparison.</p><button class="button button-primary" type="submit">Compare price ranges ${icon("arrow")}</button></div></form>
    <div id="comparison-results">${state.comparison ? renderComparisonResults(state.comparison) : ""}</div></div>`;
}

function renderComparisonResults(comparison) {
  return `<section class="comparison-results" aria-label="Mobile comparison results" tabindex="-1"><div class="comparison-heading"><h2>Your mobiles, side by side.</h2><span>Predicted with ${escapeHtml(comparison.model_name)}</span></div><div class="comparison-overview">${comparison.mobiles.map((mobile) => `<article class="comparison-mobile-result"><h3>${escapeHtml(mobile.name)}</h3><strong>${escapeHtml(mobile.label)}</strong><p>Predicted price range · Class ${mobile.price_range}</p></article>`).join("")}</div><p class="comparison-summary">${escapeHtml(comparison.summary)}</p>
    <div class="panel comparison-table-panel"><div class="table-scroll"><table class="metrics-table comparison-table"><caption class="sr-only">Specifications of both mobiles</caption><thead><tr><th scope="col">Specification</th>${comparison.mobiles.map((mobile) => `<th scope="col">${escapeHtml(mobile.name)}</th>`).join("")}</tr></thead><tbody>${featureGroups()
      .map(
        (group) =>
          `<tr class="table-group"><th colspan="3" scope="rowgroup">${escapeHtml(group)}</th></tr>${state.metadata.features
            .filter((feature) => feature.group === group)
            .map(
              (feature) =>
                `<tr class="${comparison.mobiles[0].features[feature.name] !== comparison.mobiles[1].features[feature.name] ? "different" : ""}"><td>${escapeHtml(feature.label)}</td>${comparison.mobiles.map((mobile) => `<td>${escapeHtml(formatFeature(feature, mobile.features[feature.name]))}</td>`).join("")}</tr>`,
            )
            .join("")}`,
      )
      .join(
        "",
      )}</tbody></table></div><p class="comparison-table-note">Highlighted cells show different specifications. A higher predicted price category does not necessarily mean a better phone.</p></div></section>`;
}

function readFeatureValues(form, prefix) {
  const values = {};
  state.metadata.features.forEach((feature) => {
    const raw = form.elements.namedItem(`${prefix}-${feature.name}`).value;
    values[feature.name] = raw === "" ? "" : Number(raw);
  });
  return values;
}

function fillFeatureValues(form, prefix, values) {
  state.metadata.features.forEach((feature) => {
    form.elements.namedItem(`${prefix}-${feature.name}`).value =
      values[feature.name];
  });
}

function saveDrafts() {
  const predictForm = document.querySelector("#prediction-form");
  if (predictForm) {
    state.predictionFeatures = readFeatureValues(predictForm, "predict");
    state.selectedModel = predictForm.elements.namedItem("model").value;
  }
  const compareForm = document.querySelector("#compare-form");
  if (compareForm) {
    state.compareModel = compareForm.elements.namedItem("model").value;
    state.compareMobiles = [0, 1].map((index) => ({
      name: compareForm.elements.namedItem(`mobile-${index}-name`).value,
      features: readFeatureValues(compareForm, `mobile-${index}`),
    }));
  }
}

function showFormError(element, error) {
  element.innerHTML = `${escapeHtml(error.message)}${error.details?.length ? `<ul>${error.details.map((detail) => `<li>${escapeHtml(typeof detail === "string" ? detail : JSON.stringify(detail))}</li>`).join("")}</ul>` : ""}`;
  element.focus();
  element.scrollIntoView({ block: "center", behavior: "smooth" });
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  button.innerHTML = busy
    ? "Making your prediction…"
    : `${label} ${icon("arrow")}`;
}

function attachPredictionEvents() {
  const form = document.querySelector("#prediction-form");
  document.querySelector("#reset-prediction").addEventListener("click", () => {
    state.predictionFeatures = sampleFeatures();
    fillFeatureValues(form, "predict", state.predictionFeatures);
    document.querySelector("#prediction-error").textContent = "";
    liveStatus.textContent = "Sample specifications restored.";
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const errorBox = document.querySelector("#prediction-error");
    errorBox.textContent = "";
    saveDrafts();
    setBusy(button, true);
    try {
      const result = await apiRequest("/api/predict", {
        model: state.selectedModel,
        features: state.predictionFeatures,
      });
      // Do not move someone back to the result page if they navigated away while waiting.
      if (document.contains(form)) {
        saveResult(result);
        liveStatus.textContent = `Prediction complete. ${result.label} price range, using ${result.model_name}.`;
        location.hash = "/result";
      }
    } catch (error) {
      if (document.contains(form)) showFormError(errorBox, error);
    } finally {
      setBusy(button, false, "Predict price range");
    }
  });
}

function clearComparison() {
  if (state.comparison) {
    state.comparison = null;
    document.querySelector("#comparison-results").innerHTML = "";
    liveStatus.textContent =
      "Specifications changed. Compare again to update the results.";
  }
}

function attachCompareEvents() {
  const form = document.querySelector("#compare-form");
  form.addEventListener("input", clearComparison);
  form.addEventListener("change", clearComparison);
  form.querySelectorAll(".reset-mobile").forEach((button) =>
    button.addEventListener("click", () => {
      const index = Number(button.dataset.mobile);
      fillFeatureValues(form, `mobile-${index}`, sampleFeatures(index === 1));
      form.elements.namedItem(`mobile-${index}-name`).value =
        `Mobile ${index === 0 ? "A" : "B"}`;
      document.querySelector("#compare-error").textContent = "";
      clearComparison();
      liveStatus.textContent = `Mobile ${index === 0 ? "A" : "B"} sample restored.`;
    }),
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const errorBox = document.querySelector("#compare-error");
    errorBox.textContent = "";
    saveDrafts();
    setBusy(button, true);
    // Capture the submitted profile so edits while the request runs cannot make stale results look current.
    const requestBody = {
      model: state.compareModel,
      mobiles: state.compareMobiles,
    };
    const submitted = JSON.stringify(requestBody);
    try {
      const comparison = await apiRequest("/api/compare", requestBody);
      if (!document.contains(form)) return;
      saveDrafts();
      if (
        submitted !==
        JSON.stringify({
          model: state.compareModel,
          mobiles: state.compareMobiles,
        })
      ) {
        liveStatus.textContent =
          "The specifications changed during prediction. Compare again to see updated results.";
        errorBox.textContent =
          "Your specifications changed while predicting. Please compare again.";
        return;
      }
      state.comparison = comparison;
      document.querySelector("#comparison-results").innerHTML =
        renderComparisonResults(comparison);
      const resultSection = document.querySelector(".comparison-results");
      resultSection.focus({ preventScroll: true });
      resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
      liveStatus.textContent = comparison.summary;
    } catch (error) {
      if (document.contains(form)) showFormError(errorBox, error);
    } finally {
      setBusy(button, false, "Compare price ranges");
    }
  });
}

function errorPage(error, retryLabel = "Try again") {
  return `<div class="page"><section class="error-state"><span class="empty-icon">${icon("info")}</span><h1>A small pause in the discovery.</h1><p>${escapeHtml(error.message)}</p><button class="button button-primary reload-button" id="retry-page" type="button">${retryLabel} ${icon("arrow")}</button></section></div>`;
}

async function renderRoute(focusHeading = false) {
  if (!state.metadata) return;
  saveDrafts();
  const route = location.hash.slice(1) || "/";
  const titles = {
    "/": "Overview",
    "/predict": "Predict a Price",
    "/result": "Your Prediction",
    "/models": "Model Insights",
    "/compare": "Compare Mobiles",
  };
  document.title = `${titles[route] || "Page Not Found"} — MobileIQ`;
  navigation.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation");
  navigation.querySelectorAll("a").forEach((link) => {
    const active =
      link.dataset.route === (route === "/result" ? "/predict" : route);
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  window.scrollTo(0, 0);
  if (route === "/") main.innerHTML = renderHome();
  else if (route === "/predict") {
    main.innerHTML = renderPredict();
    attachPredictionEvents();
  } else if (route === "/result") {
    main.innerHTML = renderResult();
    document
      .querySelector("#edit-prediction")
      ?.addEventListener("click", () => {
        state.predictionFeatures = { ...state.result.features };
        state.selectedModel = state.result.model;
      });
  } else if (route === "/compare") {
    main.innerHTML = renderCompare();
    attachCompareEvents();
  } else if (route === "/models") {
    main.innerHTML = `<div class="page"><div class="loading-card" role="status"><span class="spinner"></span><p>Loading measured model performance…</p></div></div>`;
    try {
      if (!state.metrics) state.metrics = await apiRequest("/api/metrics");
      if ((location.hash.slice(1) || "/") !== route) return;
      main.innerHTML = renderModels(state.metrics);
    } catch (error) {
      if ((location.hash.slice(1) || "/") !== route) return;
      main.innerHTML = errorPage(error, "Reload model insights");
      document
        .querySelector("#retry-page")
        .addEventListener("click", () => renderRoute(true));
    }
  } else {
    main.innerHTML = `<div class="page"><div class="empty-state"><h1>This page is still undiscovered.</h1><p>Let’s head back to the overview to make your next prediction.</p><a class="button button-primary" href="#/">Back to overview ${icon("arrow")}</a></div></div>`;
  }
  if (focusHeading) {
    const heading = main.querySelector("h1");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  }
}

async function initialize() {
  try {
    state.metadata = await apiRequest("/api/metadata");
    state.predictionFeatures = state.result
      ? { ...state.result.features }
      : sampleFeatures();
    state.selectedModel = state.result?.model || "random_forest";
    state.compareMobiles = [
      { name: "Mobile A", features: sampleFeatures() },
      { name: "Mobile B", features: sampleFeatures(true) },
    ];
    await renderRoute();
  } catch (error) {
    main.innerHTML = errorPage(error, "Reconnect");
    document.querySelector("#retry-page").addEventListener("click", initialize);
  }
}

menuToggle.addEventListener("click", () => {
  const expanded = menuToggle.getAttribute("aria-expanded") !== "true";
  menuToggle.setAttribute("aria-expanded", String(expanded));
  menuToggle.setAttribute(
    "aria-label",
    expanded ? "Close navigation" : "Open navigation",
  );
  navigation.classList.toggle("is-open", expanded);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && navigation.classList.contains("is-open")) {
    navigation.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation");
    menuToggle.focus();
  }
});
window.addEventListener("hashchange", () => renderRoute(true));
document.querySelector(".skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  main.focus();
  main.scrollIntoView({ block: "start" });
});
initialize();
