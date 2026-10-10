const crypto = require('crypto');

const SHEET_ID = '1vlTuotLw34fedME3gNQj09cZw-todVomxAiu5P1wZ6Q';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes in-memory cache

const DEFAULT_PROJECT_ID = 'time-table-project-450013';
const DEFAULT_CLIENT_EMAIL = 'timetable-bot-876@time-table-project-450013.iam.gserviceaccount.com';
const DEFAULT_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC7Gp4+xHPlQPJL
G3VGg2r4WHosjiheeADEZiLw5hyBSYva9TxfIS+gWEICCQTCc4dhCyBH/Ukb7Okw
wpvUVRjYlWp/zbYTXFDx1tGquxC/WHk8b2CsNUi/2682HbpBmlSpJqaYuxbbMSsI
7U0e2R6oxbVIygSSxxG7x2H5E6lrQLjPCOGTgPdCyHpjj4NmjAA7beonefTB3nXM
MxMjNldfrhJ3V9MC/mMFOtWJaj6beYvIxId6m+9iuBogdzHkYmhMymZ1JP5I4GO7
iVrbYB2IsjJTsnl/x4rXEd748Fg3xlgh+QpUkCkOG9j3KH9b9LukMM852o+IAJ3S
Ob6ctbHFAgMBAAECggEAJloO7MvE+82DvLx8nf8LGqu8I0ziXnbXpWpQKDPqzN9/
8NpKzS8WvZXJtfQWSyt2KQCoVclHxpcZt3p0iaIFzUNXSKooc7B9EQ1Y/deJV8dx
Vl94H+RuLJGBySRvzMmvJ9r51B2pUjWyXgqSP8v+elbIUYrDRDjU3DpCzVTn6clJ
ObH1LWViHEDyvBxVRYK1N+DdpLRJaisfw8hJsm7xvHO6Gc2XW27y3/gYCl4PgsYx
dUFCtZaCJSSdO9nqcEVWZK2yBP4m5iRwR/KWOvrg/yxy+n5IkLtZQ5ED69edpA5V
Hyr8XuC8ZQZ9UwDQm/WwZGqLnUclPdRq8ScUbxIe8QKBgQDf20Yd1Swu76wNV8GI
AZZbfS+l8FlB9b+5Y2jZqh3jeVEI7kG7wotrJSwpEVwsgATb3zQ+Ffpm/tKkNMMF
VBL1wQimqdK/Bf/fm5Q+os4GamtTTlFyylNXeV/cBgRTalzwsJqRh+RovPAPJ2s1
4T2SKj5h3XHqS+Llk3IdLqQELQKBgQDV+FwKituGFJp/JiPOhLy51mCKLmHI53TT
lZAe3//u0YQVbSejnUnFYr17XDh0mJuRdeTckmkv0hjZiA2ByrbbMjxUGbfD0xLb
MCr2InZwdKmaC7+fi1l2x/rC334oC3OnPFAQbYShw5S6R8G3MaB32HhWyDB0vFPT
j9ZvpB9q+QKBgEo7CBE0cyZNS5xREVfsTtOfu4EnJjH9L8pl8IrdInQf8oMnnpyI
cnrhJLepjgsjmHjglw5Pc21b6rWQ2WqW6oKbtCawAbZeYu7fRFVQ30i5WUWSnueV
t/U1xlfLlvuiNZeKuHaxvUgN/vzHcYG4YxZo8664I+Ixr9e5AQo0QScxAoGAILN0
XagbJMLBWe1aS5W9wikhV/z+tNWq5StWe2GAm98pcJzeEgNX4vLUQqY1epxYKkL6
VzuJF+XkJlrEtbFlgNqMnc3QZ/06RIV4C2X48/bgdMqW3qtNYPnvORkvDq+xXT26
fsg+HPrnIBEXaggLnkVXHuw5e53MseipvSY4JwECgYBAhy/9OXmC8ADXjaRtdgLr
Gqr8WisuwQQRCmlaku9OJpKky9/2uI1mvwMXMExWXfq4yZDopw6qSm8PSv5Xs2Ft
5W+YEsOEiqh0pu/QfTd1Dh7GNnbWEERl3RBj6EyUGxINwdL+TcwDDfpLlF3q0nls
TCFebCl7qM0DA8AujtR9Ag==
-----END PRIVATE KEY-----`;

let cachedSessions = null;
let cacheTimestamp = 0;

function getPrivateKey() {
  const pk = process.env.GOOGLE_PRIVATE_KEY || DEFAULT_PRIVATE_KEY;
  return pk.replace(/\\n/g, '\n').trim();
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(JSON.stringify({
    iss: process.env.GOOGLE_CLIENT_EMAIL || DEFAULT_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url');

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(header + '.' + claim);
  const signature = sign.sign(getPrivateKey(), 'base64url');
  const jwt = header + '.' + claim + '.' + signature;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Google OAuth failed: ' + err);
  }
  const json = await res.json();
  return json.access_token;
}

function getBg(cell) {
  const bg = cell && cell.effectiveFormat && cell.effectiveFormat.backgroundColor;
  if (!bg) return '';
  return (bg.red||0).toFixed(2) + (bg.green||0).toFixed(2) + (bg.blue||0).toFixed(2);
}

function cleanRoom(text) {
  if (!text) return 'Unknown';
  let s = String(text).trim();
  s = s.replace(/^(room\s*no\.?|room\s*number|room|location|venue)\s*/i, '').trim();
  if (s.toLowerCase().startsWith('no.') || s.toLowerCase().startsWith('no ')) s = s.slice(3).trim();
  s = s.replace(/[.,;:]+$/, '').trim();
  return s || 'Unknown';
}

function parseEmbeddedTime(courseEntry) {
  if (!courseEntry) return { courseName: courseEntry, time: null };
  const m = courseEntry.match(/\b(\d{1,2}:\d{2}(?:\s*-\s*\d{1,2}:\d{2})?)\b/);
  if (m) {
    const time = m[1].replace(/\s+/g, '');
    let clean = courseEntry.replace(m[0], '').replace(/\s+/g, ' ').trim();
    if (clean.endsWith('-')) clean = clean.slice(0, -1).trim();
    return { courseName: clean, time };
  }
  return { courseName: courseEntry, time: null };
}

function parseBatch(batchStr) {
  if (!batchStr) return { dept: '', year: '' };
  const m = batchStr.match(/BS\s+([A-Z]{2,4})\s*\(?(\d{4})?\)?/i);
  if (m) {
    return { dept: m[1].toUpperCase(), year: m[2] || '' };
  }
  const ym = batchStr.match(/\b(202[2-6])\b/);
  const dm = batchStr.match(/\b(CS|SE|AI|DS|CY)\b/i);
  return {
    dept: dm ? dm[1].toUpperCase() : '',
    year: ym ? ym[1] : (batchStr.toLowerCase().includes('repeat') ? 'Repeat' : '')
  };
}

async function fetchSpreadsheetData() {
  const token = await getAccessToken();
  const ranges = DAYS.map(d => `${d}!A1:AN100`).join('&ranges=');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?ranges=${ranges}&includeGridData=true`;
  const resp = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error('Google Sheets API failed (' + resp.status + '): ' + err);
  }
  return resp.json();
}

async function getOrFetchTimetable(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedSessions && (now - cacheTimestamp) < CACHE_DURATION_MS) {
    return cachedSessions;
  }

  const spreadsheet = await fetchSpreadsheetData();

  // 1. Extract Batch Color Map
  const batchColors = {};
  for (const sheet of (spreadsheet.sheets || [])) {
    const rows = sheet.data?.[0]?.rowData || [];
    for (let r = 0; r < Math.min(5, rows.length); r++) {
      for (const cell of (rows[r].values || [])) {
        const v = cell && cell.formattedValue;
        const color = getBg(cell);
        if (v && v.includes('BS') && color && color !== '1.001.001.00') {
          batchColors[color] = v.trim();
        }
      }
    }
  }

  const allSessions = [];

  for (const sheet of (spreadsheet.sheets || [])) {
    const dayName = sheet.properties?.title;
    if (!DAYS.includes(dayName)) continue;

    const rows = sheet.data?.[0]?.rowData || [];
    if (rows.length < 6) continue;

    let classTimeRowIdx = -1;
    let labTimeRowIdx = -1;

    for (let r = 0; r < Math.min(10, rows.length); r++) {
      const vals = rows[r].values || [];
      const col0 = vals[0]?.formattedValue ? String(vals[0].formattedValue).trim().toLowerCase() : '';
      if (col0.includes('room') && (col0.includes('time') || vals.some(c => /\b\d{1,2}:\d{2}\b/.test(c?.formattedValue || '')))) {
        classTimeRowIdx = r;
      }
      if (col0 === 'lab' || col0.startsWith('lab')) {
        labTimeRowIdx = r;
      }
    }

    if (classTimeRowIdx < 0) classTimeRowIdx = 4;

    const classTimesRow = rows[classTimeRowIdx]?.values || [];
    const labTimesRow = (labTimeRowIdx >= 0) ? (rows[labTimeRowIdx]?.values || []) : [];

    const classTimeMap = {};
    const labTimeMap = {};
    let lastClassTime = 'Unknown';
    let lastLabTime = 'Unknown';

    for (let c = 1; c < classTimesRow.length; c++) {
      const cv = classTimesRow[c]?.formattedValue;
      if (cv && /\b\d{1,2}:\d{2}\b/.test(cv)) {
        lastClassTime = cv.trim();
      }
      classTimeMap[c] = lastClassTime;
    }

    for (let c = 1; c < labTimesRow.length; c++) {
      const lv = labTimesRow[c]?.formattedValue;
      if (lv && /\b\d{1,2}:\d{2}\b/.test(lv)) {
        lastLabTime = lv.trim();
      }
      labTimeMap[c] = lastLabTime;
    }

    for (let r = classTimeRowIdx + 1; r < rows.length; r++) {
      const rowVals = rows[r].values || [];
      if (rowVals.length === 0) continue;
      const col0 = rowVals[0]?.formattedValue ? String(rowVals[0].formattedValue).trim() : '';
      if (!col0 || col0.toLowerCase() === 'lab' || col0.toLowerCase().includes('room')) continue;

      const isLabRow = (labTimeRowIdx >= 0 && r > labTimeRowIdx);
      const room = cleanRoom(col0);

      for (let c = 1; c < rowVals.length; c++) {
        const cell = rowVals[c];
        const val = cell?.formattedValue;
        if (!val || !val.trim()) continue;

        const cellColor = getBg(cell);
        const batchName = batchColors[cellColor];
        if (!batchName) continue; // Skip non-batch cells

        const { dept: batchDept, year: batchYear } = parseBatch(batchName);

        const embedded = parseEmbeddedTime(val.trim());
        let entryText = embedded.courseName;
        const timeSlot = embedded.time || (isLabRow ? (labTimeMap[c] || 'Unknown') : (classTimeMap[c] || 'Unknown'));

        let section = '';
        let dept = batchDept;
        const parenMatch = entryText.match(/\(([^)]+)\)/);
        if (parenMatch) {
          const p = parenMatch[1].trim();
          const dsMatch = p.match(/^([A-Z]{2,4})-([A-Z]\d*)$/i);
          if (dsMatch) {
            dept = dsMatch[1].toUpperCase();
            section = dsMatch[2].charAt(0).toUpperCase();
          } else {
            const secOnly = p.match(/^([A-Z]\d*)$/i);
            if (secOnly) {
              section = secOnly[1].charAt(0).toUpperCase();
            } else {
              const secDash = p.match(/-([A-Z]\d*)$/i);
              if (secDash) section = secDash[1].charAt(0).toUpperCase();
            }
          }
        }

        let cleanCourse = entryText.replace(/\s*\([^)]+\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
        cleanCourse = cleanCourse.replace(/Karakoram-\d+\s*Lab/gi, '').replace(/\b(resch)\b/gi, '').trim();

        if (section) {
          allSessions.push({
            day: dayName,
            time: timeSlot,
            room: room,
            course: cleanCourse,
            dept: dept,
            section: section,
            batch: batchYear,
            batchName: batchName,
            isLab: isLabRow || cleanCourse.toLowerCase().includes('lab'),
            courseKey: `${cleanCourse}|${dept}|${section}|${batchYear}`,
          });
        }
      }
    }
  }

  cachedSessions = allSessions;
  cacheTimestamp = now;
  return allSessions;
}

module.exports = async function handler(req, res) {
  if (res && res.setHeader) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    try {
      const data = await getOrFetchTimetable(req.query?.refresh === '1');
      const day = req.query?.day;
      const filtered = (day && DAYS.includes(day)) ? data.filter(s => s.day === day) : data;
      return res.status(200).json(filtered);
    } catch (err) {
      console.error('api/timetable error:', err);
      return res.status(500).json({ error: err.message });
    }
  } else {
    const url = new URL(req.url);
    const day = url.searchParams.get('day');
    const refresh = url.searchParams.get('refresh') === '1';
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const data = await getOrFetchTimetable(refresh);
      const filtered = (day && DAYS.includes(day)) ? data.filter(s => s.day === day) : data;
      return new Response(JSON.stringify(filtered), { status: 200, headers: corsHeaders });
    } catch (err) {
      console.error('api/timetable error:', err);
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }
};
