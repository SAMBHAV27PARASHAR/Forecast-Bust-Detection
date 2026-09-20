/**
 * Timezone and Exact Lead Time Utilities
 * Converts UTC NOAA GEFS timestamps to Indian Standard Time (IST = UTC + 05:30)
 * Calculates exact lead time directly from initialization and valid forecast timestamps.
 */

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Parses any UTC timestamp string into a Date object (in UTC epoch time)
 * Supports formats like:
 * - "2026-09-19 00:00 UTC"
 * - "2026-09-19 00:00"
 * - "2026-09-19T00:00:00Z"
 * - "2026-09-19"
 */
export function parseUtcTimestamp(utcStr) {
  if (!utcStr) return null;
  if (utcStr instanceof Date) return utcStr;

  const clean = String(utcStr).trim().replace(' UTC', '').replace('Z', '');
  
  // Format: YYYY-MM-DD HH:mm or YYYY-MM-DDTHH:mm:ss or YYYY-MM-DD HH
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2})(?::(\d{2}))?(?::(\d{2}))?)?/);
  if (!match) {
    const d = new Date(utcStr);
    return isNaN(d.getTime()) ? null : d;
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  const hour = match[4] !== undefined ? parseInt(match[4], 10) : 0;
  const min = match[5] !== undefined ? parseInt(match[5], 10) : 0;
  const sec = match[6] !== undefined ? parseInt(match[6], 10) : 0;

  return new Date(Date.UTC(year, month, day, hour, min, sec));
}

/**
 * Converts UTC timestamp to IST Date components (UTC + 05:30)
 */
export function getIstComponents(utcStr) {
  const utcDate = parseUtcTimestamp(utcStr);
  if (!utcDate) return null;

  // IST offset is +5 hours 30 minutes = +330 minutes = 19,800,000 ms
  const istEpoch = utcDate.getTime() + (5.5 * 60 * 60 * 1000);
  const istDate = new Date(istEpoch);

  return {
    year: istDate.getUTCFullYear(),
    monthIndex: istDate.getUTCMonth(),
    monthShort: MONTH_NAMES_SHORT[istDate.getUTCMonth()],
    monthFull: MONTH_NAMES_FULL[istDate.getUTCMonth()],
    day: istDate.getUTCDate(),
    dayPad: String(istDate.getUTCDate()).padStart(2, '0'),
    hours: istDate.getUTCHours(),
    hoursPad: String(istDate.getUTCHours()).padStart(2, '0'),
    minutes: istDate.getUTCMinutes(),
    minutesPad: String(istDate.getUTCMinutes()).padStart(2, '0')
  };
}

/**
 * Formats UTC timestamp into IST display string
 * e.g. "2026-09-19 00:00 UTC" -> "19 Sep 2026 • 05:30 IST"
 * e.g. "2026-09-24 06:00 UTC" -> "24 Sep 2026 • 11:30 IST"
 */
export function formatToIst(utcStr, format = 'full') {
  const comp = getIstComponents(utcStr);
  if (!comp) return utcStr || '';

  if (format === 'time') {
    return `${comp.hoursPad}:${comp.minutesPad} IST`;
  }
  if (format === 'timeNoTz') {
    return `${comp.hoursPad}:${comp.minutesPad}`;
  }
  if (format === 'date') {
    return `${comp.day} ${comp.monthShort} ${comp.year}`;
  }
  if (format === 'dateFull') {
    return `${comp.day} ${comp.monthFull} ${comp.year}`;
  }
  if (format === 'short') {
    return `${comp.day} ${comp.monthShort} • ${comp.hoursPad}:${comp.minutesPad} IST`;
  }

  // Default: 'full' -> "19 Sep 2026 • 05:30 IST"
  return `${comp.day} ${comp.monthShort} ${comp.year} • ${comp.hoursPad}:${comp.minutesPad} IST`;
}

/**
 * Converts a UTC hour (0, 3, 6, 9, 12, 15, 18, 21) into its IST time string
 * e.g. 0 -> "05:30 IST", 6 -> "11:30 IST"
 */
export function formatUtcHourToIst(utcHour) {
  const totalMins = (Number(utcHour) * 60) + 330; // +5h 30m
  const istHour = Math.floor(totalMins / 60) % 24;
  const istMin = totalMins % 60;
  return `${String(istHour).padStart(2, '0')}:${String(istMin).padStart(2, '0')} IST`;
}

/**
 * Calculates exact lead time in hours from actual initialization and valid forecast timestamps
 * e.g. init: "2026-09-19 00:00 UTC", valid: "2026-09-24 06:00 UTC" -> 126
 */
export function calculateExactLeadHours(validTimeStr, initTimeStr, fallbackLead = 0) {
  const vDate = parseUtcTimestamp(validTimeStr);
  const iDate = parseUtcTimestamp(initTimeStr);

  if (vDate && iDate) {
    const diffMs = vDate.getTime() - iDate.getTime();
    const exactHours = Math.round(diffMs / (3600 * 1000));
    if (!isNaN(exactHours) && exactHours >= 0) {
      return exactHours;
    }
  }

  return fallbackLead;
}
