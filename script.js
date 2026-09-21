
// Footer year
document.querySelectorAll('.js-year').forEach(el => el.textContent = new Date().getFullYear());

// ---- Hash-based page router (keeps everything in one file) ----
const PAGES = ['home','about','experience','education','skills','engagements','contact'];
const TITLES = {
  home: "Emily Naidoo — Aspiring Chartered Accountant",
  about: "About — Emily Naidoo",
  experience: "Experience — Emily Naidoo",
  education: "Education — Emily Naidoo",
  skills: "Skills — Emily Naidoo",
  engagements: "Accounting Projects — Emily Naidoo",
  contact: "Contact — Emily Naidoo"
};

function activatePage(id, opts) {
  opts = opts || {};

  if (id.indexOf('project/') === 0) {
    const slug = decodeURIComponent(id.slice('project/'.length));
    document.querySelectorAll('.page').forEach(p => { p.hidden = (p.id !== 'page-project-detail'); });
    document.querySelectorAll('.tabs a, .mobile-nav a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === '#engagements');
    });
    if (!opts.skipScroll) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    showProjectDetail(slug);
    return;
  }

  if (!PAGES.includes(id)) id = 'home';
  document.querySelectorAll('.page').forEach(p => {
    p.hidden = (p.id !== 'page-' + id);
  });
  document.querySelectorAll('.tabs a, .mobile-nav a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === '#' + id);
  });
  document.title = TITLES[id] || TITLES.home;
  if (!opts.skipScroll) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  const activeSection = document.getElementById('page-' + id);
  if (activeSection) {
    const targets = activeSection.querySelectorAll('.reveal, .glass-card, .timeline-item');
    targets.forEach((el, i) => {
      el.classList.remove('in-view');
      void el.offsetWidth;
      setTimeout(() => el.classList.add('in-view'), 60 + (i % 8) * 70);
    });
    if (id === 'home') runCounters(activeSection);
    if (id === 'engagements') renderProjects();
  }
}

function currentHash() {
  return (location.hash || '#home').replace('#', '');
}

window.addEventListener('hashchange', () => activatePage(currentHash()));

const menuBtn = document.getElementById('menuBtn');
const mobileNav = document.getElementById('mobileNav');
if (menuBtn && mobileNav) {
  menuBtn.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    });
  });
}

const progressBar = document.getElementById('progressBar');
if (progressBar) {
  window.addEventListener('scroll', () => {
    const h = document.documentElement;
    const denom = (h.scrollHeight - h.clientHeight) || 1;
    const scrolled = (h.scrollTop) / denom * 100;
    progressBar.style.width = Math.min(Math.max(scrolled, 0), 100) + '%';
  }, { passive: true });
}

const revealTargets = document.querySelectorAll('.reveal, .glass-card, .timeline-item');
if ('IntersectionObserver' in window && revealTargets.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  revealTargets.forEach(el => observer.observe(el));
} else {
  revealTargets.forEach(el => el.classList.add('in-view'));
}

function runCounters(scope) {
  const counters = (scope || document).querySelectorAll('[data-count]');
  counters.forEach(el => {
    if (el.dataset.counted === '1') return;
    el.dataset.counted = '1';
    const target = parseFloat(el.getAttribute('data-count'));
    const suffix = el.getAttribute('data-suffix') || '';
    const duration = 1400;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = (target * eased);
      el.textContent = (Number.isInteger(target) ? Math.round(value) : value.toFixed(1)) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}
if ('IntersectionObserver' in window) {
  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { runCounters(document); countObserver.disconnect(); }
    });
  }, { threshold: 0.5 });
  const homeStats = document.querySelector('.stat-row');
  if (homeStats) countObserver.observe(homeStats);
}

// ============================================================
// ACCOUNTING PROJECTS — auto-detects repos on the GitHub account
// ============================================================
// HOW THIS WORKS
// Nothing to edit in code, ever. Create a new public repo under the GitHub
// account below and a card for it appears here automatically next time
// someone loads the page — title comes from the repo name, description
// from the repo's "About" field, and the card links to the repo's live
// GitHub Pages site if it has one, otherwise to the repo itself on GitHub.
//
// This portfolio's own repo is automatically excluded from the list (see
// EXCLUDE_REPO_NAMES below) so it doesn't show up as one of "her projects".
const GITHUB_OWNER = 'Emily-Michaele-Naidoo';   // GitHub account to pull repos from
const GITHUB_REPO   = 'Emily-Michaele-Naidoo.github.io'; // this portfolio's own repo — excluded from the project list

const EXCLUDE_FORKS = true;      // hide forked repos (not original work)
const EXCLUDE_ARCHIVED = true;   // hide archived/retired repos

const PROJECTS_CACHE_KEY = 'en_repos_cache_v1';
const PROJECTS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

let projectsState = null; // { items: [...], error: bool } — cached for this page session
let projectsQuery = '';

function excludedRepoNames() {
  const names = new Set();
  names.add(`${GITHUB_OWNER}.github.io`.toLowerCase());
  names.add(GITHUB_OWNER.toLowerCase()); // GitHub's special profile-README repo
  if (GITHUB_REPO && GITHUB_REPO !== 'YOUR_REPO_NAME') names.add(GITHUB_REPO.toLowerCase());
  return names;
}

function repoNameToTitle(name) {
  return name.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatMonthYear(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return monthNames[d.getMonth()] + ' ' + d.getFullYear();
}

function repoToProject(r) {
  const liveUrl = (r.homepage && r.homepage.trim())
    ? r.homepage.trim()
    : (r.has_pages ? `https://${GITHUB_OWNER}.github.io/${r.name}/` : r.html_url);
  return {
    repoName: r.name,
    defaultBranch: r.default_branch || 'main',
    title: repoNameToTitle(r.name),
    description: r.description || '',
    url: liveUrl,
    repoUrl: r.html_url,
    isLive: liveUrl !== r.html_url,
    language: r.language || '',
    stars: r.stargazers_count || 0,
    dateLabel: formatMonthYear(r.pushed_at),
    sortKey: r.pushed_at || '',
  };
}

async function loadProjects() {
  if (projectsState) return projectsState;

  try {
    const cached = JSON.parse(sessionStorage.getItem(PROJECTS_CACHE_KEY) || 'null');
    if (cached && (Date.now() - cached.ts) < PROJECTS_CACHE_TTL) {
      projectsState = cached.data;
      return projectsState;
    }
  } catch (e) { /* sessionStorage unavailable — skip cache */ }

  const excluded = excludedRepoNames();
  const apiUrl = `https://api.github.com/users/${GITHUB_OWNER}/repos?per_page=100&sort=pushed`;
  try {
    const res = await fetch(apiUrl, { headers: { 'Accept': 'application/vnd.github+json' } });
    if (!res.ok) throw new Error('GitHub API responded ' + res.status);
    const data = await res.json();
    const items = (Array.isArray(data) ? data : [])
      .filter(r => !r.private)
      .filter(r => !excluded.has((r.name || '').toLowerCase()))
      .filter(r => !(EXCLUDE_FORKS && r.fork))
      .filter(r => !(EXCLUDE_ARCHIVED && r.archived))
      .map(repoToProject)
      .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
    projectsState = { items, error: false };
  } catch (err) {
    console.error('Accounting Projects: could not load repos from GitHub —', err);
    projectsState = { items: [], error: true };
  }

  try {
    sessionStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: projectsState }));
  } catch (e) { /* sessionStorage unavailable — skip cache */ }

  return projectsState;
}

function renderProjectSkeleton() {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;
  grid.innerHTML = Array.from({ length: 3 }).map(() => `
    <div class="project-card project-skeleton" aria-hidden="true">
      <div class="skeleton-line skeleton-w40"></div>
      <div class="skeleton-line skeleton-w80" style="height:20px; margin-top:14px;"></div>
      <div class="skeleton-line skeleton-w100" style="margin-top:16px;"></div>
      <div class="skeleton-line skeleton-w60"></div>
    </div>`).join('');
}

async function renderProjects(query) {
  if (typeof query === 'string') projectsQuery = query;
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;

  if (!projectsState) renderProjectSkeleton();
  const state = await loadProjects();

  // page may have navigated away while the fetch was in flight
  if (!document.getElementById('page-engagements') || document.getElementById('page-engagements').hidden) return;

  const q = projectsQuery.trim().toLowerCase();
  const filtered = state.items.filter(p => {
    if (!q) return true;
    const hay = (p.title + ' ' + p.description + ' ' + p.language).toLowerCase();
    return hay.includes(q);
  });

  grid.innerHTML = '';

  if (state.error) {
    grid.innerHTML = `
      <div class="project-empty">
        <div class="empty-icon">&#9888;</div>
        <h3>Projects are temporarily unavailable</h3>
        <p>Couldn't load repositories just now — please check back soon.</p>
      </div>`;
    return;
  }

  if (state.items.length === 0) {
    grid.innerHTML = `
      <div class="project-empty">
        <div class="empty-icon">&#128203;</div>
        <h3>No projects published yet</h3>
        <p>New repositories appear here automatically as they're created — check back soon.</p>
      </div>`;
    return;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="project-empty">
        <div class="empty-icon">&#128269;</div>
        <h3>No matches</h3>
        <p>No projects match "${q}". Try a different search term.</p>
      </div>`;
    return;
  }

  filtered.forEach((p) => {
    const card = document.createElement('a');
    card.className = 'project-card reveal in-view';
    card.href = `#project/${encodeURIComponent(p.repoName)}`;
    card.innerHTML = `
      <div class="project-card-top">
        <span class="project-type">${p.language ? p.language.toUpperCase() : 'REPO'}</span>
        <span class="project-date">${p.dateLabel || ''}</span>
      </div>
      <h3>${p.title}</h3>
      <p>${p.description || ''}</p>
      <div class="project-tags">${p.stars > 0 ? `<span class="chip">&#9733; ${p.stars}</span>` : ''}</div>
      <span class="project-open">View project &rarr;</span>`;
    grid.appendChild(card);
  });
}

const searchInput = document.getElementById('projectSearch');
if (searchInput) {
  searchInput.addEventListener('input', (e) => renderProjects(e.target.value));
}

// ============================================================
// PROJECT DETAIL — in-site view for a single repo
// README on the left, a picked file previewed read-only on the right,
// GitHub link up top.
// ============================================================
const readmeCache = {};
const fileTreeCache = {};

async function fetchReadmeHtml(repoName) {
  if (readmeCache[repoName]) return readmeCache[repoName];
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${repoName}/readme`;
  const res = await fetch(url, { headers: { 'Accept': 'application/vnd.github.html+json' } });
  if (res.status === 404) {
    readmeCache[repoName] = null;
    return null;
  }
  if (!res.ok) throw new Error('README request failed: ' + res.status);
  const html = await res.text();
  readmeCache[repoName] = html;
  return html;
}

function cleanReadmeHtml(html) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  // strip GitHub's permalink anchor icons — clutter without their stylesheet
  wrapper.querySelectorAll('a.anchor, svg').forEach(el => el.remove());
  return wrapper.innerHTML;
}

function isNoisePath(path) {
  const lower = path.toLowerCase();
  if (lower.startsWith('.git/') || lower.startsWith('node_modules/') || lower.startsWith('.github/')) return true;
  if (path.split('/').some(seg => seg.startsWith('.'))) return true;
  if (lower === 'readme.md') return true; // already shown on the left
  return false;
}

async function fetchFileTree(project) {
  if (fileTreeCache[project.repoName]) return fileTreeCache[project.repoName];
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${project.repoName}/git/trees/${encodeURIComponent(project.defaultBranch)}?recursive=1`;
  const res = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } });
  if (!res.ok) throw new Error('File tree request failed: ' + res.status);
  const data = await res.json();
  const files = (data.tree || [])
    .filter(item => item.type === 'blob')
    .map(item => item.path)
    .filter(path => !isNoisePath(path))
    .sort((a, b) => a.localeCompare(b));
  fileTreeCache[project.repoName] = files;
  return files;
}

function rawFileUrl(project, path) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${project.repoName}/${encodeURIComponent(project.defaultBranch)}/${encodedPath}`;
}

function githubBlobUrl(project, path) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${project.repoUrl}/blob/${encodeURIComponent(project.defaultBranch)}/${encodedPath}`;
}

function fileCategory(path) {
  const ext = (path.split('.').pop() || '').toLowerCase();
  if (['xlsx', 'xls', 'xlsm', 'docx', 'doc', 'pptx', 'ppt'].includes(ext)) return 'office';
  if (ext === 'csv') return 'csv';
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'image';
  if (['md', 'markdown'].includes(ext)) return 'markdown';
  if (ext === 'ipynb') return 'notebook';
  if (['txt', 'json', 'js', 'ts', 'py', 'css', 'html', 'htm', 'yml', 'yaml', 'xml', 'sql', 'log', 'sh', 'java', 'c', 'cpp', 'h', 'rb', 'go', 'rs', 'php', 'ofx', 'qfx', 'qif', 'qbo'].includes(ext)) return 'text';
  return 'other';
}

const HLJS_LANG_MAP = {
  py: 'python', js: 'javascript', ts: 'typescript', java: 'java', c: 'c', cpp: 'cpp', h: 'cpp',
  css: 'css', html: 'xml', htm: 'xml', xml: 'xml', json: 'json', sql: 'sql', sh: 'bash',
  rb: 'ruby', go: 'go', rs: 'rust', php: 'php', yml: 'yaml', yaml: 'yaml',
};
function hljsLanguageFor(path) {
  const ext = (path.split('.').pop() || '').toLowerCase();
  return HLJS_LANG_MAP[ext] || null;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function previewFallback(project, path, message) {
  return `
    <div class="project-detail-empty">
      <div class="empty-icon">&#128193;</div>
      <h3>${escapeHtml(message)}</h3>
      <p>You can still view it directly on GitHub.</p>
      <a class="btn btn-primary" href="${githubBlobUrl(project, path)}" target="_blank" rel="noopener">Open on GitHub &#8599;</a>
    </div>`;
}

let activeChart = null;
function destroyActiveChart() {
  if (activeChart) { activeChart.destroy(); activeChart = null; }
}

function analyzeForChart(aoa) {
  if (!aoa || aoa.length < 3) return null; // need a header + at least 2 data rows
  const header = aoa[0].map(v => String(v ?? ''));
  const rows = aoa.slice(1).filter(r => r.some(c => c !== '' && c !== undefined && c !== null));
  if (rows.length < 2 || rows.length > 60) return null; // too little to plot, or too much to read
  if (header.length < 2) return null;

  const numericCols = [];
  for (let c = 1; c < header.length; c++) {
    let numCount = 0, filled = 0;
    rows.forEach(r => {
      const v = r[c];
      if (v === '' || v === undefined || v === null) return;
      filled++;
      if (typeof v === 'number' || (!isNaN(parseFloat(v)) && isFinite(v))) numCount++;
    });
    if (filled > 0 && numCount / filled >= 0.7) numericCols.push(c);
  }
  if (!numericCols.length) return null;

  const chosenCols = numericCols.slice(0, 4); // cap series count so the chart stays readable
  return {
    labels: rows.map(r => String(r[0] ?? '')),
    datasets: chosenCols.map(c => ({
      label: header[c] || `Column ${c + 1}`,
      data: rows.map(r => { const v = parseFloat(r[c]); return isNaN(v) ? 0 : v; }),
    })),
  };
}

function renderChartView(container, chartInfo) {
  destroyActiveChart();
  container.innerHTML = `<div class="chart-wrap"><canvas></canvas></div>`;
  if (typeof Chart === 'undefined') {
    container.innerHTML = `<div class="project-detail-empty"><p>Chart library failed to load.</p></div>`;
    return;
  }
  const canvas = container.querySelector('canvas');
  const colors = ['#9D5CFF', '#C7C4DA', '#6D28D9', '#34D399'];
  activeChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: chartInfo.labels,
      datasets: chartInfo.datasets.map((ds, i) => ({
        label: ds.label,
        data: ds.data,
        backgroundColor: colors[i % colors.length],
        borderRadius: 4,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#C7C4DA' } } },
      scales: {
        x: { ticks: { color: '#A6A2C2' }, grid: { color: 'rgba(255,255,255,.06)' } },
        y: { ticks: { color: '#A6A2C2' }, grid: { color: 'rgba(255,255,255,.06)' } },
      },
    },
  });
}

function renderSheet(container, workbook, project, path, sheetIndex, viewMode) {
  sheetIndex = sheetIndex || 0;
  viewMode = viewMode || 'table';
  const names = workbook.SheetNames;
  const sheet = workbook.Sheets[names[sheetIndex]];

  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
  const chartInfo = analyzeForChart(aoa);
  if (viewMode === 'chart' && !chartInfo) viewMode = 'table';

  const fullHtml = XLSX.utils.sheet_to_html(sheet, { editable: false });
  // sheet_to_html returns a full <html><head>...<body> document — keep just the <table>
  const match = fullHtml.match(/<table[\s\S]*<\/table>/);
  const tableHtml = match ? match[0] : fullHtml;

  const sheetTabsHtml = names.length > 1
    ? `<div class="sheet-tabs">${names.map((n, i) => `<button type="button" class="sheet-tab${i === sheetIndex ? ' active' : ''}" data-i="${i}">${escapeHtml(n)}</button>`).join('')}</div>`
    : '';
  const viewTabsHtml = chartInfo
    ? `<div class="view-tabs">
         <button type="button" class="view-tab${viewMode === 'table' ? ' active' : ''}" data-view="table">Table</button>
         <button type="button" class="view-tab${viewMode === 'chart' ? ' active' : ''}" data-view="chart">Chart</button>
       </div>`
    : '';

  if (viewMode !== 'chart') destroyActiveChart();

  container.innerHTML = `
    <div class="sheet-controls">${sheetTabsHtml}${viewTabsHtml}</div>
    <div class="sheet-view-area"></div>`;

  const viewArea = container.querySelector('.sheet-view-area');
  if (viewMode === 'chart' && chartInfo) {
    renderChartView(viewArea, chartInfo);
  } else {
    viewArea.innerHTML = `<div class="spreadsheet-scroll">${tableHtml}</div>`;
  }

  container.querySelectorAll('.sheet-tab').forEach(btn => {
    btn.addEventListener('click', () => renderSheet(container, workbook, project, path, parseInt(btn.dataset.i, 10), 'table'));
  });
  container.querySelectorAll('.view-tab').forEach(btn => {
    btn.addEventListener('click', () => renderSheet(container, workbook, project, path, sheetIndex, btn.dataset.view));
  });
}

async function renderCsvFile(container, project, path) {
  if (typeof XLSX === 'undefined') {
    container.innerHTML = previewFallback(project, path, "Couldn't load the spreadsheet viewer");
    return;
  }
  try {
    const res = await fetch(rawFileUrl(project, path));
    if (!res.ok) throw new Error('fetch failed ' + res.status);
    const text = await res.text();
    const wb = XLSX.read(text, { type: 'string' });
    renderSheet(container, wb, project, path);
  } catch (err) {
    console.error('CSV preview failed:', err);
    container.innerHTML = previewFallback(project, path, "Couldn't load this file");
  }
}

function renderOfficeFile(container, project, path) {
  // Renders the actual file — real formatting, real embedded charts — via
  // Microsoft's free Office Online viewer, rather than us reinterpreting the
  // data ourselves. Fully read-only; no editing capability is exposed.
  const fileUrl = rawFileUrl(project, path);
  const embedUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
  container.innerHTML = `<iframe class="project-detail-frame" title="${escapeHtml(path)}" src="${embedUrl}" allowfullscreen></iframe>`;
}

async function renderPdfFile(container, project, path) {
  try {
    const res = await fetch(rawFileUrl(project, path));
    if (!res.ok) throw new Error('fetch failed ' + res.status);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    container.innerHTML = `<iframe class="project-detail-frame" title="${escapeHtml(path)}" src="${objectUrl}"></iframe>`;
  } catch (err) {
    console.error('PDF preview failed:', err);
    container.innerHTML = previewFallback(project, path, "Couldn't load this PDF");
  }
}

function renderImageFile(container, project, path) {
  const url = rawFileUrl(project, path);
  const img = document.createElement('img');
  img.src = url;
  img.alt = path;
  img.onerror = () => { container.innerHTML = previewFallback(project, path, "Couldn't load this image"); };
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'image-preview-wrap';
  wrap.appendChild(img);
  container.appendChild(wrap);
}

async function renderMarkdownFile(container, project, path) {
  try {
    const res = await fetch(rawFileUrl(project, path));
    if (!res.ok) throw new Error('fetch failed ' + res.status);
    const text = await res.text();
    const renderRes = await fetch('https://api.github.com/markdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/vnd.github+json' },
      body: JSON.stringify({ text, mode: 'gfm', context: `${GITHUB_OWNER}/${project.repoName}` }),
    });
    if (!renderRes.ok) throw new Error('render failed ' + renderRes.status);
    const html = await renderRes.text();
    container.innerHTML = `<div class="readme-body">${cleanReadmeHtml(html)}</div>`;
  } catch (err) {
    console.error('Markdown preview failed:', err);
    container.innerHTML = previewFallback(project, path, "Couldn't render this file");
  }
}

async function renderTextFile(container, project, path) {
  try {
    const res = await fetch(rawFileUrl(project, path));
    if (!res.ok) throw new Error('fetch failed ' + res.status);
    const text = await res.text();
    const lang = hljsLanguageFor(path);
    const escaped = escapeHtml(text);
    container.innerHTML = `<pre class="code-preview"><code class="hljs${lang ? ' language-' + lang : ''}">${escaped}</code></pre>`;
    highlightCodeIn(container);
  } catch (err) {
    console.error('Text preview failed:', err);
    container.innerHTML = previewFallback(project, path, "Couldn't load this file");
  }
}

function highlightCodeIn(scope) {
  if (typeof hljs === 'undefined') return;
  scope.querySelectorAll('pre code').forEach(block => {
    try { hljs.highlightElement(block); } catch (e) { /* leave unhighlighted, still readable */ }
  });
}

// Small local Markdown→HTML converter for notebook markdown cells — keeps
// notebook rendering fast and avoids one GitHub API call per cell.
function simpleMarkdownToHtml(md) {
  const escaped = escapeHtml(md);
  let html = escaped
    .replace(/^#### (.*)$/gm, '<h4>$1</h4>')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  html = html
    .split(/\n{2,}/)
    .map(block => {
      if (/^<h[1-4]>/.test(block.trim())) return block;
      if (/^(-|\*) /m.test(block.trim())) {
        const items = block.split('\n').filter(l => l.trim()).map(l => `<li>${l.replace(/^(-|\*)\s+/, '')}</li>`).join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
  return html;
}

function stripAnsiCodes(str) {
  return String(str).replace(/\x1b\[[0-9;]*m/g, '');
}

function notebookSource(cell) {
  const s = cell.source;
  return Array.isArray(s) ? s.join('') : (s || '');
}

function renderNotebookOutput(output) {
  if (output.output_type === 'stream') {
    return `<div class="nb-output">${escapeHtml((Array.isArray(output.text) ? output.text.join('') : output.text) || '')}</div>`;
  }
  if (output.output_type === 'error') {
    const trace = (output.traceback || []).map(stripAnsiCodes).join('\n');
    return `<div class="nb-output nb-output-error">${escapeHtml(trace || `${output.ename}: ${output.evalue}`)}</div>`;
  }
  if (output.output_type === 'execute_result' || output.output_type === 'display_data') {
    const data = output.data || {};
    if (data['image/png']) {
      return `<div class="nb-output nb-output-image"><img src="data:image/png;base64,${data['image/png']}" alt="Cell output"></div>`;
    }
    if (data['text/plain']) {
      const text = Array.isArray(data['text/plain']) ? data['text/plain'].join('') : data['text/plain'];
      return `<div class="nb-output">${escapeHtml(text)}</div>`;
    }
  }
  return '';
}

async function renderNotebookFile(container, project, path) {
  try {
    const res = await fetch(rawFileUrl(project, path));
    if (!res.ok) throw new Error('fetch failed ' + res.status);
    const text = await res.text();
    const notebook = JSON.parse(text);
    const cells = notebook.cells || [];
    const lang = (notebook.metadata && notebook.metadata.language_info && notebook.metadata.language_info.name)
      || (notebook.metadata && notebook.metadata.kernelspec && notebook.metadata.kernelspec.language)
      || 'python';

    if (!cells.length) {
      container.innerHTML = `<div class="project-detail-empty"><h3>Empty notebook</h3><p>This notebook has no cells.</p></div>`;
      return;
    }

    const cellsHtml = cells.map(cell => {
      if (cell.cell_type === 'markdown') {
        return `<div class="nb-cell nb-cell-markdown">${simpleMarkdownToHtml(notebookSource(cell))}</div>`;
      }
      if (cell.cell_type === 'code') {
        const source = notebookSource(cell);
        const prompt = (typeof cell.execution_count === 'number') ? `In [${cell.execution_count}]:` : 'In [ ]:';
        const outputs = (cell.outputs || []).map(renderNotebookOutput).join('');
        return `
          <div class="nb-cell nb-cell-code">
            <div class="nb-prompt">${prompt}</div>
            <pre class="code-preview nb-code"><code class="hljs language-${lang}">${escapeHtml(source)}</code></pre>
            ${outputs}
          </div>`;
      }
      // raw cells
      return `<div class="nb-cell nb-cell-raw"><pre class="code-preview">${escapeHtml(notebookSource(cell))}</pre></div>`;
    }).join('');

    container.innerHTML = `<div class="notebook-view">${cellsHtml}</div>`;
    highlightCodeIn(container);
  } catch (err) {
    console.error('Notebook preview failed:', err);
    container.innerHTML = previewFallback(project, path, "Couldn't load this notebook");
  }
}

function renderFilePreview(container, project, path) {
  destroyActiveChart();
  container.innerHTML = `<div class="project-detail-empty"><div class="empty-icon">&#8987;</div><p>Loading&hellip;</p></div>`;
  const cat = fileCategory(path);
  if (cat === 'office') return renderOfficeFile(container, project, path);
  if (cat === 'csv') return renderCsvFile(container, project, path);
  if (cat === 'pdf') return renderPdfFile(container, project, path);
  if (cat === 'image') return renderImageFile(container, project, path);
  if (cat === 'markdown') return renderMarkdownFile(container, project, path);
  if (cat === 'notebook') return renderNotebookFile(container, project, path);
  if (cat === 'text') return renderTextFile(container, project, path);
  container.innerHTML = previewFallback(project, path, 'Preview not available for this file type');
}

const PREVIEW_PRIORITY = ['office', 'notebook', 'pdf', 'image', 'csv', 'markdown', 'text', 'other'];

function pickDefaultFile(files) {
  let best = null, bestRank = PREVIEW_PRIORITY.length;
  files.forEach(f => {
    const rank = PREVIEW_PRIORITY.indexOf(fileCategory(f));
    if (rank !== -1 && rank < bestRank) { best = f; bestRank = rank; }
  });
  return best || files[0] || null;
}

async function loadProjectFiles(project) {
  const pickerBar = document.getElementById('filePickerBar');
  const select = document.getElementById('projectFileSelect');
  const previewContent = document.getElementById('previewContent');

  pickerBar.hidden = true;
  previewContent.innerHTML = `<div class="project-detail-empty"><div class="empty-icon">&#8987;</div><p>Looking through the repository&hellip;</p></div>`;

  let files;
  try {
    files = await fetchFileTree(project);
  } catch (err) {
    console.error('Project detail: could not load file list —', err);
    previewContent.innerHTML = previewFallback(project, '', "Couldn't load this repository's files");
    return;
  }

  if (document.getElementById('page-project-detail').hidden) return; // navigated away

  if (!files.length) {
    previewContent.innerHTML = `
      <div class="project-detail-empty">
        <div class="empty-icon">&#128193;</div>
        <h3>No files to preview</h3>
        <p>This repository doesn't have any files yet.</p>
        <a class="btn btn-primary" href="${project.repoUrl}" target="_blank" rel="noopener">Open on GitHub &#8599;</a>
      </div>`;
    return;
  }

  select.innerHTML = files.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');
  pickerBar.hidden = false;

  const defaultFile = pickDefaultFile(files);
  select.value = defaultFile;
  renderFilePreview(previewContent, project, defaultFile);

  select.onchange = () => renderFilePreview(previewContent, project, select.value);
}

async function showProjectDetail(slug) {
  const titleEl = document.getElementById('projectDetailTitle');
  const descEl = document.getElementById('projectDetailDesc');
  const githubLink = document.getElementById('projectDetailGithub');
  const readmeEl = document.getElementById('projectDetailReadme');
  const pickerBar = document.getElementById('filePickerBar');
  const previewContent = document.getElementById('previewContent');
  if (!titleEl) return;

  // reset to a loading state immediately
  titleEl.textContent = 'Loading…';
  descEl.textContent = '';
  githubLink.href = '#';
  pickerBar.hidden = true;
  readmeEl.innerHTML = `
    <div class="skeleton-line skeleton-w40" style="height:20px;"></div>
    <div class="skeleton-line skeleton-w100" style="margin-top:16px;"></div>
    <div class="skeleton-line skeleton-w80"></div>
    <div class="skeleton-line skeleton-w60"></div>`;
  previewContent.innerHTML = `<div class="project-detail-empty"><div class="empty-icon">&#8987;</div><p>Loading preview&hellip;</p></div>`;

  const state = await loadProjects();
  const project = state.items.find(p => p.repoName.toLowerCase() === slug.toLowerCase());

  // page may have navigated away while the fetch was in flight
  const detailPage = document.getElementById('page-project-detail');
  if (!detailPage || detailPage.hidden) return;

  if (!project) {
    titleEl.textContent = 'Project not found';
    descEl.textContent = "This project isn't available — it may have been renamed or removed.";
    githubLink.href = `https://github.com/${GITHUB_OWNER}`;
    readmeEl.innerHTML = '';
    previewContent.innerHTML = '';
    document.title = 'Project not found — Emily Naidoo';
    return;
  }

  titleEl.textContent = project.title;
  descEl.textContent = project.description;
  githubLink.href = project.repoUrl;
  document.title = project.title + ' — Emily Naidoo';

  loadProjectFiles(project);

  // README (left side)
  try {
    const html = await fetchReadmeHtml(project.repoName);
    if (document.getElementById('page-project-detail').hidden) return; // navigated away
    if (html) {
      readmeEl.innerHTML = `<div class="readme-body">${cleanReadmeHtml(html)}</div>`;
    } else {
      readmeEl.innerHTML = `<p class="readme-empty">No README available for this project yet.</p>`;
    }
  } catch (err) {
    console.error('Project detail: could not load README —', err);
    readmeEl.innerHTML = `<p class="readme-empty">Couldn't load the README right now.</p>`;
  }
}

// ============================================================
// PARTICLE BACKGROUND
// ============================================================
(function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let particles = [];
  let w, h;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const COUNT = Math.min(60, Math.max(24, Math.floor(window.innerWidth / 26)));
  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.5 + 0.6,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      purple: Math.random() > 0.45
    });
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.purple ? 'rgba(157,92,255,0.55)' : 'rgba(199,196,218,0.4)';
      ctx.fill();
    });
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 110) {
          ctx.strokeStyle = 'rgba(157,92,255,' + (0.12 * (1 - dist / 110)) + ')';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
    if (!reduceMotion) requestAnimationFrame(frame);
  }
  frame();
})();

// Initial route
activatePage(currentHash(), { skipScroll: true });
if (currentHash() === 'engagements') renderProjects();
