// Pure functions: they receive plain arrays and return a string.
// They do not know about gRPC, so they are easy to read and test.

export function formatText(title, columns, rows, generatedAt) {
  // Each column is as wide as its longest value (header included).
  const widths = columns.map((column, i) =>
    Math.max(column.length, ...rows.map((row) => row[i].length)),
  );

  const formatRow = (values) =>
    values.map((value, i) => value.padEnd(widths[i])).join(' | ');
  const separator = widths.map((width) => '-'.repeat(width)).join('-+-');

  return [
    title,
    '='.repeat(title.length),
    `Generated at: ${generatedAt}`,
    '',
    formatRow(columns),
    separator,
    ...rows.map(formatRow),
    '',
    `(${rows.length} rows)`,
  ].join('\n');
}

export function formatCsv(columns, rows) {
  return [columns, ...rows]
    .map((values) => values.map(escapeCsv).join(','))
    .join('\n');
}

// A CSV value must be quoted if it contains a comma, a quote or a line break.
// Quotes inside the value are doubled: He said "hi" -> "He said ""hi"""
function escapeCsv(value) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}
