const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:8000';

export const resolveMediaUrl = (...candidates) => {
  const raw = candidates.find((value) => typeof value === 'string' && value.trim());
  if (!raw) return null;

  const value = raw.trim();

  if (/^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }

  if (value.startsWith('/')) {
    return value.startsWith('/uploads/') ? value : `${API_ORIGIN}${value}`;
  }

  return `${API_ORIGIN}/${value}`;
};
