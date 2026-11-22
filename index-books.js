(() => {
  'use strict';

  const books = window.BOOKS || [];
  const list = document.querySelector('#volume-list');
  if (!list) return;

  const esc = value => String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);

  const sections = books.map((book, index) => {
    const volume = `volume-${Math.floor(index / 2)}-${index % 2}`;
    const cards = book.units.map(unit => {
      const href = `unit.html?book=${encodeURIComponent(book.id)}&unit=${unit.no}`;
      return `<a class="card" href="${href}">
        <div class="no">${unit.no}</div>
        <div class="nm"><b>Unit ${unit.no}</b> ${esc(unit.en)}<small>${esc(unit.zh)} · ${unit.words.length} 个词</small></div>
        <div class="go">开始 ▶</div>
      </a>`;
    }).join('');
    const allHref = `unit.html?book=${encodeURIComponent(book.id)}`;
    return `<section class="unit-volume" id="${volume}">
      <h3>${esc(book.name)}</h3>
      <p class="edition-note">${esc(book.note)} · ${book.units.length} 个单元已就绪</p>
      <div class="unit-links">
        ${cards}
        <a class="card" href="${allHref}">
          <div class="no">★</div>
          <div class="nm"><b>整册版</b> All units<small>全册大混战 · 打乱所有单元</small></div>
          <div class="go">开始 ▶</div>
        </a>
      </div>
    </section>`;
  }).join('');

  list.insertAdjacentHTML('beforeend', sections);

  const footer = document.querySelector('#desk-footer');
  if (footer) {
    const total = books.reduce((sum, book) => sum + book.units.length, 0);
    footer.textContent = `三至六年级 · ${books.length} 册 ${total} 个单元`;
  }
})();
