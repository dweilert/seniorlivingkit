const DATA_URL = "/data/facilities/combined-facilities-active.json";
import { PIPELINE_STAGES, SAMPLE_COMMUNICATIONS, SAMPLE_LEADS } from "./crm-data.js";

const MAX_RENDERED_ROWS = 120;
const MAX_RENDERED_PINS = 300;
const TILE_SIZE = 256;
const PREFERENCES_KEY = "facility-directory-preferences-v2";
const CRM_STATE_KEY = "facility-directory-crm-state-v2";

const state = {
  records: [],
  filtered: [],
  leads: [],
  communications: [],
  selectedLeadId: "",
  selectedKey: "",
  query: "",
  state: "",
  care: "",
  capacity: "",
  visibility: "visible",
  mapZoomOffset: 0,
  preferences: {
    priority: {},
    excluded: {}
  }
};

const elements = {
  directoryTab: document.querySelector("#directoryTab"),
  crmTab: document.querySelector("#crmTab"),
  directoryView: document.querySelector("#directoryView"),
  crmView: document.querySelector("#crmView"),
  datasetStatus: document.querySelector("#datasetStatus"),
  searchInput: document.querySelector("#searchInput"),
  stateFilter: document.querySelector("#stateFilter"),
  careFilter: document.querySelector("#careFilter"),
  capacityFilter: document.querySelector("#capacityFilter"),
  visibilityFilter: document.querySelector("#visibilityFilter"),
  resetButton: document.querySelector("#resetButton"),
  resultCount: document.querySelector("#resultCount"),
  resultMeta: document.querySelector("#resultMeta"),
  resultList: document.querySelector("#resultList"),
  mapCount: document.querySelector("#mapCount"),
  mapCanvas: document.querySelector("#mapCanvas"),
  mapTiles: document.querySelector("#mapTiles"),
  mapViewport: document.querySelector("#mapViewport"),
  zoomInButton: document.querySelector("#zoomInButton"),
  zoomOutButton: document.querySelector("#zoomOutButton"),
  emptyDetail: document.querySelector("#emptyDetail"),
  facilityDetail: document.querySelector("#facilityDetail"),
  leadCount: document.querySelector("#leadCount"),
  touringCount: document.querySelector("#touringCount"),
  applicationCount: document.querySelector("#applicationCount"),
  pipelineBoard: document.querySelector("#pipelineBoard"),
  leadDetail: document.querySelector("#leadDetail"),
  communicationContext: document.querySelector("#communicationContext"),
  communicationForm: document.querySelector("#communicationForm"),
  communicationChannel: document.querySelector("#communicationChannel"),
  communicationDirection: document.querySelector("#communicationDirection"),
  communicationSubject: document.querySelector("#communicationSubject"),
  communicationBody: document.querySelector("#communicationBody"),
  communicationList: document.querySelector("#communicationList"),
  cardScanForm: document.querySelector("#cardScanForm"),
  cardImageInput: document.querySelector("#cardImageInput"),
  cardPreview: document.querySelector("#cardPreview"),
  scanStatus: document.querySelector("#scanStatus"),
  scanResult: document.querySelector("#scanResult")
};

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function clean(value, fallback = "Not listed") {
  return value == null || value === "" ? fallback : String(value);
}

function optionValues(records, key) {
  return [...new Set(records.map((record) => record[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function populateSelect(select, values) {
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
}

function loadPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}");
    state.preferences.priority = stored.priority && typeof stored.priority === "object" ? stored.priority : {};
    state.preferences.excluded = stored.excluded && typeof stored.excluded === "object" ? stored.excluded : {};
  } catch {
    state.preferences = { priority: {}, excluded: {} };
  }
}

function savePreferences() {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(state.preferences));
}

function loadCrmState() {
  try {
    const stored = JSON.parse(localStorage.getItem(CRM_STATE_KEY) || "{}");
    state.leads = Array.isArray(stored.leads) ? stored.leads : structuredClone(SAMPLE_LEADS);
    state.communications = Array.isArray(stored.communications)
      ? stored.communications
      : structuredClone(SAMPLE_COMMUNICATIONS);
  } catch {
    state.leads = structuredClone(SAMPLE_LEADS);
    state.communications = structuredClone(SAMPLE_COMMUNICATIONS);
  }
  state.selectedLeadId = state.leads[0]?.id || "";
}

function saveCrmState() {
  localStorage.setItem(CRM_STATE_KEY, JSON.stringify({
    leads: state.leads,
    communications: state.communications
  }));
}

function priorityValue(record) {
  return state.preferences.priority[record.facility_key] || 0;
}

function isExcluded(record) {
  return Boolean(state.preferences.excluded[record.facility_key]);
}

function hasCoordinates(record) {
  return record.latitude != null && record.longitude != null;
}

function capacityMatches(record) {
  if (!state.capacity) return true;
  const capacity = Number(record.capacity);
  if (!Number.isFinite(capacity)) return false;
  if (state.capacity === "small") return capacity >= 1 && capacity <= 15;
  if (state.capacity === "medium") return capacity >= 16 && capacity <= 75;
  if (state.capacity === "large") return capacity >= 76;
  return true;
}

function recordMatches(record) {
  const query = state.query.trim().toLowerCase();
  const searchText = [
    record.facility_name,
    record.address,
    record.city,
    record.county,
    record.state,
    record.zip,
    record.phone,
    record.program_type
  ].join(" ").toLowerCase();

  const excluded = isExcluded(record);

  return (state.visibility === "all" || (state.visibility === "excluded" ? excluded : !excluded))
    && (!query || searchText.includes(query))
    && (!state.state || record.state === state.state)
    && (!state.care || record.program_type === state.care)
    && capacityMatches(record);
}

function applyFilters() {
  state.filtered = state.records.filter(recordMatches).sort((a, b) => {
    const priorityDifference = priorityValue(b) - priorityValue(a);
    return priorityDifference
      || a.state.localeCompare(b.state)
      || a.city.localeCompare(b.city)
      || a.facility_name.localeCompare(b.facility_name);
  });
  if (!state.filtered.some((record) => record.facility_key === state.selectedKey)) {
    state.selectedKey = state.filtered[0]?.facility_key || "";
  }
  renderResults();
  renderMap();
  renderDetail();
}

function addressLine(record) {
  return [record.address, record.city, record.state, record.zip].filter(Boolean).join(", ");
}

function mapUrl(record) {
  if (record.latitude != null && record.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${record.latitude},${record.longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine(record))}`;
}

function mapBounds(records) {
  const points = records.filter(hasCoordinates);
  if (points.length === 0) return null;
  const lats = points.map((record) => Number(record.latitude));
  const lons = points.map((record) => Number(record.longitude));
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const latPadding = Math.max((maxLat - minLat) * 0.12, 0.02);
  const lonPadding = Math.max((maxLon - minLon) * 0.12, 0.02);

  return {
    minLat: minLat - latPadding,
    maxLat: maxLat + latPadding,
    minLon: minLon - lonPadding,
    maxLon: maxLon + lonPadding
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function longitudeToTileX(longitude, zoom) {
  return ((longitude + 180) / 360) * 2 ** zoom * TILE_SIZE;
}

function latitudeToTileY(latitude, zoom) {
  const latRad = latitude * Math.PI / 180;
  return (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * 2 ** zoom * TILE_SIZE;
}

function pointFor(record, zoom) {
  return {
    x: longitudeToTileX(Number(record.longitude), zoom),
    y: latitudeToTileY(Number(record.latitude), zoom)
  };
}

function mapCenter(records) {
  const bounds = mapBounds(records);
  if (!bounds) return null;
  return {
    latitude: (bounds.minLat + bounds.maxLat) / 2,
    longitude: (bounds.minLon + bounds.maxLon) / 2,
    bounds
  };
}

function zoomForBounds(bounds, width, height) {
  for (let zoom = 15; zoom >= 3; zoom -= 1) {
    const minX = longitudeToTileX(bounds.minLon, zoom);
    const maxX = longitudeToTileX(bounds.maxLon, zoom);
    const minY = latitudeToTileY(bounds.maxLat, zoom);
    const maxY = latitudeToTileY(bounds.minLat, zoom);
    if ((maxX - minX) <= width * 0.9 && (maxY - minY) <= height * 0.9) return zoom;
  }
  return 3;
}

function renderTiles(centerPoint, zoom, width, height) {
  elements.mapTiles.replaceChildren();

  const startX = Math.floor((centerPoint.x - width / 2) / TILE_SIZE);
  const endX = Math.floor((centerPoint.x + width / 2) / TILE_SIZE);
  const startY = Math.floor((centerPoint.y - height / 2) / TILE_SIZE);
  const endY = Math.floor((centerPoint.y + height / 2) / TILE_SIZE);
  const tileLimit = 2 ** zoom;
  const fragment = document.createDocumentFragment();

  for (let x = startX; x <= endX; x += 1) {
    for (let y = startY; y <= endY; y += 1) {
      if (y < 0 || y >= tileLimit) continue;
      const wrappedX = ((x % tileLimit) + tileLimit) % tileLimit;
      const tile = document.createElement("img");
      tile.className = "map-tile";
      tile.alt = "";
      tile.loading = "lazy";
      tile.decoding = "async";
      tile.src = `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`;
      tile.style.left = `${x * TILE_SIZE - centerPoint.x + width / 2}px`;
      tile.style.top = `${y * TILE_SIZE - centerPoint.y + height / 2}px`;
      fragment.append(tile);
    }
  }

  const attribution = document.createElement("div");
  attribution.className = "map-attribution";
  attribution.innerHTML = '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';
  fragment.append(attribution);
  elements.mapTiles.append(fragment);
}

function renderMap() {
  const mapped = state.filtered.filter(hasCoordinates);
  elements.mapCount.textContent = formatNumber(mapped.length);
  elements.mapTiles.replaceChildren();
  elements.mapViewport.replaceChildren();

  const center = mapCenter(mapped);
  if (!center) {
    const empty = document.createElement("div");
    empty.className = "empty-detail";
    empty.textContent = "No mapped facilities in this view";
    elements.mapViewport.append(empty);
    return;
  }

  const rect = elements.mapCanvas.getBoundingClientRect();
  const width = Math.max(Math.round(rect.width), 320);
  const height = Math.max(Math.round(rect.height), 220);
  const baseZoom = zoomForBounds(center.bounds, width, height);
  const zoom = clamp(baseZoom + state.mapZoomOffset, 3, 15);
  const centerPoint = {
    x: longitudeToTileX(center.longitude, zoom),
    y: latitudeToTileY(center.latitude, zoom)
  };
  const fragment = document.createDocumentFragment();
  renderTiles(centerPoint, zoom, width, height);

  mapped.slice(0, MAX_RENDERED_PINS).forEach((record, index) => {
    const point = pointFor(record, zoom);
    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = [
      "map-pin",
      record.facility_key === state.selectedKey ? "is-selected" : "",
      priorityValue(record) > 0 ? "is-priority" : ""
    ].filter(Boolean).join(" ");
    pin.dataset.key = record.facility_key;
    pin.style.left = `${point.x - centerPoint.x + width / 2}px`;
    pin.style.top = `${point.y - centerPoint.y + height / 2}px`;
    pin.title = `${record.facility_name} - ${record.city}, ${record.state}`;
    pin.innerHTML = `<span>${index + 1}</span>`;
    fragment.append(pin);
  });

  elements.mapViewport.append(fragment);
}

function zoomMap(delta) {
  const next = clamp(state.mapZoomOffset + delta, -4, 4);
  if (next === state.mapZoomOffset) return;
  state.mapZoomOffset = next;
  renderMap();
}

function renderResults() {
  elements.resultCount.textContent = formatNumber(state.filtered.length);
  elements.resultMeta.textContent = state.filtered.length === 1
    ? "facility"
    : `facilities (${Math.min(state.filtered.length, MAX_RENDERED_ROWS)} shown)`;
  elements.resultList.replaceChildren();

  const fragment = document.createDocumentFragment();
  for (const record of state.filtered.slice(0, MAX_RENDERED_ROWS)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "facility-row",
      record.facility_key === state.selectedKey ? "is-selected" : "",
      isExcluded(record) ? "is-excluded" : ""
    ].filter(Boolean).join(" ");
    button.dataset.key = record.facility_key;

    const title = document.createElement("strong");
    title.textContent = record.facility_name;

    const meta = document.createElement("div");
    meta.className = "row-meta";
    meta.innerHTML = `
      <span>${clean(record.address)}</span>
      <span>${clean(record.city)}, ${clean(record.state, "")}</span>
      <span>${clean(record.county)} County</span>
      <span>${clean(record.capacity)} beds</span>
    `;

    const submeta = document.createElement("div");
    submeta.className = "row-submeta";
    submeta.innerHTML = `
      <span class="pill">${clean(record.program_type, "Care type")}</span>
      ${priorityValue(record) > 0 ? `<span class="pill priority">Priority ${priorityValue(record)}</span>` : ""}
      ${isExcluded(record) ? '<span class="pill excluded">Excluded</span>' : ""}
      ${!hasCoordinates(record) ? '<span class="pill warn">No coordinates</span>' : ""}
    `;

    const actions = document.createElement("div");
    actions.className = "row-actions";
    actions.innerHTML = `
      <button type="button" class="is-priority" data-action="priority-up" data-key="${record.facility_key}">Priority +</button>
      <button type="button" data-action="priority-down" data-key="${record.facility_key}">Priority -</button>
      <button type="button" class="is-excluded" data-action="toggle-excluded" data-key="${record.facility_key}">
        ${isExcluded(record) ? "Restore" : "Exclude"}
      </button>
    `;

    button.append(title, meta, submeta, actions);
    fragment.append(button);
  }

  elements.resultList.append(fragment);
}

function renderFact(label, value) {
  return `
    <div class="fact">
      <span>${label}</span>
      <strong>${clean(value)}</strong>
    </div>
  `;
}

function renderDetail() {
  const record = state.records.find((item) => item.facility_key === state.selectedKey);
  elements.emptyDetail.hidden = Boolean(record);
  elements.facilityDetail.hidden = !record;

  if (!record) {
    elements.facilityDetail.replaceChildren();
    return;
  }

  const phoneLink = record.phone ? `<a href="tel:${record.phone.replaceAll(/[^0-9+]/g, "")}">Call</a>` : "";
  const sourceLink = record.source_url ? `<a href="${record.source_url}" target="_blank" rel="noreferrer">Source</a>` : "";
  const mapLink = `<a href="${mapUrl(record)}" target="_blank" rel="noreferrer">Map</a>`;

  elements.facilityDetail.innerHTML = `
    <h2>${record.facility_name}</h2>
    <p class="detail-address">${addressLine(record)}</p>
    <div class="detail-actions">${phoneLink}${mapLink}${sourceLink}</div>
    <div class="detail-actions">
      <button type="button" data-detail-action="priority-up">Priority +</button>
      <button type="button" data-detail-action="priority-down">Priority -</button>
      <button type="button" data-detail-action="toggle-excluded">${isExcluded(record) ? "Restore" : "Exclude"}</button>
    </div>
    <div class="detail-grid">
      ${renderFact("Phone", record.phone)}
      ${renderFact("Capacity", record.capacity)}
      ${renderFact("Care type", record.program_type)}
      ${renderFact("Status", record.facility_status || "Active")}
      ${renderFact("Priority", priorityValue(record))}
      ${renderFact("Map", hasCoordinates(record) ? "Mapped" : "Needs geocoding")}
      ${renderFact("Licensee", record.licensee)}
      ${renderFact("Administrator", record.administrator)}
      ${renderFact("County", record.county)}
      ${renderFact("Source ID", record.source_facility_id)}
    </div>
    <div class="source-block">
      <strong>${record.source_name}</strong><br>
      ${record.source_owner}<br>
      ${record.facility_key}
    </div>
  `;
}

function selectedLead() {
  return state.leads.find((lead) => lead.id === state.selectedLeadId) || null;
}

function facilityByKey(key) {
  return state.records.find((record) => record.facility_key === key) || null;
}

function renderPipeline() {
  elements.leadCount.textContent = formatNumber(state.leads.filter((lead) => !["Placed", "Closed"].includes(lead.status)).length);
  elements.touringCount.textContent = formatNumber(state.leads.filter((lead) => lead.status === "Touring").length);
  elements.applicationCount.textContent = formatNumber(state.leads.filter((lead) => lead.status === "Application").length);
  elements.pipelineBoard.replaceChildren();

  const fragment = document.createDocumentFragment();
  for (const stage of PIPELINE_STAGES) {
    const column = document.createElement("section");
    column.className = "pipeline-column";
    column.dataset.stage = stage;
    const leads = state.leads.filter((lead) => lead.status === stage);
    column.innerHTML = `
      <div class="pipeline-column-header">
        <h3>${stage}</h3>
        <span>${leads.length}</span>
      </div>
    `;

    const list = document.createElement("div");
    list.className = "lead-card-list";
    for (const lead of leads) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = `lead-card${lead.id === state.selectedLeadId ? " is-selected" : ""}`;
      card.dataset.leadId = lead.id;
      card.innerHTML = `
        <div class="lead-card-top">
          <strong>${lead.name}</strong>
          <span class="lead-urgency">${lead.urgency}</span>
        </div>
        <span>${lead.relationship}</span>
        <span>${lead.preferredArea} · ${lead.budget}</span>
        <p>${lead.nextStep}</p>
      `;
      list.append(card);
    }

    column.append(list);
    fragment.append(column);
  }

  elements.pipelineBoard.append(fragment);
}

function renderLeadDetail() {
  const lead = selectedLead();
  if (!lead) {
    elements.leadDetail.innerHTML = "<p>Select a lead</p>";
    return;
  }

  const stageOptions = PIPELINE_STAGES.map((stage) => `
    <option value="${stage}"${stage === lead.status ? " selected" : ""}>${stage}</option>
  `).join("");
  const linkedFacilities = lead.linkedFacilities
    .map((key) => facilityByKey(key))
    .filter(Boolean);

  elements.leadDetail.innerHTML = `
    <h2>${lead.name}</h2>
    <p class="lead-subtitle">${lead.relationship}</p>
    <form class="lead-form" id="leadForm">
      <label>
        <span>Status</span>
        <select id="leadStatus">${stageOptions}</select>
      </label>
      <label>
        <span>Assigned</span>
        <input id="leadAssignedTo" type="text" value="${lead.assignedTo}">
      </label>
      <label>
        <span>Phone</span>
        <input id="leadPhone" type="tel" value="${lead.phone}">
      </label>
      <label>
        <span>Email</span>
        <input id="leadEmail" type="email" value="${lead.email}">
      </label>
      <label>
        <span>Urgency</span>
        <input id="leadUrgency" type="text" value="${lead.urgency}">
      </label>
      <label>
        <span>Budget</span>
        <input id="leadBudget" type="text" value="${lead.budget}">
      </label>
      <label class="wide-field">
        <span>Care needs</span>
        <textarea id="leadCareNeeds">${lead.careNeeds}</textarea>
      </label>
      <label class="wide-field">
        <span>Next step</span>
        <textarea id="leadNextStep">${lead.nextStep}</textarea>
      </label>
      <button type="submit">Save lead</button>
    </form>
    <div class="linked-facilities">
      <strong>Linked facilities</strong>
      ${linkedFacilities.length ? linkedFacilities.map((facility) => `
        <div class="linked-facility">
          <strong>${facility.facility_name}</strong><br>
          <span>${addressLine(facility)}</span>
        </div>
      `).join("") : "<span>No facilities linked yet</span>"}
    </div>
  `;
}

function renderCommunications() {
  const lead = selectedLead();
  const selectedFacility = facilityByKey(state.selectedKey);
  elements.communicationContext.textContent = lead
    ? `${lead.name}${selectedFacility ? ` · ${selectedFacility.facility_name}` : ""}`
    : "selected lead";
  elements.communicationList.replaceChildren();

  if (!lead) return;

  const items = state.communications
    .filter((item) => item.leadId === lead.id || item.facilityKey === state.selectedKey)
    .sort((a, b) => b.id.localeCompare(a.id));
  const fragment = document.createDocumentFragment();

  for (const item of items) {
    const facility = item.facilityKey ? facilityByKey(item.facilityKey) : null;
    const node = document.createElement("article");
    node.className = "communication-item";
    node.innerHTML = `
      <strong>${item.subject}</strong>
      <div class="communication-meta">${item.date} · ${item.direction} ${item.channel}${facility ? ` · ${facility.facility_name}` : ""}</div>
      <p>${item.body}</p>
    `;
    fragment.append(node);
  }

  elements.communicationList.append(fragment);
}

function renderScanResult(result) {
  const contact = result.contact;
  elements.scanResult.hidden = false;
  elements.scanResult.innerHTML = `
    <dl>
      <dt>Name</dt><dd>${clean(contact.name)}</dd>
      <dt>Title</dt><dd>${clean(contact.title)}</dd>
      <dt>Company</dt><dd>${clean(contact.company)}</dd>
      <dt>Phone</dt><dd>${clean(contact.phone)}</dd>
      <dt>Email</dt><dd>${clean(contact.email)}</dd>
      <dt>Address</dt><dd>${clean(contact.address)}</dd>
      <dt>Confidence</dt><dd>${Math.round(result.confidence * 100)}%</dd>
    </dl>
    <button type="button" id="applyScanButton">Apply to selected lead</button>
  `;
  const applyButton = document.querySelector("#applyScanButton");
  applyButton.addEventListener("click", () => {
    const lead = selectedLead();
    if (!lead) return;
    lead.relationship = contact.title ? `${contact.title}: ${contact.name}` : contact.name;
    lead.phone = contact.phone || lead.phone;
    lead.email = contact.email || lead.email;
    lead.preferredArea = contact.address || lead.preferredArea;
    lead.nextStep = `Review scanned business card contact: ${contact.name}`;
    state.communications.push({
      id: `comm-${Date.now()}`,
      leadId: lead.id,
      facilityKey: state.selectedKey || "",
      direction: "Internal",
      channel: "Note",
      date: new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }),
      subject: "Business card scanned",
      body: `Extracted ${contact.name}, ${contact.phone}, ${contact.email}.`
    });
    saveCrmState();
    renderCrm();
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function renderCrm() {
  renderPipeline();
  renderLeadDetail();
  renderCommunications();
}

function setView(view) {
  const showCrm = view === "crm";
  elements.directoryView.hidden = showCrm;
  elements.crmView.hidden = !showCrm;
  elements.directoryTab.classList.toggle("is-active", !showCrm);
  elements.crmTab.classList.toggle("is-active", showCrm);
  if (showCrm) renderCrm();
}

function resetFilters() {
  state.query = "";
  state.state = "";
  state.care = "";
  state.capacity = "";
  state.visibility = "visible";
  elements.searchInput.value = "";
  elements.stateFilter.value = "";
  elements.careFilter.value = "";
  elements.capacityFilter.value = "";
  elements.visibilityFilter.value = "visible";
  applyFilters();
}

function changePriority(key, delta) {
  const current = state.preferences.priority[key] || 0;
  const next = Math.max(0, Math.min(9, current + delta));
  if (next === 0) delete state.preferences.priority[key];
  else state.preferences.priority[key] = next;
  savePreferences();
  applyFilters();
}

function toggleExcluded(key) {
  if (state.preferences.excluded[key]) delete state.preferences.excluded[key];
  else state.preferences.excluded[key] = true;
  savePreferences();
  applyFilters();
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    applyFilters();
  });
  elements.stateFilter.addEventListener("change", (event) => {
    state.state = event.target.value;
    applyFilters();
  });
  elements.careFilter.addEventListener("change", (event) => {
    state.care = event.target.value;
    applyFilters();
  });
  elements.capacityFilter.addEventListener("change", (event) => {
    state.capacity = event.target.value;
    applyFilters();
  });
  elements.visibilityFilter.addEventListener("change", (event) => {
    state.visibility = event.target.value;
    applyFilters();
  });
  elements.resetButton.addEventListener("click", resetFilters);
  elements.resultList.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]");
    if (action) {
      event.stopPropagation();
      if (action.dataset.action === "priority-up") changePriority(action.dataset.key, 1);
      if (action.dataset.action === "priority-down") changePriority(action.dataset.key, -1);
      if (action.dataset.action === "toggle-excluded") toggleExcluded(action.dataset.key);
      return;
    }

    const row = event.target.closest(".facility-row");
    if (!row) return;
    state.selectedKey = row.dataset.key;
    renderResults();
    renderMap();
    renderDetail();
    renderCommunications();
  });
  elements.mapCanvas.addEventListener("click", (event) => {
    const pin = event.target.closest(".map-pin");
    if (!pin) return;
    state.selectedKey = pin.dataset.key;
    renderResults();
    renderMap();
    renderDetail();
    renderCommunications();
  });
  elements.mapCanvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    zoomMap(direction);
  }, { passive: false });
  elements.zoomInButton.addEventListener("click", () => {
    zoomMap(1);
  });
  elements.zoomOutButton.addEventListener("click", () => {
    zoomMap(-1);
  });
  elements.facilityDetail.addEventListener("click", (event) => {
    const action = event.target.closest("[data-detail-action]");
    if (!action || !state.selectedKey) return;
    if (action.dataset.detailAction === "priority-up") changePriority(state.selectedKey, 1);
    if (action.dataset.detailAction === "priority-down") changePriority(state.selectedKey, -1);
    if (action.dataset.detailAction === "toggle-excluded") toggleExcluded(state.selectedKey);
  });
  elements.directoryTab.addEventListener("click", () => setView("directory"));
  elements.crmTab.addEventListener("click", () => setView("crm"));
  elements.pipelineBoard.addEventListener("click", (event) => {
    const card = event.target.closest(".lead-card");
    if (!card) return;
    state.selectedLeadId = card.dataset.leadId;
    renderCrm();
  });
  elements.leadDetail.addEventListener("submit", (event) => {
    event.preventDefault();
    const lead = selectedLead();
    if (!lead) return;
    lead.status = document.querySelector("#leadStatus").value;
    lead.assignedTo = document.querySelector("#leadAssignedTo").value.trim();
    lead.phone = document.querySelector("#leadPhone").value.trim();
    lead.email = document.querySelector("#leadEmail").value.trim();
    lead.urgency = document.querySelector("#leadUrgency").value.trim();
    lead.budget = document.querySelector("#leadBudget").value.trim();
    lead.careNeeds = document.querySelector("#leadCareNeeds").value.trim();
    lead.nextStep = document.querySelector("#leadNextStep").value.trim();
    saveCrmState();
    renderCrm();
  });
  elements.communicationForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const lead = selectedLead();
    if (!lead) return;
    const subject = elements.communicationSubject.value.trim();
    const body = elements.communicationBody.value.trim();
    if (!subject && !body) return;

    state.communications.push({
      id: `comm-${Date.now()}`,
      leadId: lead.id,
      facilityKey: state.selectedKey || "",
      direction: elements.communicationDirection.value,
      channel: elements.communicationChannel.value,
      date: new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }),
      subject: subject || "Communication logged",
      body: body || "No additional notes."
    });
    elements.communicationSubject.value = "";
    elements.communicationBody.value = "";
    saveCrmState();
    renderCommunications();
  });
  elements.cardImageInput.addEventListener("change", async () => {
    const file = elements.cardImageInput.files?.[0];
    elements.scanResult.hidden = true;
    elements.scanResult.replaceChildren();
    if (!file) {
      elements.cardPreview.textContent = "No image selected";
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    elements.cardPreview.innerHTML = `<img src="${dataUrl}" alt="Selected business card preview">`;
  });
  elements.cardScanForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = elements.cardImageInput.files?.[0];
    if (!file) {
      elements.scanStatus.textContent = "choose image";
      return;
    }

    elements.scanStatus.textContent = "extracting";
    const imageDataUrl = await fileToDataUrl(file);
    const response = await fetch("/api/business-card/ocr", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type,
        bytes: file.size,
        imageDataUrl
      })
    });
    if (!response.ok) {
      elements.scanStatus.textContent = "failed";
      return;
    }
    const result = await response.json();
    elements.scanStatus.textContent = `${result.mode} · ${Math.round(result.confidence * 100)}%`;
    renderScanResult(result);
  });
}

async function init() {
  loadPreferences();
  loadCrmState();
  bindEvents();
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`Failed to load facility data: ${response.status}`);

  const payload = await response.json();
  state.records = payload.records;
  state.filtered = state.records;
  state.selectedKey = state.records[0]?.facility_key || "";

  populateSelect(elements.stateFilter, optionValues(state.records, "state"));
  populateSelect(elements.careFilter, optionValues(state.records, "program_type"));
  elements.datasetStatus.textContent = `${formatNumber(payload.record_count)} active records`;
  applyFilters();
  renderCrm();
}

init().catch((error) => {
  console.error(error);
  elements.datasetStatus.textContent = "Data unavailable";
  elements.resultList.textContent = "Unable to load facility data.";
});
