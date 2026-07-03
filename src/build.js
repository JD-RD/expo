// EXPO — Static OKF site builder
// Usage: node src/build.js [--watch]

import { readFileSync, writeFileSync, readdirSync, statSync, cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join, relative, dirname, basename, extname } from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import nunjucks from 'nunjucks';
import lunr from 'lunr';

const ROOT = new URL('..', import.meta.url).pathname;
const BUNDLES = join(ROOT, 'bundles');
const TEMPLATES = join(ROOT, 'src', 'templates');
const ASSETS_SRC = join(ROOT, 'src', 'assets');
const DIST = join(ROOT, 'dist');
const DATA = join(ROOT, 'data');

// ─── Nunjucks setup ────────────────────────────────────────────
nunjucks.configure(TEMPLATES, { autoescape: true, noCache: true });

// ─── Types ──────────────────────────────────────────────────────
/** @typedef {{ path: string, slug: string, frontmatter: Record<string,any>, body: string, bodyHtml: string, links: string[], backlinks: string[], bundle: string }} Concept */

// ─── Helpers ────────────────────────────────────────────────────

function readMd(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  return { frontmatter: data, body: content };
}

function isReserved(filename) {
  return filename === 'index.md' || filename === 'log.md';
}

/** Recursively walk a directory, returning all .md file paths (except reserved names) */
function walkMd(dir, bundleName) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMd(full, bundleName));
    } else if (entry.isFile() && entry.name.endsWith('.md') && !isReserved(entry.name)) {
      const relPath = relative(join(BUNDLES, bundleName), full).replace(/\.md$/, '');
      results.push({ filePath: full, slug: `${bundleName}/${relPath}`, bundle: bundleName });
    }
  }
  return results;
}

/** Walk directories to build tree structure for sidebar */
function buildTree(dir, bundleName, basePath = '') {
  const items = [];
  if (!existsSync(dir)) return items;
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    if (e.name.startsWith('_')) continue; // skip _resources
    if (e.name === 'index.md' || e.name === 'log.md') continue;
    if (e.isDirectory()) {
      const relPath = basePath ? `${basePath}/${e.name}` : e.name;
      const indexPath = join(dir, e.name, 'index.md');
      let label = e.name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      let desc = '';
      if (existsSync(indexPath)) {
        const { frontmatter } = readMd(indexPath);
        if (frontmatter.title) label = frontmatter.title;
        if (frontmatter.description) desc = frontmatter.description;
      }
      items.push({
        type: 'directory',
        name: e.name,
        label,
        desc,
        path: `/${bundleName}/${relPath}/`,
        children: buildTree(join(dir, e.name), bundleName, relPath),
      });
    } else if (e.isFile() && e.name.endsWith('.md')) {
      const relPath = basePath ? `${basePath}/${e.name.replace(/\.md$/, '')}` : e.name.replace(/\.md$/, '');
      const { frontmatter } = readMd(join(dir, e.name));
      const label = frontmatter.title || e.name.replace(/\.md$/, '').replace(/[-_]/g, ' ');
      items.push({
        type: 'concept',
        name: e.name.replace(/\.md$/, ''),
        label,
        desc: frontmatter.description || '',
        path: `/${bundleName}/${relPath}.html`,
        children: [],
      });
    }
  }
  return items;
}

/** Emoji by type */
function typeEmoji(type) {
  const map = {
    'Restaurant': '🍜', 'Attraction': '🗿', 'Lieu': '📍', 'Café': '☕',
    'Shopping': '🛍', 'Transport': '🚃', 'Projet': '🛠', 'Personne': '👤',
    'Bien-être': '♨️', 'Hébergement': '🏨', 'Musée': '🏛', 'Parc': '🌳',
    'Activité': '🎯', 'Playbook': '📋', 'Reference': '📖',
  };
  return map[type] || '📄';
}

// ─── Main Build ─────────────────────────────────────────────────

function build() {
  console.log('⚡ KAI — Building static site...\n');

  // Clean dist
  if (existsSync(DIST)) rmSync(DIST, { recursive: true });
  mkdirSync(DIST, { recursive: true });

  // ── 1. Discover bundles ────────────────────────────────────
  const bundleDirs = readdirSync(BUNDLES, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('_'))
    .map(e => e.name);

  /** @type {Record<string, { concepts: Concept[], tree: any[], meta: any }>} */
  const bundles = {};

  for (const name of bundleDirs) {
    console.log(`  📦 ${name}`);
    const bundleDir = join(BUNDLES, name);

    // Read bundle index.md if exists
    let meta = { title: name, description: '' };
    const indexPath = join(bundleDir, 'index.md');
    if (existsSync(indexPath)) {
      const { frontmatter, body } = readMd(indexPath);
      meta = { ...meta, ...frontmatter, body };
    }

    // Read all concepts
    const files = walkMd(bundleDir, name);
    const concepts = files.map(f => {
      const { frontmatter, body } = readMd(f.filePath);
      const bodyHtml = marked.parse(body, { breaks: true });
      return {
        path: `/${f.slug}`,
        slug: f.slug,
        frontmatter,
        body,
        bodyHtml,
        links: [],     // resolved later
        backlinks: [],
        bundle: name,
      };
    });

    // Build tree
    const tree = buildTree(bundleDir, name);

    bundles[name] = { concepts, tree, meta };
  }

  // ── 2. Build path lookup map ────────────────────────────────
  /** @type {Map<string, Concept>} */
  const pathMap = new Map();
  for (const bundle of Object.values(bundles)) {
    for (const concept of bundle.concepts) {
      pathMap.set(concept.path, concept);
    }
  }

  // ── 3. Resolve links ───────────────────────────────────────
  for (const bundle of Object.values(bundles)) {
    for (const concept of bundle.concepts) {
      const linkRegex = /\]\((\/[^)]+?)(?:#|\))/g;
      let match;
      while ((match = linkRegex.exec(concept.body)) !== null) {
        let target = match[1].replace(/\.md$/, '');
        const found = pathMap.get(target);
        if (found) {
          if (!concept.links.includes(found.path)) concept.links.push(found.path);
          if (!found.backlinks.includes(concept.path)) found.backlinks.push(concept.path);
        }
      }
    }
  }

  // ── 3. Build pages ─────────────────────────────────────────

  // Portal homepage (bundles/index.md)
  const portalIndexPath = join(BUNDLES, 'index.md');
  let portalMeta = { title: 'KAI', description: 'Knowledge Explorer' };
  if (existsSync(portalIndexPath)) {
    const { frontmatter, body } = readMd(portalIndexPath);
    portalMeta = { ...portalMeta, ...frontmatter, body: marked.parse(body, { breaks: true }) };
  }

  // Build bundle list for portal
  const bundleList = [];
  for (const [name, bundle] of Object.entries(bundles)) {
    bundleList.push({
      name,
      title: bundle.meta.title || name,
      description: bundle.meta.description || '',
      path: `/${name}/`,
      conceptCount: bundle.concepts.length,
      emoji: name === 'japon' ? '🇯🇵' : name === 'projets' ? '🛠' : '📦',
    });
  }

  const portalHtml = nunjucks.render('portal.njk', {
    siteTitle: portalMeta.title,
    siteDescription: portalMeta.description,
    body: portalMeta.body || '',
    bundles: bundleList,
  });
  writeFileSync(join(DIST, 'index.html'), portalHtml);
  console.log(`  🏠 portal → /index.html`);

  // Bundle index pages
  for (const [name, bundle] of Object.entries(bundles)) {
    const bundleDir = join(DIST, name);
    mkdirSync(bundleDir, { recursive: true });

    const bundleHtml = nunjucks.render('bundle-index.njk', {
      siteTitle: bundle.meta.title,
      pageTitle: bundle.meta.title,
      description: bundle.meta.description,
      body: bundle.meta.body ? marked.parse(bundle.meta.body, { breaks: true }) : '',
      tree: bundle.tree,
      bundleName: name,
      concepts: bundle.concepts.slice(0, 20).map(c => ({
        slug: c.slug,
        frontmatter: c.frontmatter,
        title: c.frontmatter.title || c.slug.split('/').pop(),
        emoji: typeEmoji(c.frontmatter.type),
      })),
    });
    writeFileSync(join(bundleDir, 'index.html'), bundleHtml);
    console.log(`  📖 ${name} → /${name}/index.html`);

    // Concept pages
    for (const concept of bundle.concepts) {
      const outPath = join(DIST, `${concept.slug}.html`);
      mkdirSync(dirname(outPath), { recursive: true });

      // Build breadcrumb
      const parts = concept.slug.split('/');
      const breadcrumb = [];
      let accum = '';
      for (let i = 0; i < parts.length; i++) {
        accum += '/' + parts[i];
        const label = parts[i].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        if (i === parts.length - 1) {
          breadcrumb.push({ label: concept.frontmatter.title || label, path: null });
        } else {
          breadcrumb.push({ label, path: accum + '/' });
        }
      }

      // Build tree with active state for sidebar
      const activePath = `/${concept.slug}`;

      const html = nunjucks.render('concept.njk', {
        siteTitle: `${concept.frontmatter.title || concept.slug} · ${bundle.meta.title}`,
        pageTitle: concept.frontmatter.title || concept.slug,
        description: concept.frontmatter.description || '',
        type: concept.frontmatter.type || 'Concept',
        typeEmoji: typeEmoji(concept.frontmatter.type),
        tags: concept.frontmatter.tags || [],
        timestamp: concept.frontmatter.timestamp || '',
        body: concept.bodyHtml,
        breadcrumb,
        tree: bundle.tree,
        bundleName: name,
        backlinks: concept.backlinks.map(p => {
          const found = bundle.concepts.find(c => c.path === p);
          return found ? { path: `${found.path}.html`, title: found.frontmatter.title || found.slug } : null;
        }).filter(Boolean),
        forwardLinks: concept.links.map(p => {
          const found = bundle.concepts.find(c => c.path === p);
          return found ? { path: `${found.path}.html`, title: found.frontmatter.title || found.slug } : null;
        }).filter(Boolean),
      });
      writeFileSync(outPath, html);
      console.log(`  📄 ${concept.slug} → /${concept.slug}.html`);
    }
  }

  // ── 4. Generate subdirectory index pages ───────────────────
  for (const [name, bundle] of Object.entries(bundles)) {
    const bundleDir = join(BUNDLES, name);

    function findTreeNode(nodes, targetPath) {
      for (const node of nodes) {
        if (node.path === targetPath) return node;
        if (node.children) {
          const found = findTreeNode(node.children, targetPath);
          if (found) return found;
        }
      }
      return null;
    }

    function genDirIndex(dir, prefix) {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        if (e.name.startsWith('_')) continue;

        const subDir = join(dir, e.name);
        const indexPath = join(subDir, 'index.md');
        const relPath = prefix ? `${prefix}/${e.name}` : e.name;

        // Concepts in this directory (first level only, excl. deeper subdirs)
        const dirPrefix = `${name}/${relPath}/`;
        const dirConcepts = bundle.concepts
          .filter(c => c.slug.startsWith(dirPrefix) && c.slug.split('/').length === relPath.split('/').length + 2)
          .map(c => ({
            slug: c.slug,
            frontmatter: c.frontmatter,
            title: c.frontmatter.title || c.slug.split('/').pop(),
            emoji: typeEmoji(c.frontmatter.type),
          }));

        // Subdirectories from the tree
        const currentPath = `/${name}/${relPath}/`;
        const treeNode = findTreeNode(bundle.tree, currentPath);
        const subdirs = treeNode && treeNode.children ? treeNode.children
          .filter(child => child.type === 'directory')
          .map(child => {
            const subDirCount = bundle.concepts.filter(c => c.slug.startsWith(`${name}/${relPath}/${child.name}/`)).length;
            const subDirEmojis = { 'attractions': '🗿', 'bars': '🍺', 'hebergements': '🏨', 'lieux': '📍', 'onsens': '♨️', 'restaurants': '🍜', 'shoppings': '🛍️', 'activites': '🎯' };
            return {
              label: child.label,
              path: child.path,
              desc: child.desc || `${subDirCount} concepts`,
              count: subDirCount,
              emoji: subDirEmojis[child.name] || '📂',
            };
          }) : [];

        let pageTitle, description, body;
        if (existsSync(indexPath)) {
          const fm = readMd(indexPath);
          pageTitle = fm.frontmatter.title || e.name;
          description = fm.frontmatter.description || '';
          body = fm.body ? marked.parse(fm.body, { breaks: true }) : '';
        } else {
          pageTitle = e.name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          description = `${dirConcepts.length} concepts`;
          body = '';
        }

        // Breadcrumb
        const parts = relPath.split('/');
        const breadcrumb = [{ label: bundle.meta.title || name, path: `/${name}/` }];
        let accum = name;
        for (let i = 0; i < parts.length; i++) {
          accum += '/' + parts[i];
          if (i === parts.length - 1) {
            breadcrumb.push({ label: pageTitle, path: null });
          } else {
            breadcrumb.push({ label: parts[i], path: '/' + accum + '/' });
          }
        }

        const html = nunjucks.render('dir-index.njk', {
          siteTitle: `${pageTitle} · ${bundle.meta.title}`,
          pageTitle,
          description,
          body,
          concepts: dirConcepts,
          subdirs,
          breadcrumb,
          tree: bundle.tree,
          bundleName: name,
        });

        const outDir = join(DIST, name, relPath);
        mkdirSync(outDir, { recursive: true });
        writeFileSync(join(outDir, 'index.html'), html);
        console.log(`  📁 ${name}/${relPath}/ → /${name}/${relPath}/index.html (${dirConcepts.length} concepts)`);

        // Recurse into subdirectories
        genDirIndex(subDir, relPath);
      }
    }
    genDirIndex(bundleDir, '');
  }

  // ── 5. Copy static assets ──────────────────────────────────
  const assetsDist = join(DIST, 'assets');
  if (existsSync(ASSETS_SRC)) {
    mkdirSync(assetsDist, { recursive: true });
    for (const file of readdirSync(ASSETS_SRC)) {
      const src = join(ASSETS_SRC, file);
      const dest = join(assetsDist, file);
      if (statSync(src).isFile()) {
        writeFileSync(dest, readFileSync(src));
      }
    }
    console.log('\n  🎨 assets/ → dist/assets/');
  }

  // ── 5. Generate search index (Lunr.js) ──────────
  const searchDocs = [];
  for (const [name, bundle] of Object.entries(bundles)) {
    for (const concept of bundle.concepts) {
      searchDocs.push({
        id: concept.path,
        title: concept.frontmatter.title || concept.slug.split('/').pop(),
        description: (concept.frontmatter.description || '').slice(0, 200),
        url: concept.path + '.html',
        tags: (concept.frontmatter.tags || []).join(' '),
        bundle: bundle.meta.title || name,
      });
    }
  }

  if (searchDocs.length > 0) {
    const idx = lunr(function () {
      this.ref('id');
      this.field('title', { boost: 10 });
      this.field('description', { boost: 5 });
      this.field('tags', { boost: 3 });
      this.field('bundle');

      for (const doc of searchDocs) {
        this.add(doc);
      }
    });

    const searchIndex = {
      index: idx.toJSON(),
      docs: searchDocs,
    };
    writeFileSync(join(assetsDist, 'search-index.json'), JSON.stringify(searchIndex));
    console.log('  🔍 search-index.json → dist/assets/search-index.json');
  }

  // ── 6. 404 page ──────────────────────────────────
  const notFoundHtml = nunjucks.render('404.njk', {
    siteTitle: '404 · EXPO',
  });
  writeFileSync(join(DIST, '404.html'), notFoundHtml);
  console.log('  🌊 404 → /404.html');

  // ── 7. Copy CNAME / sitemap / robots if present ────
  for (const f of ['CNAME', 'robots.txt', 'sitemap.xml', 'manifest.json']) {
    const src = join(ROOT, f);
    if (existsSync(src)) writeFileSync(join(DIST, f), readFileSync(src));
  }

  const count = Object.values(bundles).reduce((s, b) => s + b.concepts.length, 0);
  console.log(`\n✅ Done — ${count} concepts in ${bundleList.length} bundles → ${DIST}\n`);
}

build();
