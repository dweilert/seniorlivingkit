import {
  ArrowLeft,
  ArrowRight,
  Camera,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe,
  Link,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Users
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { PERSON_TYPES, PIPELINE_STAGES, SAMPLE_COMMUNICATIONS, SAMPLE_LEADS, SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS } from "../crm-data.js";

const DATA_URL = "/data/facilities/combined-facilities-active.json";
const FACILITY_API_URL = "/api/facilities/search";
const FACILITY_PAGE_SIZE = 500;
const MAX_RENDERED_ROWS = 300;
const DEFAULT_PIN_LIMIT = 300;
const TILE_SIZE = 256;
const PREFERENCES_KEY = "facility-directory-preferences-v3";
const CRM_STATE_KEY = "facility-directory-crm-state-v3";
const WEBSITE_CONTACTS_KEY = "facility-directory-website-contacts-v1";
const TARGET_CATEGORIES = [
  ["age_55_plus", "55+ community"],
  ["independent_living", "Independent living"],
  ["assisted_living", "Assisted living"],
  ["memory_care", "Memory care"],
  ["skilled_nursing", "Skilled nursing"]
];
const PERSON_TYPE_COLORS = {
  Resident: "#244c5a",
  Family: "#3f7d5a",
  Friend: "#b07a2b",
  Doctor: "#6f4aa0",
  Advisor: "#4769a8",
  "Facility contact": "#9b4d42"
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

function categoryLabel(value) {
  return TARGET_CATEGORIES.find(([key]) => key === value)?.[1] || clean(value).replaceAll("_", " ");
}

function hasCoordinates(record) {
  return record.latitude != null && record.longitude != null;
}

function addressLine(record) {
  return [record.address, record.city, record.state, record.zip].filter(Boolean).join(", ");
}

function mapUrl(record) {
  if (hasCoordinates(record)) return `https://www.google.com/maps/search/?api=1&query=${record.latitude},${record.longitude}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine(record))}`;
}

function personLocation(person) {
  return [person.city, person.state, person.zip].filter(Boolean).join(", ");
}

function personDistanceMiles(a, b) {
  return haversineMiles({ latitude: a.latitude, longitude: a.longitude }, { latitude: b.latitude, longitude: b.longitude });
}

function relatedEdgesForPerson(relationships, personId) {
  return relationships.filter((relationship) => relationship.from === personId || relationship.to === personId);
}

function relationshipLabelForPerson(relationships, personId, otherId) {
  const relationship = relationships.find((item) =>
    (item.from === personId && item.to === otherId) || (item.from === otherId && item.to === personId)
  );
  return relationship ? `${relationship.label} · ${relationship.type}` : "";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function haversineMiles(from, to) {
  if (!Number.isFinite(Number(from?.latitude)) || !Number.isFinite(Number(from?.longitude))) return null;
  if (!Number.isFinite(Number(to?.latitude)) || !Number.isFinite(Number(to?.longitude))) return null;
  const radiusMiles = 3958.8;
  const radians = (degrees) => Number(degrees) * Math.PI / 180;
  const deltaLat = radians(to.latitude) - radians(from.latitude);
  const deltaLon = radians(to.longitude) - radians(from.longitude);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * radiusMiles * Math.asin(Math.sqrt(a));
}

function longitudeToTileX(longitude, zoom) {
  return ((longitude + 180) / 360) * 2 ** zoom * TILE_SIZE;
}

function latitudeToTileY(latitude, zoom) {
  const latRad = latitude * Math.PI / 180;
  return (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * 2 ** zoom * TILE_SIZE;
}

function mapBounds(records) {
  const points = records.filter(hasCoordinates);
  if (!points.length) return null;
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

function readStored(key, fallback) {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "null");
    return stored ?? fallback;
  } catch {
    return fallback;
  }
}

function usePersistentState(key, fallback) {
  const [value, setValue] = useState(() => readStored(key, fallback));
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
}

function defaultPreferences() {
  return { priority: {}, excluded: {}, favorite: {}, notes: {} };
}

function defaultFacilitySearchMeta() {
  return {
    total_matching: 0,
    total_active: 0,
    page: 1,
    page_size: FACILITY_PAGE_SIZE,
    has_more: false,
    states: [],
    care_options: [],
    categories: []
  };
}

function facilitySearchUrl(filters, page) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(FACILITY_PAGE_SIZE),
    sort: filters.distanceCenter && filters.distanceMiles ? "distance" : "location"
  });
  const values = {
    q: filters.query,
    category: filters.category,
    state: filters.state,
    care: filters.care,
    zip: filters.zip,
    capacity: filters.capacity,
    minBeds: filters.minBeds,
    maxBeds: filters.maxBeds,
    miles: filters.distanceMiles
  };
  for (const [key, value] of Object.entries(values)) {
    if (String(value || "").trim()) params.set(key, String(value).trim());
  }
  if (filters.distanceCenter && filters.distanceMiles) {
    params.set("latitude", String(filters.distanceCenter.latitude));
    params.set("longitude", String(filters.distanceCenter.longitude));
  }
  return `${FACILITY_API_URL}?${params.toString()}`;
}

function facilityFilterSignature(filters) {
  return JSON.stringify({
    query: filters.query,
    category: filters.category,
    state: filters.state,
    care: filters.care,
    zip: filters.zip,
    capacity: filters.capacity,
    minBeds: filters.minBeds,
    maxBeds: filters.maxBeds,
    distanceMiles: filters.distanceMiles,
    distanceCenter: filters.distanceCenter
      ? { latitude: filters.distanceCenter.latitude, longitude: filters.distanceCenter.longitude }
      : null
  });
}

function mergeFacilities(...groups) {
  const byKey = new Map();
  for (const group of groups) {
    for (const facility of group || []) {
      if (facility?.facility_key) byKey.set(facility.facility_key, facility);
    }
  }
  return [...byKey.values()];
}

function defaultCrmState() {
  return {
    leads: structuredClone(SAMPLE_LEADS),
    communications: structuredClone(SAMPLE_COMMUNICATIONS),
    people: structuredClone(SAMPLE_PEOPLE),
    relationships: structuredClone(SAMPLE_RELATIONSHIPS)
  };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function numericFilterValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && value !== "" ? number : null;
}

function displayWebsite(value) {
  return String(value || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function stageOffset(status, offset) {
  const index = PIPELINE_STAGES.indexOf(status);
  if (index < 0) return PIPELINE_STAGES[0];
  return PIPELINE_STAGES[clamp(index + offset, 0, PIPELINE_STAGES.length - 1)];
}

function createLead() {
  const now = Date.now();
  return {
    id: `lead-${now}`,
    name: "New lead",
    relationship: "",
    phone: "",
    email: "",
    status: "New",
    urgency: "Unknown",
    budget: "Unknown",
    careNeeds: "",
    preferredArea: "",
    assignedTo: "Unassigned",
    nextStep: "Complete intake",
    linkedFacilities: []
  };
}

function createPerson() {
  const now = Date.now();
  return {
    id: `person-${now}`,
    name: "New person",
    type: "Family",
    age: "",
    phone: "",
    email: "",
    city: "Austin",
    state: "TX",
    zip: "",
    latitude: null,
    longitude: null,
    notes: ""
  };
}

function relationshipGraph(people, relationships, selectedPersonId, filters) {
  const maxLevels = Number(filters.levels || 1);
  const selectedTypes = new Set(filters.types);
  const start = people.find((person) => person.id === selectedPersonId) || people[0];
  if (!start) return { nodes: [], edges: [] };
  const byId = new Map(people.map((person) => [person.id, person]));
  const adjacency = new Map();
  for (const relationship of relationships) {
    if (selectedTypes.size && !selectedTypes.has(relationship.type)) continue;
    adjacency.set(relationship.from, [...(adjacency.get(relationship.from) || []), relationship]);
    adjacency.set(relationship.to, [...(adjacency.get(relationship.to) || []), { ...relationship, from: relationship.to, to: relationship.from }]);
  }

  const queue = [{ id: start.id, level: 0 }];
  const levels = new Map([[start.id, 0]]);
  const edgeKeys = new Set();
  const edges = [];
  while (queue.length) {
    const current = queue.shift();
    for (const edge of adjacency.get(current.id) || []) {
      const nextLevel = current.level + 1;
      if (nextLevel > maxLevels) continue;
      const target = byId.get(edge.to);
      if (!target) continue;
      const key = [edge.from, edge.to].sort().join(":");
      if (!edgeKeys.has(key)) {
        edgeKeys.add(key);
        edges.push(edge);
      }
      if (!levels.has(edge.to)) {
        levels.set(edge.to, nextLevel);
        queue.push({ id: edge.to, level: nextLevel });
      }
    }
  }

  const radiusMiles = numericFilterValue(filters.radiusMiles);
  const ageYears = numericFilterValue(filters.ageYears);
  const nodes = [...levels.entries()]
    .map(([id, level]) => {
      const person = byId.get(id);
      const miles = personDistanceMiles(start, person);
      return { ...person, level, miles_from_selected: miles == null ? null : Number(miles.toFixed(1)) };
    })
    .filter((person) => {
      if (person.id === start.id) return true;
      const distanceMatch = radiusMiles == null || (person.miles_from_selected != null && person.miles_from_selected <= radiusMiles);
      const ageMatch = ageYears == null || !Number.isFinite(Number(start.age)) || !Number.isFinite(Number(person.age)) || Math.abs(Number(start.age) - Number(person.age)) <= ageYears;
      return distanceMatch && ageMatch;
    });
  const nodeIds = new Set(nodes.map((person) => person.id));
  const columns = new Map();
  for (const node of nodes) {
    columns.set(node.level, [...(columns.get(node.level) || []), node]);
  }
  const maxLevel = Math.max(1, ...nodes.map((node) => node.level));
  const positionedNodes = nodes.map((node) => {
    const siblings = columns.get(node.level) || [node];
    const siblingIndex = siblings.findIndex((item) => item.id === node.id);
    const x = node.level === 0 ? 12 : 12 + (node.level / maxLevel) * 78;
    const yStep = 82 / Math.max(siblings.length, 1);
    const y = siblings.length === 1 ? 50 : 9 + yStep * siblingIndex + yStep / 2;
    return {
      ...node,
      graph_x: Number(x.toFixed(2)),
      graph_y: Number(y.toFixed(2))
    };
  });
  return {
    nodes: positionedNodes,
    edges: edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)),
    selected: start
  };
}

function Header({ view, setView, recordCount, dataStatus }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Senior living CRM</p>
        <h1>Facility CRM</h1>
      </div>
      <div className="topbar-actions">
        <nav className="view-tabs" aria-label="Primary views">
          <button className={view === "directory" ? "is-active" : ""} onClick={() => setView("directory")} type="button">
            <MapPin size={16} /> Directory
          </button>
          <button className={view === "crm" ? "is-active" : ""} onClick={() => setView("crm")} type="button">
            <Users size={16} /> CRM
          </button>
          <button className={view === "advisors" ? "is-active" : ""} onClick={() => setView("advisors")} type="button">
            <Users size={16} /> Advisors
          </button>
        </nav>
        <div className="dataset-status">{recordCount ? `${formatNumber(recordCount)} active records` : "Loading"}{dataStatus ? ` · ${dataStatus}` : ""}</div>
      </div>
    </header>
  );
}

function DirectoryFilters({ filters, setFilters, stateOptions, careOptions, geocodeStatus, geocodeAddress }) {
  const update = (patch) => setFilters((current) => ({ ...current, ...patch }));
  const resetFilters = () => setFilters({
    query: "",
    category: "",
    state: "",
    care: "",
    zip: "",
    capacity: "",
    minBeds: "",
    maxBeds: "",
    distanceAddress: "",
    distanceMiles: "",
    distanceCenter: null,
    pinLimit: String(DEFAULT_PIN_LIMIT),
    visibility: "visible",
    costMin: "",
    costMax: "",
    sort: "location"
  });

  return (
    <aside className="filters" aria-label="Facility filters">
      <label>
        <span>Search</span>
        <div className="input-with-icon">
          <Search size={16} />
          <input
            id="searchInput"
            type="search"
            placeholder="Name, address, city, county, ZIP"
            value={filters.query}
            onChange={(event) => update({ query: event.target.value })}
          />
        </div>
      </label>
      <div className="filter-grid">
        <label>
          <span>Category</span>
          <select id="categoryFilter" value={filters.category} onChange={(event) => update({ category: event.target.value })}>
            <option value="">All</option>
            {TARGET_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>State</span>
          <select id="stateFilter" value={filters.state} onChange={(event) => update({ state: event.target.value })}>
            <option value="">All</option>
            {stateOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label>
          <span>Source type</span>
          <select id="careFilter" value={filters.care} onChange={(event) => update({ care: event.target.value })}>
            <option value="">All</option>
            {careOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label>
          <span>Capacity</span>
          <select id="capacityFilter" value={filters.capacity} onChange={(event) => update({ capacity: event.target.value })}>
            <option value="">All</option>
            <option value="small">1-15</option>
            <option value="medium">16-75</option>
            <option value="large">76+</option>
          </select>
        </label>
        <label>
          <span>Min beds</span>
          <input id="minBedsFilter" type="number" min="0" inputMode="numeric" value={filters.minBeds} onChange={(event) => update({ minBeds: event.target.value })} />
        </label>
        <label>
          <span>Max beds</span>
          <input id="maxBedsFilter" type="number" min="0" inputMode="numeric" value={filters.maxBeds} onChange={(event) => update({ maxBeds: event.target.value })} />
        </label>
        <label>
          <span>ZIP</span>
          <input id="zipFilter" inputMode="numeric" placeholder="Exact ZIP" value={filters.zip} onChange={(event) => update({ zip: event.target.value })} />
        </label>
        <label>
          <span>Map pins</span>
          <select id="pinLimitFilter" value={filters.pinLimit} onChange={(event) => update({ pinLimit: event.target.value })}>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="300">300</option>
            <option value="all">All filtered</option>
          </select>
        </label>
        <label className="wide-filter">
          <span>Distance from address</span>
          <input id="distanceAddressFilter" placeholder="Street address, city, state ZIP" value={filters.distanceAddress} onChange={(event) => update({ distanceAddress: event.target.value, distanceCenter: null })} />
        </label>
        <label>
          <span>Miles</span>
          <input id="distanceMilesFilter" type="number" min="1" inputMode="numeric" value={filters.distanceMiles} onChange={(event) => update({ distanceMiles: event.target.value })} />
        </label>
        <button id="geocodeDistanceButton" className="filter-inline-button" type="button" onClick={() => geocodeAddress(filters.distanceAddress)}>
          Locate
        </button>
        <label>
          <span>Min cost</span>
          <input id="costMinFilter" disabled placeholder="Unavailable" value={filters.costMin} onChange={(event) => update({ costMin: event.target.value })} />
        </label>
        <label>
          <span>Max cost</span>
          <input id="costMaxFilter" disabled placeholder="Unavailable" value={filters.costMax} onChange={(event) => update({ costMax: event.target.value })} />
        </label>
        <label>
          <span>Visibility</span>
          <select id="visibilityFilter" value={filters.visibility} onChange={(event) => update({ visibility: event.target.value })}>
            <option value="visible">Visible</option>
            <option value="all">All</option>
            <option value="excluded">Excluded</option>
            <option value="favorite">Favorites</option>
          </select>
        </label>
      </div>
      <p className="filter-note" id="distanceFilterStatus">{geocodeStatus}</p>
      <p className="filter-note">55+ HUD elderly-housing records are partially populated; independent living and memory care still need additional source enrichment.</p>
      <p className="filter-note">Cost filters are ready, but current public sources do not include facility pricing.</p>
      <div className="filter-actions">
        <button type="button" onClick={resetFilters}>
          Reset
        </button>
      </div>
    </aside>
  );
}

function FacilityMap({ records, selectedKey, onPinSelect, priority, zoomOffset, setZoomOffset, pinLimit }) {
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const [size, setSize] = useState({ width: 640, height: 300 });
  const [hoveredRecord, setHoveredRecord] = useState(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const mapped = records.filter(hasCoordinates).slice(0, pinLimit);
  const previewRecord = hoveredRecord || mapped.find((record) => record.facility_key === selectedKey);
  const mapResetKey = `${mapped.length}:${mapped[0]?.facility_key || ""}:${mapped.at(-1)?.facility_key || ""}`;

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(Math.round(entry.contentRect.width), 320),
        height: Math.max(Math.round(entry.contentRect.height), 220)
      });
    });
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);

  const mapState = useMemo(() => {
    const bounds = mapBounds(mapped);
    if (!bounds) return null;
    const center = {
      latitude: (bounds.minLat + bounds.maxLat) / 2,
      longitude: (bounds.minLon + bounds.maxLon) / 2
    };
    const zoom = clamp(zoomForBounds(bounds, size.width, size.height) + zoomOffset, 3, 15);
    const centerPoint = {
      x: longitudeToTileX(center.longitude, zoom),
      y: latitudeToTileY(center.latitude, zoom)
    };
    return { centerPoint, zoom };
  }, [mapped, size.height, size.width, zoomOffset]);

  useEffect(() => {
    setPanOffset({ x: 0, y: 0 });
  }, [mapResetKey]);

  const viewCenterPoint = mapState ? {
    x: mapState.centerPoint.x - panOffset.x,
    y: mapState.centerPoint.y - panOffset.y
  } : null;

  const tiles = useMemo(() => {
    if (!mapState || !viewCenterPoint) return [];
    const startX = Math.floor((viewCenterPoint.x - size.width / 2) / TILE_SIZE);
    const endX = Math.floor((viewCenterPoint.x + size.width / 2) / TILE_SIZE);
    const startY = Math.floor((viewCenterPoint.y - size.height / 2) / TILE_SIZE);
    const endY = Math.floor((viewCenterPoint.y + size.height / 2) / TILE_SIZE);
    const tileLimit = 2 ** mapState.zoom;
    const nextTiles = [];
    for (let x = startX; x <= endX; x += 1) {
      for (let y = startY; y <= endY; y += 1) {
        if (y < 0 || y >= tileLimit) continue;
        const wrappedX = ((x % tileLimit) + tileLimit) % tileLimit;
        nextTiles.push({
          key: `${mapState.zoom}-${x}-${y}`,
          src: `https://tile.openstreetmap.org/${mapState.zoom}/${wrappedX}/${y}.png`,
          left: x * TILE_SIZE - viewCenterPoint.x + size.width / 2,
          top: y * TILE_SIZE - viewCenterPoint.y + size.height / 2
        });
      }
    }
    return nextTiles;
  }, [mapState, size.height, size.width, viewCenterPoint]);

  const zoom = (delta) => setZoomOffset((current) => clamp(current + delta, -4, 4));
  const startPan = (event) => {
    if (event.target.closest(".map-pin")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    };
  };
  const updatePan = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    setPanOffset((current) => ({ x: current.x + deltaX, y: current.y + deltaY }));
  };
  const endPan = (event) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  return (
    <section className="map-panel" aria-label="Facility map">
      <div className="map-toolbar">
        <div><strong id="mapCount">{formatNumber(mapped.length)}</strong><span>mapped · drag to pan · scroll to zoom</span></div>
        <div className="map-controls">
          <button id="zoomOutButton" type="button" aria-label="Zoom out" onClick={() => zoom(-1)}><ChevronDown size={17} /></button>
          <button id="zoomInButton" type="button" aria-label="Zoom in" onClick={() => zoom(1)}><ChevronUp size={17} /></button>
        </div>
      </div>
      <div
        className="map-canvas"
        id="mapCanvas"
        ref={canvasRef}
        role="img"
        aria-label="Map of filtered facilities with coordinates"
        onPointerDown={startPan}
        onPointerMove={updatePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onWheel={(event) => {
          event.preventDefault();
          zoom(event.deltaY < 0 ? 1 : -1);
        }}
      >
        <div className="map-tiles" id="mapTiles">
          {tiles.map((tile) => (
            <img key={tile.key} className="map-tile" src={tile.src} alt="" style={{ left: tile.left, top: tile.top }} />
          ))}
          {tiles.length > 0 && <div className="map-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a></div>}
        </div>
        <div className="map-viewport" id="mapViewport">
          {!mapState && <div className="empty-detail">No mapped facilities in this view</div>}
          {mapState && viewCenterPoint && mapped.map((record, index) => {
            const point = {
              x: longitudeToTileX(Number(record.longitude), mapState.zoom),
              y: latitudeToTileY(Number(record.latitude), mapState.zoom)
            };
            return (
              <button
                key={record.facility_key}
                type="button"
                className={[
                  "map-pin",
                  selectedKey === record.facility_key ? "is-selected" : "",
                  priority[record.facility_key] ? "is-priority" : ""
                ].filter(Boolean).join(" ")}
                title={`${record.facility_name} - ${record.city}, ${record.state}`}
                style={{
                  left: point.x - viewCenterPoint.x + size.width / 2,
                  top: point.y - viewCenterPoint.y + size.height / 2
                }}
                onMouseEnter={() => setHoveredRecord(record)}
                onMouseLeave={() => setHoveredRecord(null)}
                onFocus={() => setHoveredRecord(record)}
                onBlur={() => setHoveredRecord(null)}
                onClick={() => onPinSelect(record.facility_key)}
              >
                <span>{index + 1}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="map-preview-panel" id="mapPreviewPanel" aria-live="polite">
        {previewRecord ? (
          <>
            <strong id="mapPreviewName">{previewRecord.facility_name}</strong>
            <span id="mapPreviewLocation">{[previewRecord.address, previewRecord.city, previewRecord.state, previewRecord.zip].filter(Boolean).join(", ")}</span>
          </>
        ) : (
          <>
            <strong id="mapPreviewName">Map facility preview</strong>
            <span id="mapPreviewLocation">Hover a pin to see the facility name and location.</span>
          </>
        )}
      </div>
    </section>
  );
}

function FacilityRow({ record, selected, priority, excluded, favorite, onSelect, changePriority, toggleExcluded, toggleFavorite }) {
  return (
    <article
      className={["facility-row", selected ? "is-selected" : "", excluded ? "is-excluded" : ""].filter(Boolean).join(" ")}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <strong>{record.facility_name}</strong>
      <div className="row-meta">
        <span>{clean(record.address)}</span>
        <span>{clean(record.city)}, {clean(record.state, "")}</span>
        <span>{clean(record.county)} County</span>
        <span>{clean(record.capacity)} beds</span>
      </div>
      <div className="row-submeta">
        <span className="pill">{categoryLabel(record.care_category)}</span>
        <span className="pill">{clean(record.program_type, "Source type")}</span>
        {priority > 0 && <span className="pill priority">Priority {priority}</span>}
        {favorite && <span className="pill priority">Favorite</span>}
        {excluded && <span className="pill excluded">Excluded</span>}
        {!hasCoordinates(record) && <span className="pill warn">No coordinates</span>}
      </div>
      <div className="row-actions" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="is-priority" onClick={() => changePriority(1)}>Priority +</button>
        <button type="button" onClick={() => changePriority(-1)}>Priority -</button>
        <button type="button" onClick={toggleFavorite}>{favorite ? "Unfavorite" : "Favorite"}</button>
        <button type="button" className="is-excluded" onClick={toggleExcluded}>{excluded ? "Restore" : "Exclude"}</button>
      </div>
    </article>
  );
}

function FacilityDetail({ record, priority, excluded, favorite, changePriority, toggleExcluded, toggleFavorite, websiteContact, setWebsiteContacts }) {
  const [websiteDraft, setWebsiteDraft] = useState("");
  const [contactStatus, setContactStatus] = useState("");

  useEffect(() => {
    setWebsiteDraft(websiteContact?.website_url || record?.website_url || "");
    setContactStatus("");
  }, [record?.facility_key, record?.website_url, websiteContact?.website_url]);

  if (!record) return <div className="empty-detail" id="emptyDetail">Select a facility</div>;
  const websiteUrl = websiteContact?.website_url || record.website_url || "";
  const fact = (label, value) => <div className="fact"><span>{label}</span><strong>{clean(value)}</strong></div>;
  const saveWebsiteUrl = () => {
    const nextUrl = websiteDraft.trim();
    if (!nextUrl) return;
    setWebsiteContacts((current) => ({
      ...current,
      [record.facility_key]: {
        ...(current[record.facility_key] || {}),
        website_url: /^https?:\/\//i.test(nextUrl) ? nextUrl : `https://${nextUrl}`,
        source: "manual",
        source_note: "User-entered facility website URL",
        updated_at: new Date().toISOString()
      }
    }));
    setContactStatus("Website saved.");
  };
  const checkLatestContacts = async () => {
    const nextUrl = websiteDraft.trim() || websiteUrl;
    if (!nextUrl) {
      setContactStatus("Add a website URL first.");
      return;
    }
    setContactStatus("Checking website...");
    try {
      const response = await fetch("/api/facility/contact-info", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ facilityKey: record.facility_key, websiteUrl: nextUrl })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to check website");
      setWebsiteContacts((current) => ({
        ...current,
        [record.facility_key]: {
          ...result,
          source: "website_scrape",
          source_note: result.source_note || "Website contact harvester parsed facility website pages."
        }
      }));
      setWebsiteDraft(result.website_url);
      setContactStatus(`Updated ${new Date(result.checked_at).toLocaleString()}.`);
    } catch (error) {
      setContactStatus(error.message);
    }
  };

  return (
    <article className="facility-detail" id="facilityDetail">
      <h2>{record.facility_name}</h2>
      <p className="detail-address">{addressLine(record)}</p>
      <div className="detail-actions">
        {record.phone && <a href={`tel:${record.phone.replaceAll(/[^0-9+]/g, "")}`}><Phone size={16} /> Call</a>}
        <a href={mapUrl(record)} target="_blank" rel="noreferrer"><MapPin size={16} /> Map</a>
        {websiteUrl && <a href={websiteUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Website</a>}
        {record.source_url && <a href={record.source_url} target="_blank" rel="noreferrer">Source</a>}
      </div>
      <div className="detail-actions">
        <button type="button" onClick={() => changePriority(1)}>Priority +</button>
        <button type="button" onClick={() => changePriority(-1)}>Priority -</button>
        <button type="button" onClick={toggleFavorite}>{favorite ? "Unfavorite" : "Favorite"}</button>
        <button type="button" onClick={toggleExcluded}>{excluded ? "Restore" : "Exclude"}</button>
      </div>
      <div className="detail-grid">
        {fact("Phone", record.phone)}
        {fact("Capacity", record.capacity)}
        {fact("Category", categoryLabel(record.care_category))}
        {fact("Source type", record.program_type)}
        {fact("Status", record.facility_status || "Active")}
        {fact("Priority", priority)}
        {fact("Favorite", favorite ? "Yes" : "No")}
        {fact("Map", hasCoordinates(record) ? "Mapped" : "Needs geocoding")}
        {fact("Licensee", record.licensee)}
        {fact("Administrator", record.administrator)}
        {fact("County", record.county)}
        {fact("Source ID", record.source_facility_id)}
      </div>
      <section className="website-contact-card" id="websiteContactCard" aria-label="Facility website contact enrichment">
        <div className="website-contact-header">
          <div>
            <strong><Globe size={16} /> Website contacts</strong>
            <span>{websiteContact?.checked_at ? `Checked ${new Date(websiteContact.checked_at).toLocaleString()}` : "No website contacts checked yet"}</span>
          </div>
        </div>
        <label>
          <span>Facility website</span>
          <input id="facilityWebsiteInput" value={websiteDraft} placeholder="https://facility-example.com" onChange={(event) => setWebsiteDraft(event.target.value)} />
        </label>
        <div className="website-contact-actions">
          <button type="button" id="saveFacilityWebsiteButton" onClick={saveWebsiteUrl}>Save website</button>
          <button type="button" id="checkFacilityContactsButton" onClick={checkLatestContacts}><RefreshCw size={15} /> Check latest contacts</button>
          {websiteUrl && <a href={websiteUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Open site</a>}
        </div>
        <p className="filter-note" id="contactInfoStatus">{contactStatus || clean(websiteContact?.source_note, "Website URL can be saved now; contact parsing runs on demand.")}</p>
        {websiteContact?.title && <div className="contact-result-row"><span>Site title</span><strong>{websiteContact.title}</strong></div>}
        {websiteContact?.emails?.length > 0 && <div className="contact-result-row"><span>Emails</span><strong>{websiteContact.emails.join(", ")}</strong></div>}
        {websiteContact?.phones?.length > 0 && <div className="contact-result-row"><span>Phones</span><strong>{websiteContact.phones.join(", ")}</strong></div>}
        {websiteContact?.parser_version && <div className="contact-result-row"><span>Parser</span><strong>{websiteContact.parser_version}</strong></div>}
        {websiteContact?.fetched_pages?.length > 0 && (
          <details className="parsing-notes" id="websiteFetchedPages">
            <summary>Pages checked</summary>
            <ul>
              {websiteContact.fetched_pages.map((page) => (
                <li key={`${page.requested_url}-${page.html_sha256}`}>
                  {displayWebsite(page.final_url)}: {page.extracted_email_count} emails, {page.extracted_phone_count} phones
                </li>
              ))}
            </ul>
          </details>
        )}
        {websiteContact?.evidence?.length > 0 && (
          <details className="parsing-notes" id="websiteContactEvidence">
            <summary>Contact evidence</summary>
            <ul>
              {websiteContact.evidence.slice(0, 8).map((item) => (
                <li key={`${item.rule}-${item.value}-${item.page_url}`}>
                  {item.rule}: {item.value}{item.snippet ? ` (${item.snippet})` : ""}
                </li>
              ))}
            </ul>
          </details>
        )}
        {websiteContact?.contact_links?.length > 0 && (
          <div className="contact-link-list">
            <span>Contact links</span>
            {websiteContact.contact_links.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer">{displayWebsite(url)}</a>)}
          </div>
        )}
        {websiteContact?.parser_rules?.length > 0 && (
          <details className="parsing-notes" id="websiteParserRules">
            <summary>How this was collected</summary>
            <ul>{websiteContact.parser_rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
          </details>
        )}
        {websiteContact?.parsing_notes?.length > 0 && (
          <details className="parsing-notes" id="websiteParsingNotes">
            <summary>Parsing notes</summary>
            <ul>{websiteContact.parsing_notes.map((note) => <li key={note}>{note}</li>)}</ul>
          </details>
        )}
      </section>
      <div className="source-block"><strong>{record.source_name}</strong><br />{record.source_owner}<br />{record.facility_key}</div>
    </article>
  );
}

function DirectoryView({ records, filters, setFilters, searchMeta, searchPage, setSearchPage, preferences, setPreferences, preferenceStatus, setPreferenceStatus, selectedKey, setSelectedKey }) {
  const [zoomOffset, setZoomOffset] = useState(0);
  const [geocodeStatus, setGeocodeStatus] = useState("Address distance filter inactive.");
  const [websiteContacts, setWebsiteContacts] = usePersistentState(WEBSITE_CONTACTS_KEY, {});
  const resultListRef = useRef(null);
  const stateOptions = searchMeta.states?.length ? searchMeta.states : optionValues(records, "state");
  const careOptions = searchMeta.care_options?.length ? searchMeta.care_options : optionValues(records, "program_type");

  const filtered = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    const minBeds = numericFilterValue(filters.minBeds);
    const maxBeds = numericFilterValue(filters.maxBeds);
    const distanceMiles = numericFilterValue(filters.distanceMiles);
    const pinCenter = filters.distanceCenter;
    return records.filter((record) => {
      const excluded = Boolean(preferences.excluded[record.facility_key]);
      const favorite = Boolean(preferences.favorite?.[record.facility_key]);
      const searchText = [record.facility_name, record.address, record.city, record.county, record.state, record.zip, record.phone, record.program_type, record.care_category, categoryLabel(record.care_category)].join(" ").toLowerCase();
      const capacity = Number(record.capacity);
      const capacityMatches = !filters.capacity
        || (filters.capacity === "small" && capacity >= 1 && capacity <= 15)
        || (filters.capacity === "medium" && capacity >= 16 && capacity <= 75)
        || (filters.capacity === "large" && capacity >= 76);
      const bedsMatch = (minBeds == null || capacity >= minBeds) && (maxBeds == null || capacity <= maxBeds);
      const zipMatch = !filters.zip.trim() || String(record.zip || "").startsWith(filters.zip.trim());
      const distance = pinCenter && distanceMiles != null ? haversineMiles(pinCenter, record) : null;
      const distanceMatch = !pinCenter || distanceMiles == null || (distance != null && distance <= distanceMiles);
      const visibilityMatches = filters.visibility === "all"
        || (filters.visibility === "excluded" ? excluded : filters.visibility === "favorite" ? favorite : !excluded);
      return visibilityMatches
        && (!query || searchText.includes(query))
        && (!filters.category || record.care_category === filters.category)
        && (!filters.state || record.state === filters.state)
        && (!filters.care || record.program_type === filters.care)
        && capacityMatches
        && bedsMatch
        && zipMatch
        && distanceMatch;
    }).sort((a, b) => (preferences.priority[b.facility_key] || 0) - (preferences.priority[a.facility_key] || 0)
      || (filters.distanceCenter ? (haversineMiles(filters.distanceCenter, a) ?? Number.POSITIVE_INFINITY) - (haversineMiles(filters.distanceCenter, b) ?? Number.POSITIVE_INFINITY) : 0)
      || a.state.localeCompare(b.state)
      || a.city.localeCompare(b.city)
      || a.facility_name.localeCompare(b.facility_name));
  }, [filters, preferences.excluded, preferences.favorite, preferences.priority, records]);

  const pinLimit = filters.pinLimit === "all" ? filtered.length : Number(filters.pinLimit || DEFAULT_PIN_LIMIT);

  const geocodeAddress = async (address) => {
    const trimmed = address.trim();
    if (!trimmed) {
      setGeocodeStatus("Enter an address before locating.");
      return;
    }
    setGeocodeStatus("Locating address...");
    try {
      const response = await fetch("/api/geocode/address", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: trimmed })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to locate address");
      if (!result.matched) {
        setFilters((current) => ({ ...current, distanceCenter: null }));
        setGeocodeStatus("No Census match. Enter a full street address for radius search.");
        return;
      }
      setFilters((current) => ({
        ...current,
        distanceAddress: trimmed,
        distanceCenter: {
          latitude: result.latitude,
          longitude: result.longitude,
          label: result.matched_address || trimmed
        }
      }));
      setGeocodeStatus(`Distance center: ${result.matched_address || trimmed}`);
    } catch (error) {
      setFilters((current) => ({ ...current, distanceCenter: null }));
      setGeocodeStatus(error.message);
    }
  };

  useEffect(() => {
    if (!filtered.some((record) => record.facility_key === selectedKey)) setSelectedKey(filtered[0]?.facility_key || "");
  }, [filtered, selectedKey, setSelectedKey]);

  const selectedRecord = records.find((record) => record.facility_key === selectedKey);
  const savePreference = (key, nextPreferences) => {
    setPreferenceStatus("Saving preferences");
    fetch("/api/facility-preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        facilityKey: key,
        priority: nextPreferences.priority?.[key] || 0,
        isExcluded: Boolean(nextPreferences.excluded?.[key]),
        isFavorite: Boolean(nextPreferences.favorite?.[key]),
        notes: nextPreferences.notes?.[key] || ""
      })
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Preference save failed: ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        setPreferences({
          priority: payload.priority || {},
          excluded: payload.excluded || {},
          favorite: payload.favorite || {},
          notes: payload.notes || {}
        });
        setPreferenceStatus("Preferences saved to Postgres");
      })
      .catch((error) => setPreferenceStatus(`${error.message}; browser draft retained`));
  };
  const changePriority = (key, delta) => setPreferences((current) => {
    const nextPriority = { ...(current.priority || {}) };
    const nextPreferences = {
      priority: nextPriority,
      excluded: { ...(current.excluded || {}) },
      favorite: { ...(current.favorite || {}) },
      notes: { ...(current.notes || {}) }
    };
    const next = clamp((nextPriority[key] || 0) + delta, 0, 9);
    if (next) nextPriority[key] = next;
    else delete nextPriority[key];
    savePreference(key, nextPreferences);
    return nextPreferences;
  });
  const toggleExcluded = (key) => setPreferences((current) => {
    const excluded = { ...(current.excluded || {}) };
    const nextPreferences = {
      priority: { ...(current.priority || {}) },
      excluded,
      favorite: { ...(current.favorite || {}) },
      notes: { ...(current.notes || {}) }
    };
    if (excluded[key]) delete excluded[key];
    else excluded[key] = true;
    savePreference(key, nextPreferences);
    return nextPreferences;
  });
  const toggleFavorite = (key) => setPreferences((current) => {
    const favorite = { ...(current.favorite || {}) };
    const nextPreferences = {
      priority: { ...(current.priority || {}) },
      excluded: { ...(current.excluded || {}) },
      favorite,
      notes: { ...(current.notes || {}) }
    };
    if (favorite[key]) delete favorite[key];
    else favorite[key] = true;
    savePreference(key, nextPreferences);
    return nextPreferences;
  });
  const scrollFacilityRowIntoView = (key) => {
    window.requestAnimationFrame(() => {
      const list = resultListRef.current;
      const selector = `[data-facility-key="${CSS.escape(key)}"]`;
      const row = list?.querySelector(selector);
      if (!list || !row) return;
      list.scrollTo({
        top: Math.max(row.offsetTop - list.offsetTop, 0),
        behavior: "smooth"
      });
    });
  };
  const selectFromMap = (key) => {
    setSelectedKey(key);
    scrollFacilityRowIntoView(key);
  };

  return (
    <main className="workspace" id="directoryView">
      <DirectoryFilters filters={filters} setFilters={setFilters} stateOptions={stateOptions} careOptions={careOptions} geocodeStatus={geocodeStatus} geocodeAddress={geocodeAddress} />
      <section className="results-panel" aria-label="Facility results">
        <div className="result-summary">
          <strong id="resultCount">{formatNumber(searchMeta.total_matching || filtered.length)}</strong>
          <span id="resultMeta">facilities ({Math.min(filtered.length, MAX_RENDERED_ROWS)} rows loaded · page {searchPage} · {Math.min(filtered.filter(hasCoordinates).length, pinLimit)} pins · <span id="facilityPreferenceStatus">{preferenceStatus}</span>)</span>
        </div>
        <FacilityMap records={filtered} selectedKey={selectedKey} onPinSelect={selectFromMap} priority={preferences.priority} zoomOffset={zoomOffset} setZoomOffset={setZoomOffset} pinLimit={pinLimit} />
        <div className="pagination-bar" id="facilityPagination">
          <button type="button" disabled={searchPage <= 1} onClick={() => setSearchPage((current) => Math.max(current - 1, 1))}><ArrowLeft size={15} /> Previous</button>
          <span>Showing {formatNumber(filtered.length)} of {formatNumber(searchMeta.total_matching || filtered.length)}</span>
          <button type="button" disabled={!searchMeta.has_more} onClick={() => setSearchPage((current) => current + 1)}>Next <ArrowRight size={15} /></button>
        </div>
        <div className="result-list" id="resultList" ref={resultListRef}>
          {filtered.slice(0, MAX_RENDERED_ROWS).map((record) => (
            <div key={record.facility_key} data-facility-key={record.facility_key}>
              <FacilityRow
                record={record}
                selected={selectedKey === record.facility_key}
                priority={preferences.priority[record.facility_key] || 0}
                excluded={Boolean(preferences.excluded[record.facility_key])}
                favorite={Boolean(preferences.favorite?.[record.facility_key])}
                onSelect={() => setSelectedKey(record.facility_key)}
                changePriority={(delta = 1) => changePriority(record.facility_key, delta)}
                toggleExcluded={() => toggleExcluded(record.facility_key)}
                toggleFavorite={() => toggleFavorite(record.facility_key)}
              />
            </div>
          ))}
        </div>
      </section>
      <section className="detail-panel" aria-label="Facility details">
        <FacilityDetail
          record={selectedRecord}
          priority={selectedRecord ? preferences.priority[selectedRecord.facility_key] || 0 : 0}
          excluded={selectedRecord ? Boolean(preferences.excluded[selectedRecord.facility_key]) : false}
          favorite={selectedRecord ? Boolean(preferences.favorite?.[selectedRecord.facility_key]) : false}
          changePriority={(delta) => selectedRecord && changePriority(selectedRecord.facility_key, delta)}
          toggleExcluded={() => selectedRecord && toggleExcluded(selectedRecord.facility_key)}
          toggleFavorite={() => selectedRecord && toggleFavorite(selectedRecord.facility_key)}
          websiteContact={selectedRecord ? websiteContacts[selectedRecord.facility_key] : null}
          setWebsiteContacts={setWebsiteContacts}
        />
      </section>
    </main>
  );
}

function Pipeline({ leads, selectedLeadId, setSelectedLeadId }) {
  return (
    <section className="pipeline-panel" aria-label="Lead pipeline">
      <div className="pipeline-board" id="pipelineBoard">
        {PIPELINE_STAGES.map((stage) => {
          const stageLeads = leads.filter((lead) => lead.status === stage);
          return (
            <section className="pipeline-column" data-stage={stage} key={stage}>
              <div className="pipeline-column-header"><h3>{stage}</h3><span>{stageLeads.length}</span></div>
              <div className="lead-card-list">
                {stageLeads.map((lead) => (
                  <button className={`lead-card${lead.id === selectedLeadId ? " is-selected" : ""}`} key={lead.id} type="button" onClick={() => setSelectedLeadId(lead.id)}>
                    <div className="lead-card-top"><strong>{lead.name}</strong><span className="lead-urgency">{lead.urgency}</span></div>
                    <span>{lead.relationship}</span>
                    <span>{lead.preferredArea} · {lead.budget}</span>
                    <p>{lead.nextStep}</p>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function LeadDetail({ lead, setLeads, facilities, selectedFacility }) {
  if (!lead) return <article className="lead-detail">Select a lead</article>;
  const leadFacilityKeys = lead.linkedFacilities || [];
  const linkedFacilities = leadFacilityKeys.map((key) => facilities.find((facility) => facility.facility_key === key)).filter(Boolean);
  const canLinkSelectedFacility = selectedFacility && !leadFacilityKeys.includes(selectedFacility.facility_key);
  const update = (patch) => setLeads((leads) => leads.map((item) => item.id === lead.id ? { ...item, ...patch } : item));
  const moveStage = (offset) => update({ status: stageOffset(lead.status, offset) });
  const addSelectedFacility = () => {
    if (!selectedFacility) return;
    update({ linkedFacilities: [...leadFacilityKeys, selectedFacility.facility_key] });
  };
  const removeFacility = (facilityKey) => update({ linkedFacilities: leadFacilityKeys.filter((key) => key !== facilityKey) });

  return (
    <article className="lead-detail" id="leadDetail">
      <div className="lead-detail-header">
        <div>
          <h2>{lead.name}</h2>
          <p className="lead-subtitle">{lead.relationship || "No relationship captured"}</p>
        </div>
        <div className="stage-actions" aria-label="Lead stage controls">
          <button type="button" onClick={() => moveStage(-1)} disabled={lead.status === PIPELINE_STAGES[0]}>
            <ArrowLeft size={15} /> Back
          </button>
          <button type="button" onClick={() => moveStage(1)} disabled={lead.status === PIPELINE_STAGES.at(-1)}>
            Next <ArrowRight size={15} />
          </button>
        </div>
      </div>
      <form className="lead-form" onSubmit={(event) => event.preventDefault()}>
        <label><span>Resident</span><input id="leadName" value={lead.name} onChange={(event) => update({ name: event.target.value })} /></label>
        <label><span>Status</span><select id="leadStatus" value={lead.status} onChange={(event) => update({ status: event.target.value })}>{PIPELINE_STAGES.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
        <label><span>Relationship</span><input value={lead.relationship} onChange={(event) => update({ relationship: event.target.value })} /></label>
        <label><span>Assigned</span><input value={lead.assignedTo} onChange={(event) => update({ assignedTo: event.target.value })} /></label>
        <label><span>Phone</span><input type="tel" value={lead.phone} onChange={(event) => update({ phone: event.target.value })} /></label>
        <label><span>Email</span><input type="email" value={lead.email} onChange={(event) => update({ email: event.target.value })} /></label>
        <label><span>Urgency</span><input value={lead.urgency} onChange={(event) => update({ urgency: event.target.value })} /></label>
        <label><span>Budget</span><input value={lead.budget} onChange={(event) => update({ budget: event.target.value })} /></label>
        <label className="wide-field"><span>Care needs</span><textarea value={lead.careNeeds} onChange={(event) => update({ careNeeds: event.target.value })} /></label>
        <label className="wide-field"><span>Next step</span><textarea value={lead.nextStep} onChange={(event) => update({ nextStep: event.target.value })} /></label>
      </form>
      <div className="linked-facilities">
        <div className="linked-facilities-header">
          <strong>Linked facilities</strong>
          {canLinkSelectedFacility && (
            <button type="button" id="linkSelectedFacilityButton" onClick={addSelectedFacility}>
              <Link size={15} /> Link selected
            </button>
          )}
        </div>
        {linkedFacilities.length ? linkedFacilities.map((facility) => (
          <div className="linked-facility" key={facility.facility_key}>
            <div>
              <strong>{facility.facility_name}</strong><br />
              <span>{addressLine(facility)}</span>
            </div>
            <button type="button" aria-label={`Remove ${facility.facility_name}`} onClick={() => removeFacility(facility.facility_key)}>
              <Trash2 size={15} />
            </button>
          </div>
        )) : <span>No facilities linked yet</span>}
      </div>
    </article>
  );
}

function Scanner({ lead, selectedFacilityKey, setLeads, setCommunications }) {
  const [status, setStatus] = useState("ready");
  const [preview, setPreview] = useState("");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);

  async function submit(event) {
    event.preventDefault();
    if (!file) {
      setStatus("choose image");
      return;
    }
    setStatus("extracting");
    const imageDataUrl = await fileToDataUrl(file);
    const response = await fetch("/api/business-card/ocr", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filename: file.name, mimeType: file.type, bytes: file.size, imageDataUrl })
    });
    if (!response.ok) {
      setStatus("failed");
      return;
    }
    const nextResult = await response.json();
    setResult(nextResult);
    setStatus(`${nextResult.mode} · ${Math.round(nextResult.confidence * 100)}%`);
  }

  function applyScan() {
    if (!lead || !result) return;
    const contact = result.contact;
    setLeads((leads) => leads.map((item) => item.id === lead.id ? {
      ...item,
      relationship: contact.title ? `${contact.title}: ${contact.name}` : contact.name,
      phone: contact.phone || item.phone,
      email: contact.email || item.email,
      preferredArea: contact.address || item.preferredArea,
      nextStep: `Review scanned business card contact: ${contact.name}`
    } : item));
    setCommunications((items) => [...items, {
      id: `comm-${Date.now()}`,
      leadId: lead.id,
      facilityKey: selectedFacilityKey || "",
      direction: "Internal",
      channel: "Note",
      date: new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }),
      subject: "Business card scanned",
      body: `Extracted ${contact.name}, ${contact.phone}, ${contact.email}.`
    }]);
  }

  return (
    <section className="card-scan-panel" aria-label="Business card scanner">
      <div className="result-summary"><strong><Camera size={16} /> Scan card</strong><span id="scanStatus">{status}</span></div>
      <form className="card-scan-form" id="cardScanForm" onSubmit={submit}>
        <label className="wide-field"><span>Business card image</span><input id="cardImageInput" type="file" accept="image/*" capture="environment" onChange={async (event) => {
          const nextFile = event.target.files?.[0] || null;
          setFile(nextFile);
          setResult(null);
          setPreview(nextFile ? await fileToDataUrl(nextFile) : "");
        }} /></label>
        <div className="card-preview" id="cardPreview">{preview ? <img src={preview} alt="Selected business card preview" /> : "No image selected"}</div>
        <button type="submit">Extract contact</button>
      </form>
      {result && (
        <div className="scan-result" id="scanResult">
          <dl>{Object.entries({
            Name: result.contact.name,
            Title: result.contact.title,
            Company: result.contact.company,
            Phone: result.contact.phone,
            Email: result.contact.email,
            Address: result.contact.address,
            Confidence: `${Math.round(result.confidence * 100)}%`
          }).map(([key, value]) => <Fragment key={key}><dt>{key}</dt><dd>{clean(value)}</dd></Fragment>)}</dl>
          <button type="button" id="applyScanButton" onClick={applyScan}>Apply to selected lead</button>
        </div>
      )}
    </section>
  );
}

function Communications({ lead, selectedFacility, facilities, communications, setCommunications }) {
  const [draft, setDraft] = useState({ channel: "Email", direction: "Outbound", facilityKey: selectedFacility?.facility_key || "", subject: "", body: "" });
  const facilityLookup = useMemo(() => new Map(facilities.map((facility) => [facility.facility_key, facility])), [facilities]);
  const communicationFacilities = useMemo(() => {
    const keys = new Set([
      ...(lead?.linkedFacilities || []),
      selectedFacility?.facility_key || ""
    ].filter(Boolean));
    return [...keys].map((key) => facilityLookup.get(key)).filter(Boolean);
  }, [facilityLookup, lead, selectedFacility]);
  const items = useMemo(() => {
    if (!lead) return [];
    return communications
      .filter((item) => item.leadId === lead.id || (item.facilityKey && communicationFacilities.some((facility) => facility.facility_key === item.facilityKey)))
      .sort((a, b) => b.id.localeCompare(a.id));
  }, [communicationFacilities, communications, lead]);

  useEffect(() => {
    setDraft((current) => {
      if (current.facilityKey || !selectedFacility?.facility_key) return current;
      return { ...current, facilityKey: selectedFacility.facility_key };
    });
  }, [selectedFacility]);

  function submit(event) {
    event.preventDefault();
    if (!lead || (!draft.subject.trim() && !draft.body.trim())) return;
    setCommunications((current) => [...current, {
      id: `comm-${Date.now()}`,
      leadId: lead.id,
      facilityKey: draft.facilityKey,
      direction: draft.direction,
      channel: draft.channel,
      date: new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }),
      subject: draft.subject.trim() || "Communication logged",
      body: draft.body.trim() || "No additional notes."
    }]);
    setDraft({ ...draft, subject: "", body: "" });
  }

  return (
    <>
      <div className="result-summary"><strong><MessageSquare size={16} /> Communications</strong><span id="communicationContext">{lead ? `${lead.name} · ${items.length} logged` : "selected lead"}</span></div>
      <form className="communication-form" id="communicationForm" onSubmit={submit}>
        <label><span>Channel</span><select id="communicationChannel" value={draft.channel} onChange={(event) => setDraft({ ...draft, channel: event.target.value })}><option>Email</option><option>Phone</option><option>Text</option><option>Note</option></select></label>
        <label><span>Direction</span><select id="communicationDirection" value={draft.direction} onChange={(event) => setDraft({ ...draft, direction: event.target.value })}><option>Outbound</option><option>Inbound</option><option>Internal</option></select></label>
        <label className="wide-field"><span>Regarding</span><select id="communicationFacilityKey" value={draft.facilityKey} onChange={(event) => setDraft({ ...draft, facilityKey: event.target.value })}>
          <option value="">Prospect only</option>
          {communicationFacilities.map((facility) => <option key={facility.facility_key} value={facility.facility_key}>{facility.facility_name}</option>)}
        </select></label>
        <label className="wide-field"><span>Subject</span><input id="communicationSubject" value={draft.subject} placeholder="Short summary" onChange={(event) => setDraft({ ...draft, subject: event.target.value })} /></label>
        <label className="wide-field"><span>Note</span><textarea id="communicationBody" value={draft.body} placeholder="Call notes, email summary, facility response" onChange={(event) => setDraft({ ...draft, body: event.target.value })} /></label>
        <button type="submit">Log communication</button>
      </form>
      <div className="communication-list" id="communicationList">
        {items.map((item) => (
          <article className="communication-item" key={item.id}>
            <strong>{item.subject}</strong>
            <div className="communication-meta">{item.date} · {item.direction} {item.channel} · {facilityLookup.get(item.facilityKey)?.facility_name || "Prospect only"}</div>
            <p>{item.body}</p>
          </article>
        ))}
      </div>
    </>
  );
}

function PeopleNetwork({ people, relationships, setPeople, setRelationships }) {
  const [selectedPersonId, setSelectedPersonId] = useState(people[0]?.id || "");
  const [personTrail, setPersonTrail] = useState([]);
  const [hoveredPersonId, setHoveredPersonId] = useState("");
  const [filters, setFilters] = useState({ levels: "2", radiusMiles: "", ageYears: "", types: [] });
  const [newRelationship, setNewRelationship] = useState({ targetId: "", type: "Family", label: "" });
  const selectedPerson = people.find((person) => person.id === selectedPersonId) || people[0];
  const hoveredPerson = people.find((person) => person.id === hoveredPersonId);
  const graph = useMemo(() => relationshipGraph(people, relationships, selectedPerson?.id, filters), [filters, people, relationships, selectedPerson?.id]);
  const visibleIds = new Set(graph.nodes.map((person) => person.id));
  const selectedEdges = relatedEdgesForPerson(relationships, selectedPerson?.id);
  const visibleRelationshipRows = selectedEdges
    .map((relationship) => {
      const otherId = relationship.from === selectedPerson?.id ? relationship.to : relationship.from;
      const person = people.find((item) => item.id === otherId);
      return person ? { ...relationship, person } : null;
    })
    .filter(Boolean);
  const selectPerson = (personId) => {
    if (!personId || personId === selectedPerson?.id) return;
    setPersonTrail((current) => [...current.slice(-5), selectedPerson?.id].filter(Boolean));
    setSelectedPersonId(personId);
  };
  const goBackPerson = () => {
    setPersonTrail((current) => {
      const next = [...current];
      const previous = next.pop();
      if (previous) setSelectedPersonId(previous);
      return next;
    });
  };
  const updatePerson = (patch) => {
    if (!selectedPerson) return;
    setPeople((current) => current.map((person) => person.id === selectedPerson.id ? { ...person, ...patch } : person));
  };
  const addPerson = () => {
    const person = createPerson();
    setPeople((current) => [person, ...current]);
    selectPerson(person.id);
  };
  const addRelationship = () => {
    if (!selectedPerson || !newRelationship.targetId || selectedPerson.id === newRelationship.targetId) return;
    setRelationships((current) => [...current, {
      id: `rel-${Date.now()}`,
      from: selectedPerson.id,
      to: newRelationship.targetId,
      type: newRelationship.type,
      label: newRelationship.label.trim() || newRelationship.type,
      strength: "Manual"
    }]);
    setNewRelationship({ targetId: "", type: "Family", label: "" });
  };
  const toggleType = (type) => {
    setFilters((current) => ({
      ...current,
      types: current.types.includes(type) ? current.types.filter((item) => item !== type) : [...current.types, type]
    }));
  };

  return (
    <section className="people-network-panel" id="peopleNetworkPanel" aria-label="People relationship network">
      <div className="people-network-header">
        <div>
          <p className="eyebrow">People directory</p>
          <h2>Relationship Map</h2>
        </div>
        <button type="button" id="addPersonButton" onClick={addPerson}><UserPlus size={16} /> Add person</button>
      </div>
      <div className="people-network-layout">
        <aside className="people-directory" aria-label="People directory list">
          <label>
            <span>Selected person</span>
            <select id="selectedPersonFilter" value={selectedPerson?.id || ""} onChange={(event) => setSelectedPersonId(event.target.value)}>
              {people.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.type}</option>)}
            </select>
          </label>
          <div className="people-list" id="peopleList">
            {people.map((person) => (
              <button type="button" key={person.id} className={`person-list-item${person.id === selectedPerson?.id ? " is-selected" : ""}${visibleIds.has(person.id) ? " is-visible" : ""}`} onClick={() => selectPerson(person.id)}>
                <span className="person-dot" style={{ background: PERSON_TYPE_COLORS[person.type] || "#667085" }} />
                <strong>{person.name}</strong>
                <span>{person.type} · {personLocation(person)}</span>
              </button>
            ))}
          </div>
        </aside>
        <section className="relationship-workspace">
          <div className="relationship-filters" aria-label="Relationship graph filters">
            <label><span>Levels away</span><select id="relationshipLevelsFilter" value={filters.levels} onChange={(event) => setFilters({ ...filters, levels: event.target.value })}><option value="1">1 level</option><option value="2">2 levels</option><option value="3">3 levels</option></select></label>
            <label><span>Miles</span><input id="relationshipMilesFilter" type="number" min="1" placeholder="Any" value={filters.radiusMiles} onChange={(event) => setFilters({ ...filters, radiusMiles: event.target.value })} /></label>
            <label><span>Years</span><input id="relationshipYearsFilter" type="number" min="1" placeholder="Any" value={filters.ageYears} onChange={(event) => setFilters({ ...filters, ageYears: event.target.value })} /></label>
            <button type="button" onClick={() => setFilters({ levels: "2", radiusMiles: "", ageYears: "", types: [] })}>Reset graph</button>
          </div>
          <div className="relationship-type-filters" aria-label="Relationship type filters">
            {["Family", "Friend", "Doctor", "Advisor", "Facility contact"].map((type) => (
              <button key={type} type="button" className={filters.types.includes(type) ? "is-active" : ""} onClick={() => toggleType(type)}>
                <span className="person-dot" style={{ background: PERSON_TYPE_COLORS[type] || "#667085" }} /> {type}
              </button>
            ))}
          </div>
          <div className="relationship-nav" id="relationshipBreadcrumbs" aria-label="Relationship navigation">
            <button type="button" id="relationshipBackButton" onClick={goBackPerson} disabled={!personTrail.length}><ArrowLeft size={15} /> Back</button>
            <div className="relationship-crumbs">
              {personTrail.slice(-4).map((personId) => {
                const person = people.find((item) => item.id === personId);
                return person ? <button type="button" key={personId} onClick={() => selectPerson(personId)}>{person.name}</button> : null;
              })}
              {selectedPerson && <strong>{selectedPerson.name}</strong>}
            </div>
          </div>
          <div className="relationship-graph" id="relationshipGraph">
            <svg className="relationship-lines" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">
              {graph.edges.map((edge) => {
                const from = graph.nodes.find((person) => person.id === edge.from);
                const to = graph.nodes.find((person) => person.id === edge.to);
                if (!from || !to) return null;
                return <line key={edge.id || `${edge.from}-${edge.to}`} x1={from.graph_x} y1={from.graph_y} x2={to.graph_x} y2={to.graph_y} />;
              })}
            </svg>
            {graph.nodes.map((person) => {
              const size = person.level === 0 ? 118 : Math.max(78, 108 - person.level * 10);
              const style = {
                "--bubble-color": PERSON_TYPE_COLORS[person.type] || "#667085",
                width: `${size}px`,
                height: `${size}px`,
                left: `${person.graph_x}%`,
                top: `${person.graph_y}%`,
                transform: "translate(-50%, -50%)"
              };
              return (
                <button
                  key={person.id}
                  type="button"
                  className={`person-bubble level-${person.level}${person.id === selectedPerson?.id ? " is-selected" : ""}`}
                  style={style}
                  onClick={() => selectPerson(person.id)}
                  onMouseEnter={() => setHoveredPersonId(person.id)}
                  onMouseLeave={() => setHoveredPersonId("")}
                  onFocus={() => setHoveredPersonId(person.id)}
                  onBlur={() => setHoveredPersonId("")}
                >
                  <strong>{person.name}</strong>
                  <span>{person.type}</span>
                  <small>{person.level === 0 ? "selected" : `${person.level} away`}{person.miles_from_selected != null && person.level > 0 ? ` · ${person.miles_from_selected} mi` : ""}</small>
                </button>
              );
            })}
          </div>
          <div className="relationship-hover-panel" id="relationshipHoverPanel">
            {hoveredPerson ? (
              <>
                <strong>{hoveredPerson.name}</strong>
                <span>{hoveredPerson.type} · {clean(hoveredPerson.age, "Age not listed")} years · {personLocation(hoveredPerson)}</span>
                <span>{relationshipLabelForPerson(relationships, selectedPerson?.id, hoveredPerson.id) || clean(hoveredPerson.notes, "No relationship note")}</span>
              </>
            ) : (
              <>
                <strong>{selectedPerson?.name || "Select a person"}</strong>
                <span>{graph.nodes.length} people shown · {graph.edges.length} relationships visible</span>
                <span>Hover a bubble for quick details; click a bubble to make it the graph center.</span>
              </>
            )}
          </div>
          <div className="people-detail-grid">
            <article className="selected-person-card" id="selectedPersonCard">
              <div className="selected-person-card-header">
                <span className="person-dot" style={{ background: PERSON_TYPE_COLORS[selectedPerson?.type] || "#667085" }} />
                <div>
                  <h3>{selectedPerson?.name || "No person selected"}</h3>
                  <p>{selectedPerson?.type} · {clean(selectedPerson?.age, "Age not listed")} years · {personLocation(selectedPerson || {})}</p>
                </div>
              </div>
              <dl>
                <dt>Phone</dt><dd>{clean(selectedPerson?.phone)}</dd>
                <dt>Email</dt><dd>{clean(selectedPerson?.email)}</dd>
                <dt>Relationships</dt><dd>{visibleRelationshipRows.length}</dd>
                <dt>Notes</dt><dd>{clean(selectedPerson?.notes)}</dd>
              </dl>
              <div className="selected-relationship-list" id="selectedRelationshipList">
                {visibleRelationshipRows.map((relationship) => (
                  <button type="button" key={relationship.id} onClick={() => selectPerson(relationship.person.id)}>
                    <strong>{relationship.person.name}</strong>
                    <span>{relationship.label} · {relationship.type}</span>
                  </button>
                ))}
              </div>
            </article>
            <form className="person-form" onSubmit={(event) => event.preventDefault()}>
              <h3>Person</h3>
              <label><span>Name</span><input id="personNameInput" value={selectedPerson?.name || ""} onChange={(event) => updatePerson({ name: event.target.value })} /></label>
              <label><span>Type</span><select id="personTypeInput" value={selectedPerson?.type || "Family"} onChange={(event) => updatePerson({ type: event.target.value })}>{PERSON_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label><span>Age</span><input id="personAgeInput" type="number" value={selectedPerson?.age || ""} onChange={(event) => updatePerson({ age: event.target.value })} /></label>
              <label><span>Phone</span><input type="tel" value={selectedPerson?.phone || ""} onChange={(event) => updatePerson({ phone: event.target.value })} /></label>
              <label><span>Email</span><input type="email" value={selectedPerson?.email || ""} onChange={(event) => updatePerson({ email: event.target.value })} /></label>
              <label><span>ZIP</span><input value={selectedPerson?.zip || ""} onChange={(event) => updatePerson({ zip: event.target.value })} /></label>
              <label className="wide-field"><span>Notes</span><textarea value={selectedPerson?.notes || ""} onChange={(event) => updatePerson({ notes: event.target.value })} /></label>
            </form>
            <form className="relationship-form" onSubmit={(event) => { event.preventDefault(); addRelationship(); }}>
              <h3>Link relationship</h3>
              <label><span>Related person</span><select id="relationshipTargetInput" value={newRelationship.targetId} onChange={(event) => setNewRelationship({ ...newRelationship, targetId: event.target.value })}>
                <option value="">Choose person</option>
                {people.filter((person) => person.id !== selectedPerson?.id).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select></label>
              <label><span>Relationship type</span><select id="relationshipTypeInput" value={newRelationship.type} onChange={(event) => setNewRelationship({ ...newRelationship, type: event.target.value })}>
                {["Family", "Friend", "Doctor", "Advisor", "Facility contact"].map((type) => <option key={type}>{type}</option>)}
              </select></label>
              <label><span>Label</span><input id="relationshipLabelInput" placeholder="Daughter, physician, neighbor" value={newRelationship.label} onChange={(event) => setNewRelationship({ ...newRelationship, label: event.target.value })} /></label>
              <button type="submit" id="addRelationshipButton">Add relationship</button>
              <div className="relationship-summary" id="relationshipSummary">
                {graph.edges.length} visible relationships · {graph.nodes.length} visible people
              </div>
            </form>
          </div>
        </section>
      </div>
    </section>
  );
}

function CrmView({ facilities, selectedFacilityKey }) {
  const [crmState, setCrmState] = useState(() => readStored(CRM_STATE_KEY, defaultCrmState()));
  const [crmSaveStatus, setCrmSaveStatus] = useState("Loading CRM database");
  const [linkedFacilities, setLinkedFacilities] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState(crmState.leads[0]?.id || "");
  const [leadFilters, setLeadFilters] = useState({ query: "", status: "" });
  const crmWriteEnabledRef = useRef(false);
  const skipNextCrmSaveRef = useRef(false);
  const people = crmState.people?.length ? crmState.people : SAMPLE_PEOPLE;
  const relationships = crmState.relationships?.length ? crmState.relationships : SAMPLE_RELATIONSHIPS;
  const crmFacilities = useMemo(() => mergeFacilities(facilities, linkedFacilities), [facilities, linkedFacilities]);
  const lead = crmState.leads.find((item) => item.id === selectedLeadId) || crmState.leads[0];
  const selectedFacility = crmFacilities.find((facility) => facility.facility_key === selectedFacilityKey);
  const setLeads = (updater) => setCrmState((current) => ({ ...current, leads: typeof updater === "function" ? updater(current.leads) : updater }));
  const setCommunications = (updater) => setCrmState((current) => ({ ...current, communications: typeof updater === "function" ? updater(current.communications) : updater }));
  const setPeople = (updater) => setCrmState((current) => ({ ...current, people: typeof updater === "function" ? updater(current.people?.length ? current.people : SAMPLE_PEOPLE) : updater }));
  const setRelationships = (updater) => setCrmState((current) => ({ ...current, relationships: typeof updater === "function" ? updater(current.relationships?.length ? current.relationships : SAMPLE_RELATIONSHIPS) : updater }));
  const filteredLeads = useMemo(() => {
    const query = leadFilters.query.trim().toLowerCase();
    return crmState.leads.filter((item) => {
      const searchText = [item.name, item.relationship, item.phone, item.email, item.preferredArea, item.careNeeds, item.nextStep, item.assignedTo].join(" ").toLowerCase();
      return (!leadFilters.status || item.status === leadFilters.status) && (!query || searchText.includes(query));
    });
  }, [crmState.leads, leadFilters]);
  const addLead = () => {
    const leadToAdd = createLead();
    setCrmState((current) => ({ ...current, leads: [leadToAdd, ...current.leads] }));
    setSelectedLeadId(leadToAdd.id);
  };

  useEffect(() => {
    let ignore = false;
    fetch("/api/crm/state")
      .then((response) => {
        if (!response.ok) throw new Error(`CRM database load failed: ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (ignore) return;
        const nextState = {
          leads: payload.leads?.length ? payload.leads : structuredClone(SAMPLE_LEADS),
          communications: payload.communications?.length ? payload.communications : structuredClone(SAMPLE_COMMUNICATIONS),
          people: payload.people?.length ? payload.people : structuredClone(SAMPLE_PEOPLE),
          relationships: payload.relationships?.length ? payload.relationships : structuredClone(SAMPLE_RELATIONSHIPS)
        };
        skipNextCrmSaveRef.current = true;
        crmWriteEnabledRef.current = true;
        setCrmState(nextState);
        setSelectedLeadId((current) => nextState.leads.some((item) => item.id === current) ? current : nextState.leads[0]?.id || "");
        localStorage.setItem(CRM_STATE_KEY, JSON.stringify(nextState));
        setCrmSaveStatus(`Loaded from Postgres · ${formatNumber(nextState.leads.length)} leads`);
      })
      .catch((error) => {
        if (!ignore) {
          crmWriteEnabledRef.current = false;
          setCrmSaveStatus(`${error.message}; using browser draft`);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(CRM_STATE_KEY, JSON.stringify(crmState));
    if (!crmWriteEnabledRef.current) return undefined;
    if (skipNextCrmSaveRef.current) {
      skipNextCrmSaveRef.current = false;
      return undefined;
    }

    setCrmSaveStatus("Saving CRM changes");
    const timer = window.setTimeout(() => {
      fetch("/api/crm/state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(crmState)
      })
        .then((response) => {
          if (!response.ok) throw new Error(`CRM database save failed: ${response.status}`);
          return response.json();
        })
        .then(() => setCrmSaveStatus("Saved to Postgres"))
        .catch((error) => setCrmSaveStatus(`${error.message}; browser draft retained`));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [crmState]);

  useEffect(() => {
    const keys = [...new Set(crmState.leads.flatMap((item) => item.linkedFacilities || []))]
      .filter((key) => !facilities.some((facility) => facility.facility_key === key));
    if (!keys.length) {
      setLinkedFacilities([]);
      return;
    }
    let ignore = false;
    fetch(`${FACILITY_API_URL}?pageSize=${keys.length}&keys=${encodeURIComponent(keys.join(","))}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Linked facility lookup failed: ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (!ignore) setLinkedFacilities(payload.records || []);
      })
      .catch(() => {
        if (!ignore) setLinkedFacilities([]);
      });
    return () => {
      ignore = true;
    };
  }, [crmState.leads, facilities]);

  return (
    <main className="crm-workspace" id="crmView">
      <section className="crm-header" aria-label="CRM summary">
        <div className="crm-title-row">
          <div><p className="eyebrow">Lead operations</p><h2>Placement Pipeline</h2></div>
          <div className="crm-title-actions">
            <span className="crm-save-status" id="crmSaveStatus">{crmSaveStatus}</span>
            <button type="button" id="addLeadButton" onClick={addLead}><UserPlus size={16} /> New lead</button>
          </div>
        </div>
        <div className="crm-metrics">
          <div><strong id="leadCount">{formatNumber(crmState.leads.filter((item) => !["Placed", "Closed"].includes(item.status)).length)}</strong><span>Active</span></div>
          <div><strong id="touringCount">{formatNumber(crmState.leads.filter((item) => item.status === "Touring").length)}</strong><span>Touring</span></div>
          <div><strong id="applicationCount">{formatNumber(crmState.leads.filter((item) => item.status === "Application").length)}</strong><span>Applications</span></div>
          <div><strong id="linkedCount">{formatNumber(crmState.leads.reduce((sum, item) => sum + (item.linkedFacilities?.length || 0), 0))}</strong><span>Facility links</span></div>
        </div>
      </section>
      <section className="crm-toolbar" aria-label="CRM filters">
        <label>
          <span>Find lead</span>
          <div className="input-with-icon">
            <Search size={16} />
            <input id="leadSearchInput" type="search" placeholder="Resident, family, area, need" value={leadFilters.query} onChange={(event) => setLeadFilters({ ...leadFilters, query: event.target.value })} />
          </div>
        </label>
        <label>
          <span>Status</span>
          <select id="leadStatusFilter" value={leadFilters.status} onChange={(event) => setLeadFilters({ ...leadFilters, status: event.target.value })}>
            <option value="">All stages</option>
            {PIPELINE_STAGES.map((stage) => <option key={stage}>{stage}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => setLeadFilters({ query: "", status: "" })}>Reset</button>
        <span id="leadFilterCount">{formatNumber(filteredLeads.length)} shown</span>
      </section>
      <Pipeline leads={filteredLeads} selectedLeadId={lead?.id} setSelectedLeadId={setSelectedLeadId} />
      <section className="lead-panel" aria-label="Lead detail"><LeadDetail lead={lead} setLeads={setLeads} facilities={crmFacilities} selectedFacility={selectedFacility} /></section>
      <section className="communications-panel" aria-label="Communication history">
        <Scanner lead={lead} selectedFacilityKey={selectedFacilityKey} setLeads={setLeads} setCommunications={setCommunications} />
        <Communications lead={lead} selectedFacility={selectedFacility} facilities={crmFacilities} communications={crmState.communications} setCommunications={setCommunications} />
      </section>
      <PeopleNetwork people={people} relationships={relationships} setPeople={setPeople} setRelationships={setRelationships} />
    </main>
  );
}

function AdvisorsView() {
  const [summary, setSummary] = useState(null);
  const [payload, setPayload] = useState({ records: [], states: [], industries: [], total_matching: 0, limit: 80 });
  const [filters, setFilters] = useState({ q: "", source: "", state: "", industry: "" });
  const [status, setStatus] = useState("Loading advisor data");
  const update = (patch) => setFilters((current) => ({ ...current, ...patch }));

  useEffect(() => {
    let ignore = false;
    fetch("/api/advisors/summary")
      .then((response) => {
        if (!response.ok) throw new Error(`Advisor summary failed: ${response.status}`);
        return response.json();
      })
      .then((nextSummary) => {
        if (!ignore) setSummary(nextSummary);
      })
      .catch((error) => {
        if (!ignore) setStatus(error.message);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    const params = new URLSearchParams({ limit: "80" });
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    setStatus("Loading advisor data");
    fetch(`/api/advisors/search?${params.toString()}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Advisor search failed: ${response.status}`);
        return response.json();
      })
      .then((nextPayload) => {
        if (ignore) return;
        setPayload(nextPayload);
        setStatus(`${formatNumber(nextPayload.records.length)} shown from ${formatNumber(nextPayload.total_matching)} matching database records`);
      })
      .catch((error) => {
        if (!ignore) setStatus(error.message);
      });
    return () => {
      ignore = true;
    };
  }, [filters]);

  return (
    <main className="advisors-workspace" id="advisorsView">
      <section className="advisor-summary" aria-label="Advisor data summary">
        <div>
          <p className="eyebrow">Advisor intelligence</p>
          <h2>Advisor Directory</h2>
        </div>
        <div className="crm-metrics">
          <div><strong id="advisorTotalCount">{formatNumber(summary?.total_records || 0)}</strong><span>Total records</span></div>
          <div><strong>{formatNumber(summary?.seniorplace_records || 0)}</strong><span>SeniorPlace</span></div>
          <div><strong>{formatNumber(summary?.csa_locator_records || 0)}</strong><span>CSA Locator</span></div>
          <div><strong>{formatNumber(summary?.matched_records || 0)}</strong><span>Matched CSAs</span></div>
        </div>
      </section>
      <section className="advisor-toolbar" aria-label="Advisor filters">
        <label>
          <span>Find advisor</span>
          <div className="input-with-icon">
            <Search size={16} />
            <input id="advisorSearchInput" type="search" placeholder="Name, agency, industry, services" value={filters.q} onChange={(event) => update({ q: event.target.value })} />
          </div>
        </label>
        <label>
          <span>Source</span>
          <select id="advisorSourceFilter" value={filters.source} onChange={(event) => update({ source: event.target.value })}>
            <option value="">All</option>
            <option value="seniorplace-advisor-directory">SeniorPlace</option>
            <option value="society-certified-senior-advisors-locator">CSA Locator</option>
          </select>
        </label>
        <label>
          <span>State</span>
          <select id="advisorStateFilter" value={filters.state} onChange={(event) => update({ state: event.target.value })}>
            <option value="">All</option>
            {(payload.states || []).map((state) => <option key={state}>{state}</option>)}
          </select>
        </label>
        <label>
          <span>Industry</span>
          <select id="advisorIndustryFilter" value={filters.industry} onChange={(event) => update({ industry: event.target.value })}>
            <option value="">All</option>
            {(payload.industries || []).map((industry) => <option key={industry}>{industry}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => setFilters({ q: "", source: "", state: "", industry: "" })}>Reset</button>
        <span id="advisorFilterCount">{status}</span>
      </section>
      <section className="advisor-layout" aria-label="Advisor records">
        <div className="advisor-list">
          {payload.records.map((advisor) => {
            const isSeniorPlace = advisor.source_id === "seniorplace-advisor-directory";
            const contactLine = [
              advisor.emails?.[0],
              advisor.phone_numbers?.[0],
              advisor.website_urls?.[0] ? displayWebsite(advisor.website_urls[0]) : ""
            ].filter(Boolean).join(" · ");
            return (
              <article className="advisor-row" key={advisor.advisor_record_key}>
                <div>
                  <div className="advisor-row-header">
                    <h3>{advisor.name}</h3>
                    <span className={isSeniorPlace ? "source-pill source-seniorplace" : "source-pill source-csa"}>{isSeniorPlace ? "SeniorPlace" : "CSA"}</span>
                    {advisor.match_count > 0 ? <span className="source-pill source-match">{advisor.match_count} match{advisor.match_count === 1 ? "" : "es"}</span> : null}
                  </div>
                  <p>{advisor.agency || advisor.main_industry || "No agency listed"}</p>
                  <p className="advisor-meta">{advisor.location || advisor.locations?.join("; ") || "No location listed"}</p>
                  {contactLine ? <p className="advisor-meta">{contactLine}</p> : null}
                  {advisor.certified_since ? <p className="advisor-meta">Certified since {advisor.certified_since}</p> : null}
                  {advisor.summary ? <p className="advisor-summary-text">{advisor.summary}</p> : null}
                </div>
                <div className="advisor-actions">
                  {advisor.detail_url ? <a href={advisor.detail_url} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Profile</a> : null}
                  {advisor.website_urls?.[0] ? <a href={advisor.website_urls[0]} target="_blank" rel="noreferrer"><Globe size={15} /> Site</a> : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [view, setView] = useState("directory");
  const [records, setRecords] = useState([]);
  const [searchMeta, setSearchMeta] = useState(defaultFacilitySearchMeta());
  const [searchPage, setSearchPage] = useState(1);
  const [dataStatus, setDataStatus] = useState("Loading database");
  const [selectedKey, setSelectedKey] = useState("");
  const [filters, setFilters] = useState({
    query: "",
    category: "",
    state: "",
    care: "",
    zip: "",
    capacity: "",
    minBeds: "",
    maxBeds: "",
    distanceAddress: "",
    distanceMiles: "",
    distanceCenter: null,
    pinLimit: String(DEFAULT_PIN_LIMIT),
    visibility: "visible",
    costMin: "",
    costMax: "",
    sort: "location"
  });
  const [preferences, setPreferences] = usePersistentState(PREFERENCES_KEY, defaultPreferences());
  const [preferenceStatus, setPreferenceStatus] = useState("Loading preferences");

  const serverFilterSignature = facilityFilterSignature(filters);

  useEffect(() => {
    setSearchPage(1);
  }, [serverFilterSignature]);

  useEffect(() => {
    let ignore = false;
    setDataStatus("Loading database");
    fetch(facilitySearchUrl(filters, searchPage))
      .then((response) => {
        if (!response.ok) throw new Error(`Facility database load failed: ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (ignore) return;
        const nextRecords = payload.records || [];
        setRecords(nextRecords);
        setSearchMeta({
          total_matching: payload.total_matching || 0,
          total_active: payload.total_active || 0,
          page: payload.page || searchPage,
          page_size: payload.page_size || FACILITY_PAGE_SIZE,
          has_more: Boolean(payload.has_more),
          states: payload.states || [],
          care_options: payload.care_options || [],
          categories: payload.categories || []
        });
        setSelectedKey(nextRecords[0]?.facility_key || "");
        setDataStatus(`Postgres source · ${formatNumber(payload.total_matching || nextRecords.length)} matching · page ${payload.page || searchPage}`);
      })
      .catch((error) => {
        console.error(error);
        setDataStatus("Loading fallback file");
        fetch(DATA_URL)
          .then((response) => {
            if (!response.ok) throw new Error(`Failed to load facility data: ${response.status}`);
            return response.json();
          })
          .then((payload) => {
            if (ignore) return;
            setRecords(payload.records);
            setSearchMeta({
              ...defaultFacilitySearchMeta(),
              total_matching: payload.records.length,
              total_active: payload.records.length,
              page: 1,
              page_size: payload.records.length,
              states: optionValues(payload.records, "state"),
              care_options: optionValues(payload.records, "program_type"),
              categories: optionValues(payload.records, "care_category")
            });
            setSelectedKey(payload.records[0]?.facility_key || "");
            setDataStatus("fallback file");
          })
          .catch((fallbackError) => {
            console.error(fallbackError);
            if (!ignore) setDataStatus(fallbackError.message);
          });
      });
    return () => {
      ignore = true;
    };
  }, [filters, searchPage]);

  useEffect(() => {
    let ignore = false;
    fetch("/api/facility-preferences")
      .then((response) => {
        if (!response.ok) throw new Error(`Preference load failed: ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (ignore) return;
        setPreferences({
          priority: payload.priority || {},
          excluded: payload.excluded || {},
          favorite: payload.favorite || {},
          notes: payload.notes || {}
        });
        setPreferenceStatus(`Loaded ${formatNumber(payload.records?.length || 0)} saved preferences`);
      })
      .catch((error) => {
        if (!ignore) setPreferenceStatus(`${error.message}; using browser draft`);
      });
    return () => {
      ignore = true;
    };
  }, [setPreferences]);

  return (
    <div className="app-shell">
      <Header view={view} setView={setView} recordCount={records.length} dataStatus={dataStatus} />
      {view === "directory" ? (
        <DirectoryView
          records={records}
          filters={filters}
          setFilters={setFilters}
          searchMeta={searchMeta}
          searchPage={searchPage}
          setSearchPage={setSearchPage}
          preferences={preferences}
          setPreferences={setPreferences}
          preferenceStatus={preferenceStatus}
          setPreferenceStatus={setPreferenceStatus}
          selectedKey={selectedKey}
          setSelectedKey={setSelectedKey}
        />
      ) : view === "crm" ? (
        <CrmView facilities={records} selectedFacilityKey={selectedKey} />
      ) : (
        <AdvisorsView />
      )}
    </div>
  );
}
