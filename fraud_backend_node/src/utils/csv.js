/**
 * Parse a CSV string into rows of string arrays.
 * Supports quoted values with commas and escaped quotes.
 * @param {string} csvText
 * @returns {string[][]}
 */
function parseCsvToRows(csvText) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  // Normalize line endings to \n
  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (ch === '\n') {
      row.push(field);
      field = '';
      // skip completely empty trailing last line
      const isAllEmpty = row.every((v) => String(v).trim() === '');
      if (!isAllEmpty) rows.push(row);
      row = [];
      continue;
    }

    field += ch;
  }

  // last field
  row.push(field);
  const isAllEmpty = row.every((v) => String(v).trim() === '');
  if (!isAllEmpty) rows.push(row);

  return rows;
}

/**
 * Parse CSV into objects keyed by header row.
 * @param {string} csvText
 * @returns {{headers: string[], records: object[]}}
 */
function parseCsvToObjects(csvText) {
  const rows = parseCsvToRows(csvText);
  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows[0].map((h) => String(h || '').trim());
  const records = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c] || `col_${c + 1}`;
      obj[key] = r[c] !== undefined ? String(r[c]).trim() : '';
    }
    records.push(obj);
  }
  return { headers, records };
}

module.exports = { parseCsvToRows, parseCsvToObjects };
