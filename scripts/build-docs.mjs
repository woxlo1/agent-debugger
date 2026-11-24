import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const docsDir = path.join(root, "docs")
const outDir = path.join(root, "docs-site")
const assetsDir = path.join(outDir, "assets")
const repoUrl = "https://github.com/woxlo1/agent-debugger"

const nav = [
  { file: "PRODUCT_BRIEF.md", title: "Product brief" },
  { file: "ARCHITECTURE.md", title: "Architecture" },
  { file: "USAGE_PRIVACY.md", title: "Usage and privacy" },
  { file: "CASE_COMPARE.md", title: "Case comparison" },
  { file: "MCP_CLAUDE_LOCAL.md", title: "MCP and Claude local" },
  { file: "DESKTOP_SHELL.md", title: "Desktop shell" },
  { file: "PERFORMANCE.md", title: "Performance results" },
  { file: "AI_SOURCE_MATRIX.md", title: "AI source matrix" },
  { file: "VALIDATION_PLAN.md", title: "Validation plan" },
  { file: "SECURITY_REVIEW.md", title: "Security review" },
  { file: "OPS_BOTS.md", title: "Ops bots" },
  { file: "COORDINATOR_PLAN.md", title: "Coordinator plan" },
  { file: "HN_LAUNCH_DRAFT.md", title: "HN launch draft" },
]

const htmlEscapeMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => htmlEscapeMap[char])
}

function inline(value) {
  let text = escapeHtml(value)
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>")
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  text = text.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
  text = text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" rel="noopener noreferrer">$1</a>',
  )
  return text
}

function slug(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section"
  )
}

function renderMarkdown(markdown) {
  const usedIds = new Set()
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n")
  const output = []
  const toc = []
  const paragraph = []
  let list = null
  let quote = []

  function uniqueId(text) {
    const base = slug(text)
    let candidate = base
    let counter = 2
    while (usedIds.has(candidate)) candidate = `${base}-${counter++}`
    usedIds.add(candidate)
    return candidate
  }

  function flushParagraph() {
    if (paragraph.length === 0) return
    output.push(`<p>${inline(paragraph.join(" "))}</p>`)
    paragraph.length = 0
  }

  function flushList() {
    if (!list) return
    output.push(`</${list}>`)
    list = null
  }

  function flushQuote() {
    if (quote.length === 0) return
    output.push(
      `<blockquote>${quote
        .map((line) => `<p>${inline(line)}</p>`)
        .join("")}</blockquote>`,
    )
    quote = []
  }

  function flushAll() {
    flushParagraph()
    flushList()
    flushQuote()
  }

  function cells(row) {
    return row
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim())
  }

  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (trimmed.startsWith("```")) {
      flushAll()
      const language = trimmed.slice(3).trim().replace(/[^\w-]/g, "") || "text"
      index += 1
      const code = []
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      output.push(
        `<pre><code class="language-${language}">${escapeHtml(
          code.join("\n"),
        )}</code></pre>`,
      )
      continue
    }

    if (/^---+$/.test(trimmed)) {
      flushAll()
      output.push("<hr />")
      index += 1
      continue
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      flushAll()
      const level = heading[1].length
      const text = heading[2].trim()
      const id = uniqueId(text)
      output.push(`<h${level} id="${id}">${inline(text)}</h${level}>`)
      if (level === 2 || level === 3) toc.push({ level, id, text })
      index += 1
      continue
    }

    if (trimmed.startsWith("> ")) {
      flushParagraph()
      flushList()
      quote.push(trimmed.slice(2).trim())
      index += 1
      continue
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/)
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/)
    if (unordered || ordered) {
      flushParagraph()
      flushQuote()
      const type = unordered ? "ul" : "ol"
      if (list !== type) {
        flushList()
        output.push(`<${type}>`)
        list = type
      }
      output.push(`<li>${inline((unordered || ordered)[1].trim())}</li>`)
      index += 1
      continue
    }

    const hasTableSeparator =
      index + 1 < lines.length &&
      /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[index + 1])
    if (trimmed.includes("|") && hasTableSeparator) {
      flushAll()
      const header = cells(trimmed)
      index += 2
      const rows = []
      while (
        index < lines.length &&
        lines[index].trim() !== "" &&
        lines[index].includes("|")
      ) {
        rows.push(cells(lines[index]))
        index += 1
      }
      output.push(
        `<table><thead><tr>${header
          .map((cell) => `<th>${inline(cell)}</th>`)
          .join("")}</tr></thead><tbody>${rows
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`,
          )
          .join("")}</tbody></table>`,
      )
      continue
    }

    if (trimmed === "") {
      flushAll()
      index += 1
      continue
    }

    paragraph.push(trimmed)
    index += 1
  }

  flushAll()
  return { html: output.join("\n"), toc }
}

function page({ title, body, activeFile, toc = [] }) {
  const links = nav
    .map((item) => {
      const href = item.file === "PRODUCT_BRIEF.md" ? "index.html" : `${item.file.replace(/\.md$/, "")}.html`
      const active = item.file === activeFile ? ' class="active"' : ""
      return `<a href="${href}"${active}>${escapeHtml(item.title)}</a>`
    })
    .join("\n        ")

  const tocLinks = toc
    .map(
      (item) =>
        `<a class="toc-${item.level}" href="#${item.id}">${inline(item.text)}</a>`,
    )
    .join("\n        ")

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · Agent Debugger Docs</title>
  <meta name="description" content="Local-first failure debugging for AI agents." />
  <link rel="icon" href="assets/favicon.svg" />
  <meta property="og:title" content="Agent Debugger" />
  <meta property="og:description" content="Local-first failure debugging for AI agents." />
  <meta property="og:image" content="assets/social-card.svg" />
  <style>
    :root { color-scheme: dark; --bg:#080f1c; --panel:#0d1729; --line:#1e293b; --text:#e2e8f0; --muted:#94a3b8; --accent:#34d399; --accent2:#22d3ee; }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--bg); color:var(--text); font:15px/1.65 Inter,"Segoe UI",Arial,sans-serif; }
    a { color:var(--accent2); text-decoration:none; }
    a:hover { text-decoration:underline; }
    .layout { display:grid; grid-template-columns:250px minmax(0,1fr) 220px; min-height:100vh; }
    .sidebar { border-right:1px solid var(--line); padding:28px 20px; background:var(--panel); position:sticky; top:0; height:100vh; overflow-y:auto; }
    .brand { display:flex; align-items:center; gap:10px; color:var(--text); font-weight:700; font-size:17px; margin-bottom:28px; }
    .brand:hover { text-decoration:none; }
    .brand img { width:34px; height:34px; }
    nav.side-links { display:flex; flex-direction:column; gap:4px; }
    nav.side-links a { padding:8px 10px; border-radius:8px; color:var(--muted); font-size:14px; }
    nav.side-links a:hover, nav.side-links a.active { background:#13233c; color:var(--text); text-decoration:none; }
    .side-footer { margin-top:32px; font-size:12px; color:#64748b; }
    main { padding:48px 56px 96px; max-width:960px; }
    article h1 { font-size:36px; line-height:1.2; margin:0 0 24px; }
    article h2 { font-size:24px; margin:40px 0 12px; padding-bottom:8px; border-bottom:1px solid var(--line); }
    article h3 { font-size:19px; margin:28px 0 8px; }
    article p, article li { color:#cbd5e1; }
    article ul, article ol { padding-left:22px; }
    article li { margin:6px 0; }
    article pre { background:#050b16; border:1px solid var(--line); border-radius:10px; padding:16px; overflow-x:auto; }
    article code { font-family:"SFMono-Regular",Consolas,monospace; font-size:0.9em; }
    article :not(pre) > code { background:#13233c; color:#a7f3d0; padding:2px 5px; border-radius:4px; }
    article table { width:100%; border-collapse:collapse; margin:18px 0; font-size:14px; }
    article th, article td { border:1px solid var(--line); padding:8px 10px; text-align:left; vertical-align:top; }
    article th { background:#111d33; color:#e2e8f0; }
    article blockquote { margin:18px 0; padding:12px 16px; border-left:3px solid var(--accent); background:#0f1d2e; color:var(--muted); }
    article blockquote p { margin:0; }
    article hr { border:0; border-top:1px solid var(--line); margin:32px 0; }
    .toc { border-left:1px solid var(--line); padding:48px 20px; font-size:13px; position:sticky; top:0; height:100vh; overflow-y:auto; }
    .toc strong { display:block; color:#64748b; text-transform:uppercase; letter-spacing:0.08em; font-size:11px; margin-bottom:12px; }
    .toc a { display:block; color:var(--muted); padding:4px 0; }
    .toc .toc-3 { padding-left:14px; color:#64748b; }
    .hero { display:flex; align-items:center; gap:22px; margin-bottom:32px; }
    .hero img { width:88px; height:88px; }
    .hero h1 { margin:0 0 6px; }
    .hero p { margin:0; color:var(--muted); }
    .cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:14px; margin:32px 0; }
    .card { display:block; padding:18px; border:1px solid var(--line); border-radius:12px; background:var(--panel); color:var(--text); }
    .card:hover { border-color:var(--accent); text-decoration:none; }
    .card strong { display:block; margin-bottom:6px; }
    .card span { color:var(--muted); font-size:13px; }
    .demo { width:100%; max-width:900px; border:1px solid var(--line); border-radius:12px; display:block; margin:24px 0; }
    .generated { color:#475569; font-size:12px; margin-top:56px; }
    @media (max-width:1100px) { .layout { grid-template-columns:220px minmax(0,1fr); } .toc { display:none; } main { padding:36px 32px 72px; } }
    @media (max-width:720px) { .layout { grid-template-columns:1fr; } .sidebar { position:static; height:auto; border-right:0; border-bottom:1px solid var(--line); } main { padding:28px 20px 56px; } }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <a class="brand" href="index.html"><img src="assets/icon.svg" alt="" /> Agent Debugger</a>
      <nav class="side-links">
        ${links}
      </nav>
      <p class="side-footer">Local-first · MIT licensed<br />Generated docs, edit Markdown in <code>docs/</code>.</p>
    </aside>
    <main>
      ${body}
      <p class="generated">Generated by <code>scripts/build-docs.mjs</code>. Do not edit this HTML directly.</p>
    </main>
    <aside class="toc">
      <strong>On this page</strong>
      ${tocLinks || '<a href="index.html">Home</a>'}
    </aside>
  </div>
</body>
</html>
`
}

function titleOf(markdown, fallback) {
  const match = markdown.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : fallback
}

function summaryOf(markdown) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n")
  let seenTitle = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!seenTitle) {
      if (trimmed.startsWith("# ")) seenTitle = true
      continue
    }
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("```")) continue
    return trimmed.length > 150 ? `${trimmed.slice(0, 147)}...` : trimmed
  }
  return "Documentation for Agent Debugger."
}

async function main() {
  await mkdir(assetsDir, { recursive: true })
  for (const name of ["icon.svg", "favicon.svg", "social-card.svg", "demo.gif"]) {
    await copyFile(path.join(docsDir, "assets", name), path.join(assetsDir, name))
  }

  const pages = []
  for (const item of nav) {
    const source = path.join(docsDir, item.file)
    let markdown
    try {
      markdown = await readFile(source, "utf8")
    } catch {
      continue
    }
    const rendered = renderMarkdown(markdown)
    const title = titleOf(markdown, item.title)
    const name = item.file === "PRODUCT_BRIEF.md" ? "index" : item.file.replace(/\.md$/, "")
    pages.push({
      ...item,
      name,
      title,
      summary: summaryOf(markdown),
      html: page({ title, body: `<article>${rendered.html}</article>`, activeFile: item.file, toc: rendered.toc }),
    })
  }

  const cards = pages
    .map(
      (item) =>
        `<a class="card" href="${item.name}.html"><strong>${escapeHtml(
          item.title,
        )}</strong><span>${inline(item.summary)}</span></a>`,
    )
    .join("\n      ")

  const indexBody = `<section class="hero">
      <img src="assets/icon.svg" alt="Agent Debugger icon" />
      <div>
        <h1>Agent Debugger Docs</h1>
        <p>Local-first failure debugging for AI agents. Evidence, hypotheses, reproduction, and handoff.</p>
      </div>
    </section>
    <img class="demo" src="assets/demo.gif" alt="Agent Debugger replaying a synthetic failed checkout trace" />
    <h2>Guides</h2>
    <div class="cards">
      ${cards}
    </div>
    <p>Everything described here runs on your machine. No account, no cloud, and no external AI service call.</p>`

  await writeFile(
    path.join(outDir, "index.html"),
    page({ title: "Home", body: indexBody, activeFile: "PRODUCT_BRIEF.md" }),
    "utf8",
  )

  for (const item of pages) {
    await writeFile(path.join(outDir, `${item.name}.html`), item.html, "utf8")
  }

  await writeFile(
    path.join(outDir, "README.md"),
    `# Generated docs site\n\nThis directory is generated by \`scripts/build-docs.mjs\` from the Markdown files in \`docs/\`.\n\nRun \`npm run build:docs\` after editing documentation. Do not edit the HTML files by hand.\n\nHost the directory as static files, or open \`index.html\` locally.\n`,
    "utf8",
  )

  console.log(`Generated ${pages.length + 1} pages in docs-site/`)
}

await main()
