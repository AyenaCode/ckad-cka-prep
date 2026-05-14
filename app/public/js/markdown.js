export function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function inline(text) {
  let s = escHtml(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s;
}

export function mdToHtml(md) {
  const lines = md.split('\n');
  let html = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim() || 'bash';
      let code = '';
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { code += lines[i] + '\n'; i++; }
      i++;
      html += `<div class="code-block">
        <div class="code-header">
          <span class="code-lang">${lang}</span>
          <button class="copy-btn" data-copy>Copier</button>
        </div>
        <pre><code>${escHtml(code.trimEnd())}</code></pre>
      </div>\n`;
      continue;
    }

    // Headings
    if (line.startsWith('### ')) { html += `<h3>${inline(line.slice(4))}</h3>\n`; i++; continue; }
    if (line.startsWith('## '))  { html += `<h2>${inline(line.slice(3))}</h2>\n`; i++; continue; }
    if (line.startsWith('# '))   { html += `<h1>${inline(line.slice(2))}</h1>\n`; i++; continue; }

    // HR
    if (line.trim() === '---') { html += '<hr>\n'; i++; continue; }

    // Blockquote
    if (line.startsWith('>')) {
      const parts = [];
      while (i < lines.length && lines[i].startsWith('>')) { parts.push(inline(lines[i].replace(/^>\s?/, ''))); i++; }
      html += `<blockquote>${parts.join('<br>')}</blockquote>\n`;
      continue;
    }

    // UL
    if (/^[-*] /.test(line)) {
      html += '<ul>\n';
      while (i < lines.length && /^[-*] /.test(lines[i])) { html += `<li>${inline(lines[i].replace(/^[-*] /, ''))}</li>\n`; i++; }
      html += '</ul>\n';
      continue;
    }

    // OL
    if (/^\d+\. /.test(line)) {
      html += '<ol>\n';
      while (i < lines.length && /^\d+\. /.test(lines[i])) { html += `<li>${inline(lines[i].replace(/^\d+\. /, ''))}</li>\n`; i++; }
      html += '</ol>\n';
      continue;
    }

    // Table
    if (line.startsWith('|')) {
      html += '<div class="table-wrap"><table>\n';
      let isHeader = true;
      while (i < lines.length && lines[i].startsWith('|')) {
        const row = lines[i]; i++;
        if (/^\|[\s\-:|]+\|$/.test(row.replace(/ /g, ''))) { isHeader = false; continue; }
        const cells = row.split('|').slice(1, -1);
        const tag   = isHeader ? 'th' : 'td';
        html += '<tr>' + cells.map(c => `<${tag}>${inline(c.trim())}</${tag}>`).join('') + '</tr>\n';
      }
      html += '</table></div>\n';
      continue;
    }

    // Empty line
    if (line.trim() === '') { i++; continue; }

    // Paragraph
    const isBlock = l =>
      !l.trim() || l.startsWith('#') || l.startsWith('```') || l.startsWith('>') ||
      l.startsWith('|') || /^[-*] /.test(l) || /^\d+\. /.test(l) || l.trim() === '---';

    let para = '';
    while (i < lines.length && !isBlock(lines[i])) { para += (para ? ' ' : '') + lines[i]; i++; }
    if (para.trim()) html += `<p>${inline(para)}</p>\n`;
  }

  return html;
}

export function setupCopyButtons(container) {
  container.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.closest('.code-block').querySelector('code').innerText;
      navigator.clipboard?.writeText(code).catch(() => {});
      btn.textContent = 'Copié !';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copier'; btn.classList.remove('copied'); }, 2500);
    });
  });
}
