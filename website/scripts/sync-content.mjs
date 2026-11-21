// Builds website/src/content/docs from the maintained sources: README.md, docs/*.md,
// CHANGELOG.md and the hand-written pages in website/src/content-src. The output is
// generated and gitignored; edit the sources, not the output.
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import GithubSlugger from 'github-slugger';
import { base, branch, changelogPage, docPages, readmePages, repo } from './content-map.mjs';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(siteRoot, '..');
const outRoot = path.join(siteRoot, 'src/content/docs');
const handWrittenRoot = path.join(siteRoot, 'src/content-src');

const errors = [];
const fail = (message) => errors.push(message);

const read = (file) => readFileSync(path.join(repoRoot, file), 'utf8').replace(/\r\n/g, '\n');

const routeUrl = (route, anchor) => `${base}/${route}/${anchor ? `#${anchor}` : ''}`;
const githubUrl = (repoPath, anchor) => {
  const isDir =
    existsSync(path.join(repoRoot, repoPath)) &&
    statSync(path.join(repoRoot, repoPath)).isDirectory();
  const clean = repoPath.replace(/\/$/, '');
  return `https://github.com/${repo}/${isDir ? 'tree' : 'blob'}/${branch}/${clean}${anchor ? `#${anchor}` : ''}`;
};

const fenceRe = /^\s*(```|~~~)/;
const headingRe = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

/** Calls fn(line, index, inFence) for every line; returns nothing. */
function eachLine(lines, fn) {
  let fence = null;
  lines.forEach((line, index) => {
    const m = fenceRe.exec(line);
    if (m) {
      if (fence === null) fence = m[1];
      else if (m[1] === fence) fence = null;
      fn(line, index, true);
      return;
    }
    fn(line, index, fence !== null);
  });
}

function headingsOf(lines) {
  const found = [];
  eachLine(lines, (line, index, inFence) => {
    if (inFence) return;
    const m = headingRe.exec(line);
    if (m) found.push({ index, level: m[1].length, text: m[2] });
  });
  return found;
}

function gitDate(source) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', source], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

function frontmatter({ title, description, source }) {
  const lines = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
  ];
  lines.push(`editUrl: ${JSON.stringify(`https://github.com/${repo}/edit/${branch}/${source}`)}`);
  const date = gitDate(source);
  if (date) lines.push(`lastUpdated: ${date}`);
  lines.push('---', '');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Anchor tables. Each maps a heading slug in the source file to its place on the site.
// ---------------------------------------------------------------------------

/** source file (repo-relative) -> { route, anchors: Map<slug, anchorOnPage|''> } */
const targets = new Map();

// --- README -----------------------------------------------------------------
const readmeLines = read('README.md').split('\n');
const readmeHeadings = headingsOf(readmeLines);
{
  const slugger = new GithubSlugger();
  for (const h of readmeHeadings) h.slug = slugger.slug(h.text);
}

const pageByHeading = new Map();
for (const page of readmePages) {
  page.lines = [];
  page.entries = [];
  for (const h of page.headings) pageByHeading.set(`${h.level ?? 2}:${h.text}`, page);
}
for (const page of readmePages) {
  for (const h of page.headings) {
    if (!readmeHeadings.some((r) => r.level === (h.level ?? 2) && r.text === h.text)) {
      fail(
        `README.md has no "${'#'.repeat(h.level ?? 2)} ${h.text}" heading (mapped to ${page.route}). Update scripts/content-map.mjs.`,
      );
    }
  }
}

const readmeAnchors = new Map(); // slug -> { route, anchor }
{
  const headingAt = new Map(readmeHeadings.map((h) => [h.index, h]));
  let current = null;
  let fence = null;
  readmeLines.forEach((line, index) => {
    const m = fenceRe.exec(line);
    if (m) {
      if (fence === null) fence = m[1];
      else if (m[1] === fence) fence = null;
      if (current) current.lines.push({ text: line });
      return;
    }
    const h = fence === null ? headingAt.get(index) : undefined;
    if (h) {
      const mapped = pageByHeading.get(`${h.level}:${h.text}`);
      if (mapped) {
        current = mapped;
        mapped.entries.push({ heading: h, lineIndex: mapped.lines.length });
        mapped.lines.push({ text: line, heading: h });
        return;
      }
      if (h.level <= 2) {
        current = null;
        return;
      }
    }
    if (current) current.lines.push({ text: line, heading: h });
  });

  for (const page of readmePages) {
    const single = page.headings.length === 1;
    const first = page.headings[0];
    const titleLevel = first.level ?? 2;
    const shift = single ? titleLevel - 1 : 0;
    const out = [];
    const slugger = new GithubSlugger();
    for (const entry of page.lines) {
      const h = entry.heading;
      if (!h) {
        out.push(entry.text);
        continue;
      }
      const isPageTitle =
        single && h.level === titleLevel && pageByHeading.get(`${h.level}:${h.text}`) === page;
      if (isPageTitle) {
        readmeAnchors.set(h.slug, { route: page.route, anchor: '' });
        continue;
      }
      const level = Math.max(2, h.level - shift);
      const pageSlug = slugger.slug(h.text);
      readmeAnchors.set(h.slug, { route: page.route, anchor: pageSlug });
      out.push(`${'#'.repeat(level)} ${h.text}`);
    }
    page.body = out;
  }
}
targets.set('README.md', { anchors: readmeAnchors, home: true });

// --- docs/*.md and CHANGELOG ------------------------------------------------
const docs = [];
for (const page of [...docPages, changelogPage]) {
  const lines = read(page.source).split('\n');
  const all = headingsOf(lines);
  const h1 = all.find((h) => h.level === 1);
  if (!h1) {
    fail(`${page.source} has no H1 heading.`);
    continue;
  }
  const title = page.title ?? h1.text;
  const slugger = new GithubSlugger();
  for (const h of all) h.slug = slugger.slug(h.text);
  const anchors = new Map();
  const pageSlugger = new GithubSlugger();
  for (const h of all) {
    anchors.set(
      h.slug,
      h === h1
        ? { route: page.route, anchor: '' }
        : { route: page.route, anchor: pageSlugger.slug(h.text) },
    );
  }
  targets.set(page.source, { anchors });
  docs.push({ ...page, title, lines, h1 });
}

// ---------------------------------------------------------------------------
// Link rewriting
// ---------------------------------------------------------------------------

const linkRe = /\]\(\s*<?([^)\s>]+)>?((?:\s+"[^"]*")?)\)/g;

function rewriteTarget(url, source) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) return url;
  const hashAt = url.indexOf('#');
  const filePart = hashAt === -1 ? url : url.slice(0, hashAt);
  const anchor = hashAt === -1 ? '' : url.slice(hashAt + 1);

  let repoPath = source;
  if (filePart !== '') {
    repoPath = path.posix.normalize(path.posix.join(path.posix.dirname(source), filePart));
    if (repoPath.startsWith('..')) {
      fail(`${source}: link "${url}" points outside the repository.`);
      return url;
    }
  }

  const target = targets.get(repoPath);
  if (target) {
    if (anchor === '') {
      if (target.home) return `${base}/`;
      const any = target.anchors.values().next().value;
      return routeUrl(any.route);
    }
    const hit = target.anchors.get(anchor);
    if (hit) return routeUrl(hit.route, hit.anchor);
    if (target.home) {
      // A README heading that is not part of the site (for example Roadmap).
      return githubUrl(repoPath, anchor);
    }
    fail(`${source}: link "${url}" targets a heading that does not exist in ${repoPath}.`);
    return url;
  }
  if (!existsSync(path.join(repoRoot, repoPath))) {
    fail(`${source}: link "${url}" targets ${repoPath}, which does not exist.`);
    return url;
  }
  return githubUrl(repoPath, anchor);
}

function rewriteLinks(lines, source) {
  const out = [];
  eachLine(lines, (line, _index, inFence) => {
    out.push(
      inFence
        ? line
        : line.replace(linkRe, (m, url, title) => `](${rewriteTarget(url, source)}${title})`),
    );
  });
  return out;
}

// ---------------------------------------------------------------------------
// Hand-written pages: include expansion and the typechecked-snippet guard
// ---------------------------------------------------------------------------

const includeRe = /^\{\{include\s+(\S+?)(?:#(\S+))?\s*\}\}\s*$/;
const tsFenceRe = /^\s*(```|~~~)\s*(ts|typescript|tsx)\b/;

function expandIncludes(lines, source) {
  const out = [];
  lines.forEach((line, i) => {
    const where = `${source}:${i + 1}`;
    const m = includeRe.exec(line);
    if (!m) {
      if (tsFenceRe.test(line)) {
        fail(
          `${where}: TypeScript code fence that is not an include. Put the code in a typechecked file and use {{include path}}.`,
        );
      }
      out.push(line);
      return;
    }
    const [, file, region] = m;
    const full = path.join(repoRoot, file);
    if (!existsSync(full)) {
      fail(`${where}: include "${file}" does not exist.`);
      return;
    }
    let code = readFileSync(full, 'utf8').replace(/\r\n/g, '\n').split('\n');
    if (region) {
      const start = code.findIndex((l) =>
        new RegExp(`^\\s*//\\s*#region\\s+${region}\\s*$`).test(l),
      );
      const end = code.findIndex((l, j) => j > start && /^\s*\/\/\s*#endregion\b/.test(l));
      if (start === -1 || end === -1) {
        fail(`${where}: region "${region}" not found in ${file}.`);
        return;
      }
      code = code.slice(start + 1, end);
    }
    while (code.length && code[code.length - 1] === '') code.pop();
    const lang = file.endsWith('.tsx') ? 'tsx' : 'ts';
    out.push(`\`\`\`${lang} title="${file}"`, ...code, '```');
  });
  return out;
}

function listFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files.push(...listFiles(full));
    else files.push(full);
  }
  return files;
}

// ---------------------------------------------------------------------------
// Write the content tree
// ---------------------------------------------------------------------------

function writePage(route, content) {
  const file = path.join(outRoot, `${route}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function trimBlank(lines) {
  const out = [...lines];
  while (out.length && out[0].trim() === '') out.shift();
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  return out;
}

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

for (const page of readmePages) {
  const body = trimBlank(rewriteLinks(page.body ?? [], 'README.md'));
  writePage(page.route, `${frontmatter({ ...page, source: 'README.md' })}${body.join('\n')}\n`);
}

for (const doc of docs) {
  let lines = doc.lines.filter((_, i) => i !== doc.h1.index);
  lines = lines.filter((l) => !/^\[Back to the README\]\(.*\)\s*$/.test(l));
  lines = trimBlank(rewriteLinks(lines, doc.source));
  writePage(doc.route, `${frontmatter(doc)}${lines.join('\n')}\n`);
}

if (existsSync(handWrittenRoot)) {
  for (const file of listFiles(handWrittenRoot)) {
    const rel = path.relative(handWrittenRoot, file);
    const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const lines = expandIncludes(text.split('\n'), `website/src/content-src/${rel}`);
    const dest = path.join(outRoot, rel);
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, lines.join('\n'));
  }
}

// Every page needs a unique title and a unique, non-empty description (search snippets).
{
  const seen = { title: new Map(), description: new Map() };
  for (const file of listFiles(outRoot)) {
    if (!/\.mdx?$/.test(file)) continue;
    const rel = path.relative(outRoot, file);
    const head = /^---\n([\s\S]*?)\n---/.exec(readFileSync(file, 'utf8'));
    for (const key of ['title', 'description']) {
      const m = head && new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(head[1]);
      const value = m ? m[1].trim().replace(/^(["'])(.*)\1$/, '$2') : '';
      if (value === '') {
        fail(`${rel}: missing ${key} in frontmatter.`);
        continue;
      }
      const other = seen[key].get(value);
      if (other) fail(`${rel}: ${key} duplicates the one in ${other}.`);
      else seen[key].set(value, rel);
    }
  }
}

if (errors.length > 0) {
  console.error(`sync-content failed with ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`sync-content: wrote ${readmePages.length + docs.length} generated pages.`);
