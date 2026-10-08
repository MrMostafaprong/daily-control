export function parseCommandLine(input) {
  const value = String(input || '').trim();
  if (!value) throw new Error('اكتب أمرًا أولًا');
  if (/[;&|<>`$()\\\n\r]/.test(value)) {
    throw new Error('استخدم أمرًا واحدًا فقط؛ الـ pipes والـ shell expressions غير مسموحة');
  }
  const parts = [];
  const pattern = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^']*)'|(\S+)/g;
  let match;
  while ((match = pattern.exec(value))) parts.push(match[1] ?? match[2] ?? match[3]);
  if (!parts.length) throw new Error('الأمر غير صالح');
  return { command: parts[0], args: parts.slice(1) };
}

export function formatCommand(command, args = []) {
  return [command, ...args].join(' ').trim();
}
