export const config = {
  runtime: 'edge',
};

const SHEET_ID = '1vlTuotLw34fedME3gNQj09cZw-todVomxAiu5P1wZ6Q';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const CACHE_TTL = 300; // 5 minutes

// Curriculum year mapping for FAST computing courses
const COURSE_YEAR_MAP = {
  // 2026 (Freshmen / 1st Year)
  'pf': '2026', 'programming fundamentals': '2026', 'calculus': '2026',
  'ideology of pak': '2026', 'pakistan studies': '2026', 'islamic': '2026', 'islamiyat': '2026',
  'func eng': '2026', 'functional english': '2026', 'english': '2026',
  'iict': '2026', 'intro to ict': '2026', 'applied physics': '2026', 'ap': '2026',
  'intro to se': '2026', 'intro to ds': '2026', 'prog for ai': '2026',
  'stat & math': '2026', 'seerah': '2026', 'arts & humanities': '2026',

  // 2025 (Sophomores / 2nd Year)
  'oop': '2025', 'object oriented': '2025', 'discrete': '2025', 'discrete structures': '2025',
  'data st': '2025', 'data structures': '2025', 'dld': '2025', 'digital logic': '2025',
  'sda': '2025', 'software design': '2025', 'la': '2025', 'linear algebra': '2025',
  'coal': '2025', 'computer organization': '2025',
  'math foundations of ai': '2025', 'dav': '2025', 'data analysis': '2025',
  'pak studies': '2025', 'tbw': '2025', 'technical & business': '2025',
  'uhq-i&ii': '2025', 'uhq-i & ii': '2025', 'uhq-ii': '2025',

  // 2024 (Juniors / 3rd Year)
  'os': '2024', 'operating systems': '2024', 'comp net': '2024', 'computer networks': '2024',
  'algo': '2024', 'algorithms': '2024', 'comp arch': '2024', 'computer architecture': '2024',
  'comp wrch': '2024', 'db': '2024', 'database': '2024',
  'ai': '2024', 'artificial intelligence': '2024', 'info sec': '2024', 'information security': '2024',
  'web prog': '2024', 'web programming': '2024', 'knowl rep': '2024', 'knowledge rep': '2024',
  'data ware': '2024', 'data ware & bi': '2024', 'fund of cv': '2024',
  's/w const': '2024', 'software const': '2024', 's/w quality': '2024', 'software quality': '2024',
  'cy sec': '2024', 'cyber security': '2024', 'info assur': '2024', 'adv stats': '2024',

  // 2023 (Seniors / 4th Year)
  'pdc': '2023', 'parallel': '2023', 'ppit': '2023', 'professional practices': '2023',
  'ml': '2023', 'machine learning': '2023', 'deep learn': '2023', 'gen ai': '2023',
  'agentic ai': '2023', 'cloud comp': '2023', 'nlp': '2023', 'smd': '2023',
  'mlops': '2023', 'app hci': '2023', 'hci': '2023', 'blockchain': '2023',
  'security ops': '2023', 'sec ops': '2023', 'vulnerability': '2023', 'formal methods': '2023',
  'process mining': '2023', 'business research': '2023', 'multiagent': '2023',
  'digital sustain': '2023', 'project': '2023', 'ai prod dev': '2023', 'adv ai': '2023',
  'embed robo': '2023', 's/w re-engg': '2023', 'game design': '2023',
};

function resolveBatchYear(courseName, parenContent) {
  if (parenContent) {
    const ym = parenContent.match(/,\s*(\d{2,4})\s*$/);
    if (ym) {
      const yr = ym[1];
      return yr.length === 2 ? '20' + yr : yr;
    }
    const ym2 = parenContent.match(/\b(202[2-6]|2[2-6])\b/);
    if (ym2) {
      const yr = ym2[1];
      return yr.length === 2 ? '20' + yr : yr;
    }
  }

  const clean = courseName.replace(/[\d:\-\s]+$/, '').trim().toLowerCase()
                          .replace(/\b(lab|resch|session)\b/g, '').trim();

  for (const [prefix, batch] of Object.entries(COURSE_YEAR_MAP)) {
    if (clean === prefix || clean.startsWith(prefix + ' ') || (' ' + clean + ' ').includes(' ' + prefix + ' ')) {
      return batch;
    }
  }

  return '2026';
}

export default async function handler(request) {
  const url = new URL(request.url);
  const day = url.searchParams.get('day');
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': `public, s-maxage=${CACHE_TTL}, stale-while-revalidate=600`,
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (day && DAYS.includes(day)) {
      const data = await fetchSheetDay(day);
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      const results = await Promise.all(DAYS.map(fetchSheetDay));
      const allEntries = results.flat();
      return new Response(JSON.stringify(allEntries), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function fetchSheetDay(dayName) {
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(dayName)}`;
  const resp = await fetch(sheetUrl, {
    headers: { 'User-Agent': 'Fastable/2.0' },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${dayName}`);
  const text = await resp.text();
  const jsonStr = text.replace(/^[^{]*/, '').replace(/\)\s*;?\s*$/, '');
  const gvizData = JSON.parse(jsonStr);
  return parseSheetData(gvizData.table, dayName);
}

function parseSheetData(tableData, dayName) {
  const results = [];
  const rows = tableData?.rows || [];
  if (rows.length < 6) return results;

  let timeRowIndex = -1;
  let labRowIndex = -1;

  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].c || [];
    const col0 = cells[0]?.v ? String(cells[0].v).trim().toLowerCase() : '';
    if (col0.includes('room') && col0.includes('time')) {
      timeRowIndex = i;
    }
    if (col0 === 'lab') {
      labRowIndex = i;
    }
  }

  if (timeRowIndex < 0) return results;

  const timeHeaderRow = rows[timeRowIndex].c || [];
  const timesPart1 = {};
  const timesPart2 = {};
  let room2Col = null;

  for (let c = 1; c < timeHeaderRow.length; c++) {
    const cell = timeHeaderRow[c];
    if (cell?.v) {
      const val = String(cell.v).trim();
      if (val.toLowerCase().includes('room')) {
        room2Col = c;
      } else if (val.includes(':') || val.includes('-')) {
        if (room2Col === null) {
          timesPart1[c] = val;
        } else {
          timesPart2[c] = val;
        }
      }
    }
  }

  const timesSorted1 = Object.keys(timesPart1).map(Number).sort((a, b) => a - b);
  const timesSorted2 = Object.keys(timesPart2).map(Number).sort((a, b) => a - b);

  const labTimeSlots = [];
  if (labRowIndex >= 0) {
    const labRow = rows[labRowIndex].c || [];
    for (let c = 1; c < labRow.length; c++) {
      const cell = labRow[c];
      if (cell?.v) {
        const ts = String(cell.v).trim();
        if (ts.includes(':') || ts.includes('-')) {
          labTimeSlots.push({ col: c, time: ts });
        }
      }
    }
  }

  function getTimeForCol(colIdx, isLab) {
    if (isLab) {
      for (let i = labTimeSlots.length - 1; i >= 0; i--) {
        if (labTimeSlots[i].col <= colIdx) return labTimeSlots[i].time;
      }
      return 'Unknown';
    }
    if (room2Col !== null && colIdx >= room2Col) {
      let t = null;
      for (const tc of timesSorted2) {
        if (tc <= colIdx) t = timesPart2[tc];
        else break;
      }
      return t || 'Unknown';
    } else {
      let t = null;
      for (const tc of timesSorted1) {
        if (tc <= colIdx) t = timesPart1[tc];
        else break;
      }
      return t || 'Unknown';
    }
  }

  function parseCellEntry(rawEntry) {
    if (!rawEntry) return null;
    let entry = rawEntry.trim();

    let embeddedTime = null;
    const timeMatch = entry.match(/\b(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})\b/);
    if (timeMatch) {
      embeddedTime = timeMatch[1].replace(/\s+/g, '');
      entry = entry.replace(timeMatch[0], '').trim();
    }

    const parenMatch = entry.match(/\(([^)]+)\)/);
    let dept = '', section = '', parenContent = '';
    let courseName = entry;

    if (parenMatch) {
      parenContent = parenMatch[1];
      courseName = entry.replace(/\s*\([^)]+\)\s*/, '').trim();

      const deptSecPart = parenContent.split(',')[0].trim();
      const dsMatch = deptSecPart.match(/^([A-Z]{2,4}(?:\/[A-Z]{2,4})*)-([A-Z]\d*)$/);
      if (dsMatch) {
        dept = dsMatch[1].split('/')[0];
        section = dsMatch[2].charAt(0);
      } else {
        const deptOnly = deptSecPart.match(/^([A-Z]{2,4}(?:\/[A-Z]{2,4})*)$/);
        if (deptOnly) dept = deptOnly[1].split('/')[0];
      }
    }

    const skipWords = ['tutorial batch', 'fids', 'fcs', 'fis boys', 'ee', 'reserved', 'fsm', 'orientation'];
    if (skipWords.some(w => courseName.toLowerCase().includes(w))) return null;
    if (!dept && !section) return null;

    const batchYear = resolveBatchYear(courseName, parenContent);

    return { courseName: courseName || rawEntry.trim(), dept, section, batchYear, embeddedTime };
  }

  for (let rowIdx = timeRowIndex + 1; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    if (!row?.c) continue;
    const cells = row.c;
    const col0Val = cells[0]?.v ? String(cells[0].v).trim() : '';
    if (!col0Val) continue;
    if (col0Val.toLowerCase() === 'lab') continue;
    if (col0Val.toLowerCase().includes('room') && col0Val.toLowerCase().includes('time')) continue;

    const isLabRow = labRowIndex >= 0 && rowIdx > labRowIndex;
    const room1 = col0Val;
    const room2 = (room2Col !== null && cells.length > room2Col && cells[room2Col]?.v)
      ? String(cells[room2Col].v).trim()
      : null;

    for (let c = 1; c < cells.length; c++) {
      if (room2Col !== null && c === room2Col) continue;
      const cell = cells[c];
      if (!cell?.v) continue;
      const rawVal = String(cell.v).trim();
      if (!rawVal) continue;

      const parsed = parseCellEntry(rawVal);
      if (!parsed) continue;

      const timeSlot = parsed.embeddedTime || getTimeForCol(c, isLabRow);
      const room = (room2Col !== null && c > room2Col && room2) ? room2 : room1;
      const isLabEntry = isLabRow || parsed.courseName.toLowerCase().includes(' lab');
      const courseKey = `${parsed.courseName}|${parsed.dept}|${parsed.section}|${parsed.batchYear}`;

      results.push({
        day: dayName,
        time: timeSlot,
        room,
        course: parsed.courseName,
        dept: parsed.dept,
        section: parsed.section,
        isLab: isLabEntry,
        batch: parsed.batchYear,
        courseKey,
      });
    }
  }

  return results;
}
