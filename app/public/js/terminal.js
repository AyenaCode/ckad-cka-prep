export class Terminal {
  constructor(wrapId, outputId, titleId) {
    this.wrap   = document.getElementById(wrapId);
    this.output = document.getElementById(outputId);
    this.title  = document.getElementById(titleId);
    this._cursor = null;
  }

  show(label = 'terminal') {
    this.wrap.classList.add('visible');
    this.output.innerHTML = '';
    if (this.title) this.title.textContent = label;
    this._appendCmd('$ ' + label);
    this._appendRaw('\n');
    this._addCursor();
    this.output.scrollTop = 0;
  }

  hide() { this.wrap.classList.remove('visible'); }

  chunk(msg) {
    this._removeCursor();
    const span = document.createElement('span');
    span.className = msg.type === 'err' ? 'term-line-err' : 'term-line-out';
    span.textContent = msg.text;
    this.output.appendChild(span);
    this._addCursor();
    this.output.scrollTop = this.output.scrollHeight;
  }

  done(ok) {
    this._removeCursor();
    const span = document.createElement('span');
    span.className = 'term-line-cmd';
    span.textContent = ok ? '\n✓ terminé\n' : '\n✗ erreur\n';
    this.output.appendChild(span);
    this.output.scrollTop = this.output.scrollHeight;
  }

  _appendCmd(text) {
    const span = document.createElement('span');
    span.className = 'term-line-cmd';
    span.textContent = text;
    this.output.appendChild(span);
  }

  _appendRaw(text) {
    this.output.appendChild(document.createTextNode(text));
  }

  _addCursor() {
    this._removeCursor();
    const c = document.createElement('span');
    c.className = 'term-cursor';
    c.id = '_tc';
    this.output.appendChild(c);
  }

  _removeCursor() {
    document.getElementById('_tc')?.remove();
  }
}
