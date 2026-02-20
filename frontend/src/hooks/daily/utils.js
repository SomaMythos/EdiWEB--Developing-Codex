export function parseIntegerOrFallback(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function isBlockCompleted(value) {
  return value === true || value === 1;
}

export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

export function addMinutesToTime(start, minutes) {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor((total % 1440) / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function getFrequencyLabel(frequencyType) {
  const labels = {
    flex: "Flexível",
    everyday: "Todo Dia",
    workday: "Work Day",
    offday: "Off Day"
  };

  return labels[frequencyType] || "Flexível";
}

export function formatFixedTime(timeValue) {
  if (!timeValue) return null;
  return String(timeValue).slice(0, 5);
}

export function createUiState(status = "idle", error = null, successMessage = "") {
  return { status, error, successMessage };
}
