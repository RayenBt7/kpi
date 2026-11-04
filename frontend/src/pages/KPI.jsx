/* eslint-disable no-unused-vars */
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api, {
  createOutils,
  fetchAllProcessusSummary,
  fetchDashboardMonthlyConformity,
  fetchMLCopilot,
  fetchMLAnomalies,
  fetchMLBestPredictions,
  fetchMLDashboard,
  fetchMLRiskScores,
  fetchMLSuggestions,
  ollamaEnterpriseChat,
  ollamaPublicChat,
  predictMLRealisation,
  predictMLRiskSuggestion,
  testMLAnomaly,
} from "../services/api";

import ascendTrendImage from "../assets/ascend.png";
import descendTrendImage from "../assets/descend.png";
import stableTrendImage from "../assets/stable.png";
import {
  FaSearch,
  FaFilter,
  FaSyncAlt,
  FaEdit,
  FaTrash,
  FaPlus,
  FaSave,
  FaTimes,
  FaCheck,
  FaExclamationTriangle,
  FaArrowRight,
  FaArrowLeft,
  FaUser,
  FaHome,
  FaCog,
  FaBars,
  FaChevronDown,
  FaChevronUp,
  FaPlusCircle,
  FaMinusCircle,
  FaEye,
  FaEyeSlash,
  FaChartLine,
  FaChartBar,
  FaList,
  FaTh,
  FaThLarge,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaCopy,
  FaDownload,
  FaUpload,
  FaPen,
  FaTrashAlt,
  FaWindowClose,
  FaCheckCircle,
  FaExclamationCircle,
  FaInfoCircle,
  FaBullseye,
  FaTasks,
  FaCalendar,
  FaClock,
  FaFlag,
  FaComment,
  FaPlusSquare,
  FaMoon,
  FaSun,
} from "react-icons/fa";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  ComposedChart,
  Bar,
  AreaChart,
  Area,
} from "recharts";

import "../styles/Dashboard.css";
import "../styles/outils-input.css";

const FontAwesomeIcon = ({ icon: Icon }) =>
  Icon ? <Icon aria-hidden="true" focusable="false" /> : null;

const BotIcon = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="white"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    <path d="M4.93 4.93a10 10 0 0 0 0 14.14" />
  </svg>
);

const SendIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="white"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const byPrefixAndName = {
  fa: {
    search: FaSearch,
    filter: FaFilter,
    refresh: FaSyncAlt,
    edit: FaEdit,
    delete: FaTrash,
    add: FaPlus,
    save: FaSave,
    close: FaTimes,
    check: FaCheck,
    warning: FaExclamationTriangle,
    arrowRight: FaArrowRight,
    arrowLeft: FaArrowLeft,
    user: FaUser,
    home: FaHome,
    settings: FaCog,
    bars: FaBars,
    chevronDown: FaChevronDown,
    chevronUp: FaChevronUp,
    plusCircle: FaPlusCircle,
    minusCircle: FaMinusCircle,
    eye: FaEye,
    eyeSlash: FaEyeSlash,
    chartLine: FaChartLine,
    chartBar: FaChartBar,
    list: FaList,
    grid: FaTh,
    sort: FaSort,
    sortUp: FaSortUp,
    sortDown: FaSortDown,
    copy: FaCopy,
    download: FaDownload,
    upload: FaUpload,
    pen: FaPen,
    trashAlt: FaTrashAlt,
    windowClose: FaWindowClose,
    checkCircle: FaCheckCircle,
    exclamationCircle: FaExclamationCircle,
    infoCircle: FaInfoCircle,
    bullseye: FaBullseye,
    tasks: FaTasks,
    calendar: FaCalendar,
    clock: FaClock,
    flag: FaFlag,
    comment: FaComment,
    plusSquare: FaPlusSquare,
    moon: FaMoon,
    sun: FaSun,
  },
};
const getMonthlyData = (row) => {
  const months = [
    "janv",
    "fev",
    "mars",
    "avril",
    "mai",
    "juin",
    "juil",
    "aout",
    "sept",
    "oct",
    "nov",
    "decem",
  ];
  return months.map((month) => ({
    month: MONTH_COLUMNS.find((entry) => entry.key === month)?.label || month,
    objectif: toFiniteNumber(row?.[`objective_${month}`]),
    realise: toFiniteNumber(row?.[`realise_${month}`]),
  }));
};

const getChartYDomain = (
  chartData,
  dataKeys,
  { baselineZero = false, paddingRatio = 0.12 } = {},
) => {
  const values = (Array.isArray(chartData) ? chartData : [])
    .flatMap((entry) => dataKeys.map((key) => toFiniteNumber(entry?.[key])))
    .filter((value) => value !== null);

  if (values.length === 0) {
    return ["auto", "auto"];
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const reference = Math.max(Math.abs(rawMin), Math.abs(rawMax), 1);
  const span = rawMax - rawMin;
  const padding = span > 0 ? span * paddingRatio : reference * paddingRatio;

  if (baselineZero) {
    const upperBound = rawMax + padding;
    return [Math.min(0, rawMin), Number(upperBound.toFixed(2))];
  }

  const lowerBound = rawMin - padding;
  const upperBound = rawMax + padding;
  return [Number(lowerBound.toFixed(2)), Number(upperBound.toFixed(2))];
};

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().toLocaleString("fr-FR", {
  month: "long",
});
const YEARS_TO_SHOW = 15; // Show 15 years of data
const PLAN_IMPLEMENTATION_DEFAULT = "missing";
const DEFAULT_PROCESSUS_CATEGORY = "C";
const PROCESSUS_CATEGORY_FALLBACK = "AUTRES";
const PROCESSUS_CATEGORY_OPTIONS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
];
const USER_TYPE_OPTIONS = ["user", "responsable", "pilote"];
const USER_TYPE_LABELS = {
  user: "User",
  responsable: "Responsable",
  pilote: "Pilote",
};
const CATEGORY_LABELS = {
  C010: "Logistique",
  C020: "Planification des processus ",
  C030: "Production ",
  C040: "Embalage et Expedition ",
  M010: "Managment de la direction",
  M020: "Management integré IMS  ",
  M030: "Management des ressources humaines et Formation",
  S010: "Maintenance",
  S020: "Assurance qualité",
  S030: "Achat",
  S040: "IT",
};
const SIGN_OPTIONS = ["\u2265", "\u2264", ">", "<", "=", "\u2260"];
const UNIT_OPTIONS = [
  "%",
  "\u20ac",
  "$",
  "kg",
  "t",
  "ppm",
  "h",
  "min",
  "m\u00b2",
  "m\u00b3",
];
const INDICATOR_CODE_SUFFIX_LENGTH = 10;

const parseProcessusEntry = (value) => {
  const raw = String(value ?? "").trim();
  const match = raw.match(
    /^([A-Za-z]{1,4})\s*(\d{1,4})(?:\s*[-+:/_]\s*|\s+)?(.*)$/,
  );

  if (!match) {
    return {
      raw,
      category: PROCESSUS_CATEGORY_FALLBACK,
      code: "",
      number: null,
      numberDigits: 3,
      name: raw,
      label: raw,
      hasStructuredCode: false,
    };
  }

  const [, prefixRaw, digitsRaw, restRaw] = match;
  const prefix = String(prefixRaw).toUpperCase();
  const category = prefix.charAt(0) || PROCESSUS_CATEGORY_FALLBACK;
  const parsedNumber = Number.parseInt(digitsRaw, 10);
  const numberDigits = Math.max(3, digitsRaw.length);
  const number = Number.isFinite(parsedNumber) ? parsedNumber : null;
  const paddedDigits =
    number === null ? digitsRaw : String(number).padStart(numberDigits, "0");
  const code = `${prefix}${paddedDigits}`;
  const name = String(restRaw ?? "").trim();
  const label = name ? `${code} ${name}` : code;

  return {
    raw,
    category,
    code,
    number,
    numberDigits,
    name,
    label,
    hasStructuredCode: true,
  };
};
const EMPTY_SUMMARY = {
  anomalies_count: 0,
  high_risk_count: 0,
  critical_suggestions: 0,
};

const formatProcessusCode = (category, number, numberDigits = 3) => {
  const safeCategory = String(category ?? "")
    .trim()
    .toUpperCase();
  if (!safeCategory) {
    return "";
  }

  const parsedNumber = Number.parseInt(String(number ?? ""), 10);
  if (!Number.isFinite(parsedNumber) || parsedNumber <= 0) {
    return safeCategory;
  }

  const requestedDigits = Number.parseInt(String(numberDigits), 10);
  const safeDigits = Math.max(
    3,
    String(parsedNumber).length,
    Number.isFinite(requestedDigits) ? requestedDigits : 3,
  );
  return `${safeCategory}${String(parsedNumber).padStart(safeDigits, "0")}`;
};

const toStorageProcessusPrefix = (value) => {
  const cleaned = normalizeIndicatorPrefix(value);
  if (!cleaned) {
    return "";
  }

  const match = cleaned.match(/^([A-Z]{1,4})(\d{1,6})$/);
  if (!match) {
    return cleaned.toLowerCase();
  }

  const [, letters, digits] = match;
  const parsedNumber = Number.parseInt(digits, 10);
  if (!Number.isFinite(parsedNumber) || parsedNumber <= 0) {
    return letters.toLowerCase();
  }

  return `${letters.toLowerCase()}${parsedNumber}`;
};

const compareProcessusEntries = (left, right) => {
  if (left.category !== right.category) {
    if (left.category === PROCESSUS_CATEGORY_FALLBACK) return 1;
    if (right.category === PROCESSUS_CATEGORY_FALLBACK) return -1;
    return left.category.localeCompare(right.category, "fr");
  }

  if (
    left.hasStructuredCode &&
    right.hasStructuredCode &&
    left.number !== right.number
  ) {
    return Number(left.number ?? 0) - Number(right.number ?? 0);
  }

  if (left.hasStructuredCode !== right.hasStructuredCode) {
    return left.hasStructuredCode ? -1 : 1;
  }

  return left.label.localeCompare(right.label, "fr");
};

const MONTH_COLUMNS = [
  { key: "janv", label: "Janv" },
  { key: "fev", label: "Fev" },
  { key: "mars", label: "Mars" },
  { key: "avril", label: "Avril" },
  { key: "mai", label: "Mai" },
  { key: "juin", label: "Juin" },
  { key: "juil", label: "Juil" },
  { key: "aout", label: "Aout" },
  { key: "sept", label: "Sept" },
  { key: "oct", label: "Oct" },
  { key: "nov", label: "Nov" },
  { key: "decem", label: "Decem" },
];

const MONTH_INDEX_BY_KEY = MONTH_COLUMNS.reduce((acc, month, index) => {
  acc[month.key] = index + 1;
  return acc;
}, {});

const KPI_ROUTE_BASE = "/dashboard";
const KPI_PROCESSUS_ROUTE_BASE = `${KPI_ROUTE_BASE}/processus`;
const KPI_PLAN_ACTION_ROUTE = `${KPI_ROUTE_BASE}/plan-action`;
const KPI_GENERAL_MONTHLY_ROUTE = `${KPI_ROUTE_BASE}/generale/mensuelle`;
const KPI_GENERAL_ANNUAL_ROUTE = `${KPI_ROUTE_BASE}/generale/annuelle`;

const trimTrailingSlashes = (value) =>
  String(value ?? "").replace(/\/+$/, "") || KPI_ROUTE_BASE;

const buildProcessusRoute = (processus) => {
  const safeProcessus = String(processus ?? "").trim();
  return safeProcessus
    ? `${KPI_PROCESSUS_ROUTE_BASE}/${encodeURIComponent(safeProcessus)}`
    : KPI_PROCESSUS_ROUTE_BASE;
};

const parseKpiRoute = (pathname) => {
  const normalizedPath = trimTrailingSlashes(pathname);
  const routeWithoutQuery = normalizedPath.split("?")[0];
  const segments = routeWithoutQuery.split("/").filter(Boolean);

  if (segments[0] !== "dashboard") {
    return { view: "dashboard", processus: "" };
  }

  if (segments.length === 1 || segments[1] === "overview") {
    return { view: "dashboard", processus: "" };
  }

  if (segments[1] === "processus") {
    return {
      view: "kpi",
      processus: segments[2] ? decodeURIComponent(segments[2]) : "",
    };
  }

  if (segments[1] === "plan-action") {
    return { view: "plan-action", processus: "" };
  }

  if (segments[1] === "generale" && segments[2] === "annuelle") {
    return { view: "general-annual", processus: "" };
  }

  if (segments[1] === "generale") {
    return { view: "general-monthly", processus: "" };
  }

  return { view: "dashboard", processus: "" };
};

const EMPTY_DASHBOARD_MONTHLY_TOTALS = {
  indicatorCount: 0,
  conformingCount: 0,
  nonConformingCount: 0,
  missingCount: 0,
  conformityRate: null,
};

const getFrenchMonthLabel = (monthValue) => {
  const parsed = Number.parseInt(String(monthValue ?? ""), 10);
  const safeMonthIndex =
    Number.isInteger(parsed) && parsed >= 1 && parsed <= 12
      ? parsed - 1
      : new Date().getMonth();
  const label = new Date(Date.UTC(2024, safeMonthIndex, 1)).toLocaleString(
    "fr-FR",
    {
      month: "long",
      timeZone: "UTC",
    },
  );

  return label.charAt(0).toUpperCase() + label.slice(1);
};

const QUARTER_COLUMNS = [
  { key: "q1", label: "Janv-Fev-Mars", months: ["janv", "fev", "mars"] },
  { key: "q2", label: "Avril-Mai-Juin", months: ["avril", "mai", "juin"] },
  { key: "q3", label: "Juil-Aout-Sept", months: ["juil", "aout", "sept"] },
  { key: "q4", label: "Oct-Nov-Decem", months: ["oct", "nov", "decem"] },
];

const TABLE_PERIOD_OPTIONS = [
  { key: "mensuelle", label: "Mensuelle" },
  { key: "trimestrielle", label: "Trimestrielle" },
  { key: "annuelle", label: "Annuelle" },
];

const toFiniteNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "-") {
      return null;
    }
    const numeric = Number(trimmed.replace(",", "."));
    return Number.isFinite(numeric) ? numeric : null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const averageFiniteNumbers = (values) => {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const finiteValues = values
    .map(toFiniteNumber)
    .filter((value) => value !== null);
  if (finiteValues.length === 0) {
    return null;
  }

  const sum = finiteValues.reduce((acc, value) => acc + value, 0);
  return sum / finiteValues.length;
};

const resolvePeriodColumns = (periodType) => {
  if (periodType === "trimestrielle") {
    return QUARTER_COLUMNS;
  }

  if (periodType === "annuelle") {
    return [
      {
        key: "annual",
        label: "12 mois (Janv-Decem)",
        months: MONTH_COLUMNS.map((month) => month.key),
      },
    ];
  }

  return MONTH_COLUMNS.map((month) => ({
    key: month.key,
    label: month.label,
    months: [month.key],
  }));
};

const getPeriodValue = (row, prefix, column) => {
  const values = column.months
    .map((monthKey) => toFiniteNumber(row?.[`${prefix}_${monthKey}`]))
    .filter((value) => value !== null);

  if (values.length === 0) {
    return null;
  }

  const first = values[0];
  const allEqual = values.every((value) => Math.abs(value - first) < 0.000001);
  if (allEqual) {
    return first;
  }

  return averageFiniteNumbers(values);
};

const computeStdDev = (values) => {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length <= 1) {
    return 0;
  }

  const mean =
    finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
  const variance =
    finiteValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    finiteValues.length;
  return Math.sqrt(variance);
};

const buildRiskSuggestionPayloadFromRow = (row, selectedYear, monthNumber) => {
  if (!row) {
    return null;
  }

  const cappedMonth = Math.min(
    12,
    Math.max(1, Number(monthNumber) || new Date().getMonth() + 1),
  );
  const candidateMonths = MONTH_COLUMNS.slice(0, cappedMonth);
  const selectedMonth =
    [...candidateMonths].reverse().find((month) => {
      const objectif = toFiniteNumber(row?.[`objective_${month.key}`]);
      const realisation = toFiniteNumber(row?.[`realise_${month.key}`]);
      return objectif !== null || realisation !== null;
    }) || MONTH_COLUMNS[cappedMonth - 1];

  const selectedMonthIndex =
    MONTH_INDEX_BY_KEY[selectedMonth.key] || cappedMonth;
  const objectif =
    toFiniteNumber(row?.[`objective_${selectedMonth.key}`]) ??
    toFiniteNumber(row?.objective_moyenne_current);
  const realisation =
    toFiniteNumber(row?.[`realise_${selectedMonth.key}`]) ??
    toFiniteNumber(row?.realise_moyenne_current);
  const realiseHistory = MONTH_COLUMNS.slice(0, selectedMonthIndex)
    .map((month) => toFiniteNumber(row?.[`realise_${month.key}`]))
    .filter((value) => value !== null);
  const previousValues = [...realiseHistory].slice(-4, -1);
  const rollingValues =
    previousValues.length > 0 ? previousValues : realiseHistory;

  return {
    indicator: row.Indicateur,
    year: Number(selectedYear),
    month: selectedMonthIndex,
    features: {
      Indicateur: row.Indicateur,
      Processus: row.Processus,
      Signe: row.Signe,
      Unite: row.Unite,
      Objectif: objectif,
      Realisation: realisation,
      Annee: Number(selectedYear),
      Mois: selectedMonthIndex,
      lag_1: previousValues.at(-1) ?? 0,
      lag_2: previousValues.at(-2) ?? 0,
      lag_3: previousValues.at(-3) ?? 0,
      rolling_mean: averageFiniteNumbers(rollingValues) ?? 0,
      rolling_std: computeStdDev(rollingValues),
      tendance:
        previousValues.length > 0 && realisation !== null
          ? realisation - previousValues.at(-1)
          : 0,
      plan_action_open_count: toFiniteNumber(row.plan_action_open_count) ?? 0,
      plan_action_late_count: toFiniteNumber(row.plan_action_late_count) ?? 0,
    },
  };
};

const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  return Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
};

const getAiRiskTone = (riskLevel) => {
  const normalized = String(riskLevel ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "high") {
    return "high";
  }
  if (normalized === "medium") {
    return "medium";
  }
  if (normalized === "low") {
    return "low";
  }
  return "unknown";
};

const formatTrend = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  const numeric = Number(value);
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${formatNumber(numeric)}%`;
};

const getTrendImage = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null;
  }

  const numeric = Number(value);
  if (numeric > 0) {
    return {
      src: ascendTrendImage,
      alt: "Tendance en hausse",
    };
  }

  if (numeric < 0) {
    return {
      src: descendTrendImage,
      alt: "Tendance en baisse",
    };
  }

  return {
    src: stableTrendImage,
    alt: "Tendance stable",
  };
};

const renderTrendDisplay = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  const trendImage = getTrendImage(value);
  const valueClassName = trendClass(value);

  return (
    <span className="dashboard-trend-display">
      {trendImage ? (
        <span className="dashboard-trend-display-media">
          <img
            src={trendImage.src}
            alt={trendImage.alt}
            className="dashboard-trend-display-image"
          />
          <span className={`dashboard-trend-display-value ${valueClassName}`}>
            {formatTrend(value)}
          </span>
        </span>
      ) : null}
    </span>
  );
};

const formatProgress = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}%`;
};

const progressClass = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "dashboard-progress-pending";
  }

  const numeric = Number(value);
  if (numeric >= 100) return "dashboard-progress-complete";
  if (numeric >= 60) return "dashboard-progress-mid";
  return "dashboard-progress-pending";
};

const hasPlanDetails = (row) => {
  const progressValue = toFiniteNumber(row?.PROGRESS);
  return progressValue !== null && progressValue > 0;
};

const planInfoLabel = (row) =>
  hasPlanDetails(row) ? "Renseigne" : "A completer";

const planInfoClass = (row) =>
  hasPlanDetails(row)
    ? "dashboard-plan-info-ready"
    : "dashboard-plan-info-missing";

const trendClass = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "dashboard-trend-neutral";
  }

  const numeric = Number(value);
  if (numeric > 0) return "dashboard-trend-up";
  if (numeric < 0) return "dashboard-trend-down";
  return "dashboard-trend-neutral";
};

const stripAccents = (value) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const normalizeText = (value) =>
  stripAccents(
    String(value ?? "")
      .toLowerCase()
      .trim(),
  );

const normalizeIndicatorPrefix = (value) =>
  stripAccents(String(value ?? "").toUpperCase()).replace(/[^A-Z0-9]/g, "");

const getProcessusCodePrefixFromRaw = (processusRaw) => {
  const parsed = parseProcessusEntry(processusRaw);
  const structuredCode = normalizeIndicatorPrefix(parsed.code || "");
  if (structuredCode) {
    return structuredCode;
  }

  const firstToken =
    String(processusRaw ?? "")
      .trim()
      .split(/\s+/)[0] || "";
  return normalizeIndicatorPrefix(firstToken);
};

const getDesignationCodeChunk = (designation) => {
  const normalized = stripAccents(String(designation ?? "").toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
  const compact = normalized.replace(/\s+/g, "");
  if (!compact) {
    return "";
  }
  return compact.slice(0, INDICATOR_CODE_SUFFIX_LENGTH);
};

const buildIndicatorCodeBase = (prefix, designation) => {
  const safePrefix = toStorageProcessusPrefix(prefix);
  if (!safePrefix) {
    return "";
  }
  const suffix = getDesignationCodeChunk(designation);
  return suffix ? `${safePrefix}_${suffix}` : safePrefix;
};

const buildUniqueIndicatorCode = (baseCode, usedCodes) => {
  if (!baseCode) {
    return "";
  }

  let candidate = baseCode;
  let suffix = 2;
  while (usedCodes.has(candidate)) {
    candidate = `${baseCode}_${suffix}`;
    suffix += 1;
  }
  usedCodes.add(candidate);
  return candidate;
};

const normalizeUserType = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return USER_TYPE_OPTIONS.includes(normalized) ? normalized : "user";
};

const formatMathSign = (value) => {
  if (!value) {
    return "-";
  }

  const raw = String(value).trim();
  const normalized = stripAccents(raw.toLowerCase()).replace(/\s+/g, " ");
  const normalizedCompact = normalized.replace(/\s+/g, "");
  const MATH_LEQ = "\u2264";
  const MATH_GEQ = "\u2265";
  const MATH_NEQ = "\u2260";

  if (normalizedCompact === "inf") {
    return MATH_LEQ;
  }

  if (normalizedCompact === "supp") {
    return MATH_GEQ;
  }

  if (
    raw.includes(">=") ||
    raw.includes("=>") ||
    raw.includes(MATH_GEQ) ||
    normalized.includes("superieur ou egal") ||
    normalized.includes("greater or equal")
  ) {
    return MATH_GEQ;
  }

  if (
    raw.includes("<=") ||
    raw.includes("=<") ||
    raw.includes(MATH_LEQ) ||
    normalized.includes("inferieur ou egal") ||
    normalized.includes("less or equal")
  ) {
    return MATH_LEQ;
  }

  if (
    raw.includes("!=") ||
    raw.includes("<>") ||
    raw.includes(MATH_NEQ) ||
    normalized.includes("different")
  ) {
    return MATH_NEQ;
  }

  if (
    raw.includes(">") ||
    normalized === "gt" ||
    normalized.includes("superieur")
  ) {
    return ">";
  }

  if (
    raw.includes("<") ||
    normalized === "lt" ||
    normalized.includes("inferieur")
  ) {
    return "<";
  }

  if (raw.includes("=") || normalized === "eq" || normalized.includes("egal")) {
    return "=";
  }

  return raw;
};

const computeIndicatorTrend = (previousValue, currentAverage, signe) => {
  if (
    previousValue === "" ||
    previousValue === null ||
    previousValue === undefined ||
    currentAverage === "" ||
    currentAverage === null ||
    currentAverage === undefined
  ) {
    return null;
  }

  const rowprec = Number(previousValue);
  const moy = Number(currentAverage);
  if (!Number.isFinite(rowprec) || !Number.isFinite(moy)) {
    return null;
  }

  if (rowprec === 0 && moy === 0) {
    return 0;
  }

  if (rowprec === 0 || moy === 0) {
    return null;
  }

  const sign = formatMathSign(signe);
  const rawTrend =
    sign === "\u2264" || sign === "<"
      ? (rowprec / moy - 1) * 100
      : (moy / rowprec - 1) * 100;

  return Number(rawTrend.toFixed(2));
};

const formatMathUnit = (value) => {
  if (!value) {
    return "-";
  }

  const raw = String(value).trim();
  const normalized = stripAccents(raw.toLowerCase()).replace(/\s+/g, "");

  const unitMap = {
    "%": "%",
    pourcentage: "%",
    percentage: "%",
    percent: "%",
    euro: "\u20ac",
    eur: "\u20ac",
    "\u20ac": "\u20ac",
    usd: "$",
    dollar: "$",
    dollars: "$",
    $: "$",
    kg: "kg",
    kilogramme: "kg",
    kilogrammes: "kg",
    kilogram: "kg",
    kilograms: "kg",
    t: "t",
    tonne: "t",
    tonnes: "t",
    ppm: "ppm",
    h: "h",
    heure: "h",
    heures: "h",
    min: "min",
    minute: "min",
    minutes: "min",
    m2: "m\u00b2",
    "m\u00b2": "m\u00b2",
    m3: "m\u00b3",
    "m\u00b3": "m\u00b3",
  };

  return unitMap[normalized] || raw;
};

const getViewportWidth = () =>
  typeof window === "undefined" ? 1280 : window.innerWidth;

const formatValueWithUnit = (value, unit) => {
  if (value === null || value === undefined) {
    return "-";
  }

  const formattedValue = formatNumber(value);
  const formattedUnit = formatMathUnit(unit);
  return formattedUnit === "-"
    ? formattedValue
    : `${formattedValue} ${formattedUnit}`;
};

const normalizeMonthToken = (value) =>
  normalizeText(value).replace(/\./g, "").slice(0, 5);

const getMonthKeyFromAnomaly = (anomaly) => {
  const rawMonth = anomaly?.month ?? anomaly?.mois ?? anomaly?.month_value;
  const parsed = Number.parseInt(String(rawMonth ?? ""), 10);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 12) {
    return MONTH_COLUMNS[parsed - 1]?.key || "";
  }

  const normalized = normalizeMonthToken(rawMonth);
  return (
    MONTH_COLUMNS.find(
      (month) =>
        normalizeMonthToken(month.key) === normalized ||
        normalizeMonthToken(month.label) === normalized,
    )?.key || ""
  );
};

const getAnomalyTone = (result) => {
  if (!result) {
    return "pending";
  }
  if (Number(result.is_anomaly) === 1) {
    return "anomaly";
  }
  if (result.is_conforme === false) {
    return "warning";
  }
  return "normal";
};

const formatProcessusTick = (value) => {
  const parsed = parseProcessusEntry(value);
  if (parsed.code) {
    return parsed.code;
  }

  const raw = String(value ?? "").trim();
  return raw.length > 12 ? `${raw.slice(0, 12)}...` : raw;
};

const DASHBOARD_STATUS_META = {
  reached: {
    label: "Atteint",
    pluralLabel: "Atteints",
    className: "reached",
    color: "#10b981",
    countKey: "reachedCount",
  },
  atRisk: {
    label: "En risque",
    pluralLabel: "En risque",
    className: "at-risk",
    color: "#ef4444",
    countKey: "atRiskCount",
  },
  partial: {
    label: "Partiel",
    pluralLabel: "Partiels",
    className: "partial",
    color: "#f59e0b",
    countKey: "partialCount",
  },
  noData: {
    label: "Sans donnees",
    pluralLabel: "Sans donnees",
    className: "no-data",
    color: "#94a3b8",
    countKey: "noDataCount",
  },
};

const DASHBOARD_STATUS_PRIORITY = {
  noData: 0,
  atRisk: 1,
  partial: 2,
  reached: 3,
};

const clampPercentage = (value) => {
  const numeric = toFiniteNumber(value);
  if (numeric === null) {
    return null;
  }

  return Math.max(0, Math.min(100, numeric));
};

const formatPercent = (value) => {
  const numeric = toFiniteNumber(value);
  return numeric === null ? "-" : `${formatNumber(numeric)}%`;
};

const getDashboardProgressColor = (value) => {
  const numeric = toFiniteNumber(value);
  if (numeric === null) {
    return "#94a3b8";
  }
  if (numeric >= 100) {
    return "#10b981";
  }
  if (numeric >= 80) {
    return "#2563eb";
  }
  if (numeric >= 60) {
    return "#f59e0b";
  }
  return "#ef4444";
};

const getDashboardIndicatorStatus = (indicator) => {
  const monthsWithObjective = Number(indicator?.monthsWithObjective ?? 0);
  const monthsWithRealise = Number(indicator?.monthsWithRealise ?? 0);
  const coverageRate = toFiniteNumber(indicator?.coverageRate);

  if (
    monthsWithObjective === 0 ||
    monthsWithRealise === 0 ||
    coverageRate === null
  ) {
    return "noData";
  }

  if (coverageRate < 100) {
    return "partial";
  }

  return indicator?.objectiveReached ? "reached" : "atRisk";
};

const normalizeDashboardIndicator = (indicator) => {
  const kpiProgress = clampPercentage(
    indicator?.kpiProgress ?? indicator?.progress ?? indicator?.Progress,
  );
  const actionPlanProgress = clampPercentage(
    indicator?.actionPlanProgress ??
      indicator?.planActionProgress ??
      indicator?.PlanActionProgress,
  );
  const objective = toFiniteNumber(
    indicator?.objective ?? indicator?.Objective,
  );
  const realise = toFiniteNumber(indicator?.realise ?? indicator?.Realise);
  const avgObjective = toFiniteNumber(
    indicator?.avgObjective ?? indicator?.avg_objective ?? objective,
  );
  const avgRealise = toFiniteNumber(
    indicator?.avgRealise ?? indicator?.avg_realise ?? realise,
  );
  const coverageRate = clampPercentage(
    indicator?.coverageRate ?? indicator?.CoverageRate,
  );
  const monthsWithObjective = Math.max(
    0,
    Math.round(
      toFiniteNumber(
        indicator?.monthsWithObjective ?? indicator?.MonthsWithObjective,
      ) ?? 0,
    ),
  );
  const monthsWithRealise = Math.max(
    0,
    Math.round(
      toFiniteNumber(
        indicator?.monthsWithRealise ?? indicator?.MonthsWithRealise,
      ) ?? 0,
    ),
  );
  const comparableMonths = Math.max(
    0,
    Math.round(
      toFiniteNumber(
        indicator?.comparableMonths ?? indicator?.ComparableMonths,
      ) ?? monthsWithRealise,
    ),
  );
  const missingRealiseMonths = Math.max(
    0,
    Math.round(
      toFiniteNumber(
        indicator?.missingRealiseMonths ?? indicator?.MissingRealiseMonths,
      ) ?? Math.max(monthsWithObjective - monthsWithRealise, 0),
    ),
  );
  const objectiveReachedRaw =
    indicator?.objectiveReached ?? indicator?.ObjectiveReached;

  let objectiveReached = false;
  if (typeof objectiveReachedRaw === "boolean") {
    objectiveReached = objectiveReachedRaw;
  } else if (objectiveReachedRaw === 1 || objectiveReachedRaw === "1") {
    objectiveReached = true;
  } else if (objectiveReachedRaw === 0 || objectiveReachedRaw === "0") {
    objectiveReached = false;
  } else if (kpiProgress !== null) {
    objectiveReached = kpiProgress >= 100;
  }

  const hasActionPlanRaw = indicator?.hasActionPlan ?? indicator?.HasActionPlan;
  const normalizedIndicator = {
    code: String(
      indicator?.code ??
        indicator?.Code ??
        indicator?.indicateur ??
        indicator?.Indicateur ??
        "",
    ).trim(),
    designation: String(
      indicator?.designation ?? indicator?.Designation ?? "",
    ).trim(),
    signe: String(indicator?.signe ?? indicator?.Signe ?? "").trim(),
    unite: String(indicator?.unite ?? indicator?.Unite ?? "").trim(),
    pilote: String(indicator?.pilote ?? indicator?.Pilote ?? "").trim(),
    responsable: String(
      indicator?.responsable ?? indicator?.Responsable ?? "",
    ).trim(),
    progress: kpiProgress,
    kpiProgress,
    actionPlanProgress,
    objective,
    realise,
    avgObjective,
    avgRealise,
    coverageRate,
    monthsWithObjective,
    monthsWithRealise,
    comparableMonths,
    missingRealiseMonths,
    objectiveReached,
    hasActionPlan:
      typeof hasActionPlanRaw === "boolean"
        ? hasActionPlanRaw
        : hasActionPlanRaw === 1 ||
          hasActionPlanRaw === "1" ||
          actionPlanProgress !== null ||
          String(
            indicator?.actionEnCours ?? indicator?.ActionEnCours ?? "",
          ).trim().length > 0 ||
          (indicator?.dateCloturePrevue ??
            indicator?.DateCloturePrevue ??
            null) !== null,
    actionEnCours: String(
      indicator?.actionEnCours ?? indicator?.ActionEnCours ?? "",
    ).trim(),
    dateCloturePrevue:
      indicator?.dateCloturePrevue ?? indicator?.DateCloturePrevue ?? null,
  };

  return {
    ...normalizedIndicator,
    statusKey: getDashboardIndicatorStatus(normalizedIndicator),
  };
};

const normalizeDashboardProcesses = (processes) => {
  if (!Array.isArray(processes)) {
    return [];
  }

  return processes
    .map((process) => ({
      name: String(
        process?.name ?? process?.Processus ?? process?.processus ?? "",
      ).trim(),
      indicators: Array.isArray(process?.indicators)
        ? process.indicators
            .map(normalizeDashboardIndicator)
            .filter((indicator) => indicator.code || indicator.designation)
        : [],
    }))
    .filter((process) => process.name);
};

const normalizeDashboardMonthlyTotals = (totals) => ({
  indicatorCount: Math.max(
    0,
    Math.round(toFiniteNumber(totals?.indicatorCount) ?? 0),
  ),
  conformingCount: Math.max(
    0,
    Math.round(toFiniteNumber(totals?.conformingCount) ?? 0),
  ),
  nonConformingCount: Math.max(
    0,
    Math.round(toFiniteNumber(totals?.nonConformingCount) ?? 0),
  ),
  missingCount: Math.max(
    0,
    Math.round(toFiniteNumber(totals?.missingCount) ?? 0),
  ),
  conformityRate: clampPercentage(totals?.conformityRate),
});

const normalizeDashboardMonthlyConformity = (processes) => {
  if (!Array.isArray(processes)) {
    return [];
  }

  return processes
    .map((process) => ({
      processus: String(process?.processus ?? process?.Processus ?? "").trim(),
      indicatorCount: Math.max(
        0,
        Math.round(toFiniteNumber(process?.indicatorCount) ?? 0),
      ),
      conformingCount: Math.max(
        0,
        Math.round(toFiniteNumber(process?.conformingCount) ?? 0),
      ),
      nonConformingCount: Math.max(
        0,
        Math.round(toFiniteNumber(process?.nonConformingCount) ?? 0),
      ),
      missingCount: Math.max(
        0,
        Math.round(toFiniteNumber(process?.missingCount) ?? 0),
      ),
      conformityRate: clampPercentage(process?.conformityRate),
    }))
    .filter((process) => process.processus);
};

const getDashboardConformityRingStyle = (process) => {
  const total = Math.max(
    0,
    Math.round(toFiniteNumber(process?.indicatorCount) ?? 0),
  );

  if (total === 0) {
    return { background: "conic-gradient(#cbd5e1 0% 100%)" };
  }

  const conforming = Math.max(
    0,
    Math.round(toFiniteNumber(process?.conformingCount) ?? 0),
  );
  const nonConforming = Math.max(
    0,
    Math.round(toFiniteNumber(process?.nonConformingCount) ?? 0),
  );
  const conformingShare = Number(((conforming / total) * 100).toFixed(2));
  const nonConformingShare = Number(((nonConforming / total) * 100).toFixed(2));
  const warningStart = Number(
    (conformingShare + nonConformingShare).toFixed(2),
  );

  return {
    background: `conic-gradient(#10b981 0% ${conformingShare}%, #ef4444 ${conformingShare}% ${warningStart}%, #94a3b8 ${warningStart}% 100%)`,
  };
};

// Evaluate whether realise meets objective based on the indicator's sign
const evaluatePerformance = (realise, objective, signe) => {
  if (
    realise === null ||
    realise === undefined ||
    objective === null ||
    objective === undefined
  ) {
    return "neutral";
  }
  const r = Number(realise);
  const o = Number(objective);
  if (!Number.isFinite(r) || !Number.isFinite(o)) return "neutral";
  const sign = formatMathSign(signe);
  if (sign === "\u2265") return r >= o ? "good" : "bad"; // 0
  if (sign === "\u2264") return r <= o ? "good" : "bad"; // 0
  if (sign === ">") return r > o ? "good" : "bad";
  if (sign === "<") return r < o ? "good" : "bad";
  if (sign === "=") return Math.abs(r - o) < 0.0001 ? "good" : "bad";
  if (sign === "\u2260") return Math.abs(r - o) >= 0.0001 ? "good" : "bad"; // 0
  return "neutral";
};

// Progress smileys based on conformity progress (copied from Plan_action.jsx)
const getProgressSmileys = (progress) => {
  const normalizedProgress = Number.isFinite(Number(progress))
    ? Number(progress)
    : 0;
  const greenCount = Math.round(normalizedProgress / 25);
  const redCount = 4 - greenCount;

  return {
    green: "😀".repeat(greenCount),
    red: "😔".repeat(redCount),
    combined: "😀".repeat(greenCount) + "😔".repeat(redCount),
    percentage: normalizedProgress,
  };
};

const buildPlanActionRowsFromKpi = (
  kpiRows,
  { fallbackProcessus, year, monthIndex, showAll = false },
) => {
  if (!Array.isArray(kpiRows) || kpiRows.length === 0) {
    return [];
  }

  const monthColumn = MONTH_COLUMNS[monthIndex - 1];
  if (!monthColumn) {
    return [];
  }

  return kpiRows
    .map((row) => {
      const objectiveValue = toFiniteNumber(
        row?.[`objective_${monthColumn.key}`],
      );
      const realiseValue = toFiniteNumber(row?.[`realise_${monthColumn.key}`]);
      const hasObjective = objectiveValue !== null;
      const hasRealise = realiseValue !== null;

      if (!hasObjective && !showAll) {
        return null;
      }

      const performance = evaluatePerformance(
        realiseValue,
        objectiveValue,
        row?.Signe,
      );
      const shouldFlagMissing = !hasRealise || performance === "bad";

      // If showAll is false, only include rows that need attention
      if (!showAll && !shouldFlagMissing) {
        return null;
      }

      return {
        Indicateur: String(row?.Indicateur ?? "").trim(),
        Processus:
          String(row?.Processus ?? fallbackProcessus ?? "").trim() ||
          "Sans processus",
        Designation:
          String(row?.Designation ?? "").trim() ||
          String(row?.Indicateur ?? "").trim() ||
          "-",
        responsable: String(row?.ActionResponsable ?? "").trim() || "-",
        actionResponsable: String(row?.ActionResponsable ?? "").trim(),
        mois: String(monthIndex),
        annee: String(year),
        rootCause: "",
        action: "",
        dateclotprevu: "",
        efficacit: "",
        datecreation: "",
        PROGRESS: row.PROGRESS ?? null,
        statusText: hasRealise ? "under-target" : "missing-realise",
        pendingReason: hasRealise ? "under-target" : "missing-realise",
        hasPlanInfo: 0,
        dateclot: null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const processCompare = String(a.Processus).localeCompare(
        String(b.Processus),
        "fr",
      );
      if (processCompare !== 0) {
        return processCompare;
      }
      return String(a.Indicateur).localeCompare(String(b.Indicateur), "fr");
    });
};

const performanceCellClass = (perf) => {
  if (perf === "good") return "dashboard-cell-good";
  if (perf === "bad") return "dashboard-cell-bad";
  return "";
};

const renderPerformanceEmoji = (performance) => {
  if (performance === "good") {
    return (
      <span
        className="dashboard-performance-emoji dashboard-performance-emoji--good"
        title="Objectif atteint"
      >
        😀
      </span>
    );
  }

  if (performance === "bad") {
    return (
      <span
        className="dashboard-performance-emoji dashboard-performance-emoji--bad"
        title="Objectif non atteint"
      >
        😠
      </span>
    );
  }

  return (
    <span
      className="dashboard-performance-emoji dashboard-performance-emoji--neutral"
      title="Donnees incompletes"
    >
      😐
    </span>
  );
};

function KPI({ theme = "dark", onToggleTheme, authUser }) {
  const location = useLocation();
  const [isSigneOpen, setIsSigneOpen] = useState(false);
  const [isUniteOpen, setIsUniteOpen] = useState(false);
  const [signeText, setSigneText] = useState("");
  const [uniteText, setUniteText] = useState("");
  const [text, setText] = useState("");
  const navigate = useNavigate();
  const [processusList, setProcessusList] = useState([]);
  const [planYearsList, setPlanYearsList] = useState([]);
  const [selectedProcessus, setSelectedProcessus] = useState("");
  const [rows, setRows] = useState([]);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [dashboardMonthFilter, setDashboardMonthFilter] = useState(
    String(new Date().getMonth() + 1),
  );
  const [tablePeriodType, setTablePeriodType] = useState("mensuelle");
  const [isLoadingProcessus, setIsLoadingProcessus] = useState(true);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProcessusMenuOpen, setIsProcessusMenuOpen] = useState(false);
  const [isPlanActionMenuOpen, setIsPlanActionMenuOpen] = useState(false);
  const [isDashboardMenuOpen, setIsDashboardMenuOpen] = useState(false);
  const [isGeneralMenuOpen, setIsGeneralMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  const [generalRows, setGeneralRows] = useState([]);
  const [isLoadingGeneral, setIsLoadingGeneral] = useState(false);
  const [generalProcessusFilter, setGeneralProcessusFilter] = useState("all");
  const [generalMonthFilter, setGeneralMonthFilter] = useState(
    String(new Date().getMonth() + 1),
  );
  // AI assistant states
  const [anomalies, setAnomalies] = useState([]);
  const [riskScores, setRiskScores] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [bestPredictions, setBestPredictions] = useState({
    month: [],
    quarter: [],
    year: [],
    processus: [],
  });
  const [generale, setGenerale] = useState(EMPTY_SUMMARY);
  const [chargement, setChargement] = useState(true);
  const [activeTab, setActiveTab] = useState("ml");
  const [showAiButtons, setShowAiButtons] = useState(false);
  const [erreur, setErreur] = useState("");

  const [dashboardData, setDashboardData] = useState([]);
  const [dashboardMonthlyConformity, setDashboardMonthlyConformity] = useState(
    [],
  );
  const [dashboardMonthlyTotals, setDashboardMonthlyTotals] = useState({
    ...EMPTY_DASHBOARD_MONTHLY_TOTALS,
  });
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [chartViewportWidth, setChartViewportWidth] =
    useState(getViewportWidth);
  // For AI assistant
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingChatMode, setLoadingChatMode] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMode, setChatMode] = useState("enterprise");
  const [chatMessages, setChatMessages] = useState({
    normal: [
      {
        role: "bot",
        text: "Bonjour ! Je suis le chat normal, sans accès à la base de données.",
      },
    ],
    enterprise: [
      {
        role: "bot",
        text: "Bonjour ! Je suis le chat entreprise. Je peux analyser les données internes autorisées.",
      },
    ],
  });
  const messages = chatMessages[chatMode] || [];
  const messagesEndRef = useRef(null);

  const appendChatMessage = (mode, message) => {
    setChatMessages((prev) => ({
      ...prev,
      [mode]: [...(prev[mode] || []), message],
    }));
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const fetchMLData = async () => {
    try {
      setChargement(true);
      setErreur("");
      const [dashboardRes, anomaliesRes, riskRes, suggestionsRes] =
        await Promise.all([
          fetchMLDashboard(),
          fetchMLAnomalies(),
          fetchMLRiskScores(),
          fetchMLSuggestions(),
        ]);
      setGenerale(dashboardRes.data || EMPTY_SUMMARY);
      setAnomalies(anomaliesRes.data || []);
      setRiskScores(riskRes.data || []);
      setSuggestions(suggestionsRes.data || []);
      const currentMonth =
        Number(dashboardMonthFilter) || new Date().getMonth() + 1;
      const currentQuarter = Math.ceil(currentMonth / 3);
      const [bestMonth, bestQuarter, bestYear, bestProcessus] =
        await Promise.all([
          fetchMLBestPredictions({
            year: selectedYear,
            period: "month",
            month: currentMonth,
            scope: "indicator",
            limit: 8,
          }),
          fetchMLBestPredictions({
            year: selectedYear,
            period: "quarter",
            quarter: currentQuarter,
            scope: "indicator",
            limit: 8,
          }),
          fetchMLBestPredictions({
            year: selectedYear,
            period: "year",
            scope: "indicator",
            limit: 8,
          }),
          fetchMLBestPredictions({
            year: selectedYear,
            period: "year",
            scope: "processus",
            limit: 8,
          }),
        ]);
      setBestPredictions({
        month: bestMonth.data?.rankings || [],
        quarter: bestQuarter.data?.rankings || [],
        year: bestYear.data?.rankings || [],
        processus: bestProcessus.data?.rankings || [],
      });
    } catch (requestError) {
      console.error("Erreur chargement ML:", requestError);
      setErreur("Erreur lors du chargement des donnees ML.");
    } finally {
      setChargement(false);
    }
  };
  useEffect(() => {
    fetchMLData();
  }, [dashboardMonthFilter, selectedYear]);
  const visibleCounts = useMemo(
    () => ({
      anomalies: Number(generale?.anomalies_count ?? 0),
      riskScores: Number(generale?.high_risk_count ?? 0),
      suggestions: Number(generale?.critical_suggestions ?? 0),
    }),
    [generale],
  );

  const extractOllamaText = (data) => {
    if (!data) {
      return "";
    }

    if (typeof data === "string") {
      return data.trim();
    }

    if (typeof data?.choices?.[0]?.text === "string") {
      return data.choices[0].text.trim();
    }

    if (typeof data?.choices?.[0]?.message?.content === "string") {
      return data.choices[0].message.content.trim();
    }

    if (typeof data?.completion === "string") {
      return data.completion.trim();
    }

    if (typeof data?.text === "string") {
      return data.text.trim();
    }

    if (
      Array.isArray(data?.generations) &&
      typeof data.generations[0]?.text === "string"
    ) {
      return data.generations[0].text.trim();
    }

    return "";
  };

  const askOllama = async () => {
    const activeMode = chatMode;
    if (!prompt.trim()) {
      appendChatMessage(activeMode, {
        role: "bot",
        text: "Veuillez saisir une question.",
      });
      return;
    }

    const userMsg = prompt;
    setPrompt("");
    appendChatMessage(activeMode, { role: "user", text: userMsg });
    setIsLoading(true);
    setLoadingChatMode(activeMode);

    try {
      const payload = {
        model: "mistral",
        message: userMsg,
        max_tokens: activeMode === "enterprise" ? 700 : 512,
        temperature: activeMode === "enterprise" ? 0.25 : 0.7,
      };
      const result =
        activeMode === "enterprise"
          ? await ollamaEnterpriseChat(payload)
          : await ollamaPublicChat(payload);

      const responseText =
        result?.data?.response || extractOllamaText(result?.data);
      const fallbackText =
        result?.data?.error ||
        result?.data?.details ||
        result?.data?.message ||
        "";
      appendChatMessage(activeMode, {
        role: "bot",
        text: responseText || fallbackText || "Aucune réponse reçue.",
      });
    } catch (error) {
      console.error("Erreur Ollama:", error);
      appendChatMessage(activeMode, {
        role: "bot",
        text:
          error?.response?.data?.details ||
          error?.response?.data?.error ||
          "Erreur lors de l'appel à Ollama.",
      });
    } finally {
      setIsLoading(false);
      setLoadingChatMode(null);
    }
  };

  const toggleChat = () => {
    setIsChatOpen((prev) => !prev);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      askOllama();
    }
  };

  const clearChat = () => {
    setChatMessages((prev) => ({
      ...prev,
      [chatMode]: [
        {
          role: "bot",
          text:
            chatMode === "enterprise"
              ? "Conversation effacée. Le chat entreprise analysera les données internes autorisées."
              : "Conversation effacée. Le chat normal répond sans accès aux données internes.",
        },
      ],
    }));
  };

  const switchChatMode = (mode) => {
    if (mode === chatMode) {
      return;
    }

    setChatMode(mode);
  };

  const isCompactChartViewport = chartViewportWidth <= 980;
  const isMobileChartViewport = chartViewportWidth <= 640;
  const tableChartHeight = isMobileChartViewport
    ? 240
    : isCompactChartViewport
      ? 270
      : 300;
  const selectedDashboardMonthLabel = useMemo(
    () => getFrenchMonthLabel(dashboardMonthFilter),
    [dashboardMonthFilter],
  );
  const generalSelectedMonthLabel = useMemo(
    () => getFrenchMonthLabel(generalMonthFilter),
    [generalMonthFilter],
  );
  const isGeneralView =
    activeView === "general-monthly" || activeView === "general-annual";

  const openDashboardRoute = useCallback(() => {
    navigate(KPI_ROUTE_BASE);
  }, [navigate]);

  const openPlanActionRoute = useCallback(() => {
    navigate(KPI_PLAN_ACTION_ROUTE);
  }, [navigate]);

  const openGeneralMonthlyRoute = useCallback(() => {
    navigate(KPI_GENERAL_MONTHLY_ROUTE);
  }, [navigate]);

  const openGeneralAnnualRoute = useCallback(() => {
    navigate(KPI_GENERAL_ANNUAL_ROUTE);
  }, [navigate]);

  const openProcessusRoute = useCallback(
    (processusValue) => {
      const fallbackProcessus =
        String(processusValue ?? "").trim() ||
        String(selectedProcessus ?? "").trim() ||
        String(processusList[0] ?? "").trim();

      navigate(buildProcessusRoute(fallbackProcessus));
    },
    [navigate, processusList, selectedProcessus],
  );

  const dashboardProcessOverview = useMemo(() => {
    if (!dashboardData || dashboardData.length === 0) {
      return [];
    }

    return dashboardData
      .map((process) => {
        const indicators = Array.isArray(process.indicators)
          ? process.indicators
          : [];
        const statusCounts = {
          reachedCount: 0,
          atRiskCount: 0,
          partialCount: 0,
          noDataCount: 0,
        };

        indicators.forEach((indicator) => {
          const statusMeta =
            DASHBOARD_STATUS_META[indicator.statusKey] ||
            DASHBOARD_STATUS_META.noData;
          statusCounts[statusMeta.countKey] += 1;
        });

        const highlightedIndicators = [...indicators]
          .sort((left, right) => {
            const leftPriority =
              DASHBOARD_STATUS_PRIORITY[left.statusKey] ?? 99;
            const rightPriority =
              DASHBOARD_STATUS_PRIORITY[right.statusKey] ?? 99;
            if (leftPriority !== rightPriority) {
              return leftPriority - rightPriority;
            }

            const leftProgress = toFiniteNumber(left.kpiProgress);
            const rightProgress = toFiniteNumber(right.kpiProgress);
            if (leftProgress === null && rightProgress === null) {
              return String(left.code || left.designation).localeCompare(
                String(right.code || right.designation),
                "fr",
              );
            }
            if (leftProgress === null) {
              return -1;
            }
            if (rightProgress === null) {
              return 1;
            }
            return leftProgress - rightProgress;
          })
          .slice(0, 4);

        return {
          name: process.name,
          indicators,
          indicatorCount: indicators.length,
          avgKpiProgress: averageFiniteNumbers(
            indicators.map((indicator) => indicator.kpiProgress),
          ),
          avgCoverageRate: averageFiniteNumbers(
            indicators.map((indicator) => indicator.coverageRate),
          ),
          avgActionPlanProgress: averageFiniteNumbers(
            indicators
              .filter((indicator) => indicator.hasActionPlan)
              .map((indicator) => indicator.actionPlanProgress),
          ),
          withActionPlanCount: indicators.filter(
            (indicator) => indicator.hasActionPlan,
          ).length,
          highlightedIndicators,
          ...statusCounts,
        };
      })
      .filter((process) => process.indicatorCount > 0);
  }, [dashboardData]);

  const dashboardSummary = useMemo(() => {
    if (dashboardProcessOverview.length === 0) {
      return {
        processCount: 0,
        indicatorCount: 0,
        averageKpiProgress: null,
        averageCoverageRate: null,
      };
    }

    return {
      processCount: dashboardProcessOverview.length,
      indicatorCount: dashboardProcessOverview.reduce(
        (sum, process) => sum + process.indicatorCount,
        0,
      ),
      averageKpiProgress: averageFiniteNumbers(
        dashboardProcessOverview.map((process) => process.avgKpiProgress),
      ),
      averageCoverageRate: averageFiniteNumbers(
        dashboardProcessOverview.map((process) => process.avgCoverageRate),
      ),
    };
  }, [dashboardProcessOverview]);

  const dashboardComparisonChartData = useMemo(
    () =>
      dashboardProcessOverview.map((process) => ({
        subject: process.name,
        kpiProgress: clampPercentage(process.avgKpiProgress),
        coverageRate: clampPercentage(process.avgCoverageRate),
        actionPlanProgress: clampPercentage(process.avgActionPlanProgress),
      })),
    [dashboardProcessOverview],
  );

  const dashboardStatusChartData = useMemo(
    () =>
      dashboardProcessOverview.map((process) => ({
        subject: process.name,
        reachedCount: process.reachedCount,
        atRiskCount: process.atRiskCount,
        partialCount: process.partialCount,
        noDataCount: process.noDataCount,
      })),
    [dashboardProcessOverview],
  );

  const dashboardProcessAxisWidth = isMobileChartViewport ? 78 : 112;
  const dashboardComparisonHeight = Math.max(
    isMobileChartViewport ? 320 : 340,
    dashboardComparisonChartData.length * (isMobileChartViewport ? 72 : 58) +
      70,
  );
  const dashboardStatusHeight = Math.max(
    isMobileChartViewport ? 320 : 340,
    dashboardStatusChartData.length * (isMobileChartViewport ? 72 : 58) + 70,
  );

  const [planActionRows, setPlanActionRows] = useState([]);
  const [isLoadingPlanAction, setIsLoadingPlanAction] = useState(false);
  const [planDesignationSearch, setPlanDesignationSearch] = useState("");
  const [planGlobalSearch, setPlanGlobalSearch] = useState("");
  const [planFilterProcessus, setPlanFilterProcessus] = useState("all");
  const [planFilterResponsable, setPlanFilterResponsable] = useState("all");
  const [planFilterMois, setPlanFilterMois] = useState("all");
  const [planFilterAnnee, setPlanFilterAnnee] = useState("all");
  const [planFilterProgress, setPlanFilterProgress] = useState("all");
  const [planFilterImplementation, setPlanFilterImplementation] = useState(
    PLAN_IMPLEMENTATION_DEFAULT,
  );
  const [profilePendingCount, setProfilePendingCount] = useState(0);
  const [error, setError] = useState("");
  const [periodicityMenuOpenKey, setPeriodicityMenuOpenKey] = useState(null);
  // State for selected indicator chart (displayed below table)
  const [selectedChartIndicator, setSelectedChartIndicator] = useState(null);
  const [aiAnalysisMonth, setAiAnalysisMonth] = useState(
    String(new Date().getMonth() + 1),
  );
  const [aiCopilotData, setAiCopilotData] = useState(null);
  const [isLoadingAiCopilot, setIsLoadingAiCopilot] = useState(false);
  const [aiCopilotError, setAiCopilotError] = useState("");

  // 0dition inline signe / unité
  const [editingSign, setEditingSign] = useState(null);
  const [editingUnit, setEditingUnit] = useState(null);
  const [outilsOptions, setOutilsOptions] = useState([]);

  // Modale objectifs
  const [objectiveModalOpen, setObjectiveModalOpen] = useState(false);
  const [currentEditingRow, setCurrentEditingRow] = useState(null);
  const [modalPeriodType, setModalPeriodType] = useState("mensuelle");
  const [modalGroupValues, setModalGroupValues] = useState({});
  const [modalDeadlines, setModalDeadlines] = useState({});

  // Admin panel state (create processus / indicateur  1..N)
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [adminTab, setAdminTab] = useState("processus");
  const [adminSaving, setAdminSaving] = useState(false);
  const [newProcName, setNewProcName] = useState("");
  const [newProcCategory, setNewProcCategory] = useState(
    DEFAULT_PROCESSUS_CATEGORY,
  );
  const [newProcCodePrefix, setNewProcCodePrefix] = useState("");
  const [newProcResponsable, setNewProcResponsable] = useState("");
  const [newProcPilote, setNewProcPilote] = useState("");
  const [newProcIndicators, setNewProcIndicators] = useState([
    {
      indicateur: "",
      designation: "",
      signe: "",
      unite: "",
      responsable: "",
      responsableAction: "",
    },
  ]);
  const [newIndFields, setNewIndFields] = useState({
    processus: "",
    designation: "",
    signe: "",
    unite: "",
    responsable: "",
    pilote: "",
    responsableAction: "",
  });

  // Saisie réalisé modal
  const [realiseModalOpen, setRealiseModalOpen] = useState(false);
  const [currentEditingRealiseRow, setCurrentEditingRealiseRow] =
    useState(null);
  const [realiseModalValues, setRealiseModalValues] = useState({});
  const [isSavingRealise, setIsSavingRealise] = useState(false);
  const [realiseMlStatus, setRealiseMlStatus] = useState(null);
  const [realiseMlLoadingKey, setRealiseMlLoadingKey] = useState("");

  // Modal error/saving states
  const [isSavingObjective, setIsSavingObjective] = useState(false);
  const [modalError, setModalError] = useState("");

  // Editable indicators state: which rows the current user can edit
  const [editableInfo, setEditableInfo] = useState({
    isAdmin: false,
    indicators: [],
  });

  // Users list for admin dropdown
  const [usersList, setUsersList] = useState([]);

  // Responsables list for admin dropdown
  const [responsablesList, setResponsablesList] = useState([]);

  // pilote list for admin dropdown
  const [pilotesList, setPilotesList] = useState([]);

  // Dropdown states for animated dropdowns
  const [responsableDropdownOpen, setResponsableDropdownOpen] = useState(false);
  const [piloteDropdownOpen, setPiloteDropdownOpen] = useState(false);
  const responsableDropdownRef = useRef(null);
  const piloteDropdownRef = useRef(null);
  const chartsSectionRef = useRef(null);
  const selectedCopilotRow = useMemo(
    () => rows.find((row) => row.Indicateur === selectedChartIndicator) || null,
    [rows, selectedChartIndicator],
  );

  useEffect(() => {
    if (!responsableDropdownOpen && !piloteDropdownOpen) {
      return undefined;
    }

    const handleOutsideDropdownClick = (event) => {
      const target = event.target;
      const clickedResponsableDropdown =
        responsableDropdownRef.current?.contains(target);
      const clickedPiloteDropdown = piloteDropdownRef.current?.contains(target);

      if (!clickedResponsableDropdown) {
        setResponsableDropdownOpen(false);
      }

      if (!clickedPiloteDropdown) {
        setPiloteDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideDropdownClick);
    document.addEventListener("touchstart", handleOutsideDropdownClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideDropdownClick);
      document.removeEventListener("touchstart", handleOutsideDropdownClick);
    };
  }, [piloteDropdownOpen, responsableDropdownOpen]);

  useEffect(() => {
    if (!periodicityMenuOpenKey) {
      return undefined;
    }

    const handleOutsidePeriodicityMenuClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (!target.closest(".dashboard-periodicity-control")) {
        setPeriodicityMenuOpenKey(null);
      }
    };

    document.addEventListener("mousedown", handleOutsidePeriodicityMenuClick);
    document.addEventListener("touchstart", handleOutsidePeriodicityMenuClick);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsidePeriodicityMenuClick,
      );
      document.removeEventListener(
        "touchstart",
        handleOutsidePeriodicityMenuClick,
      );
    };
  }, [periodicityMenuOpenKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      setChartViewportWidth(window.innerWidth);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    const loadEditableIndicators = async () => {
      try {
        const resp = await api.get("/api/dashboard/my-editable-indicators");
        setEditableInfo({
          isAdmin: resp.data.isAdmin === true,
          indicators: Array.isArray(resp.data.indicators)
            ? resp.data.indicators
            : [],
        });
      } catch {
        setEditableInfo({ isAdmin: false, indicators: [] });
      }
    };
    loadEditableIndicators();
  }, []);

  const loadProfileTaskNotifications = useCallback(async () => {
    try {
      const response = await api.get("/api/indicateurs/user-tasks");
      const tasks = Array.isArray(response.data?.indicateurs)
        ? response.data.indicateurs
        : [];
      const pendingCount = tasks.filter(
        (task) => task.notificationStatus === "pending",
      ).length;
      setProfilePendingCount(pendingCount);
    } catch {
      setProfilePendingCount(0);
    }
  }, []);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    loadProfileTaskNotifications();
  }, [authUser, loadProfileTaskNotifications]);

  const visibleProfilePendingCount = authUser ? profilePendingCount : 0;

  const scrollToChartsSection = useCallback((behavior = "smooth") => {
    if (typeof window === "undefined") {
      return;
    }

    const chartsElement = chartsSectionRef.current;
    if (!chartsElement) {
      return;
    }

    const navbarElement = document.querySelector(".navbar");
    const navbarOffset =
      navbarElement instanceof HTMLElement
        ? navbarElement.getBoundingClientRect().height
        : 0;
    const targetTop =
      window.scrollY +
      chartsElement.getBoundingClientRect().top -
      navbarOffset -
      16;

    window.scrollTo({
      top: Math.max(targetTop, 0),
      behavior,
    });
  }, []);

  const handleOpenChart = useCallback(
    (indicator) => {
      if (!indicator) {
        return;
      }

      if (selectedChartIndicator === indicator && chartsSectionRef.current) {
        scrollToChartsSection();
        return;
      }

      setAiAnalysisMonth(
        String(dashboardMonthFilter || new Date().getMonth() + 1),
      );
      setSelectedChartIndicator(indicator);
    },
    [dashboardMonthFilter, scrollToChartsSection, selectedChartIndicator],
  );

  useEffect(() => {
    if (!selectedChartIndicator || typeof window === "undefined") {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      scrollToChartsSection();
    }, 80);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [scrollToChartsSection, selectedChartIndicator]);

  useEffect(() => {
    if (!selectedChartIndicator) {
      setAiCopilotData(null);
      setAiCopilotError("");
      setIsLoadingAiCopilot(false);
      return undefined;
    }

    let ignore = false;

    const loadAiCopilot = async () => {
      try {
        setIsLoadingAiCopilot(true);
        setAiCopilotError("");
        const payload = buildRiskSuggestionPayloadFromRow(
          selectedCopilotRow,
          selectedYear,
          aiAnalysisMonth,
        );
        const response = payload
          ? await predictMLRiskSuggestion(payload)
          : await fetchMLCopilot(selectedChartIndicator, {
              year: selectedYear,
            });

        if (!ignore) {
          setAiCopilotData(response?.data || null);
        }
      } catch (requestError) {
        console.error("Error loading AI copilot:", requestError);
        if (!ignore) {
          setAiCopilotData(null);
          setAiCopilotError(
            "L'analyse AI est indisponible pour cet indicateur.",
          );
        }
      } finally {
        if (!ignore) {
          setIsLoadingAiCopilot(false);
        }
      }
    };

    loadAiCopilot();

    return () => {
      ignore = true;
    };
  }, [
    aiAnalysisMonth,
    selectedChartIndicator,
    selectedCopilotRow,
    selectedYear,
  ]);

  // Load users and responsables lists when user is admin
  useEffect(() => {
    const loadLists = async () => {
      if (!editableInfo.isAdmin) return;
      try {
        const usersEndpoint = selectedProcessus
          ? `/api/dashboard/users?processus=${encodeURIComponent(selectedProcessus)}`
          : "/api/dashboard/users";
        const [usersResp, responsablesResp, pilotesResp] = await Promise.all([
          api.get(usersEndpoint),
          api.get("/api/dashboard/responsables"),
          api.get("/api/dashboard/pilotes"),
        ]);
        setUsersList(Array.isArray(usersResp.data) ? usersResp.data : []);
        setResponsablesList(
          Array.isArray(responsablesResp.data) ? responsablesResp.data : [],
        );
        setPilotesList(Array.isArray(pilotesResp.data) ? pilotesResp.data : []);
      } catch (error) {
        console.error("Failed to load lists:", error);
        setUsersList([]);
        setResponsablesList([]);
        setPilotesList([]);
      }
    };

    if (editableInfo.isAdmin) {
      loadLists();
    }
  }, [editableInfo.isAdmin, selectedProcessus]);

  // Load responsables list for plan action filter (all authenticated users)
  useEffect(() => {
    const loadResponsables = async () => {
      try {
        const resp = await api.get("/api/dashboard/responsables");
        setResponsablesList(Array.isArray(resp.data) ? resp.data : []);
      } catch (error) {
        console.error("Failed to load responsables:", error);
        setResponsablesList([]);
      }
    };
    loadResponsables();
  }, []);

  // Helper: can the current user edit this row's objective/realise?
  // Admins can edit everything, regular users can edit their own indicators
  const canEditRow = useCallback(
    (row) => {
      if (editableInfo.isAdmin) return true;
      const indicator = normalizeText(row?.Indicateur);
      return editableInfo.indicators.some(
        (editableIndicator) => normalizeText(editableIndicator) === indicator,
      );
    },
    [editableInfo],
  );

  const canOpenPlanActionForRow = useCallback(
    (row) => {
      if (!row) return false;
      if (editableInfo.isAdmin || authUser?.isAdmin) return true;

      const username = normalizeText(authUser?.username);
      if (!username) return false;

      const indicator = normalizeText(row?.Indicateur);
      const hasExplicitPermission =
        indicator &&
        editableInfo.indicators.some(
          (editableIndicator) => normalizeText(editableIndicator) === indicator,
        );
      const isResponsable =
        normalizeText(row?.Responsable ?? row?.responsable) === username;
      const isPilote = normalizeText(row?.Pilote ?? row?.pilote) === username;

      return hasExplicitPermission || isResponsable || isPilote;
    },
    [authUser?.isAdmin, authUser?.username, editableInfo],
  );

  // Save Designation (admin only - for first row display)
  const saveDesignationEdit = async (row, value) => {
    if (!editableInfo.isAdmin) {
      return;
    }

    const nextDesignation = String(value ?? "");
    const currentDesignation = String(row?.Designation ?? "");

    if (nextDesignation === currentDesignation) {
      return;
    }

    try {
      await api.put(
        `/api/dashboard/indicateur/${encodeURIComponent(row.Indicateur)}`,
        {
          designation: nextDesignation,
        },
      );

      const response = await api.get(
        `/api/dashboard/processus/${encodeURIComponent(selectedProcessus)}?year=${selectedYear}`,
      );
      setRows(response.data.rows || []);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update designation");
    }
  };

  // Save Description (for second row - user editable)
  const saveDescriptionEdit = async (row, value) => {
    // Both admin and users can edit the description
    const nextDescription = String(value ?? "");
    const currentDescription = String(row?.Description ?? "");

    if (nextDescription === currentDescription) {
      return;
    }

    try {
      await api.put(
        `/api/dashboard/indicateur/${encodeURIComponent(row.Indicateur)}/description-year`,
        {
          year: selectedYear,
          description: nextDescription,
        },
      );

      const response = await api.get(
        `/api/dashboard/processus/${encodeURIComponent(selectedProcessus)}?year=${selectedYear}`,
      );
      setRows(response.data.rows || []);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.details ||
          "Failed to update description",
      );
    }
  };

  useEffect(() => {
    const loadProcessus = async () => {
      setIsLoadingProcessus(true);
      setError("");

      try {
        const [processusResponse, planYearsResponse] = await Promise.all([
          api.get("/api/dashboard/processus"),
          api.get("/api/dashboard/plan-years"),
        ]);

        const list = Array.isArray(processusResponse.data?.processus)
          ? processusResponse.data.processus
          : [];
        setProcessusList(list);
        const years = Array.isArray(planYearsResponse.data?.years)
          ? planYearsResponse.data.years
          : [];
        setPlanYearsList(years);

        if (list.length > 0) {
          setSelectedProcessus(
            (previousProcessus) => previousProcessus || list[0],
          );
        }
      } catch (requestError) {
        setError(
          requestError.response?.data?.error || "Unable to load processus list",
        );
      } finally {
        setIsLoadingProcessus(false);
      }
    };

    loadProcessus();
  }, []);

  const structuredProcessusList = useMemo(
    () =>
      processusList
        .map((processus) => parseProcessusEntry(processus))
        .sort(compareProcessusEntries),
    [processusList],
  );

  // Load outils options
  useEffect(() => {
    const loadOutilsOptions = async () => {
      try {
        const resp = await api.get("/api/dashboard/outils-options");
        const data = resp.data;
        setOutilsOptions({
          signes: data.signes || [],
          unites: data.unites || [],
        });
      } catch {
        setOutilsOptions({
          signes: [],
          unites: [],
        });
      }
    };
    loadOutilsOptions();
  }, []);

  const processusLabelByRaw = useMemo(
    () =>
      new Map(structuredProcessusList.map((entry) => [entry.raw, entry.label])),
    [structuredProcessusList],
  );

  const groupedProcessusOptions = useMemo(() => {
    const grouped = new Map();

    structuredProcessusList.forEach((entry) => {
      // Use entry.code (like C010, C020) for grouping instead of entry.category (just C, S, M)
      const groupKey = entry.code || entry.category;
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }
      grouped.get(groupKey).push(entry);
    });

    return [...grouped.entries()].map(([category, items]) => ({
      category,
      items: [...items].sort(compareProcessusEntries),
    }));
  }, [structuredProcessusList]);

  const availableProcessusCategories = useMemo(() => {
    const fromExisting = structuredProcessusList
      .map((entry) => entry.category)
      .filter(
        (category) => category && category !== PROCESSUS_CATEGORY_FALLBACK,
      )
      .sort((a, b) => a.localeCompare(b, "fr"));

    return [...new Set([...PROCESSUS_CATEGORY_OPTIONS, ...fromExisting])];
  }, [structuredProcessusList]);

  useEffect(() => {
    if (!availableProcessusCategories.includes(newProcCategory)) {
      setNewProcCategory(
        availableProcessusCategories[0] || DEFAULT_PROCESSUS_CATEGORY,
      );
    }
  }, [availableProcessusCategories, newProcCategory]);

  const nextProcessusConfigByCategory = useMemo(() => {
    const categoryBuckets = new Map();

    structuredProcessusList.forEach((entry) => {
      if (!entry.hasStructuredCode || !Number.isFinite(entry.number)) {
        return;
      }

      const current = categoryBuckets.get(entry.category) || {
        numbers: [],
        numberDigits: 3,
      };
      current.numbers.push(Number(entry.number));
      current.numberDigits = Math.max(
        current.numberDigits,
        entry.numberDigits || 3,
      );
      categoryBuckets.set(entry.category, current);
    });

    const computed = new Map();
    availableProcessusCategories.forEach((category) => {
      const current = categoryBuckets.get(category);
      if (!current || current.numbers.length === 0) {
        computed.set(category, { nextNumber: 10, numberDigits: 3 });
        return;
      }

      const sorted = [...current.numbers].sort((a, b) => a - b);
      const useStepOfTen = sorted.every((value) => value % 10 === 0);
      const step = useStepOfTen ? 10 : 1;

      computed.set(category, {
        nextNumber: sorted[sorted.length - 1] + step,
        numberDigits: current.numberDigits,
      });
    });

    return computed;
  }, [availableProcessusCategories, structuredProcessusList]);

  const activeProcessusCodeConfig = useMemo(
    () =>
      nextProcessusConfigByCategory.get(newProcCategory) || {
        nextNumber: 10,
        numberDigits: 3,
      },
    [newProcCategory, nextProcessusConfigByCategory],
  );

  const suggestedProcessusCode = useMemo(
    () =>
      formatProcessusCode(
        newProcCategory,
        activeProcessusCodeConfig.nextNumber,
        activeProcessusCodeConfig.numberDigits,
      ),
    [
      activeProcessusCodeConfig.nextNumber,
      activeProcessusCodeConfig.numberDigits,
      newProcCategory,
    ],
  );

  useEffect(() => {
    setNewProcCodePrefix(suggestedProcessusCode);
  }, [newProcCategory, suggestedProcessusCode]);

  const effectiveProcessusCodePrefix = useMemo(() => {
    const cleaned = normalizeIndicatorPrefix(newProcCodePrefix);
    return cleaned || suggestedProcessusCode;
  }, [newProcCodePrefix, suggestedProcessusCode]);

  const formattedNewProcessusName = useMemo(() => {
    const cleanName = newProcName.trim();
    return cleanName
      ? `${effectiveProcessusCodePrefix} ${cleanName}`
      : effectiveProcessusCodePrefix;
  }, [effectiveProcessusCodePrefix, newProcName]);

  const activeIndicatorProcessus = useMemo(
    () => String(selectedProcessus ?? "").trim(),
    [selectedProcessus],
  );

  const suggestedNewIndicatorCode = useMemo(() => {
    const prefix = getProcessusCodePrefixFromRaw(activeIndicatorProcessus);
    return buildIndicatorCodeBase(prefix, newIndFields.designation);
  }, [activeIndicatorProcessus, newIndFields.designation]);

  useEffect(() => {
    const routeState = parseKpiRoute(location.pathname);
    setActiveView((previousView) =>
      previousView === routeState.view ? previousView : routeState.view,
    );

    if (routeState.view === "kpi" && routeState.processus) {
      setSelectedProcessus((previousProcessus) =>
        previousProcessus === routeState.processus
          ? previousProcessus
          : routeState.processus,
      );
    }
  }, [location.pathname]);

  useEffect(() => {
    if (processusList.length === 0) {
      return;
    }

    const routeState = parseKpiRoute(location.pathname);
    if (routeState.view !== "kpi") {
      setSelectedProcessus(
        (previousProcessus) => previousProcessus || processusList[0],
      );
      return;
    }

    const requestedProcessus = String(routeState.processus ?? "").trim();
    const currentProcessus = String(selectedProcessus ?? "").trim();
    const hasRequestedProcessus =
      requestedProcessus && processusList.includes(requestedProcessus);
    const hasCurrentProcessus =
      currentProcessus && processusList.includes(currentProcessus);
    const resolvedProcessus = hasRequestedProcessus
      ? requestedProcessus
      : hasCurrentProcessus
        ? currentProcessus
        : processusList[0];

    if (!resolvedProcessus) {
      return;
    }

    if (resolvedProcessus !== selectedProcessus) {
      setSelectedProcessus(resolvedProcessus);
    }

    const expectedPath = buildProcessusRoute(resolvedProcessus);
    if (trimTrailingSlashes(location.pathname) !== expectedPath) {
      navigate(expectedPath, { replace: true });
    }
  }, [location.pathname, navigate, processusList, selectedProcessus]);

  // Fetch dashboard overview data when dashboard view is active
  useEffect(() => {
    if (activeView !== "dashboard") {
      return;
    }

    const loadDashboardData = async () => {
      try {
        setIsLoadingDashboard(true);
        setError("");
        const [summaryResponse, monthlyConformityResponse] = await Promise.all([
          fetchAllProcessusSummary(selectedYear),
          fetchDashboardMonthlyConformity(selectedYear, dashboardMonthFilter),
        ]);

        setDashboardData(
          normalizeDashboardProcesses(summaryResponse.data?.processus),
        );
        setDashboardMonthlyConformity(
          normalizeDashboardMonthlyConformity(
            monthlyConformityResponse.data?.processes,
          ),
        );
        setDashboardMonthlyTotals(
          normalizeDashboardMonthlyTotals(
            monthlyConformityResponse.data?.totals,
          ),
        );
      } catch (err) {
        setDashboardData([]);
        setDashboardMonthlyConformity([]);
        setDashboardMonthlyTotals({ ...EMPTY_DASHBOARD_MONTHLY_TOTALS });
        setError(
          err.response?.data?.error ||
            "Impossible de charger le tableau de bord.",
        );
      } finally {
        setIsLoadingDashboard(false);
      }
    };

    loadDashboardData();
  }, [activeView, dashboardMonthFilter, selectedYear]);

  useEffect(() => {
    if (activeView !== "kpi") {
      return;
    }

    if (!selectedProcessus) {
      setRows([]);
      return;
    }

    const loadRows = async () => {
      setIsLoadingRows(true);
      setError("");

      try {
        const response = await api.get(
          `/api/dashboard/processus/${encodeURIComponent(selectedProcessus)}?year=${selectedYear}`,
        );
        setRows(Array.isArray(response.data?.rows) ? response.data.rows : []);
      } catch (requestError) {
        setRows([]);
        setError(
          requestError.response?.data?.error || "Unable to load dashboard rows",
        );
      } finally {
        setIsLoadingRows(false);
      }
    };

    loadRows();
  }, [selectedProcessus, selectedYear, activeView]);

  const loadPendingPlanActions = useCallback(async () => {
    setIsLoadingPlanAction(true);
    setError("");

    try {
      const response = await api.get(
        `/api/dashboard/plan-action/pending?year=${selectedYear}`,
      );
      setPlanActionRows(
        Array.isArray(response.data?.rows) ? response.data.rows : [],
      );
    } catch (requestError) {
      setPlanActionRows([]);
      setError(
        requestError.response?.data?.error ||
          "Unable to load plan d'action list",
      );
    } finally {
      setIsLoadingPlanAction(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    if (activeView !== "plan-action") {
      return;
    }

    loadPendingPlanActions();
  }, [activeView, loadPendingPlanActions]);

  useEffect(() => {
    if (activeView === "plan-action") {
      return;
    }

    if (!isPlanActionMenuOpen) {
      return;
    }

    if (planActionRows.length > 0 || isLoadingPlanAction) {
      return;
    }

    loadPendingPlanActions();
  }, [
    activeView,
    isPlanActionMenuOpen,
    isLoadingPlanAction,
    loadPendingPlanActions,
    planActionRows.length,
  ]);

  const loadGeneralRows = useCallback(async () => {
    if (processusList.length === 0) {
      setGeneralRows([]);
      return;
    }

    setIsLoadingGeneral(true);
    setError("");

    try {
      const responses = await Promise.allSettled(
        processusList.map(async (processus) => {
          const response = await api.get(
            `/api/dashboard/processus/${encodeURIComponent(processus)}?year=${selectedYear}`,
          );

          const processRows = Array.isArray(response.data?.rows)
            ? response.data.rows
            : [];
          return processRows.map((row) => ({
            ...row,
            Processus: String(row?.Processus ?? processus).trim() || processus,
          }));
        }),
      );

      const successfulRows = responses.flatMap((result) =>
        result.status === "fulfilled" ? result.value : [],
      );
      const failedCount = responses.filter(
        (result) => result.status === "rejected",
      ).length;

      if (failedCount === responses.length) {
        throw new Error("Impossible de charger les donnees generales.");
      }

      if (failedCount > 0) {
        setError(
          "Certaines donnees de la section generale n'ont pas pu etre chargees.",
        );
      }

      setGeneralRows(successfulRows);
    } catch (requestError) {
      setGeneralRows([]);
      setError(
        requestError.response?.data?.error ||
          requestError.message ||
          "Impossible de charger la section generale.",
      );
    } finally {
      setIsLoadingGeneral(false);
    }
  }, [processusList, selectedYear]);

  useEffect(() => {
    if (!isGeneralView) {
      return;
    }

    loadGeneralRows();
  }, [isGeneralView, loadGeneralRows]);

  const yearOptions = useMemo(
    () =>
      Array.from({ length: YEARS_TO_SHOW }, (_, index) => CURRENT_YEAR - index),
    [],
  );
  const visiblePeriodColumns = useMemo(
    () => resolvePeriodColumns(tablePeriodType),
    [tablePeriodType],
  );
  const currentPeriodTypeLabel = useMemo(
    () =>
      TABLE_PERIOD_OPTIONS.find((option) => option.key === tablePeriodType)
        ?.label || "Periodicite",
    [tablePeriodType],
  );

  const currentUserTypeLabel = useMemo(() => {
    const fromSession = normalizeUserType(authUser?.userType);
    const username = normalizeText(authUser?.username);

    if (!username) {
      return USER_TYPE_LABELS[fromSession];
    }

    const isPiloteInRows = rows.some(
      (row) => normalizeText(row?.Pilote) === username,
    );
    if (isPiloteInRows) {
      return USER_TYPE_LABELS.pilote;
    }

    const isResponsableInRows = rows.some(
      (row) => normalizeText(row?.Responsable) === username,
    );
    if (isResponsableInRows) {
      return USER_TYPE_LABELS.responsable;
    }

    return USER_TYPE_LABELS[fromSession];
  }, [authUser?.userType, authUser?.username, rows]);

  const summary = useMemo(() => {
    if (!rows.length) {
      return {
        indicatorsCount: 0,
        averageRealiseCurrent: null,
        averageRealisePrevious: null,
        averageRealiseTendance: null,
      };
    }

    const realiseCurrentValues = rows
      .map((row) => Number(row.realise_moyenne_current))
      .filter((value) => Number.isFinite(value));

    const realisePreviousValues = rows
      .map((row) => Number(row.realise_moyenne_previous))
      .filter((value) => Number.isFinite(value));

    const realiseTendanceValues = rows
      .map((row) =>
        computeIndicatorTrend(
          row.realise_moyenne_previous,
          row.realise_moyenne_current,
          row.Signe,
        ),
      )
      .filter((value) => Number.isFinite(value));

    const averageRealiseCurrent = realiseCurrentValues.length
      ? realiseCurrentValues.reduce((sum, value) => sum + value, 0) /
        realiseCurrentValues.length
      : null;

    const averageRealisePrevious = realisePreviousValues.length
      ? realisePreviousValues.reduce((sum, value) => sum + value, 0) /
        realisePreviousValues.length
      : null;

    const averageRealiseTendance = realiseTendanceValues.length
      ? realiseTendanceValues.reduce((sum, value) => sum + value, 0) /
        realiseTendanceValues.length
      : null;

    return {
      indicatorsCount: rows.length,
      averageRealiseCurrent,
      averageRealisePrevious,
      averageRealiseTendance,
    };
  }, [rows]);

  const resolveSingleAssignment = useCallback(
    (fieldName) => {
      const values = rows
        .map((row) =>
          typeof row?.[fieldName] === "string" ? row[fieldName].trim() : "",
        )
        .filter((value) => value.length > 0);

      const uniqueValues = [...new Set(values)];

      if (uniqueValues.length === 0) {
        return {
          value: "",
          label: "-",
          isMixed: false,
        };
      }

      if (uniqueValues.length === 1) {
        return {
          value: uniqueValues[0],
          label: uniqueValues[0],
          isMixed: false,
        };
      }

      return {
        value: "",
        label: uniqueValues.join(" / "),
        isMixed: true,
      };
    },
    [rows],
  );

  const responsablesAssignment = useMemo(
    () => resolveSingleAssignment("Responsable"),
    [resolveSingleAssignment],
  );

  const pilotesAssignment = useMemo(
    () => resolveSingleAssignment("Pilote"),
    [resolveSingleAssignment],
  );

  // User names assigned to indicators (indicator_assignments, fallback user_permissions)
  const usersLine = useMemo(() => {
    const values = rows
      .map((row) =>
        typeof row.UserName === "string" ? row.UserName.trim() : "",
      )
      .filter((value) => value.length > 0);

    const uniqueValues = [...new Set(values)];
    return uniqueValues.length ? uniqueValues.join(" / ") : "-";
  }, [rows]);

  const reloadProcessusRows = useCallback(async () => {
    if (!selectedProcessus) {
      setRows([]);
      return;
    }

    const response = await api.get(
      `/api/dashboard/processus/${encodeURIComponent(selectedProcessus)}?year=${selectedYear}`,
    );
    setRows(Array.isArray(response.data?.rows) ? response.data.rows : []);
  }, [selectedProcessus, selectedYear]);

  const updateProcessusResponsable = useCallback(
    async (responsableValue) => {
      if (!selectedProcessus) {
        return;
      }

      await api.put(
        `/api/dashboard/processus/${encodeURIComponent(selectedProcessus)}/responsable`,
        { responsable: responsableValue ?? "" },
      );
      await reloadProcessusRows();
    },
    [selectedProcessus, reloadProcessusRows],
  );

  const updateProcessusPilote = useCallback(
    async (piloteValue) => {
      if (!selectedProcessus) {
        return;
      }

      await api.put(
        `/api/dashboard/processus/${encodeURIComponent(selectedProcessus)}/pilote`,
        { pilote: piloteValue ?? "" },
      );
      await reloadProcessusRows();
    },
    [selectedProcessus, reloadProcessusRows],
  );

  const planProcessusOptions = useMemo(
    () =>
      [
        ...new Set(
          processusList
            .map((row) => String(row ?? "").trim())
            .filter((value) => value.length > 0),
        ),
      ].sort((a, b) => a.localeCompare(b, "fr")),
    [processusList],
  );

  const planResponsableOptions = useMemo(
    () =>
      [
        ...new Set(
          responsablesList
            .map((r) => String(r.responsable ?? "").trim())
            .filter((value) => value.length > 0),
        ),
      ].sort((a, b) => a.localeCompare(b, "fr")),
    [responsablesList],
  );

  const planAnneeOptions = useMemo(() => {
    // Combine years from database (historical) with current year
    const dbYears = planYearsList.map(String);
    const currentYearStr = String(CURRENT_YEAR);
    // Add current year if not in database
    if (!dbYears.includes(currentYearStr)) {
      dbYears.unshift(currentYearStr);
    }
    // Sort descending
    return dbYears.sort((a, b) => Number(b) - Number(a));
  }, [planYearsList]);

  const planMoisOptions = useMemo(
    () => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    [],
  );

  const filteredPlanActionRows = useMemo(() => {
    const designationQuery = normalizeText(planDesignationSearch);
    const globalQuery = normalizeText(planGlobalSearch);

    return planActionRows.filter((row) => {
      const designationText = normalizeText(row.Designation);
      if (designationQuery && !designationText.includes(designationQuery)) {
        return false;
      }

      if (globalQuery) {
        const haystack = [
          row.Indicateur,
          row.Processus,
          row.Designation,
          row.responsable,
          row.mois,
          row.annee,
          row.rootCause,
          row.action,
          row.dateclotprevu,
          row.efficacit,
          row.datecreation,
          row.PROGRESS,
          row.statusText,
          row.pendingReason,
          row.hasPlanInfo,
          row.dateclot,
        ]
          .map((value) => normalizeText(value))
          .join(" ");

        if (!haystack.includes(globalQuery)) {
          return false;
        }
      }

      if (
        planFilterProcessus !== "all" &&
        String(row.Processus ?? "").trim() !== planFilterProcessus
      ) {
        return false;
      }

      if (
        planFilterResponsable !== "all" &&
        String(row.responsable ?? "").trim() !== planFilterResponsable
      ) {
        return false;
      }

      if (
        planFilterAnnee !== "all" &&
        String(row.annee ?? "").trim() !== planFilterAnnee
      ) {
        return false;
      }

      if (
        planFilterMois !== "all" &&
        String(row.mois ?? "").trim() !== planFilterMois
      ) {
        return false;
      }

      const progressValue = Number(row.PROGRESS);
      const hasProgress = Number.isFinite(progressValue);

      if (planFilterProgress === "no-progress") {
        return !hasProgress;
      }

      if (planFilterProgress === "low") {
        return !hasProgress || progressValue == 25;
      }

      if (planFilterProgress === "mid") {
        return hasProgress && progressValue == 50;
      }
      if (planFilterProgress === "mid-high") {
        return hasProgress && progressValue == 75;
      }
      if (planFilterProgress === "high") {
        return hasProgress && progressValue == 100;
      }

      const implemented = hasPlanDetails(row);

      if (planFilterImplementation === "implemented") {
        return implemented;
      }

      if (planFilterImplementation === "missing") {
        return !implemented;
      }

      return true;
    });
  }, [
    planActionRows,
    planDesignationSearch,
    planGlobalSearch,
    planFilterProcessus,
    planFilterResponsable,
    planFilterAnnee,
    planFilterMois,
    planFilterProgress,
    planFilterImplementation,
  ]);

  const planActionByProcessus = useMemo(() => {
    const grouped = new Map();

    planActionRows.forEach((row) => {
      const processName =
        String(row.Processus ?? "").trim() || "Sans processus";
      const current = grouped.get(processName) || {
        count: 0,
        indicators: new Set(),
      };
      current.count += 1;
      current.indicators.add(
        String(row.Designation ?? row.Indicateur ?? "").trim(),
      );
      grouped.set(processName, current);
    });

    return [...grouped.entries()]
      .map(([processus, data]) => ({
        processus,
        count: data.count,
        indicatorsPreview: [...data.indicators].filter(Boolean).slice(0, 2),
      }))
      .sort((a, b) => a.processus.localeCompare(b.processus, "fr"));
  }, [planActionRows]);

  const generalProcessusOptions = useMemo(
    () =>
      [
        ...new Set(
          generalRows
            .map((row) => String(row?.Processus ?? "").trim())
            .filter(Boolean),
        ),
      ].sort((left, right) =>
        compareProcessusEntries(
          parseProcessusEntry(left),
          parseProcessusEntry(right),
        ),
      ),
    [generalRows],
  );

  const generalSelectedMonthColumn = useMemo(() => {
    const monthIndex = Number.parseInt(String(generalMonthFilter ?? ""), 10);
    return (
      MONTH_COLUMNS[monthIndex - 1] || MONTH_COLUMNS[new Date().getMonth()]
    );
  }, [generalMonthFilter]);

  const filteredGeneralRows = useMemo(
    () =>
      generalRows
        .filter((row) => {
          if (generalProcessusFilter === "all") {
            return true;
          }

          return String(row?.Processus ?? "").trim() === generalProcessusFilter;
        })
        .sort((left, right) => {
          const processCompare = compareProcessusEntries(
            parseProcessusEntry(left?.Processus),
            parseProcessusEntry(right?.Processus),
          );

          if (processCompare !== 0) {
            return processCompare;
          }

          return String(
            left?.Designation ?? left?.Indicateur ?? "",
          ).localeCompare(
            String(right?.Designation ?? right?.Indicateur ?? ""),
            "fr",
          );
        }),
    [generalProcessusFilter, generalRows],
  );

  const generalMonthlyRows = useMemo(
    () =>
      filteredGeneralRows
        .map((row) => {
          const objectiveValue = toFiniteNumber(
            row?.[`objective_${generalSelectedMonthColumn.key}`],
          );
          const realiseValue = toFiniteNumber(
            row?.[`realise_${generalSelectedMonthColumn.key}`],
          );
          const performance = evaluatePerformance(
            realiseValue,
            objectiveValue,
            row?.Signe,
          );

          return {
            ...row,
            objectiveValue,
            realiseValue,
            performance,
          };
        })
        .filter(
          (row) => row.objectiveValue !== null || row.realiseValue !== null,
        ),
    [filteredGeneralRows, generalSelectedMonthColumn],
  );

  const generalMonthlyGroups = useMemo(() => {
    const grouped = new Map();

    generalMonthlyRows.forEach((row) => {
      const processName =
        String(row?.Processus ?? "").trim() || "Sans processus";
      const currentRows = grouped.get(processName) || [];
      currentRows.push(row);
      grouped.set(processName, currentRows);
    });

    return [...grouped.entries()]
      .map(([processus, items]) => ({
        processus,
        items: items.sort((left, right) =>
          String(left?.Designation ?? left?.Indicateur ?? "").localeCompare(
            String(right?.Designation ?? right?.Indicateur ?? ""),
            "fr",
          ),
        ),
      }))
      .sort((left, right) =>
        compareProcessusEntries(
          parseProcessusEntry(left.processus),
          parseProcessusEntry(right.processus),
        ),
      );
  }, [generalMonthlyRows]);

  const generalMonthlySummary = useMemo(() => {
    const comparableRows = generalMonthlyRows.filter(
      (row) => row.objectiveValue !== null && row.realiseValue !== null,
    );
    const conformingCount = comparableRows.filter(
      (row) => row.performance === "good",
    ).length;
    const nonConformingCount = comparableRows.filter(
      (row) => row.performance === "bad",
    ).length;

    return {
      processCount: generalMonthlyGroups.length,
      indicatorCount: generalMonthlyRows.length,
      conformingCount,
      nonConformingCount,
      missingCount: Math.max(
        0,
        generalMonthlyRows.length - comparableRows.length,
      ),
    };
  }, [generalMonthlyGroups, generalMonthlyRows]);

  const generalAnnualSummary = useMemo(() => {
    const averageRealiseTrend = averageFiniteNumbers(
      filteredGeneralRows
        .map((row) =>
          computeIndicatorTrend(
            row?.realise_moyenne_previous,
            row?.realise_moyenne_current,
            row?.Signe,
          ),
        )
        .filter((value) => value !== null),
    );

    return {
      processCount:
        generalProcessusFilter === "all"
          ? [
              ...new Set(
                filteredGeneralRows
                  .map((row) => String(row?.Processus ?? "").trim())
                  .filter(Boolean),
              ),
            ].length
          : filteredGeneralRows.length > 0
            ? 1
            : 0,
      indicatorCount: filteredGeneralRows.length,
      averageObjectiveCurrent: averageFiniteNumbers(
        filteredGeneralRows.map((row) => row?.objective_moyenne_current),
      ),
      averageRealiseCurrent: averageFiniteNumbers(
        filteredGeneralRows.map((row) => row?.realise_moyenne_current),
      ),
      averageRealiseTrend,
    };
  }, [filteredGeneralRows, generalProcessusFilter]);

  // Fonctions pour la modale objectifs
  const openObjectiveModal = async (row) => {
    setCurrentEditingRow(row);

    const monthVals = {};
    MONTH_COLUMNS.forEach((m) => {
      monthVals[m.key] = row[`objective_${m.key}`] ?? null;
    });

    let detectedType = "mensuelle";
    let groupVals = { ...monthVals };

    const nonNullValues = Object.values(monthVals).filter((v) => v !== null);
    if (
      nonNullValues.length > 0 &&
      nonNullValues.every((v) => v === nonNullValues[0])
    ) {
      detectedType = "annuelle";
      groupVals = { annual: nonNullValues[0] };
    } else {
      const quarters = {
        q1: ["janv", "fev", "mars"],
        q2: ["avril", "mai", "juin"],
        q3: ["juil", "aout", "sept"],
        q4: ["oct", "nov", "decem"],
      };
      let isQuarterly = true;
      const qVals = {};
      for (const [q, months] of Object.entries(quarters)) {
        const qValues = months
          .map((m) => monthVals[m])
          .filter((v) => v !== null);
        if (qValues.length > 0 && qValues.every((v) => v === qValues[0])) {
          qVals[q] = qValues[0];
        } else {
          isQuarterly = false;
        }
      }
      if (isQuarterly && Object.keys(qVals).length === 4) {
        detectedType = "trimestrielle";
        groupVals = qVals;
      }
    }

    setModalPeriodType(detectedType);
    setModalGroupValues(groupVals);

    // Load existing deadlines from objective_deadlines table
    try {
      const dlRes = await api.get(
        `/api/objectives/deadlines/${encodeURIComponent(row.Indicateur)}`,
      );
      const deadlines = {};
      (dlRes.data || []).forEach((d) => {
        deadlines[d.period_key] = d.date_limite
          ? d.date_limite.substring(0, 10)
          : "";
      });
      setModalDeadlines(deadlines);
    } catch {
      setModalDeadlines({});
    }

    setObjectiveModalOpen(true);
  };

  const getMonthValuesFromGroup = (group, type) => {
    const monthVals = {};
    if (type === "annuelle" && group.annual !== undefined) {
      MONTH_COLUMNS.forEach((m) => (monthVals[m.key] = group.annual));
    } else if (type === "trimestrielle") {
      const map = {
        q1: ["janv", "fev", "mars"],
        q2: ["avril", "mai", "juin"],
        q3: ["juil", "aout", "sept"],
        q4: ["oct", "nov", "decem"],
      };
      Object.entries(map).forEach(([q, months]) => {
        const v = group[q];
        if (v !== undefined) {
          months.forEach((m) => (monthVals[m] = v));
        }
      });
    } else {
      return group;
    }
    return monthVals;
  };

  const handleSaveObjective = async () => {
    if (!currentEditingRow) return;
    setIsSavingObjective(true);
    setModalError("");

    try {
      const indicateur = currentEditingRow.Indicateur;

      // Save deadlines to objective_deadlines table
      const periodTypeMap = {
        annuelle: "year",
        trimestrielle: "quarter",
        mensuelle: "month",
      };
      const ptType = periodTypeMap[modalPeriodType] || "month";
      const deadlineKeys =
        modalPeriodType === "annuelle"
          ? ["annual"]
          : modalPeriodType === "trimestrielle"
            ? ["q1", "q2", "q3", "q4"]
            : MONTH_COLUMNS.map((m) => m.key);

      for (const key of deadlineKeys) {
        const dlValue = modalDeadlines[key] || null;
        const periodKey =
          modalPeriodType === "annuelle" ? String(selectedYear) : key;
        await api.post("/api/objectives/deadlines", {
          indicateur,
          period_type: ptType,
          period_key: periodKey,
          date_limite: dlValue,
        });
      }

      const newMonthVals = getMonthValuesFromGroup(
        modalGroupValues,
        modalPeriodType,
      );

      for (const { key } of MONTH_COLUMNS) {
        const newVal = newMonthVals[key];
        const oldVal = currentEditingRow[`objective_${key}`];
        const changed =
          newVal !== oldVal ||
          (newVal === null && oldVal !== null) ||
          (newVal !== null && oldVal === null);
        if (changed) {
          await api.put(
            `/api/dashboard/objective/${encodeURIComponent(indicateur)}`,
            {
              year: selectedYear,
              month: key,
              value: newVal,
            },
          );
        }
      }

      const response = await api.get(
        `/api/dashboard/processus/${encodeURIComponent(selectedProcessus)}?year=${selectedYear}`,
      );
      setRows(response.data.rows || []);
      await loadProfileTaskNotifications();
      setObjectiveModalOpen(false);
    } catch (err) {
      // Show detailed error message if available
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.details ||
        "Erreur lors de la sauvegarde des objectifs.";
      console.error("Objective save error:", err.response?.data);
      setModalError(errorMsg);
    } finally {
      setIsSavingObjective(false);
    }
  };
  const handleSigneSubmit = async () => {
    try {
      await createOutils({ Signe: signeText });
      console.log("Signe saved !");
      setSigneText("");
      setIsSigneOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUniteSubmit = async () => {
    try {
      await createOutils({ Unite: uniteText });
      console.log("Unite saved !");
      setUniteText("");
      setIsUniteOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Fonctions pour la modale saisie réalisé
  const openRealiseModal = (row) => {
    const monthVals = {};
    MONTH_COLUMNS.forEach((m) => {
      monthVals[m.key] = row[`realise_${m.key}`] ?? null;
    });
    setRealiseModalValues(monthVals);
    setRealiseMlStatus(null);
    setRealiseMlLoadingKey("");
    setCurrentEditingRealiseRow(row);
    setRealiseModalOpen(true);
  };

  const buildRealiseMlPayload = (monthKey, options = {}) => {
    if (!currentEditingRealiseRow) {
      return null;
    }

    const includeRealisation = Boolean(options.includeRealisation);
    const objectif = toFiniteNumber(
      currentEditingRealiseRow[`objective_${monthKey}`],
    );
    const realisation = toFiniteNumber(realiseModalValues[monthKey]);
    const mois = MONTH_INDEX_BY_KEY[monthKey];
    const signe = String(currentEditingRealiseRow.Signe ?? "").trim();
    const unite = String(currentEditingRealiseRow.Unite ?? "").trim();

    if (!Number.isInteger(mois) || objectif === null) {
      return null;
    }

    const payload = {
      indicateur: currentEditingRealiseRow.Indicateur,
      annee: selectedYear,
      mois,
      objectif,
      processus: currentEditingRealiseRow.Processus,
    };

    if (!includeRealisation) {
      return payload;
    }

    if (realisation === null || !signe || !unite) {
      return null;
    }

    return {
      ...payload,
      realisation,
      signe,
      unite,
    };
  };

  const handlePredictRealiseMonth = async (monthKey) => {
    const payload = buildRealiseMlPayload(monthKey);
    if (!payload) {
      setRealiseMlStatus({
        type: "error",
        monthKey,
        message: "Objectif mensuel manquant pour lancer la prediction.",
      });
      return;
    }

    setRealiseMlLoadingKey(`predict-${monthKey}`);
    setRealiseMlStatus(null);

    try {
      const response = await predictMLRealisation(payload);
      const prediction = response.data;
      const predictedValue = toFiniteNumber(prediction.realisation_predite);

      if (predictedValue === null) {
        setRealiseMlStatus({
          type: "error",
          monthKey,
          message: "Prediction ML retournee sans valeur exploitable.",
        });
        return;
      }

      setRealiseMlStatus({
        type: "success",
        monthKey,
        message: `${formatNumber(predictedValue)} ${formatMathUnit(currentEditingRealiseRow.Unite)} - taux ${formatNumber(prediction.taux_predit)}%, statut ${prediction.statut || "n/a"}, probabilite ${formatNumber(Number(prediction.probabilite || 0) * 100)}%.`,
        prediction: {
          monthKey,
          value: predictedValue,
        },
      });
    } catch (requestError) {
      setRealiseMlStatus({
        type: "error",
        monthKey,
        message:
          requestError.response?.data?.details ||
          requestError.response?.data?.error ||
          "Prediction ML indisponible.",
      });
    } finally {
      setRealiseMlLoadingKey("");
    }
  };

  const handleApplyPredictedRealise = (prediction) => {
    if (!prediction?.monthKey || prediction.value === null) {
      return;
    }

    setRealiseModalValues((prev) => ({
      ...prev,
      [prediction.monthKey]: prediction.value,
    }));
    setRealiseMlStatus({
      type: "success",
      monthKey: prediction.monthKey,
      message: `Prediction appliquee: ${formatNumber(prediction.value)} ${formatMathUnit(currentEditingRealiseRow?.Unite)}.`,
    });
  };

  const handleTestRealiseMonth = async (monthKey) => {
    const payload = buildRealiseMlPayload(monthKey, {
      includeRealisation: true,
    });
    if (!payload) {
      setRealiseMlStatus({
        type: "error",
        monthKey,
        message:
          "Objectif, realise, signe ou unite manquant pour lancer le test d'anomalie ML.",
      });
      return;
    }

    setRealiseMlLoadingKey(`test-${monthKey}`);
    setRealiseMlStatus(null);

    try {
      const response = await testMLAnomaly(payload);
      const result = response.data;
      const isAnomaly = Number(result.is_anomaly) === 1;
      const anomalyScore = toFiniteNumber(result.anomaly_score);

      setRealiseMlStatus({
        type: isAnomaly ? "warning" : "success",
        monthKey,
        message: `Anomalie ML ${MONTH_COLUMNS[payload.mois - 1]?.label}: ${isAnomaly ? "anomalie detectee" : "aucune anomalie"} - score ${formatNumber(anomalyScore)}. ${result.interpretation || ""}`,
      });
    } catch (requestError) {
      setRealiseMlStatus({
        type: "error",
        monthKey,
        message:
          requestError.response?.data?.details ||
          requestError.response?.data?.error ||
          "Test ML indisponible.",
      });
    } finally {
      setRealiseMlLoadingKey("");
    }
  };

  const handleSaveRealise = async () => {
    if (!currentEditingRealiseRow) return;
    setIsSavingRealise(true);
    const indicateur = currentEditingRealiseRow.Indicateur;
    try {
      for (const { key } of MONTH_COLUMNS) {
        await api.put(
          `/api/dashboard/realise/${encodeURIComponent(indicateur)}`,
          {
            year: selectedYear,
            month: key,
            value: realiseModalValues[key],
          },
        );
      }
      const refreshed = await api.get(
        `/api/dashboard/processus/${encodeURIComponent(selectedProcessus)}?year=${selectedYear}`,
      );
      setRows(refreshed.data.rows || []);
      await loadProfileTaskNotifications();
      setRealiseModalOpen(false);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save realise values");
    } finally {
      setIsSavingRealise(false);
    }
  };

  const handleAdminCreateProcessus = async () => {
    if (!newProcName.trim() || !effectiveProcessusCodePrefix) return;
    const storageProcessusPrefix = toStorageProcessusPrefix(
      effectiveProcessusCodePrefix,
    );
    const processusToCreate = storageProcessusPrefix
      ? `${storageProcessusPrefix} ${newProcName.trim()}`
      : "";
    if (!processusToCreate) return;
    const indicatorsWithDesignation = newProcIndicators.filter((i) =>
      i.designation.trim(),
    );
    if (indicatorsWithDesignation.length === 0) {
      setError("Ajoutez au moins une designation d'indicateur.");
      return;
    }

    const generatedCodes = new Set();
    const indicatorsPayload = indicatorsWithDesignation.map((indicatorRow) => {
      const baseCode = buildIndicatorCodeBase(
        effectiveProcessusCodePrefix,
        indicatorRow.designation,
      );
      const indicateurCode = buildUniqueIndicatorCode(
        baseCode || `${toStorageProcessusPrefix(effectiveProcessusCodePrefix)}`,
        generatedCodes,
      );

      return {
        ...indicatorRow,
        indicateur: indicateurCode,
        designation: indicatorRow.designation.trim(),
      };
    });

    setAdminSaving(true);
    setError("");
    try {
      await api.post("/api/dashboard/processus", {
        processus: processusToCreate,
        responsable: newProcResponsable,
        pilote: newProcPilote,
        Annee: selectedYear,
        indicators: indicatorsPayload,
      });
      const resp = await api.get("/api/dashboard/processus");
      setProcessusList(
        Array.isArray(resp.data?.processus) ? resp.data.processus : [],
      );
      setSelectedProcessus(processusToCreate);
      setNewProcName("");
      setNewProcCodePrefix(suggestedProcessusCode);
      setNewProcResponsable("");
      setNewProcPilote("");
      setNewProcIndicators([
        {
          indicateur: "",
          designation: "",
          signe: "",
          unite: "",
          responsable: "",
          responsableAction: "",
        },
      ]);
      setAdminPanelOpen(false);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create processus");
    } finally {
      setAdminSaving(false);
    }
  };

  const handleAdminCreateIndicateur = async () => {
    const trimmedProcessus = String(selectedProcessus ?? "").trim();
    const trimmedDesignation = newIndFields.designation.trim();
    if (!trimmedDesignation || !trimmedProcessus) return;

    const indicateurCode =
      suggestedNewIndicatorCode ||
      buildIndicatorCodeBase(
        getProcessusCodePrefixFromRaw(trimmedProcessus),
        trimmedDesignation,
      );
    if (!indicateurCode) {
      setError("Impossible de générer un code indicateur.");
      return;
    }

    setAdminSaving(true);
    setError("");
    try {
      await api.post("/api/dashboard/indicateur", {
        ...newIndFields,
        processus: trimmedProcessus,
        indicateur: indicateurCode,
        designation: trimmedDesignation,
        Annee: selectedYear,
      });
      if (trimmedProcessus) {
        const resp = await api.get(
          `/api/dashboard/processus/${encodeURIComponent(selectedProcessus)}?year=${selectedYear}`,
        );
        setRows(Array.isArray(resp.data?.rows) ? resp.data.rows : []);
      }
      setNewIndFields({
        processus: "",
        designation: "",
        signe: "",
        unite: "",
        responsable: "",
        pilote: "",
        responsableAction: "",
      });
      setAdminPanelOpen(false);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create indicateur");
    } finally {
      setAdminSaving(false);
    }
  };

  return (
    <div
      className={`dashboard-page ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}
      data-theme={theme}
    >
      <aside className="dashboard-sidebar">
        <button
          type="button"
          className="dashboard-sidebar-toggle"
          aria-expanded={!isSidebarCollapsed}
          aria-label={isSidebarCollapsed ? "Open sidebar" : "Close sidebar"}
          onClick={() => setIsSidebarCollapsed((prev) => !prev)}
        >
          <span className="dashboard-sidebar-toggle-icon">
            {isSidebarCollapsed ? (
              <FontAwesomeIcon icon={byPrefixAndName.fa.arrowRight} />
            ) : (
              <FontAwesomeIcon icon={byPrefixAndName.fa.bars} />
            )}
          </span>
        </button>

        {isLoadingProcessus ? (
          <p className="dashboard-sidebar-state">Loading processus...</p>
        ) : (
          <>
            <div
              className={`dashboard-processus-menu ${isDashboardMenuOpen ? "open" : ""}`}
              onMouseEnter={() => setIsDashboardMenuOpen(true)}
              onMouseLeave={() => setIsDashboardMenuOpen(false)}
              onFocus={() => setIsDashboardMenuOpen(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setIsDashboardMenuOpen(false);
                }
              }}
            >
              <button
                type="button"
                className={`dashboard-processus-trigger ${activeView === "dashboard" ? "active" : ""}`}
                aria-haspopup="true"
                aria-expanded={isDashboardMenuOpen}
                onClick={openDashboardRoute}
              >
                <span className="dashboard-trigger-label">
                  <span className="dashboard-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path d="M4 18h4V9H4zm6 0h4V6h-4zm6 0h4V12h-4z" />
                    </svg>
                  </span>
                  <span>Tableau de bord</span>
                </span>
                <span className="dashboard-processus-caret">v</span>
              </button>
            </div>

            <div
              className={`dashboard-processus-menu ${isProcessusMenuOpen ? "open" : ""}`}
              onMouseEnter={() => setIsProcessusMenuOpen(true)}
              onMouseLeave={() => setIsProcessusMenuOpen(false)}
              onFocus={() => setIsProcessusMenuOpen(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setIsProcessusMenuOpen(false);
                }
              }}
            >
              <button
                type="button"
                className={`dashboard-processus-trigger ${activeView === "kpi" ? "active" : ""}`}
                aria-haspopup="menu"
                aria-expanded={isProcessusMenuOpen}
                onClick={() => openProcessusRoute(selectedProcessus)}
              >
                <span className="dashboard-trigger-label">
                  <span className="dashboard-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path d="M4 6h16v3H4zM4 11h10v3H4zM4 16h13v3H4z" />
                    </svg>
                  </span>
                  <span>Processus</span>
                </span>
                <span className="dashboard-processus-caret">v</span>
              </button>

              <div
                className="dashboard-processus-dropdown"
                role="menu"
                aria-label="Processus list"
              >
                {groupedProcessusOptions.length === 0 ? (
                  <div className="dashboard-collapsible-placeholder">
                    No processus found
                  </div>
                ) : (
                  groupedProcessusOptions.map((group) => (
                    <div
                      key={`group-${group.category}`}
                      className="dashboard-processus-category"
                      role="none"
                    >
                      <div className="dashboard-processus-category-title">
                        {CATEGORY_LABELS[group.category] || group.category}
                      </div>

                      {group.items.map((processus) => {
                        const primaryLabel = processus.code || processus.label;
                        const secondaryLabel = processus.code
                          ? processus.name
                          : "";

                        return (
                          <button
                            key={processus.raw}
                            type="button"
                            role="menuitem"
                            className={`dashboard-processus-option ${selectedProcessus === processus.raw ? "selected" : ""}`}
                            onClick={() => {
                              setSelectedProcessus(processus.raw);
                              setIsProcessusMenuOpen(false);
                              openProcessusRoute(processus.raw);
                            }}
                          >
                            <span className="dashboard-option-label dashboard-option-label--processus">
                              <span
                                className="dashboard-option-icon"
                                aria-hidden="true"
                              >
                                <svg viewBox="0 0 24 24" focusable="false">
                                  <path d="M12 4a8 8 0 108 8 8 8 0 00-8-8zm0 3a5 5 0 11-5 5 5 5 0 015-5z" />
                                </svg>
                              </span>
                              <span className="dashboard-option-details">
                                <span className="dashboard-option-primary">
                                  {primaryLabel}
                                </span>
                                {secondaryLabel ? (
                                  <span className="dashboard-option-secondary">
                                    {secondaryLabel}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div
              className={`dashboard-processus-menu ${isGeneralMenuOpen ? "open" : ""}`}
              onMouseEnter={() => setIsGeneralMenuOpen(true)}
              onMouseLeave={() => setIsGeneralMenuOpen(false)}
              onFocus={() => setIsGeneralMenuOpen(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setIsGeneralMenuOpen(false);
                }
              }}
            >
              <button
                type="button"
                className={`dashboard-processus-trigger ${isGeneralView ? "active" : ""}`}
                aria-haspopup="true"
                aria-expanded={isGeneralMenuOpen}
                onClick={openGeneralMonthlyRoute}
              >
                <span className="dashboard-trigger-label">
                  <span className="dashboard-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path d="M4 5h16v4H4zm0 6h16v4H4zm0 6h16v2H4z" />
                    </svg>
                  </span>
                  <span>Generale</span>
                </span>
                <span className="dashboard-processus-caret">v</span>
              </button>

              <div
                className="dashboard-processus-dropdown"
                role="menu"
                aria-label="Sections generales"
              >
                <button
                  type="button"
                  role="menuitem"
                  className={`dashboard-processus-option ${activeView === "general-monthly" ? "selected" : ""}`}
                  onClick={() => {
                    setIsGeneralMenuOpen(false);
                    openGeneralMonthlyRoute();
                  }}
                >
                  <span className="dashboard-plan-group-line">
                    <span>Mensuelle</span>
                    <span className="dashboard-plan-group-count">
                      {generalMonthlySummary.indicatorCount}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className={`dashboard-processus-option ${activeView === "general-annual" ? "selected" : ""}`}
                  onClick={() => {
                    setIsGeneralMenuOpen(false);
                    openGeneralAnnualRoute();
                  }}
                >
                  <span className="dashboard-plan-group-line">
                    <span>Annuelle</span>
                    <span className="dashboard-plan-group-count">
                      {filteredGeneralRows.length}
                    </span>
                  </span>
                </button>
              </div>
            </div>

            <div
              className={`dashboard-processus-menu ${isPlanActionMenuOpen ? "open" : ""}`}
              onMouseEnter={() => setIsPlanActionMenuOpen(true)}
              onMouseLeave={() => setIsPlanActionMenuOpen(false)}
              onFocus={() => setIsPlanActionMenuOpen(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setIsPlanActionMenuOpen(false);
                }
              }}
            >
              <button
                type="button"
                className={`dashboard-processus-trigger ${activeView === "plan-action" ? "active" : ""}`}
                aria-haspopup="true"
                aria-expanded={isPlanActionMenuOpen}
                onClick={openPlanActionRoute}
              >
                <span className="dashboard-trigger-label">
                  <span className="dashboard-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path d="M5 5h14v3H5zM5 10h14v3H5zM5 15h9v3H5z" />
                    </svg>
                  </span>
                  <span>Plan d'action</span>
                </span>
                <span className="dashboard-processus-caret">v</span>
              </button>

              <div
                className="dashboard-processus-dropdown"
                role="region"
                aria-label="Plan d'action content"
              >
                {isLoadingPlanAction ? (
                  <div className="dashboard-collapsible-placeholder">
                    Loading pending indicators...
                  </div>
                ) : planActionByProcessus.length === 0 ? (
                  <div className="dashboard-collapsible-placeholder">
                    No pending indicators found
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`dashboard-processus-option ${planFilterProcessus === "all" ? "selected" : ""}`}
                      onClick={() => {
                        setPlanFilterProcessus("all");
                        setIsPlanActionMenuOpen(false);
                        openPlanActionRoute();
                      }}
                    >
                      <span className="dashboard-plan-group-line">
                        <span>All processus</span>
                        <span className="dashboard-plan-group-count">
                          {planActionRows.length}
                        </span>
                      </span>
                    </button>

                    {planActionByProcessus.map((group) => (
                      <button
                        key={group.processus}
                        type="button"
                        className={`dashboard-processus-option ${planFilterProcessus === group.processus ? "selected" : ""}`}
                        onClick={() => {
                          setPlanFilterProcessus(group.processus);
                          setIsPlanActionMenuOpen(false);
                          openPlanActionRoute();
                        }}
                      >
                        <span className="dashboard-plan-group-line">
                          <span>{group.processus}</span>
                          <span className="dashboard-plan-group-count">
                            {group.count}
                          </span>
                        </span>
                        {group.indicatorsPreview.length ? (
                          <span className="dashboard-plan-group-preview">
                            {group.indicatorsPreview.join(" / ")}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* Sidebar bottom navigation */}
        <nav className="db-sidebar-nav" aria-label="Navigation">
          <div className="db-sidebar-nav-divider" />
          <button
            type="button"
            className={`db-sidebar-nav-item ${visibleProfilePendingCount > 0 ? "db-sidebar-nav-item--with-notification" : ""}`}
            onClick={() => navigate("/profile")}
            title={
              visibleProfilePendingCount > 0
                ? `Mon Profil - ${visibleProfilePendingCount} notification(s) en attente`
                : "Mon Profil"
            }
          >
            <span className="db-sidebar-nav-icon">P</span>
            <span className="db-sidebar-nav-label">Mon Profil</span>
            {visibleProfilePendingCount > 0 ? (
              <span
                className="db-sidebar-nav-notification-dot"
                aria-hidden="true"
              />
            ) : null}
          </button>

          {authUser?.isAdmin && (
            <button
              type="button"
              className="db-sidebar-nav-item db-sidebar-nav-item--admin"
              onClick={() => navigate("/admin")}
              title="Administration"
            >
              <span className="db-sidebar-nav-icon">A</span>
              <span className="db-sidebar-nav-label">Administration</span>
            </button>
          )}
        </nav>
      </aside>

      <main className="dashboard-main">
        <div className="dashboard-main-header">
          <div>
            <h2>
              {activeView === "dashboard"
                ? "Tableau de Bord"
                : activeView === "plan-action"
                  ? "Plan d'action"
                  : activeView === "general-monthly"
                    ? "Generale - Mensuelle"
                    : activeView === "general-annual"
                      ? "Generale - Annuelle"
                      : processusLabelByRaw.get(selectedProcessus) ||
                        selectedProcessus ||
                        "Dashboard"}
            </h2>
            <p>
              {activeView === "dashboard"
                ? `Vue globale par processus pour ${selectedYear}, avec progression KPI, couverture de saisie et suivi des plans d'action.`
                : activeView === "plan-action"
                  ? "Indicators not yet realized with current action plan status."
                  : activeView === "general-monthly"
                    ? `Lecture mensuelle consolidee par processus pour ${generalSelectedMonthLabel} ${selectedYear}.`
                    : activeView === "general-annual"
                      ? `Vue annuelle consolidee des indicateurs pour ${selectedYear}, sur le modele du tableau processus.`
                      : `Objectif and Realise values for ${selectedYear}, with moyenne comparison vs ${selectedYear - 1}.`}
            </p>
            <p className="dashboard-user-type-label">
              Utilisateur = {currentUserTypeLabel}
            </p>
          </div>
          <div className="dashboard-header-controls">
            {activeView !== "plan-action" ? (
              <label className="dashboard-year-picker">
                <span>Annee</span>
                <select
                  value={selectedYear}
                  onChange={(event) =>
                    setSelectedYear(Number(event.target.value))
                  }
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {activeView === "kpi" ? (
              <label className="dashboard-period-picker">
                <span>Periodicite</span>
                <select
                  value={tablePeriodType}
                  onChange={(event) => setTablePeriodType(event.target.value)}
                >
                  {TABLE_PERIOD_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <button
              type="button"
              className="dashboard-theme-toggle"
              onClick={onToggleTheme}
            >
              {theme === "dark" ? <FaSun /> : <FaMoon />}
            </button>

            <button
              type="button"
              className="dashboard-theme-toggle-imp"
              onClick={() => window.print()}
              title="Imprimer la page"
            >
              Imprimer
            </button>
            {isGeneralView ? (
              <div className="ai-ml ai-ml--general">
                <button
                  className={`ai-main-button ${showAiButtons ? "ai-chart" : ""}`}
                  onClick={() => {
                    setShowAiButtons(!showAiButtons);
                    if (!showAiButtons) setActiveTab("ml");
                  }}
                  type="button"
                >
                  Synthese AI
                </button>
              </div>
            ) : null}

            {activeView === "dashboard" ? (
              <div className="dashboard-summary">
                <div className="dashboard-summary-card">
                  <span>Processus</span>
                  <strong>{dashboardSummary.processCount}</strong>
                </div>
                <div className="dashboard-summary-card">
                  <span>Indicateurs</span>
                  <strong>{dashboardSummary.indicatorCount}</strong>
                </div>
                <div className="dashboard-summary-card">
                  <span>Progression KPI moyenne</span>
                  <strong>
                    {formatPercent(dashboardSummary.averageKpiProgress)}
                  </strong>
                </div>
                <div className="dashboard-summary-card">
                  <span>Couverture de saisie</span>
                  <strong>
                    {formatPercent(dashboardSummary.averageCoverageRate)}
                  </strong>
                </div>
              </div>
            ) : activeView === "kpi" ? (
              <div className="dashboard-summary">
                <div className="dashboard-summary-card">
                  <span>Indicators</span>
                  <strong>{summary.indicatorsCount}</strong>
                </div>
                <div className="dashboard-summary-card">
                  <span>Avg Realise {selectedYear}</span>
                  <strong>{formatNumber(summary.averageRealiseCurrent)}</strong>
                </div>
                <div className="dashboard-summary-card">
                  <span>Avg Realise {selectedYear - 1}</span>
                  <strong>
                    {formatNumber(summary.averageRealisePrevious)}
                  </strong>
                </div>
                <div className="dashboard-summary-card">
                  <span>Avg Tendance</span>
                  <strong
                    className={trendClass(summary.averageRealiseTendance)}
                  >
                    {formatTrend(summary.averageRealiseTendance)}
                  </strong>
                </div>
              </div>
            ) : activeView === "general-monthly" ? (
              <div className="dashboard-summary">
                <div className="dashboard-summary-card">
                  <span>Processus affiches</span>
                  <strong>{generalMonthlySummary.processCount}</strong>
                </div>
                <div className="dashboard-summary-card">
                  <span>Indicateurs visibles</span>
                  <strong>{generalMonthlySummary.indicatorCount}</strong>
                </div>
                <div className="dashboard-summary-card">
                  <span>Conformes</span>
                  <strong>{generalMonthlySummary.conformingCount}</strong>
                </div>
                <div className="dashboard-summary-card">
                  <span>Non conformes</span>
                  <strong>{generalMonthlySummary.nonConformingCount}</strong>
                </div>
              </div>
            ) : activeView === "general-annual" ? (
              <div className="dashboard-summary">
                <div className="dashboard-summary-card">
                  <span>Processus filtres</span>
                  <strong>{generalAnnualSummary.processCount}</strong>
                </div>
                <div className="dashboard-summary-card">
                  <span>Indicateurs</span>
                  <strong>{generalAnnualSummary.indicatorCount}</strong>
                </div>
                <div className="dashboard-summary-card">
                  <span>Objectif moyen {selectedYear}</span>
                  <strong>
                    {formatNumber(generalAnnualSummary.averageObjectiveCurrent)}
                  </strong>
                </div>
                <div className="dashboard-summary-card">
                  <span>Realise moyen {selectedYear}</span>
                  <strong>
                    {formatNumber(generalAnnualSummary.averageRealiseCurrent)}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="dashboard-summary dashboard-summary-single">
                <div className="dashboard-summary-card">
                  <span>Pending Indicators (Filtered / Total)</span>
                  <strong>
                    {filteredPlanActionRows.length} / {planActionRows.length}
                  </strong>
                </div>
              </div>
            )}
          </div>
        </div>

        {error ? <p className="dashboard-error">{error}</p> : null}

        {isGeneralView && showAiButtons ? (
          <section
            className={`dashboard-ml-intelligence dashboard-ml-intelligence--${activeView === "general-annual" ? "annual" : "monthly"}`}
          >
            <div className="dashboard-ml-intelligence-header">
              <div>
                <span className="dashboard-ai-copilot-kicker">
                  ML Supervise
                </span>
                <h3>
                  {activeView === "general-annual"
                    ? `Prediction annuelle des meilleurs indicateurs ${selectedYear}`
                    : `Prediction mensuelle et trimestrielle ${selectedYear}`}
                </h3>
                <p>
                  {activeView === "general-annual"
                    ? "Classement annuel calcule avec objectif, realisation attendue, tendance, risque et historique."
                    : "Vue consolidee des meilleurs indicateurs du mois, du trimestre et des processus les plus forts."}
                </p>
              </div>
              <span className="dashboard-ml-model-pill">
                best_performance_supervised_ranker
              </span>
            </div>

            <div className="dashboard-ml-cards">
              {(activeView === "general-annual"
                ? [
                    {
                      title: "Meilleurs de l'annee",
                      rows: bestPredictions.year,
                    },
                  ]
                : [
                    { title: "Meilleurs du mois", rows: bestPredictions.month },
                    {
                      title: "Meilleurs du trimestre",
                      rows: bestPredictions.quarter,
                    },
                    {
                      title: "Processus les plus forts",
                      rows: bestPredictions.processus,
                    },
                  ]
              ).map((group) => (
                <div key={group.title} className="dashboard-ml-card">
                  <h4>{group.title}</h4>
                  {chargement ? (
                    <p className="dashboard-ml-empty">Chargement ML...</p>
                  ) : group.rows.length === 0 ? (
                    <p className="dashboard-ml-empty">
                      Lancez l'ETL ML pour generer les predictions.
                    </p>
                  ) : (
                    <div className="dashboard-ml-rank-list">
                      {group.rows.slice(0, 5).map((item, index) => (
                        <div
                          key={`${group.title}-${item.key}`}
                          className="dashboard-ml-rank-row"
                        >
                          <span className="dashboard-ml-rank-index">
                            {index + 1}
                          </span>
                          <div className="dashboard-ml-rank-main">
                            <div className="dashboard-ml-rank-label">
                              {item.label}
                            </div>
                            <div className="dashboard-ml-rank-track">
                              <span
                                style={{
                                  width: `${Math.min(100, Math.max(0, item.predicted_score || 0))}%`,
                                }}
                              />
                            </div>
                          </div>
                          <strong>{formatNumber(item.predicted_score)}%</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="dashboard-chart-card dashboard-ml-wide-chart">
              <h4>
                {activeView === "general-annual"
                  ? "Courbe intelligente - top indicateurs annuels"
                  : "Courbe intelligente - top indicateurs mensuels"}
              </h4>
              <div className="dashboard-chart-shell">
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart
                    data={(activeView === "general-annual"
                      ? bestPredictions.year
                      : bestPredictions.month
                    ).slice(0, 8)}
                    margin={{ top: 12, right: 18, left: -12, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      angle={-18}
                      textAnchor="end"
                      interval={0}
                      height={70}
                    />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="predicted_score"
                      name="Score predit"
                      fill="#0f766e"
                    />
                    <Line
                      dataKey="predicted_achievement"
                      name="Atteinte predite"
                      type="monotone"
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        ) : null}

        {/* Dashboard Overview - Tableau de Bord */}
        {activeView === "dashboard" ? (
          isLoadingDashboard ? (
            <div className="dashboard-empty">
              Chargement du tableau de bord...
            </div>
          ) : dashboardData.length === 0 ? (
            <div className="dashboard-empty">
              Aucune donnee disponible pour le tableau de bord.
            </div>
          ) : (
            <div className="dashboard-overview">
              <div className="dashboard-confirmity">
                <div className="dashboard-confirmity-header">
                  <div>
                    <h2>
                      Tableau de bord KPI SMI pour le mois{" "}
                      <span>{selectedDashboardMonthLabel}</span>{" "}
                      <span>{selectedYear}</span>
                    </h2>
                    <p>
                      {dashboardMonthlyTotals.conformingCount} conformes,{" "}
                      {dashboardMonthlyTotals.nonConformingCount} non conformes
                      et {dashboardMonthlyTotals.missingCount} sans donnees sur{" "}
                      {dashboardMonthlyTotals.indicatorCount} indicateurs.
                    </p>
                  </div>

                  <label className="dashboard-confirmity-filter">
                    <span>Mois</span>
                    <select
                      value={dashboardMonthFilter}
                      onChange={(event) =>
                        setDashboardMonthFilter(event.target.value)
                      }
                    >
                      {planMoisOptions.map((mois) => (
                        <option key={mois} value={String(mois)}>
                          {getFrenchMonthLabel(mois)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {dashboardMonthlyConformity.length === 0 ? (
                  <div className="dashboard-confirmity-empty">
                    Aucune donnee de conformite disponible pour ce mois.
                  </div>
                ) : (
                  <div className="cards-mounths">
                    {dashboardMonthlyConformity.map((process) => {
                      const processMeta = parseProcessusEntry(
                        process.processus,
                      );

                      return (
                        <div
                          key={`${process.processus}-${dashboardMonthFilter}-${selectedYear}`}
                          className="card-mounth"
                        >
                          <div className="card-mounth-head">
                            <div className="card-mounth-title">
                              <span className="card-mounth-category">
                                {processMeta.code || processMeta.category}
                              </span>
                              <h3>{process.processus}</h3>
                            </div>
                            <span className="card-mounth-count">
                              {process.indicatorCount} indicateurs
                            </span>
                          </div>

                          <div className="card-mounth-body">
                            <div
                              className="dashboard-confirmity-ring"
                              style={getDashboardConformityRingStyle(process)}
                              aria-hidden="true"
                            >
                              <div className="dashboard-confirmity-ring-center">
                                <strong>
                                  {formatPercent(process.conformityRate)}
                                </strong>
                                <span>Conformes</span>
                              </div>
                            </div>

                            <div className="dashboard-confirmity-stats">
                              <div className="dashboard-confirmity-stat dashboard-confirmity-stat--success">
                                <span>Conformes</span>
                                <strong>{process.conformingCount}</strong>
                              </div>
                              <div className="dashboard-confirmity-stat dashboard-confirmity-stat--danger">
                                <span>Non conformes</span>
                                <strong>{process.nonConformingCount}</strong>
                              </div>
                              <div className="dashboard-confirmity-stat dashboard-confirmity-stat--neutral">
                                <span>Sans donnees</span>
                                <strong>{process.missingCount}</strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="dashboard-overview-header">
                <h3>Vue globale des processus - {selectedYear}</h3>
                <p>
                  {dashboardSummary.processCount} processus et{" "}
                  {dashboardSummary.indicatorCount} indicateurs consolides. La
                  progression KPI reste separee de l'avancement des plans
                  d'action.
                </p>
              </div>

              <div className="dashboard-overview-visuals">
                <div className="dashboard-radar-card">
                  <div className="dashboard-radar-card-header">
                    <h4>Comparaison des processus</h4>
                    <span>KPI / Saisie / Plan d'action</span>
                  </div>
                  <div className="dashboard-chart-shell">
                    <ResponsiveContainer
                      width="100%"
                      height={dashboardComparisonHeight}
                    >
                      <BarChart
                        data={dashboardComparisonChartData}
                        layout="vertical"
                        margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                        barCategoryGap={isMobileChartViewport ? "18%" : "12%"}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={theme === "dark" ? "#374151" : "#e5e7eb"}
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          domain={[0, 100]}
                          tickFormatter={(value) => `${value}%`}
                          tick={{
                            fill: theme === "dark" ? "#9ca3af" : "#374151",
                            fontSize: 11,
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="subject"
                          width={dashboardProcessAxisWidth}
                          tickFormatter={formatProcessusTick}
                          tick={{
                            fill: theme === "dark" ? "#d1d5db" : "#1f2937",
                            fontSize: 12,
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Legend
                          verticalAlign="top"
                          height={isMobileChartViewport ? 46 : 36}
                          wrapperStyle={{
                            fontSize: isMobileChartViewport ? "11px" : "12px",
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor:
                              theme === "dark" ? "#1f2937" : "#fff",
                            border: `1px solid ${theme === "dark" ? "#374151" : "#e5e7eb"}`,
                            borderRadius: "8px",
                            color: theme === "dark" ? "#fff" : "#374151",
                          }}
                          formatter={(value, name) => [
                            formatPercent(value),
                            name,
                          ]}
                          labelFormatter={(label) =>
                            processusLabelByRaw.get(label) || label
                          }
                        />
                        <Bar
                          dataKey="kpiProgress"
                          name="Progression KPI"
                          fill="#0f766e"
                          radius={[0, 6, 6, 0]}
                        />
                        <Bar
                          dataKey="coverageRate"
                          name="Couverture de saisie"
                          fill="#2563eb"
                          radius={[0, 6, 6, 0]}
                        />
                        <Bar
                          dataKey="actionPlanProgress"
                          name="Avancement plan d'action"
                          fill="#f59e0b"
                          radius={[0, 6, 6, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="dashboard-section-note">
                    Une couverture basse signifie que tous les mois attendus ne
                    sont pas encore saisis.
                  </p>
                </div>

                <div className="dashboard-radar-card">
                  <div className="dashboard-radar-card-header">
                    <h4>Etat des indicateurs</h4>
                    <span>Atteints / Risque / Partiels / Sans donnees</span>
                  </div>
                  <div className="dashboard-chart-shell">
                    <ResponsiveContainer
                      width="100%"
                      height={dashboardStatusHeight}
                    >
                      <BarChart
                        data={dashboardStatusChartData}
                        layout="vertical"
                        margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                        barCategoryGap={isMobileChartViewport ? "24%" : "18%"}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={theme === "dark" ? "#374151" : "#e5e7eb"}
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          allowDecimals={false}
                          tick={{
                            fill: theme === "dark" ? "#9ca3af" : "#374151",
                            fontSize: 11,
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="subject"
                          width={dashboardProcessAxisWidth}
                          tickFormatter={formatProcessusTick}
                          tick={{
                            fill: theme === "dark" ? "#d1d5db" : "#1f2937",
                            fontSize: 12,
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Legend
                          verticalAlign="top"
                          height={isMobileChartViewport ? 46 : 36}
                          wrapperStyle={{
                            fontSize: isMobileChartViewport ? "11px" : "12px",
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor:
                              theme === "dark" ? "#1f2937" : "#fff",
                            border: `1px solid ${theme === "dark" ? "#374151" : "#e5e7eb"}`,
                            borderRadius: "8px",
                            color: theme === "dark" ? "#fff" : "#374151",
                          }}
                          formatter={(value, name) => [
                            formatNumber(value),
                            name,
                          ]}
                          labelFormatter={(label) =>
                            processusLabelByRaw.get(label) || label
                          }
                        />
                        <Bar
                          dataKey="reachedCount"
                          name="Atteints"
                          stackId="status"
                          fill="#10b981"
                        />
                        <Bar
                          dataKey="atRiskCount"
                          name="En risque"
                          stackId="status"
                          fill="#ef4444"
                        />
                        <Bar
                          dataKey="partialCount"
                          name="Partiels"
                          stackId="status"
                          fill="#f59e0b"
                        />
                        <Bar
                          dataKey="noDataCount"
                          name="Sans donnees"
                          stackId="status"
                          fill="#94a3b8"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="dashboard-section-note">
                    Les indicateurs partiels ont au moins une saisie, mais pas
                    une couverture complete sur les mois attendus.
                  </p>
                </div>
              </div>
            </div>
          )
        ) : activeView === "general-monthly" ? (
          isLoadingGeneral ? (
            <div className="dashboard-empty">
              Chargement de la section generale mensuelle...
            </div>
          ) : generalMonthlyGroups.length === 0 ? (
            <div className="dashboard-empty">
              Aucune donnee mensuelle disponible pour les filtres selectionnes.
            </div>
          ) : (
            <>
              <div className="dashboard-plan-filters dashboard-plan-filters--general">
                <label className="dashboard-plan-filter">
                  <span>Mois</span>
                  <select
                    value={generalMonthFilter}
                    onChange={(event) =>
                      setGeneralMonthFilter(event.target.value)
                    }
                  >
                    {planMoisOptions.map((mois) => (
                      <option
                        key={`general-month-${mois}`}
                        value={String(mois)}
                      >
                        {getFrenchMonthLabel(mois)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="dashboard-plan-filter">
                  <span>Processus</span>
                  <select
                    value={generalProcessusFilter}
                    onChange={(event) =>
                      setGeneralProcessusFilter(event.target.value)
                    }
                  >
                    <option value="all">Tous</option>
                    {generalProcessusOptions.map((processus) => (
                      <option
                        key={`general-process-${processus}`}
                        value={processus}
                      >
                        {processus}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="dashboard-general-grid">
                {generalMonthlyGroups.map((group) => (
                  <section
                    key={`general-monthly-${group.processus}`}
                    className="dashboard-general-card"
                  >
                    <div className="dashboard-general-card-header">
                      <div>
                        <h3>{group.processus}</h3>
                        <p>
                          {group.items.length} indicateur(s) pour{" "}
                          {generalSelectedMonthLabel.toLowerCase()}{" "}
                          {selectedYear}
                        </p>
                      </div>
                    </div>

                    <div className="dashboard-table-wrap dashboard-general-table-wrap">
                      <table className="dashboard-table dashboard-general-small-table">
                        <thead>
                          <tr>
                            <th>Indicateur</th>
                            <th>Signe</th>
                            <th>Unite</th>
                            <th>Objectif</th>
                            <th>Realise</th>
                            <th>Trend</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((row, index) => (
                            <tr
                              key={`${group.processus}-${row.Indicateur ?? row.Designation ?? index}`}
                            >
                              <td>
                                {row.Designation || row.Indicateur || "-"}
                              </td>
                              <td>{formatMathSign(row.Signe) || "-"}</td>
                              <td>{formatMathUnit(row.Unite) || "-"}</td>
                              <td>{formatNumber(row.objectiveValue)}</td>
                              <td>{formatNumber(row.realiseValue)}</td>
                              <td>{renderPerformanceEmoji(row.performance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            </>
          )
        ) : activeView === "general-annual" ? (
          isLoadingGeneral ? (
            <div className="dashboard-empty">
              Chargement de la section generale annuelle...
            </div>
          ) : filteredGeneralRows.length === 0 ? (
            <div className="dashboard-empty">
              Aucune donnee annuelle disponible pour les filtres selectionnes.
            </div>
          ) : (
            <>
              <div className="dashboard-plan-filters dashboard-plan-filters--general">
                <label className="dashboard-plan-filter">
                  <span>Processus</span>
                  <select
                    value={generalProcessusFilter}
                    onChange={(event) =>
                      setGeneralProcessusFilter(event.target.value)
                    }
                  >
                    <option value="all">Tous</option>
                    {generalProcessusOptions.map((processus) => (
                      <option
                        key={`general-annual-process-${processus}`}
                        value={processus}
                      >
                        {processus}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <p className="dashboard-section-note">
                Tableau annuel consolide: chaque indicateur affiche les
                objectifs, les realises mensuels et les moyennes de{" "}
                {selectedYear} face a {selectedYear - 1}.
              </p>

              <div className="dashboard-table-wrap">
                <table className="dashboard-table dashboard-general-annual-table">
                  <thead>
                    <tr>
                      <th rowSpan={2}>Processus</th>
                      <th rowSpan={2}>Indicateur {selectedYear}</th>
                      <th rowSpan={2}>Signe</th>
                      <th rowSpan={2}>Unite</th>
                      {MONTH_COLUMNS.map((column) => (
                        <th
                          key={`general-annual-head-${column.key}`}
                          rowSpan={2}
                        >
                          <span className="dashboard-period-column-label">
                            {column.label}
                          </span>
                        </th>
                      ))}
                      <th colSpan={2}>Moyenne</th>
                      <th rowSpan={2}>Tendance</th>
                    </tr>
                    <tr>
                      <th>{selectedYear}</th>
                      <th>{selectedYear - 1}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGeneralRows.map((row, index) => {
                      const rowKey = `${row.Processus ?? "processus"}-${row.Nordre ?? "n"}-${row.Indicateur ?? index}`;
                      const objectiveTrend = computeIndicatorTrend(
                        row.objective_moyenne_previous,
                        row.objective_moyenne_current,
                        row.Signe,
                      );
                      const realiseTrend = computeIndicatorTrend(
                        row.realise_moyenne_previous,
                        row.realise_moyenne_current,
                        row.Signe,
                      );
                      const annualPeriodMetrics = MONTH_COLUMNS.map(
                        (column) => {
                          const objectiveValue = getPeriodValue(
                            row,
                            "objective",
                            {
                              key: column.key,
                              label: column.label,
                              months: [column.key],
                            },
                          );
                          const realiseValue = getPeriodValue(row, "realise", {
                            key: column.key,
                            label: column.label,
                            months: [column.key],
                          });

                          return {
                            column,
                            objectiveValue,
                            realiseValue,
                            performance: evaluatePerformance(
                              realiseValue,
                              objectiveValue,
                              row.Signe,
                            ),
                          };
                        },
                      );

                      return (
                        <Fragment key={rowKey}>
                          <tr className="dashboard-row-objective">
                            <td
                              rowSpan={2}
                              className="dashboard-general-processus-cell"
                            >
                              {row.Processus || "-"}
                            </td>
                            <td className="dashboard-indicator-cell dashboard-indicator-objective">
                              <strong>
                                {row.Designation || row.Indicateur || "-"}
                              </strong>
                            </td>
                            <td className="dashboard-math-cell dashboard-math-cell-sign">
                              <span className="dashboard-math-chip">
                                {formatMathSign(row.Signe) || "-"}
                              </span>
                            </td>
                            <td className="dashboard-math-cell dashboard-math-cell-unit">
                              <span className="dashboard-math-chip">
                                {formatMathUnit(row.Unite) || "-"}
                              </span>
                            </td>
                            {annualPeriodMetrics.map((metric) => (
                              <td
                                key={`general-objective-${rowKey}-${metric.column.key}`}
                              >
                                {formatNumber(metric.objectiveValue)}
                              </td>
                            ))}
                            <td>
                              {formatNumber(row.objective_moyenne_current)}
                            </td>
                            <td>
                              {formatNumber(row.objective_moyenne_previous)}
                            </td>
                            <td
                              className={`dashboard-tendance-cell ${trendClass(objectiveTrend)}`}
                            >
                              {renderTrendDisplay(objectiveTrend)}
                            </td>
                          </tr>

                          <tr className="dashboard-row-realise">
                            <td className="dashboard-indicator-cell dashboard-indicator-realise dashboard-indicator-description-cell">
                              <span className="dashboard-indicator-description-text">
                                {row.Description ||
                                  row.Designation ||
                                  row.Indicateur ||
                                  "-"}
                              </span>
                            </td>
                            <td className="dashboard-math-cell dashboard-math-cell-placeholder">
                              <span className="dashboard-math-chip dashboard-math-chip-muted">
                                {formatMathSign(row.Signe) || "-"}
                              </span>
                            </td>
                            <td className="dashboard-math-cell dashboard-math-cell-placeholder">
                              <span className="dashboard-math-chip dashboard-math-chip-muted">
                                {formatMathUnit(row.Unite) || "-"}
                              </span>
                            </td>
                            {annualPeriodMetrics.map((metric) => (
                              <td
                                key={`general-realise-${rowKey}-${metric.column.key}`}
                                className={performanceCellClass(
                                  metric.performance,
                                )}
                              >
                                {formatNumber(metric.realiseValue)}
                              </td>
                            ))}
                            <td
                              className={performanceCellClass(
                                evaluatePerformance(
                                  row.realise_moyenne_current,
                                  row.objective_moyenne_current,
                                  row.Signe,
                                ),
                              )}
                            >
                              {formatNumber(row.realise_moyenne_current)}
                            </td>
                            <td>
                              {formatNumber(row.realise_moyenne_previous)}
                            </td>
                            <td
                              className={`dashboard-tendance-cell ${trendClass(realiseTrend)}`}
                            >
                              {renderTrendDisplay(realiseTrend)}
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )
        ) : activeView === "plan-action" ? (
          isLoadingPlanAction ? (
            <div className="dashboard-empty">Loading plan d'action...</div>
          ) : planActionRows.length === 0 ? (
            <div className="dashboard-empty">No pending indicators found.</div>
          ) : (
            <>
              <div className="dashboard-plan-filters">
                <label className="dashboard-plan-filter">
                  <span>Search Designation</span>
                  <input
                    type="text"
                    value={planDesignationSearch}
                    onChange={(event) =>
                      setPlanDesignationSearch(event.target.value)
                    }
                    placeholder="Type designation..."
                  />
                </label>

                <label className="dashboard-plan-filter">
                  <span>Search All Properties</span>
                  <input
                    type="text"
                    value={planGlobalSearch}
                    onChange={(event) =>
                      setPlanGlobalSearch(event.target.value)
                    }
                    placeholder="Indicateur, cause, action..."
                  />
                </label>

                <label className="dashboard-plan-filter">
                  <span>Processus</span>
                  <select
                    value={planFilterProcessus}
                    onChange={(event) =>
                      setPlanFilterProcessus(event.target.value)
                    }
                  >
                    <option value="all">All</option>
                    {planProcessusOptions.map((processus) => (
                      <option key={processus} value={processus}>
                        {processus}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="dashboard-plan-filter">
                  <span>Responsable</span>
                  <select
                    value={planFilterResponsable}
                    onChange={(event) =>
                      setPlanFilterResponsable(event.target.value)
                    }
                  >
                    <option value="all">All</option>
                    {planResponsableOptions.map((responsable) => (
                      <option key={responsable} value={responsable}>
                        {responsable}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="dashboard-plan-filter">
                  <span>Annee</span>
                  <select
                    value={planFilterAnnee}
                    onChange={(event) => setPlanFilterAnnee(event.target.value)}
                  >
                    <option value="all">All</option>
                    {planAnneeOptions.map((annee) => (
                      <option key={annee} value={annee}>
                        {annee}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="dashboard-plan-filter">
                  <span>Mois</span>
                  <select
                    value={planFilterMois}
                    onChange={(event) => setPlanFilterMois(event.target.value)}
                  >
                    <option value="all">All</option>
                    {planMoisOptions.map((mois) => (
                      <option key={mois} value={mois}>
                        {mois}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="dashboard-plan-filter">
                  <span>Progress Status</span>
                  <select
                    value={planFilterProgress}
                    onChange={(event) =>
                      setPlanFilterProgress(event.target.value)
                    }
                  >
                    <option value="all">All</option>
                    <option value="high">100%</option>
                    <option value="mid-high">75%</option>
                    <option value="mid">50%</option>
                    <option value="low">25%</option>
                    <option value="no-progress">No Progress Value</option>
                  </select>
                </label>

                <label className="dashboard-plan-filter">
                  <span>Implementation</span>
                  <select
                    value={planFilterImplementation}
                    onChange={(event) =>
                      setPlanFilterImplementation(event.target.value)
                    }
                  >
                    <option value="all">All</option>
                    <option value="implemented">Implemented</option>
                    <option value="missing">Missing Info</option>
                  </select>
                </label>

                <button
                  type="button"
                  className="dashboard-plan-filter-reset"
                  onClick={() => {
                    setPlanDesignationSearch("");
                    setPlanGlobalSearch("");
                    setPlanFilterProcessus("all");
                    setPlanFilterResponsable("all");
                    setPlanFilterAnnee("all");
                    setPlanFilterMois("all");
                    setPlanFilterProgress("all");
                    setPlanFilterImplementation(PLAN_IMPLEMENTATION_DEFAULT);
                  }}
                >
                  Reset Filters
                </button>
              </div>

              {isLoadingPlanAction ? (
                <div className="dashboard-empty">
                  Chargement du plan d'action...
                </div>
              ) : filteredPlanActionRows.length === 0 ? (
                <div className="dashboard-empty">
                  {planActionRows.length === 0
                    ? "Aucune action en attente pour le moment."
                    : "Aucun résultat ne correspond aux filtres sélectionnés."}
                </div>
              ) : (
                <div className="dashboard-table-wrap">
                  <table className="dashboard-table dashboard-plan-action-table">
                    <thead>
                      <tr>
                        <th>Processus</th>
                        <th>Indicateur</th>
                        <th>Année</th>
                        <th>Mois</th>
                        <th>Action</th>
                        <th>Progression de la conformité</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPlanActionRows.map((row, index) => {
                        const isImplemented =
                          hasPlanDetails(row) ||
                          String(row.Implementation ?? "")
                            .trim()
                            .toLowerCase() === "implemented";
                        const planActionUrl = `/plan-action/${encodeURIComponent(row.Indicateur)}?year=${encodeURIComponent(row.annee || selectedYear)}&month=${encodeURIComponent(row.mois || "")}`;

                        return (
                          <tr key={index}>
                            <td>{row.Processus || "-"}</td>
                            <td>{row.Designation || row.Indicateur || "-"}</td>
                            <td>{row.annee || "-"}</td>
                            <td>{row.mois || "-"}</td>
                            <td>
                              {!isImplemented ? (
                                <button
                                  type="button"
                                  onClick={() => navigate(planActionUrl)}
                                >
                                  Votre action
                                </button>
                              ) : null}
                            </td>
                            <td>
                              {row.PROGRESS !== null &&
                              row.PROGRESS !== undefined
                                ? getProgressSmileys(row.PROGRESS).combined
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )
        ) : !selectedProcessus ? (
          <div className="dashboard-empty">
            Choose a processus to display dashboard rows.
          </div>
        ) : isLoadingRows ? (
          <div className="dashboard-empty">Loading table data...</div>
        ) : rows.length === 0 ? (
          <div className="dashboard-empty">
            No indicators found for this processus.
          </div>
        ) : (
          <>
            <p className="dashboard-table-meta">
              <strong>Pilote :</strong>
              <span style={{ marginLeft: "8px" }}>
                {pilotesAssignment.label || "Aucun pilote assigné"}
              </span>
            </p>
            <p className="dashboard-table-meta">
              <strong>Responsable:</strong>
              <span style={{ marginLeft: "8px" }}>
                {responsablesAssignment.label || "Aucun responsable assigné"}
              </span>
            </p>
            <p className="dashboard-table-meta">
              <strong>User:</strong>
              <span style={{ marginLeft: "8px" }}>{usersLine}</span>
            </p>

            {authUser?.isAdmin && (
              <div className="dashboard-actions">
                <span className="dashboard-admin-badge">Admin</span>
                <button
                  type="button"
                  className="dashboard-action-btn dashboard-action-btn-admin"
                  onClick={() => {
                    setAdminTab("processus");
                    setAdminPanelOpen(true);
                  }}
                >
                  Nouveau Processus
                </button>
                <button
                  type="button"
                  className="dashboard-action-btn dashboard-action-btn-admin"
                  onClick={() => {
                    setAdminTab("indicateur");
                    setAdminPanelOpen(true);
                  }}
                >
                  Nouvel Indicateur
                </button>
              </div>
            )}

            {/* Admin Panel Modal  */}
            {adminPanelOpen && authUser?.isAdmin && (
              <div
                className="dashboard-modal-overlay"
                onClick={() => setAdminPanelOpen(false)}
              >
                <div
                  className="dashboard-admin-panel"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="dashboard-admin-panel-header">
                    <span className="dashboard-admin-badge">
                      Administration
                    </span>
                    <div className="dashboard-admin-tabs">
                      <button
                        type="button"
                        className={adminTab === "processus" ? "active" : ""}
                        onClick={() => setAdminTab("processus")}
                      >
                        Nouveau Processus
                      </button>
                      <button
                        type="button"
                        className={adminTab === "indicateur" ? "active" : ""}
                        onClick={() => {
                          setAdminTab("indicateur");
                        }}
                      >
                        Nouvel Indicateur
                      </button>
                    </div>
                    <button
                      type="button"
                      className="dashboard-admin-close"
                      onClick={() => setAdminPanelOpen(false)}
                    >
                      <FontAwesomeIcon icon={byPrefixAndName.fa.close} />
                    </button>
                  </div>

                  {adminTab === "processus" && (
                    <div className="dashboard-admin-form">
                      <p className="dashboard-admin-hint">
                        Un processus peut contenir{" "}
                        <strong>1 ou N indicateurs</strong>. Ajoutez autant de
                        lignes que nécessaire. Chaque indicateur peut avoir un
                        responsable distinct.
                      </p>
                      <div className="dashboard-admin-form-grid">
                        <label>
                          Catégorie *
                          <select
                            value={newProcCategory}
                            onChange={(e) => setNewProcCategory(e.target.value)}
                          >
                            {availableProcessusCategories.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Prochain code
                          <input
                            type="text"
                            value={newProcCodePrefix}
                            onChange={(e) =>
                              setNewProcCodePrefix(e.target.value)
                            }
                            placeholder="Ex: C070"
                          />
                        </label>
                      </div>
                      <p className="dashboard-admin-processus-preview">
                        Apercu: <strong>{formattedNewProcessusName}</strong>
                      </p>
                      <div className="dashboard-admin-form-row">
                        <label>
                          Nom du processus *
                          <input
                            type="text"
                            value={newProcName}
                            onChange={(e) => setNewProcName(e.target.value)}
                            placeholder="Ex: Qualité du service, Production, Sécurité..."
                          />
                        </label>
                      </div>
                      <div className="dashboard-admin-form-row">
                        <label>
                          Responsable du processus
                          <select
                            value={newProcResponsable}
                            onChange={(e) =>
                              setNewProcResponsable(e.target.value)
                            }
                          >
                            <option value="">
                              Selectionner un responsable
                            </option>
                            {responsablesList.map((resp) => (
                              <option
                                key={resp.responsable}
                                value={resp.responsable}
                              >
                                {resp.responsable}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Pilote du processus
                          <select
                            value={newProcPilote}
                            onChange={(e) => setNewProcPilote(e.target.value)}
                          >
                            <option value="">Selectionner un pilote</option>
                            {pilotesList
                              .map((item) => String(item?.pilote ?? "").trim())
                              .filter(Boolean)
                              .map((piloteName) => (
                                <option key={piloteName} value={piloteName}>
                                  {piloteName}
                                </option>
                              ))}
                          </select>
                        </label>
                      </div>
                      <div className="dashboard-admin-indicators-header">
                        <span>
                          Indicateurs - {newProcIndicators.length} ligne(s)
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setNewProcIndicators((prev) => [
                              ...prev,
                              {
                                indicateur: "",
                                designation: "",
                                signe: "",
                                unite: "",
                                responsable: "",
                                responsableAction: "",
                              },
                            ])
                          }
                        >
                          + Ajouter une ligne
                        </button>
                      </div>
                      {newProcIndicators.map((ind, i) => (
                        <div key={i} className="dashboard-admin-indicator-row">
                          {/* Code indicator - auto-generated from designation */}
                          <input
                            type="text"
                            value={buildIndicatorCodeBase(
                              effectiveProcessusCodePrefix,
                              ind.designation,
                            )}
                            readOnly
                            placeholder="Code auto"
                          />
                          <input
                            type="text"
                            placeholder="Designation"
                            value={ind.designation}
                            onChange={(e) =>
                              setNewProcIndicators((p) =>
                                p.map((r, j) =>
                                  j === i
                                    ? { ...r, designation: e.target.value }
                                    : r,
                                ),
                              )
                            }
                          />
                          <select
                            value={ind.signe}
                            onChange={(e) =>
                              setNewProcIndicators((p) =>
                                p.map((r, j) =>
                                  j === i ? { ...r, signe: e.target.value } : r,
                                ),
                              )
                            }
                          >
                            <option value="">Signe</option>
                            {SIGN_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          <select
                            value={ind.unite}
                            onChange={(e) =>
                              setNewProcIndicators((p) =>
                                p.map((r, j) =>
                                  j === i ? { ...r, unite: e.target.value } : r,
                                ),
                              )
                            }
                          >
                            <option value="">Unité</option>
                            {UNIT_OPTIONS.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Responsable"
                            value={ind.responsable}
                            onChange={(e) =>
                              setNewProcIndicators((p) =>
                                p.map((r, j) =>
                                  j === i
                                    ? { ...r, responsable: e.target.value }
                                    : r,
                                ),
                              )
                            }
                          />
                          {newProcIndicators.length > 1 && (
                            <button
                              type="button"
                              className="dashboard-admin-remove-btn"
                              onClick={() =>
                                setNewProcIndicators((p) =>
                                  p.filter((_, j) => j !== i),
                                )
                              }
                            >
                              <FontAwesomeIcon
                                icon={byPrefixAndName.fa.trashAlt}
                              />
                            </button>
                          )}
                        </div>
                      ))}
                      <div className="dashboard-admin-form-actions">
                        <button
                          type="button"
                          onClick={handleAdminCreateProcessus}
                          disabled={
                            adminSaving ||
                            !newProcName.trim() ||
                            !effectiveProcessusCodePrefix ||
                            !newProcIndicators.some((indicatorRow) =>
                              indicatorRow.designation.trim(),
                            )
                          }
                        >
                          {adminSaving
                            ? "Creation..."
                            : `Creer (${newProcIndicators.filter((i) => i.designation.trim()).length} indicateur(s))`}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdminPanelOpen(false)}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}

                  {adminTab === "indicateur" && (
                    <div className="dashboard-admin-form">
                      <p className="dashboard-admin-hint">
                        Ajoutez un indicateur un{" "}
                        <strong>processus existant</strong>. Le code indicateur
                        doit étre <strong>unique</strong> dans toute la base.
                      </p>
                      <div className="dashboard-admin-form-grid">
                        <label>
                          Processus actif *
                          <input
                            type="text"
                            value={activeIndicatorProcessus}
                            readOnly
                            placeholder="Selectionnez un processus dans le sidebar"
                          />
                        </label>
                        <label>
                          Code indicateur (auto)
                          <input
                            type="text"
                            value={suggestedNewIndicatorCode}
                            readOnly
                          />
                        </label>
                        <label>
                          Désignation *
                          <input
                            type="text"
                            value={newIndFields.designation}
                            onChange={(e) =>
                              setNewIndFields((p) => ({
                                ...p,
                                designation: e.target.value,
                              }))
                            }
                            placeholder="Libellé descriptif"
                          />
                        </label>
                        <label>
                          Signe
                          <select
                            value={newIndFields.signe}
                            onChange={(e) =>
                              setNewIndFields((p) => ({
                                ...p,
                                signe: e.target.value,
                              }))
                            }
                          >
                            <option value="">Signe de conformité</option>
                            {SIGN_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Unité
                          <select
                            value={newIndFields.unite}
                            onChange={(e) =>
                              setNewIndFields((p) => ({
                                ...p,
                                unite: e.target.value,
                              }))
                            }
                          >
                            <option value="">Unité de mesure</option>
                            {UNIT_OPTIONS.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Responsable
                          <select
                            value={newIndFields.responsable}
                            onChange={(e) =>
                              setNewIndFields((p) => ({
                                ...p,
                                responsable: e.target.value,
                              }))
                            }
                          >
                            <option value="">
                              Selectionner un responsable
                            </option>
                            {usersList
                              .filter((user) => user.username)
                              .map((user) => (
                                <option
                                  key={`${user.source || "users"}-${user.id ?? user.username}`}
                                  value={user.username}
                                >
                                  {user.username}{" "}
                                  {user.isAdmin ? "(Admin)" : ""}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          Pilote
                          <select
                            value={newIndFields.pilote}
                            onChange={(e) =>
                              setNewIndFields((p) => ({
                                ...p,
                                pilote: e.target.value,
                              }))
                            }
                          >
                            <option value="">Selectionner un pilote</option>
                            {pilotesList
                              .map((item) => String(item?.pilote ?? "").trim())
                              .filter(Boolean)
                              .map((piloteName) => (
                                <option key={piloteName} value={piloteName}>
                                  {piloteName}
                                </option>
                              ))}
                          </select>
                        </label>
                      </div>
                      <div className="dashboard-admin-form-actions">
                        <button
                          type="button"
                          onClick={handleAdminCreateIndicateur}
                          disabled={
                            adminSaving ||
                            !newIndFields.designation.trim() ||
                            !activeIndicatorProcessus
                          }
                        >
                          {adminSaving ? "Creation..." : "Creer l'indicateur"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdminPanelOpen(false)}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="dashboard-table-wrap">
              <table
                className={`dashboard-table dashboard-process-table dashboard-table--${tablePeriodType}`}
              >
                <thead>
                  <tr>
                    <th rowSpan={2}>Indicateur {selectedYear}</th>
                    <th rowSpan={2} className="outils-th">
                      Singe
                      {editableInfo.isAdmin ? (
                        <div className="outils-input-container">
                          <button
                            type="button"
                            className="outils-add-btn"
                            title="Ajouter un signe"
                            onClick={() => setIsSigneOpen(!isSigneOpen)}
                          >
                            +
                          </button>
                          {isSigneOpen && (
                            <div className="outils-input-wrapper">
                              <div className="outils-input-group">
                                <input
                                  type="text"
                                  className="outils-input"
                                  placeholder="Ajouter un signe (≥, ≤, >, <, =)"
                                  value={signeText}
                                  onChange={(e) => setSigneText(e.target.value)}
                                />
                                <button
                                  className="outils-save-btn"
                                  onClick={handleSigneSubmit}
                                >
                                  Save
                                </button>
                                <button
                                  className="outils-cancel-btn"
                                  onClick={() => {
                                    setSigneText("");
                                    setIsSigneOpen(false);
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </th>
                    <th rowSpan={2} className="outils-th">
                      Unité
                      {editableInfo.isAdmin ? (
                        <div className="outils-input-container">
                          <button
                            type="button"
                            className="outils-add-btn"
                            title="Ajouter une unité"
                            onClick={() => setIsUniteOpen(!isUniteOpen)}
                          >
                            +
                          </button>
                          {isUniteOpen && (
                            <div className="outils-input-wrapper">
                              <div className="outils-input-group">
                                <input
                                  type="text"
                                  className="outils-input"
                                  placeholder="Ajouter une unité (%, €, kg, h, min...)"
                                  value={uniteText}
                                  onChange={(e) => setUniteText(e.target.value)}
                                />
                                <button
                                  className="outils-save-btn"
                                  onClick={handleUniteSubmit}
                                >
                                  Save
                                </button>
                                <button
                                  className="outils-cancel-btn"
                                  onClick={() => {
                                    setUniteText("");
                                    setIsUniteOpen(false);
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </th>
                    <th rowSpan={2}>Actions</th>
                    {visiblePeriodColumns.map((column) => (
                      <th key={column.key} rowSpan={2}>
                        <span className="dashboard-period-column-label">
                          {column.label}
                        </span>
                      </th>
                    ))}
                    <th colSpan={2}>Moyenne</th>
                    <th rowSpan={2}>Tendance</th>
                  </tr>
                  <tr>
                    <th>{selectedYear}</th>
                    <th>{selectedYear - 1}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const rowKey = `${row.Nordre ?? "n"}-${row.Indicateur ?? row.Designation ?? "indicator"}-${index}`;
                    const objectiveTrend = computeIndicatorTrend(
                      row.objective_moyenne_previous,
                      row.objective_moyenne_current,
                      row.Signe,
                    );
                    const realiseTrend = computeIndicatorTrend(
                      row.realise_moyenne_previous,
                      row.realise_moyenne_current,
                      row.Signe,
                    );

                    const periodMetrics = visiblePeriodColumns.map((column) => {
                      const objectiveValue = getPeriodValue(
                        row,
                        "objective",
                        column,
                      );
                      const realiseValue = getPeriodValue(
                        row,
                        "realise",
                        column,
                      );
                      return {
                        column,
                        objectiveValue,
                        realiseValue,
                        performance: evaluatePerformance(
                          realiseValue,
                          objectiveValue,
                          row.Signe,
                        ),
                      };
                    });

                    const comparablePeriods = periodMetrics.filter(
                      (metric) =>
                        metric.objectiveValue !== null &&
                        metric.realiseValue !== null,
                    );
                    const goodPeriods = comparablePeriods.filter(
                      (metric) => metric.performance === "good",
                    ).length;
                    const totalComparablePeriods = comparablePeriods.length;
                    const realiseBadgeClass =
                      totalComparablePeriods >= 1
                        ? (goodPeriods / totalComparablePeriods) * 100 >= 75
                          ? "dashboard-perf-good"
                          : (goodPeriods / totalComparablePeriods) * 100 >= 50
                            ? "dashboard-perf-mid"
                            : "dashboard-perf-bad"
                        : "";

                    return (
                      <Fragment key={rowKey}>
                        <tr className="dashboard-row-objective">
                          <td className="dashboard-indicator-cell dashboard-indicator-objective">
                            <strong>{row.Designation || "-"}</strong>
                            <button
                              type="button"
                              className="dashboard-chart-toggle-btn"
                              onClick={() => handleOpenChart(row.Indicateur)}
                              title="Afficher le graphique"
                            >
                              <FontAwesomeIcon
                                icon={byPrefixAndName.fa.chartLine}
                              />
                            </button>
                            <button
                              type="button"
                              className="dashboard-ai-toggle-btn"
                              onClick={() => handleOpenChart(row.Indicateur)}
                              title="Ouvrir le copilot AI"
                            >
                              AI
                            </button>
                          </td>

                          {/* Signe  editable only by admin */}
                          <td
                            className="dashboard-math-cell dashboard-math-cell-sign"
                            title={row.Signe || ""}
                          >
                            {editableInfo.isAdmin ? (
                              editableInfo.isAdmin && editingSign === rowKey ? (
                                <select
                                  className="dashboard-math-select"
                                  value={row.Signe || ""}
                                  onChange={async (e) => {
                                    try {
                                      await api.put(
                                        `/api/dashboard/indicateur/${encodeURIComponent(row.Indicateur)}`,
                                        {
                                          signe: e.target.value,
                                        },
                                      );
                                      const response = await api.get(
                                        `/api/dashboard/processus/${encodeURIComponent(selectedProcessus)}?year=${selectedYear}`,
                                      );
                                      setRows(response.data.rows || []);
                                    } catch (err) {
                                      setError("Failed to update sign");
                                    }
                                    setEditingSign(null);
                                  }}
                                >
                                  <option value="">Signe</option>
                                  {outilsOptions?.signes?.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  )) || []}
                                </select>
                              ) : (
                                <button
                                  type="button"
                                  className="dashboard-math-chip dashboard-math-chip-editable"
                                  title="Cliquer pour modifier"
                                  onClick={() => setEditingSign(rowKey)}
                                >
                                  {formatMathSign(row.Signe) || "-"}
                                </button>
                              )
                            ) : (
                              <span className="dashboard-math-chip">
                                {formatMathSign(row.Signe) || "-"}
                              </span>
                            )}
                          </td>

                          {/* Unité  editable only by admin */}
                          <td
                            className="dashboard-math-cell dashboard-math-cell-unit"
                            title={row.Unite || ""}
                          >
                            {editableInfo.isAdmin && editingUnit === rowKey ? (
                              <select
                                className="dashboard-math-select"
                                value={row.Unite || ""}
                                onChange={async (e) => {
                                  try {
                                    await api.put(
                                      `/api/dashboard/indicateur/${encodeURIComponent(row.Indicateur)}`,
                                      {
                                        unite: e.target.value,
                                      },
                                    );
                                    const response = await api.get(
                                      `/api/dashboard/processus/${encodeURIComponent(selectedProcessus)}?year=${selectedYear}`,
                                    );
                                    setRows(response.data.rows || []);
                                  } catch (err) {
                                    setError("Failed to update unit");
                                  }
                                  setEditingUnit(null);
                                }}
                              >
                                <option value="">Unité</option>
                                {outilsOptions?.unites?.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                )) || []}
                              </select>
                            ) : editableInfo.isAdmin ? (
                              <button
                                type="button"
                                className="dashboard-math-chip dashboard-math-chip-editable"
                                title="Cliquer pour modifier"
                                onClick={() => setEditingUnit(rowKey)}
                              >
                                {formatMathUnit(row.Unite) || "-"}
                              </button>
                            ) : (
                              <span className="dashboard-math-chip">
                                {formatMathUnit(row.Unite) || "-"}
                              </span>
                            )}
                          </td>

                          {/* Actions cell  objective row - only for admin */}
                          <td className="dashboard-actions-cell dashboard-actions-cell-objective">
                            {editableInfo.isAdmin ? (
                              <button
                                type="button"
                                className="dashboard-options-btn"
                                onClick={() => openObjectiveModal(row)}
                                title="Definir les objectifs"
                              >
                                Objectif
                              </button>
                            ) : (
                              <span
                                className="dashboard-viewer-badge dashboard-viewer-badge-text"
                                title="Seul l'administrateur peut definir les objectifs"
                              >
                                Objectif
                              </span>
                            )}
                          </td>

                          {periodMetrics.map((metric) => (
                            <td key={`objective-${metric.column.key}`}>
                              {formatNumber(metric.objectiveValue)}
                            </td>
                          ))}

                          <td>{formatNumber(row.objective_moyenne_current)}</td>
                          <td>
                            {formatNumber(row.objective_moyenne_previous)}
                          </td>
                          <td
                            className={`dashboard-tendance-cell ${trendClass(objectiveTrend)}`}
                          >
                            {renderTrendDisplay(objectiveTrend)}
                          </td>
                        </tr>

                        <tr className="dashboard-row-realise">
                          <td className="dashboard-indicator-cell dashboard-indicator-realise dashboard-indicator-description-cell">
                            <div className="dashboard-indicator-description-tools">
                              {canEditRow(row) ? (
                                <input
                                  key={`${rowKey}-${String(row?.Description ?? "")}`}
                                  type="text"
                                  className="dashboard-indicator-description-input"
                                  defaultValue={String(row?.Description ?? "")}
                                  onBlur={(event) =>
                                    saveDescriptionEdit(row, event.target.value)
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      event.currentTarget.blur();
                                    }
                                  }}
                                  placeholder="Ecrire la description de l'indicateur..."
                                />
                              ) : (
                                <span className="dashboard-indicator-description-text">
                                  {row.Description ||
                                    row.Designation ||
                                    row.Indicateur ||
                                    "-"}
                                </span>
                              )}

                              <div className="dashboard-periodicity-control">
                                <button
                                  type="button"
                                  className="dashboard-options-btn dashboard-options-btn-periodicity"
                                  onClick={() =>
                                    setPeriodicityMenuOpenKey((prev) =>
                                      prev === rowKey ? null : rowKey,
                                    )
                                  }
                                  title="Choisir la periodicite du tableau"
                                >
                                  {currentPeriodTypeLabel}
                                </button>

                                {periodicityMenuOpenKey === rowKey ? (
                                  <div
                                    className="dashboard-periodicity-menu"
                                    role="menu"
                                    aria-label="Periodicite du tableau"
                                  >
                                    {TABLE_PERIOD_OPTIONS.map((option) => (
                                      <button
                                        key={`${rowKey}-${option.key}`}
                                        type="button"
                                        role="menuitem"
                                        className={`dashboard-periodicity-option ${tablePeriodType === option.key ? "active" : ""}`}
                                        onClick={() => {
                                          setTablePeriodType(option.key);
                                          setPeriodicityMenuOpenKey(null);
                                        }}
                                      >
                                        {option.label}
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </td>

                          <td className="dashboard-math-cell dashboard-math-cell-placeholder">
                            <span className="dashboard-math-chip dashboard-math-chip-muted">
                              {formatMathSign(row.Signe) || "-"}
                            </span>
                          </td>

                          <td className="dashboard-math-cell dashboard-math-cell-placeholder">
                            <span className="dashboard-math-chip dashboard-math-chip-muted">
                              {formatMathUnit(row.Unite) || "-"}
                            </span>
                          </td>

                          <td className="dashboard-actions-cell dashboard-actions-cell-realise">
                            <div className="dashboard-realise-action-stack">
                              <div className="dashboard-realise-action-head">
                                <span>Realise</span>
                                {totalComparablePeriods > 0 ? (
                                  <span
                                    className={`dashboard-perf-badge ${realiseBadgeClass}`}
                                    title={`${goodPeriods}/${totalComparablePeriods} periode(s) conforme(s) a l'objectif`}
                                  >
                                    {goodPeriods}/{totalComparablePeriods}
                                  </span>
                                ) : null}
                              </div>

                              {canEditRow(row) ? (
                                <button
                                  type="button"
                                  className="dashboard-options-btn dashboard-options-btn-realise"
                                  onClick={() => openRealiseModal(row)}
                                  title="Saisir les valeurs realisees"
                                >
                                  Realise
                                </button>
                              ) : (
                                <span
                                  className="dashboard-viewer-badge dashboard-viewer-badge-text"
                                  title="Mode lecture - vous n'avez pas la permission de saisir les realises pour cet indicateur"
                                >
                                  Realise
                                </span>
                              )}
                            </div>
                          </td>

                          {periodMetrics.map((metric) => (
                            <td
                              key={`realise-${metric.column.key}`}
                              className={performanceCellClass(
                                metric.performance,
                              )}
                            >
                              {formatNumber(metric.realiseValue)}
                            </td>
                          ))}

                          <td
                            className={performanceCellClass(
                              evaluatePerformance(
                                row.realise_moyenne_current,
                                row.objective_moyenne_current,
                                row.Signe,
                              ),
                            )}
                          >
                            {formatNumber(row.realise_moyenne_current)}
                          </td>
                          <td>{formatNumber(row.realise_moyenne_previous)}</td>
                          <td
                            className={`dashboard-tendance-cell ${trendClass(realiseTrend)}`}
                          >
                            {renderTrendDisplay(realiseTrend)}
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Section des graphiques KPI - Dark Mode */}
            {selectedChartIndicator && (
              <div ref={chartsSectionRef} className="dashboard-charts-section">
                <div className="dashboard-charts-header">
                  <h3>
                    Assistant KPI -{" "}
                    {selectedCopilotRow
                      ? selectedCopilotRow.Designation ||
                        selectedCopilotRow.Indicateur
                      : selectedChartIndicator}
                  </h3>
                  <button
                    type="button"
                    className="dashboard-charts-close-btn"
                    onClick={() => setSelectedChartIndicator(null)}
                  >
                    <FontAwesomeIcon icon={byPrefixAndName.fa.windowClose} />{" "}
                    Fermer
                  </button>
                </div>
                <div className="dashboard-charts-grid">
                  {(() => {
                    const chartRow = selectedCopilotRow;
                    if (!chartRow) return null;
                    const chartData = getMonthlyData(chartRow);
                    const chartUnit = chartRow.Unite || "";
                    const comparisonChartDomain = getChartYDomain(chartData, [
                      "objectif",
                      "realise",
                    ]);
                    const realiseChartDomain = getChartYDomain(chartData, [
                      "realise",
                    ]);
                    const barChartDomain = getChartYDomain(
                      chartData,
                      ["objectif", "realise"],
                      { baselineZero: true },
                    );
                    const chartAxisHeight = isMobileChartViewport
                      ? 64
                      : isCompactChartViewport
                        ? 44
                        : 36;
                    const chartAxisAngle = isMobileChartViewport
                      ? -30
                      : isCompactChartViewport
                        ? -12
                        : 0;
                    const chartAxisAnchor =
                      chartAxisAngle === 0 ? "middle" : "end";
                    const chartTickMargin = isMobileChartViewport ? 10 : 12;
                    const chartXAxisPadding = isMobileChartViewport
                      ? { left: 6, right: 6 }
                      : isCompactChartViewport
                        ? { left: 12, right: 12 }
                        : { left: 20, right: 20 };
                    const chartMargin = isMobileChartViewport
                      ? { top: 10, right: 8, left: -22, bottom: 8 }
                      : isCompactChartViewport
                        ? { top: 8, right: 14, left: -10, bottom: 8 }
                        : { top: 8, right: 24, left: 8, bottom: 8 };
                    const riskModel = aiCopilotData?.risk || {};
                    const suggestionModel = aiCopilotData?.suggestion || {};
                    const signals = aiCopilotData?.signals || {};
                    const aiAnalysisMonthLabel =
                      getFrenchMonthLabel(aiAnalysisMonth);
                    const aiAnalysisMonthIndex =
                      Number.parseInt(String(aiAnalysisMonth), 10) || 1;
                    const aiAnalysisMonthColumn =
                      MONTH_COLUMNS[aiAnalysisMonthIndex - 1] ||
                      MONTH_COLUMNS[0];
                    const aiAnalysisObjective =
                      toFiniteNumber(
                        chartRow?.[`objective_${aiAnalysisMonthColumn.key}`],
                      ) ?? toFiniteNumber(chartRow?.objective_moyenne_current);
                    const aiAnalysisRealisation =
                      toFiniteNumber(
                        chartRow?.[`realise_${aiAnalysisMonthColumn.key}`],
                      ) ?? toFiniteNumber(chartRow?.realise_moyenne_current);
                    const isAiObjectiveNotReached =
                      evaluatePerformance(
                        aiAnalysisRealisation,
                        aiAnalysisObjective,
                        chartRow?.Signe,
                      ) === "bad";
                    const canOpenAiPlanAction =
                      isAiObjectiveNotReached &&
                      canOpenPlanActionForRow(chartRow);
                    const riskLevel =
                      riskModel.level || aiCopilotData?.risk_level || "Unknown";
                    const riskScore =
                      typeof riskModel.score === "number"
                        ? riskModel.score
                        : aiCopilotData?.risk_score;
                    const riskProbability =
                      typeof riskModel.probability === "number"
                        ? riskModel.probability
                        : aiCopilotData?.confidence;
                    const riskTone = getAiRiskTone(riskLevel);
                    const probabilityValue =
                      typeof riskProbability === "number"
                        ? `${Math.round(riskProbability * 100)}%`
                        : "n/a";
                    const riskScoreValue =
                      typeof riskScore === "number"
                        ? `${Math.round(riskScore * 100)}%`
                        : "n/a";
                    const suggestedActions = Array.isArray(
                      suggestionModel.actions,
                    )
                      ? suggestionModel.actions.slice(0, 3)
                      : Array.isArray(aiCopilotData?.suggested_actions)
                        ? aiCopilotData.suggested_actions.slice(0, 3)
                        : [];
                    const suggestionText =
                      suggestionModel.text ||
                      aiCopilotData?.suggestion_text ||
                      "Aucune suggestion AI detaillee n'est encore disponible.";
                    const suggestionCategory =
                      suggestionModel.category || "normal_followup";
                    const suggestionPriority =
                      suggestionModel.priority || "Normal";
                    const suggestionProbability =
                      typeof suggestionModel.probability === "number"
                        ? `${Math.round(suggestionModel.probability * 100)}%`
                        : "n/a";
                    const modelSourceLabel =
                      riskModel.model_name || suggestionModel.model_name
                        ? [riskModel.model_name, riskModel.model_version]
                            .filter(Boolean)
                            .join(" ")
                        : "Modeles ML";
                    const signalItems = [
                      {
                        label: "Anomalies",
                        value:
                          signals.anomaly_count ??
                          aiCopilotData?.anomaly_count ??
                          0,
                      },
                      {
                        label: "Ecart perf.",
                        value:
                          typeof signals.performance_gap === "number"
                            ? `${Math.round(signals.performance_gap * 100)}%`
                            : "n/a",
                      },
                      {
                        label: "Volatilite",
                        value:
                          typeof signals.volatility === "number"
                            ? `${Math.round(signals.volatility * 100)}%`
                            : "n/a",
                      },
                    ];
                    const probableCauses = Array.isArray(
                      aiCopilotData?.probable_causes,
                    )
                      ? aiCopilotData.probable_causes.slice(0, 3)
                      : [];
                    const anomaliesPreview = Array.isArray(
                      aiCopilotData?.anomalies,
                    )
                      ? aiCopilotData.anomalies.slice(0, 3)
                      : [];
                    const predictionSourceLabel =
                      aiCopilotData?.prediction_source === "trained_model" ||
                      aiCopilotData?.prediction_source === "auto_trained_model"
                        ? "Modele appris"
                        : String(
                              aiCopilotData?.prediction_source || "",
                            ).includes("fallback")
                          ? "Fallback heuristique"
                          : "Source inconnue";

                    return (
                      <>
                        <div className="dashboard-ai-copilot-panel">
                          <div className="dashboard-ai-copilot-header">
                            <div>
                              <span className="dashboard-ai-copilot-kicker">
                                Modeles ML
                              </span>
                              <h4>
                                Analyse contextuelle de{" "}
                                {chartRow.Designation || chartRow.Indicateur}
                              </h4>
                              <p className="dashboard-ai-copilot-copy">
                                Risk level et suggestion sont predits par deux
                                modeles separes, puis transformes en actions
                                controlees.
                              </p>
                            </div>
                            <div>
                              <label className="dashboard-confirmity-filter">
                                <span>Mois analyse</span>
                                <select
                                  value={aiAnalysisMonth}
                                  onChange={(event) =>
                                    setAiAnalysisMonth(event.target.value)
                                  }
                                >
                                  {planMoisOptions.map((mois) => (
                                    <option key={mois} value={String(mois)}>
                                      {getFrenchMonthLabel(mois)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <div
                                className={`dashboard-ai-risk-pill dashboard-ai-risk-pill--${riskTone}`}
                              >
                                {riskLevel}
                              </div>
                            </div>
                          </div>

                          {isLoadingAiCopilot ? (
                            <div className="dashboard-ai-copilot-state">
                              Chargement de l'analyse AI...
                            </div>
                          ) : aiCopilotError ? (
                            <div className="dashboard-ai-copilot-state dashboard-ai-copilot-state--error">
                              {aiCopilotError}
                            </div>
                          ) : (
                            <>
                              <div className="dashboard-ai-copilot-summary">
                                <div className="dashboard-ai-copilot-stat">
                                  <span>Probabilite Confiance risque</span>
                                  <strong>{probabilityValue}</strong>
                                </div>
                                <div className="dashboard-ai-copilot-stat">
                                  <span>Score risque</span>
                                  <strong>{riskScoreValue}</strong>
                                </div>
                                <div className="dashboard-ai-copilot-stat">
                                  <span>Suggestion</span>
                                  <strong>{suggestionPriority}</strong>
                                </div>

                                <div className="dashboard-ai-copilot-stat">
                                  <span>Mois analyse</span>
                                  <strong>{aiAnalysisMonthLabel}</strong>
                                </div>
                              </div>

                              <div className="dashboard-ai-copilot-grid">
                                <div className="dashboard-ai-copilot-card">
                                  <h5>Risk Level</h5>
                                  <p>
                                    Niveau predit: <strong>{riskLevel}</strong>
                                  </p>
                                  <ul>
                                    <li>Score: {riskScoreValue}</li>
                                    <li>Probabilite: {probabilityValue}</li>
                                    <li>Modele: {modelSourceLabel}</li>
                                  </ul>
                                </div>

                                <div className="dashboard-ai-copilot-card">
                                  <h5>Suggestion</h5>
                                  <p>{suggestionText}</p>
                                  <p className="dashboard-ai-copilot-note">
                                    Categorie: {suggestionCategory} ·
                                    Probabilite: {suggestionProbability}
                                  </p>
                                  {suggestedActions.length > 0 ? (
                                    <ul>
                                      {suggestedActions.map((action) => (
                                        <li key={action}>{action}</li>
                                      ))}
                                    </ul>
                                  ) : null}
                                  {canOpenAiPlanAction ? (
                                    <button
                                      type="button"
                                      className="dashboard-ai-copilot-link"
                                      onClick={() =>
                                        navigate(
                                          `/plan-action/${encodeURIComponent(chartRow.Indicateur)}?year=${encodeURIComponent(selectedYear)}`,
                                        )
                                      }
                                    >
                                      Ouvrir le plan d'action
                                    </button>
                                  ) : null}
                                </div>

                                <div className="dashboard-ai-copilot-card">
                                  <h5>Signaux</h5>
                                  <ul>
                                    {signalItems.map((item) => (
                                      <li key={item.label}>
                                        {item.label}: {item.value}
                                      </li>
                                    ))}
                                  </ul>
                                  {anomaliesPreview.length > 0 ? (
                                    <ul>
                                      {anomaliesPreview.map(
                                        (anomaly, index) => (
                                          <li
                                            key={`${anomaly.month || "month"}-${anomaly.year_value || "year"}-${index}`}
                                          >
                                            {anomaly.month || "-"}{" "}
                                            {anomaly.year_value || ""}: ecart{" "}
                                            {typeof anomaly.ecart_pourcent ===
                                            "number"
                                              ? `${anomaly.ecart_pourcent.toFixed(1)}%`
                                              : "n/a"}
                                          </li>
                                        ),
                                      )}
                                    </ul>
                                  ) : null}
                                </div>

                                <div className="dashboard-ai-copilot-card">
                                  <h5>Contexte</h5>
                                  <p>
                                    {aiCopilotData?.status_summary ||
                                      "Aucun signal AI detaille n'est encore disponible."}
                                  </p>
                                  {probableCauses.length > 0 ? (
                                    <ul>
                                      {probableCauses.map((cause) => (
                                        <li key={cause}>{cause}</li>
                                      ))}
                                    </ul>
                                  ) : null}
                                  <p className="dashboard-ai-copilot-note">
                                    {aiCopilotData?.signal_source_summary ||
                                      "Source du score AI non documentee."}
                                  </p>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="dashboard-chart-card">
                          <h4>Graphique Linéaire - Objectif vs Réalisation</h4>
                          <div className="dashboard-chart-shell">
                            <ResponsiveContainer
                              width="100%"
                              height={tableChartHeight}
                            >
                              <LineChart data={chartData} margin={chartMargin}>
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="#374151"
                                />
                                <XAxis
                                  dataKey="month"
                                  stroke="#9ca3af"
                                  interval={0}
                                  padding={chartXAxisPadding}
                                  tickMargin={chartTickMargin}
                                  height={chartAxisHeight}
                                  angle={chartAxisAngle}
                                  textAnchor={chartAxisAnchor}
                                  tick={{
                                    fontSize: isMobileChartViewport ? 11 : 12,
                                  }}
                                />
                                <YAxis
                                  stroke="#9ca3af"
                                  domain={comparisonChartDomain}
                                  width={isMobileChartViewport ? 38 : 48}
                                  tick={{
                                    fontSize: isMobileChartViewport ? 11 : 12,
                                  }}
                                />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: "#1f2937",
                                    border: "1px solid #374151",
                                    color: "#fff",
                                  }}
                                  formatter={(value) =>
                                    formatValueWithUnit(value, chartUnit)
                                  }
                                />
                                <Legend
                                  verticalAlign="top"
                                  height={isMobileChartViewport ? 46 : 32}
                                  wrapperStyle={{
                                    fontSize: isMobileChartViewport
                                      ? "11px"
                                      : "12px",
                                  }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="objectif"
                                  stroke="#a78bfa"
                                  strokeDasharray="5 5"
                                  name="Objectif"
                                  strokeWidth={2}
                                  connectNulls
                                  dot={false}
                                  activeDot={{ r: 4 }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="realise"
                                  stroke="#34d399"
                                  strokeWidth={2}
                                  name="Réalisation"
                                  connectNulls
                                  dot={
                                    isMobileChartViewport
                                      ? false
                                      : { fill: "#34d399", strokeWidth: 2 }
                                  }
                                  activeDot={{ r: 4 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                        <div className="dashboard-chart-card">
                          <h4>
                            Graphique en Aires - Évolution de la Réalisation
                          </h4>
                          <div className="dashboard-chart-shell">
                            <ResponsiveContainer
                              width="100%"
                              height={tableChartHeight}
                            >
                              <AreaChart data={chartData} margin={chartMargin}>
                                <defs>
                                  <linearGradient
                                    id="colorRealiseDark"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                  >
                                    <stop
                                      offset="5%"
                                      stopColor="#34d399"
                                      stopOpacity={0.8}
                                    />
                                    <stop
                                      offset="95%"
                                      stopColor="#34d399"
                                      stopOpacity={0.1}
                                    />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="#374151"
                                />
                                <XAxis
                                  dataKey="month"
                                  stroke="#9ca3af"
                                  interval={0}
                                  padding={chartXAxisPadding}
                                  tickMargin={chartTickMargin}
                                  height={chartAxisHeight}
                                  angle={chartAxisAngle}
                                  textAnchor={chartAxisAnchor}
                                  tick={{
                                    fontSize: isMobileChartViewport ? 11 : 12,
                                  }}
                                />
                                <YAxis
                                  stroke="#9ca3af"
                                  domain={realiseChartDomain}
                                  width={isMobileChartViewport ? 38 : 48}
                                  tick={{
                                    fontSize: isMobileChartViewport ? 11 : 12,
                                  }}
                                />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: "#1f2937",
                                    border: "1px solid #374151",
                                    color: "#fff",
                                  }}
                                  formatter={(value) =>
                                    formatValueWithUnit(value, chartUnit)
                                  }
                                />
                                <Area
                                  type="monotone"
                                  dataKey="realise"
                                  stroke="#34d399"
                                  fillOpacity={1}
                                  fill="url(#colorRealiseDark)"
                                  name="Réalisation"
                                  connectNulls
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                        <div className="dashboard-chart-card">
                          <h4>Graphique en Barres - Comparaison</h4>
                          <div className="dashboard-chart-shell">
                            <ResponsiveContainer
                              width="100%"
                              height={tableChartHeight}
                            >
                              <BarChart data={chartData} margin={chartMargin}>
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="#374151"
                                />
                                <XAxis
                                  dataKey="month"
                                  stroke="#9ca3af"
                                  interval={0}
                                  padding={chartXAxisPadding}
                                  tickMargin={chartTickMargin}
                                  height={chartAxisHeight}
                                  angle={chartAxisAngle}
                                  textAnchor={chartAxisAnchor}
                                  tick={{
                                    fontSize: isMobileChartViewport ? 11 : 12,
                                  }}
                                />
                                <YAxis
                                  stroke="#9ca3af"
                                  domain={barChartDomain}
                                  width={isMobileChartViewport ? 38 : 48}
                                  tick={{
                                    fontSize: isMobileChartViewport ? 11 : 12,
                                  }}
                                />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: "#1f2937",
                                    border: "1px solid #374151",
                                    color: "#fff",
                                  }}
                                  formatter={(value) =>
                                    formatValueWithUnit(value, chartUnit)
                                  }
                                />
                                <Legend
                                  verticalAlign="top"
                                  height={isMobileChartViewport ? 46 : 32}
                                  wrapperStyle={{
                                    fontSize: isMobileChartViewport
                                      ? "11px"
                                      : "12px",
                                  }}
                                />
                                <Bar
                                  dataKey="objectif"
                                  fill="#a78bfa"
                                  name="Objectif"
                                  radius={[4, 4, 0, 0]}
                                />
                                <Bar
                                  dataKey="realise"
                                  fill="#34d399"
                                  name="Réalisation"
                                  radius={[4, 4, 0, 0]}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/*  Modale Objectifs  */}
            {objectiveModalOpen && currentEditingRow && (
              <div
                className="dashboard-modal-overlay"
                onClick={() => {
                  setObjectiveModalOpen(false);
                  setModalError("");
                }}
              >
                <div className="obj-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="obj-modal-header">
                    <div className="obj-modal-header-left">
                      <span className="obj-modal-icon">
                        <FontAwesomeIcon icon={byPrefixAndName.fa.bullseye} />
                      </span>
                      <div>
                        <h3 className="obj-modal-title">
                          Definir les Objectifs
                        </h3>
                        <p className="obj-modal-subtitle">
                          <strong>
                            {currentEditingRow.Designation ||
                              currentEditingRow.Indicateur}
                          </strong>{" "}
                          - {selectedYear}
                          {currentEditingRow.Responsable && (
                            <span className="obj-modal-responsable">
                              {currentEditingRow.Responsable}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="obj-modal-header-right">
                      {authUser?.isAdmin ? (
                        <span className="obj-modal-role-badge obj-modal-role-admin">
                          Admin
                        </span>
                      ) : (
                        <span className="obj-modal-role-badge obj-modal-role-resp">
                          Responsable
                        </span>
                      )}
                      <button
                        type="button"
                        className="obj-modal-close"
                        onClick={() => {
                          setObjectiveModalOpen(false);
                          setModalError("");
                        }}
                        aria-label="Fermer"
                      >
                        <FontAwesomeIcon icon={byPrefixAndName.fa.close} />
                      </button>
                    </div>
                  </div>

                  <div className="obj-modal-info-bar">
                    <span className="obj-modal-info-item">
                      <span className="obj-modal-info-label">Signe</span>
                      <strong className="obj-modal-info-value">
                        {formatMathSign(currentEditingRow.Signe) || "-"}
                      </strong>
                    </span>
                    <span className="obj-modal-info-sep" />
                    <span className="obj-modal-info-item">
                      <span className="obj-modal-info-label">Unite</span>
                      <strong className="obj-modal-info-value">
                        {formatMathUnit(currentEditingRow.Unite) || "-"}
                      </strong>
                    </span>
                    <span className="obj-modal-info-sep" />
                    <span className="obj-modal-info-item">
                      <span className="obj-modal-info-label">
                        Moyenne actuelle
                      </span>
                      <strong className="obj-modal-info-value">
                        {formatNumber(
                          currentEditingRow.objective_moyenne_current,
                        ) || "-"}
                      </strong>
                    </span>
                  </div>

                  <div className="obj-modal-period-section">
                    <label className="obj-modal-period-label">
                      Periodicite des objectifs
                    </label>
                    <div className="obj-modal-period-tabs">
                      {["mensuelle", "trimestrielle", "annuelle"].map(
                        (type) => (
                          <button
                            key={type}
                            type="button"
                            className={`obj-modal-period-tab ${modalPeriodType === type ? "active" : ""}`}
                            onClick={() => {
                              const currentMonths = getMonthValuesFromGroup(
                                modalGroupValues,
                                modalPeriodType,
                              );
                              const values = Object.values(
                                currentMonths,
                              ).filter((v) => v !== null);
                              const avg =
                                values.length > 0
                                  ? values.reduce((a, b) => a + b, 0) /
                                    values.length
                                  : null;
                              let newGroup = {};
                              if (type === "annuelle") {
                                newGroup = { annual: avg };
                              } else if (type === "trimestrielle") {
                                newGroup = {
                                  q1: avg,
                                  q2: avg,
                                  q3: avg,
                                  q4: avg,
                                };
                              } else {
                                newGroup = currentMonths;
                              }
                              setModalGroupValues(newGroup);
                              setModalPeriodType(type);
                            }}
                          >
                            {type === "mensuelle"
                              ? "Mensuelle"
                              : type === "trimestrielle"
                                ? "Trimestrielle"
                                : "Annuelle"}
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="obj-modal-body">
                    {modalPeriodType === "annuelle" && (
                      <div className="obj-modal-annual-wrap">
                        <label className="obj-modal-field">
                          <span className="obj-modal-field-label">
                            Valeur cible annuelle ({selectedYear})
                          </span>
                          <input
                            type="date"
                            value={modalDeadlines.annual ?? ""}
                            onChange={(e) =>
                              setModalDeadlines((prev) => ({
                                ...prev,
                                annual: e.target.value,
                              }))
                            }
                          />
                          <div className="obj-modal-field-input-wrap">
                            <input
                              type="number"
                              step="any"
                              className="obj-modal-input obj-modal-input-lg"
                              placeholder="Ex: 95.5"
                              value={modalGroupValues.annual ?? ""}
                              onChange={(e) =>
                                setModalGroupValues({
                                  annual: e.target.value
                                    ? Number(e.target.value)
                                    : null,
                                })
                              }
                            />
                            <span className="obj-modal-input-unit">
                              {formatMathUnit(currentEditingRow.Unite) || ""}
                            </span>
                          </div>
                        </label>
                      </div>
                    )}

                    {modalPeriodType === "trimestrielle" && (
                      <div className="obj-modal-quarter-grid">
                        {[
                          { key: "q1", label: "T1", months: "Jan-Fev-Mars" },
                          { key: "q2", label: "T2", months: "Avr-Mai-Juin" },
                          { key: "q3", label: "T3", months: "Juil-Aout-Sept" },
                          { key: "q4", label: "T4", months: "Oct-Nov-Dec" },
                        ].map(({ key, label, months }) => (
                          <div key={key} className="obj-modal-quarter-card">
                            <span className="obj-modal-quarter-title">
                              {label}
                            </span>
                            <div className="date_lilimte-field">
                              <input
                                type="date"
                                value={modalDeadlines[key] ?? ""}
                                onChange={(e) =>
                                  setModalDeadlines((prev) => ({
                                    ...prev,
                                    [key]: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <span className="obj-modal-quarter-months">
                              {months}
                            </span>
                            <div className="obj-modal-field-input-wrap">
                              <input
                                type="number"
                                step="any"
                                className="obj-modal-input"
                                placeholder="Valeur"
                                value={modalGroupValues[key] ?? ""}
                                onChange={(e) =>
                                  setModalGroupValues((prev) => ({
                                    ...prev,
                                    [key]: e.target.value
                                      ? Number(e.target.value)
                                      : null,
                                  }))
                                }
                              />
                              <span className="obj-modal-input-unit">
                                {formatMathUnit(currentEditingRow.Unite) || ""}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {modalPeriodType === "mensuelle" && (
                      <div className="obj-modal-month-grid">
                        {MONTH_COLUMNS.map((m) => (
                          <div key={m.key} className="obj-modal-month-card">
                            <span className="obj-modal-month-label">
                              {m.label}
                            </span>
                            <div className="date_lilimte-field">
                              <input
                                type="date"
                                value={modalDeadlines[m.key] ?? ""}
                                onChange={(e) =>
                                  setModalDeadlines((prev) => ({
                                    ...prev,
                                    [m.key]: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="obj-modal-field-input-wrap">
                              <input
                                type="number"
                                step="any"
                                className="obj-modal-input"
                                placeholder="-"
                                value={modalGroupValues[m.key] ?? ""}
                                onChange={(e) =>
                                  setModalGroupValues((prev) => ({
                                    ...prev,
                                    [m.key]: e.target.value
                                      ? Number(e.target.value)
                                      : null,
                                  }))
                                }
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {modalError && (
                    <div className="obj-modal-error">
                      <span>Erreur: {modalError}</span>
                    </div>
                  )}

                  <div className="obj-modal-footer">
                    <button
                      type="button"
                      className="obj-modal-btn-cancel"
                      onClick={() => {
                        setObjectiveModalOpen(false);
                        setModalError("");
                      }}
                      disabled={isSavingObjective}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      className="obj-modal-btn-save"
                      onClick={handleSaveObjective}
                      disabled={isSavingObjective}
                    >
                      {isSavingObjective ? (
                        <>
                          <span className="obj-modal-spinner" />
                          Sauvegarde en cours...
                        </>
                      ) : (
                        <>Sauvegarder les objectifs</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {realiseModalOpen && currentEditingRealiseRow && (
              <div
                className="dashboard-modal-overlay"
                onClick={() => setRealiseModalOpen(false)}
              >
                <div
                  className="obj-modal obj-modal--realise"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="obj-modal-header">
                    <div className="obj-modal-header-left">
                      <span className="obj-modal-icon obj-modal-icon--realise">
                        R
                      </span>
                      <div>
                        <h3 className="obj-modal-title">Saisie des Realises</h3>
                        <p className="obj-modal-subtitle">
                          <strong>
                            {currentEditingRealiseRow.Designation ||
                              currentEditingRealiseRow.Indicateur}
                          </strong>{" "}
                          - {selectedYear}
                          {currentEditingRealiseRow.Responsable && (
                            <span className="obj-modal-responsable">
                              {currentEditingRealiseRow.Responsable}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="obj-modal-header-right">
                      {authUser?.isAdmin ? (
                        <span className="obj-modal-role-badge obj-modal-role-admin">
                          Admin
                        </span>
                      ) : (
                        <span className="obj-modal-role-badge obj-modal-role-resp">
                          Responsable
                        </span>
                      )}
                      <button
                        type="button"
                        className="obj-modal-close"
                        onClick={() => setRealiseModalOpen(false)}
                        aria-label="Fermer"
                      >
                        <FontAwesomeIcon icon={byPrefixAndName.fa.close} />
                      </button>
                    </div>
                  </div>

                  <div className="obj-modal-info-bar">
                    <span className="obj-modal-info-item">
                      <span className="obj-modal-info-label">
                        Objectif moyen
                      </span>
                      <strong className="obj-modal-info-value obj-modal-info-value--obj">
                        {formatMathSign(currentEditingRealiseRow.Signe)}{" "}
                        {formatNumber(
                          currentEditingRealiseRow.objective_moyenne_current,
                        )}{" "}
                        {formatMathUnit(currentEditingRealiseRow.Unite)}
                      </strong>
                    </span>
                    <span className="obj-modal-info-sep" />
                    <span className="obj-modal-info-item">
                      <span className="obj-modal-info-label">
                        Realise moyen actuel
                      </span>
                      <strong className="obj-modal-info-value obj-modal-info-value--real">
                        {formatNumber(
                          currentEditingRealiseRow.realise_moyenne_current,
                        ) || "-"}{" "}
                        {formatMathUnit(currentEditingRealiseRow.Unite)}
                      </strong>
                    </span>
                  </div>

                  <div className="obj-modal-body">
                    <div className="obj-modal-realise-legend">
                      <span className="obj-modal-realise-legend-item">
                        <span className="obj-modal-legend-dot obj-modal-legend-dot--obj" />
                        Objectif
                      </span>
                      <span className="obj-modal-realise-legend-item">
                        <span className="obj-modal-legend-dot obj-modal-legend-dot--real" />
                        Realise saisi
                      </span>
                    </div>
                    <div className="obj-modal-month-grid">
                      {MONTH_COLUMNS.map((m) => {
                        const objVal =
                          currentEditingRealiseRow[`objective_${m.key}`];
                        const realVal = realiseModalValues[m.key];
                        const monthMlStatus =
                          realiseMlStatus?.monthKey === m.key
                            ? realiseMlStatus
                            : null;
                        const perf = evaluatePerformance(
                          realVal,
                          objVal,
                          currentEditingRealiseRow.Signe,
                        );
                        const cardClass =
                          perf === "good"
                            ? "obj-modal-month-card obj-modal-month-card--realise obj-modal-month-good"
                            : perf === "bad"
                              ? "obj-modal-month-card obj-modal-month-card--realise obj-modal-month-bad"
                              : "obj-modal-month-card obj-modal-month-card--realise";

                        return (
                          <div key={m.key} className={cardClass}>
                            <span className="obj-modal-month-label">
                              {m.label}
                            </span>
                            {objVal !== null && objVal !== undefined && (
                              <span className="obj-modal-month-obj">
                                obj: {formatNumber(objVal)}
                              </span>
                            )}
                            <div className="obj-modal-field-input-wrap">
                              <input
                                type="number"
                                step="any"
                                className="obj-modal-input"
                                placeholder="-"
                                value={realVal ?? ""}
                                onChange={(e) => {
                                  setRealiseModalValues((prev) => ({
                                    ...prev,
                                    [m.key]: e.target.value
                                      ? Number(e.target.value)
                                      : null,
                                  }));
                                  setRealiseMlStatus((prev) =>
                                    prev?.prediction?.monthKey === m.key
                                      ? null
                                      : prev,
                                  );
                                }}
                              />
                            </div>
                            <div className="obj-modal-ml-actions">
                              <button
                                type="button"
                                className="obj-modal-ml-btn obj-modal-ml-btn--ai"
                                onClick={() => handlePredictRealiseMonth(m.key)}
                                disabled={
                                  isSavingRealise ||
                                  Boolean(realiseMlLoadingKey) ||
                                  objVal === null ||
                                  objVal === undefined
                                }
                                title="Predire la realisation avec le modele de regression"
                              >
                                {realiseMlLoadingKey === `predict-${m.key}`
                                  ? "..."
                                  : "AI"}
                              </button>
                              <button
                                type="button"
                                className="obj-modal-ml-btn obj-modal-ml-btn--ml"
                                onClick={() => handleTestRealiseMonth(m.key)}
                                disabled={
                                  isSavingRealise ||
                                  Boolean(realiseMlLoadingKey) ||
                                  objVal === null ||
                                  objVal === undefined ||
                                  realVal === null ||
                                  realVal === undefined
                                }
                                title="Tester l'anomalie ML pour ce mois"
                              >
                                {realiseMlLoadingKey === `test-${m.key}`
                                  ? "..."
                                  : "ML"}
                              </button>
                            </div>
                            {monthMlStatus && (
                              <div
                                className={`obj-modal-ml-status obj-modal-ml-status--${monthMlStatus.type}`}
                              >
                                <span>{monthMlStatus.message}</span>
                                {monthMlStatus.prediction && (
                                  <button
                                    type="button"
                                    className="obj-modal-ml-apply-btn"
                                    onClick={() =>
                                      handleApplyPredictedRealise(
                                        monthMlStatus.prediction,
                                      )
                                    }
                                  >
                                    Appliquer
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="obj-modal-footer">
                    <button
                      type="button"
                      className="obj-modal-btn-cancel"
                      onClick={() => setRealiseModalOpen(false)}
                      disabled={isSavingRealise}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      className="obj-modal-btn-save obj-modal-btn-save--realise"
                      onClick={handleSaveRealise}
                      disabled={isSavingRealise}
                    >
                      {isSavingRealise ? (
                        <>
                          <span className="obj-modal-spinner" />
                          Sauvegarde en cours...
                        </>
                      ) : (
                        <>Enregistrer les realises</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {!isChatOpen && (
          <button
            className="chatbot-launcher"
            onClick={toggleChat}
            type="button"
          >
            <FaComment></FaComment> Chat IA
          </button>
        )}

        <div className={`container-chatbot ${isChatOpen ? "open" : "closed"}`}>
          {/* ── En-tête ── */}
          <div className="chatbot-header">
            <div className="chatbot-avatar">
              <BotIcon size={18} />
            </div>
            <div>
              <p className="chatbot-name">
                {chatMode === "enterprise" ? "Chat entreprise" : "Chat normal"}
              </p>
              <p className="chatbot-status">
                {chatMode === "enterprise"
                  ? "● Données KPI sécurisées"
                  : "● Sans accès base de données"}
              </p>
            </div>
            <div
              className="chatbot-mode-toggle"
              role="tablist"
              aria-label="Mode de chat"
            >
              <button
                type="button"
                className={chatMode === "normal" ? "active" : ""}
                onClick={() => switchChatMode("normal")}
              >
                Normal
              </button>
              <button
                type="button"
                className={chatMode === "enterprise" ? "active" : ""}
                onClick={() => switchChatMode("enterprise")}
              >
                Entreprise
              </button>
            </div>
            <button
              className="chatbot-close-btn"
              onClick={toggleChat}
              type="button"
            >
              Fermer
            </button>
            <button
              className="chatbot-clear-btn"
              onClick={clearChat}
              type="button"
            >
              Effacer
            </button>
          </div>

          {/* ── Messages ── */}
          <div className="chatbot-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`message-row ${msg.role}`}>
                {msg.role === "bot" && (
                  <div className="msg-avatar bot-icon">
                    <BotIcon size={14} />
                  </div>
                )}
                <div className={`bubble ${msg.role}`}>{msg.text}</div>
                {msg.role === "user" && (
                  <div className="msg-avatar user-icon">U</div>
                )}
              </div>
            ))}

            {/* Indicateur de frappe */}
            {isLoading && loadingChatMode === chatMode && (
              <div className="message-row bot">
                <div className="msg-avatar bot-icon">
                  <BotIcon size={14} />
                </div>
                <div
                  className="bubble bot thinking-bubble"
                  role="status"
                  aria-live="polite"
                >
                  <span>Penser</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Saisie ── */}
          <div className="chatbot-input-area">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKey}
              placeholder={
                chatMode === "enterprise"
                  ? "Question sur les KPI, objectifs, anomalies..."
                  : "Question générale"
              }
              className="chatbot-input"
            />
            <button
              className="chatbot-send-btn"
              onClick={askOllama}
              type="button"
              disabled={isLoading}
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default KPI;
