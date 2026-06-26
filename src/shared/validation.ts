export function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeIdCard(value: string) {
  return value.trim().toUpperCase();
}

export function isValidPhone(value: string) {
  return /^1[3-9]\d{9}$/.test(normalizePhone(value));
}

export function isValidIdCard(value: string) {
  const text = normalizeIdCard(value);
  if (!/^\d{17}[\dX]$/.test(text)) return false;

  const year = Number(text.slice(6, 10));
  const month = Number(text.slice(10, 12));
  const day = Number(text.slice(12, 14));
  const date = new Date(year, month - 1, day);

  return (
    year >= 1900 &&
    year <= new Date().getFullYear() &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}
