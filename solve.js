// Fast drop-in for csv-reader 1.0.0 (make.fun csv-reader-speed-01).
// Same answers as the reference on every input, faster by design:
// - a record with no quote and no stray CR is sliced as one line and
//   split(',') by native code instead of being walked char by char;
// - unquoted fields are found with indexOf for ',', LF and CR, so a
//   whole field is one slice instead of one concat per character;
// - quoted fields are found with indexOf('"'), so a quoted segment is
//   one slice; doubled quotes and CR/LF inside quotes are handled
//   only on the segments that actually contain them.
// All broken-row semantics follow the reference exactly: BOM drop,
// stray CR (error stray_cr), unterminated quote re-read as unquoted,
// quote junk after a closing quote (error quote_junk), short/long
// rows padded/cut to the first record's width with their errors,
// blank lines are no records, and a line of only stray CRs is none.

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const len = text.length;
  let pos = 0;
  let line = 1;
  if (len > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  let recordLine = 1;
  let recordRow = null;

  // Result of the field just read: value in fValue, end in fEnded
  // (0 = comma, 1 = line break, 2 = end of text).
  let fValue = '';
  let fEnded = 2;

  // Read unquoted characters onto `value` up to the next comma or
  // line break. Returns how many characters were appended (0 when
  // the field ends at once); a lone CR is dropped with a stray_cr
  // error and the field goes on. Sets fValue / fEnded.
  function readUnquoted(value) {
    let added = 0;
    for (;;) {
      const c = text.indexOf(',', pos);
      const n = text.indexOf('\n', pos);
      const r = text.indexOf('\r', pos);
      let m = -1;
      let kind = -1;
      if (c !== -1) { m = c; kind = 0; }
      if (n !== -1 && (m === -1 || n < m)) { m = n; kind = 1; }
      if (r !== -1 && (m === -1 || r < m)) { m = r; kind = 2; }
      if (m === -1) {
        if (pos < len) { value += text.slice(pos); added += len - pos; }
        pos = len;
        fValue = value;
        fEnded = 2;
        return added;
      }
      if (kind === 0) {
        value += text.slice(pos, m);
        added += m - pos;
        pos = m + 1;
        fValue = value;
        fEnded = 0;
        return added;
      }
      if (kind === 1) {
        value += text.slice(pos, m);
        added += m - pos;
        pos = m + 1;
        line += 1;
        fValue = value;
        fEnded = 1;
        return added;
      }
      // kind === 2, a CR: CRLF ends the record, a lone CR is stray.
      if (m + 1 < len && text.charCodeAt(m + 1) === 10) {
        value += text.slice(pos, m);
        added += m - pos;
        pos = m + 2;
        line += 1;
        fValue = value;
        fEnded = 1;
        return added;
      }
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      value += text.slice(pos, m);
      added += m - pos;
      pos = m + 1;
    }
  }

  // Append one quoted segment text[from:to] to `value`, turning
  // each CRLF or lone CR inside it into one LF and counting every
  // line break it holds. Segments without a CR are one slice.
  function appendQuoted(value, from, to) {
    if (from >= to) return value;
    // Slice first: every scan below is then bounded by this segment
    // instead of running on past its end into the rest of the text.
    const seg = text.slice(from, to);
    if (seg.indexOf('\r') === -1) {
      let i = 0;
      let count = 0;
      for (;;) {
        const n = seg.indexOf('\n', i);
        if (n === -1) break;
        count += 1;
        i = n + 1;
      }
      if (count > 0) line += count;
      return value + seg;
    }
    const fixed = seg.replace(/\r\n?/g, '\n');
    let i = 0;
    let count = 0;
    for (;;) {
      const n = fixed.indexOf('\n', i);
      if (n === -1) break;
      count += 1;
      i = n + 1;
    }
    if (count > 0) line += count;
    return value + fixed;
  }

  // Read a quoted field whose opening quote is at pos. Sets
  // fValue / fEnded and returns the junk length (only meaningful
  // on the junk path, where the caller checks it for quote_junk).
  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos += 1;
    let value = '';
    for (;;) {
      const q = text.indexOf('"', pos);
      if (q === -1) {
        // The quote never closes: it is a literal character, and
        // the text after it is read again as unquoted.
        pos = open + 1;
        line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        return readUnquoted('"');
      }
      if (q + 1 < len && text.charCodeAt(q + 1) === 34) {
        value = appendQuoted(value, pos, q);
        value += '"';
        pos = q + 2;
        continue;
      }
      value = appendQuoted(value, pos, q);
      pos = q + 1;
      if (pos >= len) {
        fValue = value;
        fEnded = 2;
        return 0;
      }
      const cc = text.charCodeAt(pos);
      if (cc === 44) {
        pos += 1;
        fValue = value;
        fEnded = 0;
        return 0;
      }
      if (cc === 10) {
        pos += 1;
        line += 1;
        fValue = value;
        fEnded = 1;
        return 0;
      }
      if (cc === 13 && pos + 1 < len && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        fValue = value;
        fEnded = 1;
        return 0;
      }
      // What follows the closing quote is appended as it stands.
      const added = readUnquoted(value);
      if (added > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      return added;
    }
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < len) {
      const cc = text.charCodeAt(pos);
      if (cc === 10) {
        pos += 1;
        line += 1;
      } else if (cc === 13 && pos + 1 < len && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    let fields = null;
    // Fast path: a record with no quote and no stray CR is one
    // line, split by native code. Slice the line first so the
    // quote / CR checks below are bounded by it; a CRLF line
    // ends in one CR, which is stripped before the split.
    const nl = text.indexOf('\n', pos);
    const end = nl === -1 ? len : nl;
    const lineStr = text.slice(pos, end);
    if (nl !== -1 && lineStr.length > 0 && lineStr.charCodeAt(lineStr.length - 1) === 13) {
      const body = lineStr.slice(0, -1);
      if (body.indexOf('"') === -1 && body.indexOf('\r') === -1) {
        fields = body.split(',');
        pos = nl + 1;
        line += 1;
      }
    } else if (lineStr.indexOf('"') === -1 && lineStr.indexOf('\r') === -1) {
      fields = lineStr.split(',');
      if (nl === -1) pos = len;
      else { pos = nl + 1; line += 1; }
    }

    if (fields !== null) {
      if (fields.length === 1 && fields[0] === '') continue;
    } else {
      // Slow path: at least one quoted field or a stray CR in it.
      fields = [];
      let quoted = false;
      do {
        quoted = text.charCodeAt(pos) === 34;
        if (quoted) readQuoted();
        else readUnquoted('');
        fields.push(fValue);
      } while (fEnded === 0);
      // A line that held only stray CRs is left with no characters.
      if (fields.length === 1 && fields[0] === '' && !quoted) continue;
    }

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
