// EXPO — Client-side search with Lunr.js
// Loads search-index.json and provides full-text search UI

(function() {
  'use strict';

  const searchInput = document.getElementById('search');
  if (!searchInput) return;

  let idx = null;
  let docs = [];
  let overlay = null;
  let resultsBox = null;

  // Create overlay + results container
  function createUI() {
    overlay = document.createElement('div');
    overlay.className = 'search-overlay';
    overlay.addEventListener('click', hideResults);
    document.body.appendChild(overlay);

    resultsBox = document.createElement('div');
    resultsBox.className = 'search-results';
    overlay.appendChild(resultsBox);
  }

  // Load search index
  async function loadIndex() {
    try {
      const resp = await fetch('/assets/search-index.json');
      const data = await resp.json();
      docs = data.docs || [];
      idx = lunr.Index.load(data.index);
    } catch (e) {
      console.warn('Search index not available');
    }
  }

  function showResults() {
    if (overlay) overlay.classList.add('active');
  }

  function hideResults() {
    if (overlay) overlay.classList.remove('active');
    resultsBox.innerHTML = '';
  }

  function renderResults(query) {
    if (!idx || !query) {
      resultsBox.innerHTML = '<div class="search-empty">Commencez à taper pour chercher...</div>';
      return;
    }

    const results = idx.search(query + '~1').slice(0, 20);

    if (results.length === 0) {
      resultsBox.innerHTML = '<div class="search-empty">Aucun résultat</div>';
      return;
    }

    let html = '';
    for (const r of results) {
      const doc = docs.find(d => d.id === r.ref);
      if (!doc) continue;
      html += `
        <a href="${doc.url}" class="search-result-item" onclick="hideResults">
          <div class="result-title">${highlight(doc.title, query)}</div>
          ${doc.description ? `<div class="result-desc">${highlight(doc.description.slice(0, 120), query)}</div>` : ''}
          <div class="result-bundle">📦 ${doc.bundle}</div>
        </a>
      `;
    }
    resultsBox.innerHTML = html;
  }

  function highlight(text, query) {
    if (!text) return '';
    const terms = query.split(/\s+/).filter(Boolean);
    let result = escapeHtml(text);
    for (const term of terms) {
      const regex = new RegExp('(' + escapeRegex(term) + ')', 'gi');
      result = result.replace(regex, '<strong style="color:var(--accent)">$1</strong>');
    }
    return result;
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Debounced search
  let debounceTimer;
  searchInput.addEventListener('input', function() {
    clearTimeout(debounceTimer);
    const query = this.value.trim();
    if (query.length < 2) {
      hideResults();
      return;
    }
    debounceTimer = setTimeout(() => {
      renderResults(query);
      showResults();
    }, 200);
  });

  searchInput.addEventListener('focus', function() {
    if (this.value.trim().length >= 2) showResults();
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') hideResults();
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      searchInput.focus();
      e.preventDefault();
    }
  });

  // Load Lunr from CDN
  function loadLunr() {
    return new Promise((resolve, reject) => {
      if (typeof lunr !== 'undefined') { resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/lunr@2.3.9/lunr.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  createUI();
  loadLunr().then(loadIndex);

  // Expose hideResults globally for inline onclick
  window.hideResults = hideResults;
})();
