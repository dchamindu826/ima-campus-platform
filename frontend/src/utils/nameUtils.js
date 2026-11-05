/**
 * Utility functions for intelligent student name parsing and calling name extraction (Frontend).
 * Accurately extracts spoken names for entrance gate TTS announcements and registration badges.
 * 
 * Supports Sri Lankan naming patterns:
 * - "K.S. Saman" -> "Saman" (initials skipped)
 * - "K. S. Saman" -> "Saman"
 * - "K.S.Saman" -> "Saman" (unspaced dots normalized)
 * - "Saman Kumara" -> "Saman" (standard first name)
 * - "W.A. Nuwan Bandara" -> "Nuwan"
 * - "M.G. Kasun Chamara" -> "Kasun"
 * - "Mohamed Rizwan" -> "Mohamed"
 * - "A B C Silva" -> "Silva"
 * - "P. Kavindu" -> "Kavindu"
 */

export function isInitials(word) {
  if (!word) return true;
  const clean = word.replace(/[^A-Za-z\u0D80-\u0DFF\.]/g, '');
  if (!clean) return true;

  // Single character with or without dot (e.g. "K", "K.", "ස.")
  if (/^[A-Za-z\u0D80-\u0DFF]\.?$/.test(clean)) return true;

  // Initials separated by dots: e.g. "K.S.", "K.S", "W.A.S.", "M.G."
  const segments = clean.split('.').filter(s => s.length > 0);
  if (segments.length > 0 && segments.every(s => s.length <= 1)) {
    return true;
  }

  // All-uppercase short acronym without vowels (e.g. "KS", "WAS", "HMK")
  if (/^[A-Z]{2,4}$/.test(clean) && !/[AEIOU]/.test(clean)) {
    return true;
  }

  return false;
}

export function cleanWord(word) {
  if (!word) return '';
  return word.replace(/^[^\w\u0D80-\u0DFF]+|[^\w\u0D80-\u0DFF]+$/g, '').trim();
}

export function extractCallingName(studentOrName) {
  if (!studentOrName) return 'Student';

  let fullName = '';
  if (typeof studentOrName === 'string') {
    fullName = studentOrName;
  } else {
    // If callingName is already provided by backend
    if (studentOrName.callingName && !isInitials(studentOrName.callingName)) {
      return cleanWord(studentOrName.callingName);
    }
    // If firstName is already set and is NOT an initial, prefer it
    if (studentOrName.firstName && !isInitials(studentOrName.firstName)) {
      return cleanWord(studentOrName.firstName);
    }
    fullName = studentOrName.studentName || studentOrName.firstName || studentOrName.name || '';
  }

  fullName = fullName.trim();
  if (!fullName) return 'Student';

  // Normalize: e.g. "K.S.Saman" -> "K.S. Saman"
  const normalized = fullName
    .replace(/([A-Za-z\u0D80-\u0DFF]\.)(?=[A-Za-z\u0D80-\u0DFF]{2,})/g, '$1 ')
    .replace(/[,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = normalized.split(/\s+/);
  const titles = new Set(['mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'miss', 'dr', 'dr.', 'master', 'rev', 'rev.']);

  for (const part of parts) {
    const clean = cleanWord(part);
    if (!clean) continue;
    if (titles.has(clean.toLowerCase())) continue;
    if (isInitials(clean)) continue;
    return clean;
  }

  // Fallback if every part was an initial
  return cleanWord(parts[0]) || 'Student';
}

export default {
  isInitials,
  cleanWord,
  extractCallingName
};
