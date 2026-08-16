#!/usr/bin/env node
/**
 * Generate wrote.svg + wrote-dark.svg from ebreen/devblog posts.
 *
 * Reads DEVBLOG_DIR (default ./.devblog) / src/content/blog/ recursively for .md files
 * and writes the two cards into cwd (the ebreen/ebreen root).
 *
 * No extra deps. Exit 0 even if the SVGs are unchanged.
 */

import fs from "node:fs";
import path from "node:path";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ROW_Y = [118, 174, 230, 286];
const DELAY = ["d1", "d2", "d3", "d4"];
const SITE = "https://www.eirikbreen.com/blog";

const THEMES = {
  light: {
    file: "wrote.svg",
    bg: "#f3efe4",
    stroke: "#d8d0bc",
    muted: "#6b665c",
    text: "#1c1a14",
    accent: "#7a6118",
  },
  dark: {
    file: "wrote-dark.svg",
    bg: "#111111",
    stroke: "#292929",
    muted: "#98938a",
    text: "#efece3",
    accent: "#d6b45f",
  },
};

const STYLE = `      .display { font-family: Georgia, 'Times New Roman', Times, serif; font-weight: 400; }
      .sans { font-family: 'Avenir Next', Avenir, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
      .mono { font-family: 'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      .rise { animation: rise .55s cubic-bezier(.16,1,.3,1); }
      .d1 { animation-delay: .06s; }
      .d2 { animation-delay: .12s; }
      .d3 { animation-delay: .18s; }
      .d4 { animation-delay: .24s; }
      .rule { transform-box: fill-box; transform-origin: left center; animation: drawx .7s cubic-bezier(.16,1,.3,1) .12s; }
      @keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes drawx { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      @media (prefers-reduced-motion: reduce) {
        .rise, .rule { animation: none !important; }
      }`;

function walkMarkdown(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === ".obsidian" || ent.name === "." || ent.name === "..") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkMarkdown(p, out);
    else if (ent.isFile() && ent.name.endsWith(".md")) out.push(p);
  }
  return out;
}

function unquote(value) {
  const v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const block = m[1];
  let title = null;
  let date = null;
  for (const line of block.split(/\r?\n/)) {
    const tm = line.match(/^title:\s*(.*)$/);
    if (tm) title = unquote(tm[1]);
    const dm = line.match(/^date:\s*(.*)$/);
    if (dm) date = unquote(dm[1]);
  }
  if (!title || !date) return null;
  const iso = String(date).match(/^(\d{4}-\d{2}-\d{2})/);
  if (!iso) return null;
  return { title, iso: iso[1] };
}

function formatDate(iso) {
  const [y, mo, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[mo - 1]} ${y}`;
}

function escapeXml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function publicUrl(blogRoot, filePath) {
  const rel = path
    .relative(path.join(blogRoot, "src/content/blog"), filePath)
    .replaceAll("\\", "/")
    .replace(/\.md$/, "");
  return `${SITE}/${rel}`;
}

function renderCard(posts, theme) {
  const rows = posts
    .map((post, i) => {
      const y = ROW_Y[i];
      const delay = DELAY[i];
      return `  <g class="rise ${delay}">
    <text x="48" y="${y}" class="mono" font-size="12" fill="${theme.accent}">${escapeXml(post.displayDate)}</text>
    <text x="164" y="${y}" class="sans" font-size="16" font-weight="600" fill="${theme.text}">${escapeXml(post.title)}</text>
  </g>`;
    })
    .join("\n");

  const footerDelay = posts.length ? DELAY[Math.min(posts.length, 4) - 1] : "";
  const footerClass = footerDelay ? `rise ${footerDelay}` : "rise";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="380" viewBox="0 0 840 380" role="img">
  <defs><style>
${STYLE}
</style></defs>
  <rect x="0.5" y="0.5" width="839" height="379" rx="20" fill="${theme.bg}" stroke="${theme.stroke}"/>
  <g class="rise">
    <text x="48" y="44" class="mono" font-size="11" fill="${theme.muted}" letter-spacing="1.2">WROTE</text>
    <text x="46" y="80" class="display" font-size="24" fill="${theme.text}">Latest notes</text>
  </g>
${rows ? rows + "\n" : ""}  <g class="${footerClass}">
    <text x="48" y="356" class="mono" font-size="12" fill="${theme.muted}">all notes at eirikbreen.com/blog</text>
  </g>
</svg>
`;
}

function main() {
  const cwd = process.cwd();
  const blogRoot = path.resolve(process.env.DEVBLOG_DIR || path.join(cwd, ".devblog"));
  const blogDir = path.join(blogRoot, "src/content/blog");

  const posts = walkMarkdown(blogDir)
    .map((filePath) => {
      const parsed = parseFrontmatter(fs.readFileSync(filePath, "utf8"));
      if (!parsed) return null;
      return {
        title: parsed.title,
        iso: parsed.iso,
        displayDate: formatDate(parsed.iso),
        url: publicUrl(blogRoot, filePath),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : 0))
    .slice(0, 4);

  for (const theme of Object.values(THEMES)) {
    const svg = renderCard(posts, theme);
    fs.writeFileSync(path.join(cwd, theme.file), svg);
  }

  for (const post of posts) {
    console.log(post.title);
  }
}

main();
