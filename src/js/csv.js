// A small RFC4180-ish CSV parser: handles quoted fields, commas and
// newlines inside quotes, and "" as an escaped quote. Good enough for
// spreadsheet exports without pulling in a library for one function.
export function parseCsv(text) {
  var rows = [];
  var row = [];
  var field = '';
  var inQuotes = false;
  var i = 0;
  var n = text.length;

  while (i < n) {
    var c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  return rows.filter(function (r) { return !(r.length === 1 && r[0].trim() === ''); });
}
