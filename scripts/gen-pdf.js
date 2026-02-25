/*
Generate a PDF file from a Markdown file using pandoc.

Module usage:
  const { convertMarkdownToPdf } = require("./gen-pdf")
  convertMarkdownToPdf("paper.md", "paper.pdf")

CLI usage:
  node scripts/gen-pdf.js <input.md> [output.pdf]
*/

const path = require("path")
const cp = require("child_process")
const fs = require("fs")
const os = require("os")

function convertMarkdownToPdf(markdownFile, pdfFile) {
  const inputFile = path.resolve(markdownFile)
  const outputFile = path.resolve(pdfFile || inputFile.replace(/\.md$/i, ".pdf"))

  // Try Unicode-capable engines first. pdflatex remains as final fallback.
  const engines = ["xelatex", "lualatex", "pdflatex"]

  let lastError = null
  for (const engine of engines) {
    const attempt = runPandoc(inputFile, outputFile, engine)
    if (attempt.ok) {
      return outputFile
    }
    lastError = attempt
  }

  // If conversion failed, sanitize Unicode and retry.
  const original = fs.readFileSync(inputFile, "utf8")
  const sanitized = sanitizeMarkdownForLatex(original)
  if (sanitized !== original) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gpd-pdf-"))
    const tempInput = path.join(tempDir, path.basename(inputFile))
    fs.writeFileSync(tempInput, sanitized, "utf8")

    for (const engine of engines) {
      const attempt = runPandoc(tempInput, outputFile, engine)
      if (attempt.ok) {
        return outputFile
      }
      lastError = attempt
    }
  }

  const details = lastError && (lastError.stderr || lastError.stdout)
    ? `\n\nPandoc/LaTeX output:\n${(lastError.stderr || lastError.stdout).trim()}`
    : ""
  throw new Error(
    "Failed to generate PDF after Unicode-safe retries. Ensure pandoc and a LaTeX engine are installed." + details
  )
}

function runPandoc(inputFile, outputFile, pdfEngine) {
  const args = [
    inputFile,
    "--from", "markdown",
    "--to", "pdf",
    "--pdf-engine", pdfEngine,
    "--output", outputFile
  ]

  const pandoc = cp.spawnSync("pandoc", args, {
    shell: true,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  })

  return {
    ok: pandoc.status === 0,
    status: pandoc.status,
    engine: pdfEngine,
    stdout: pandoc.stdout || "",
    stderr: pandoc.stderr || ""
  }
}

function sanitizeMarkdownForLatex(markdown) {
  const replacementMap = new Map([
    ["\u00a0", " "],   // no-break space
    ["\u2009", " "],   // thin space
    ["\u200b", ""],    // zero-width space
    ["\u200c", ""],
    ["\u200d", ""],
    ["\ufeff", ""],    // BOM
    ["\u2013", "-"],   // en dash
    ["\u2014", "--"],  // em dash
    ["\u2018", "'"],
    ["\u2019", "'"],
    ["\u201c", "\""],
    ["\u201d", "\""],
    ["\u2026", "..."],
    ["\u2192", "->"],
    ["\u2190", "<-"],
    ["\u2265", ">="],
    ["\u2264", "<="],
    ["\u2260", "!="],
    ["\u2248", "~"],
    ["\u00b1", "+/-"],
    ["\u00d7", "x"],
    ["\u00f7", "/"],

    // common mojibake sequences seen in UTF-8/Latin-1 mixups
    ["â‰¥", ">="],
    ["â‰¤", "<="],
    ["â‰ ", "!="],
    ["â†’", "->"],
    ["â†�", "<-"],
    ["â€“", "-"],
    ["â€”", "--"],
    ["â€˜", "'"],
    ["â€™", "'"],
    ["â€œ", "\""],
    ["â€�", "\""],
    ["â€¦", "..."],
    ["Î±", "alpha"],
    ["Î²", "beta"],
    ["Î³", "gamma"],
    ["Î¼", "mu"],

    // observed corrupted form for >= from user report
    ["ΓëÑ", ">="]
  ])

  let result = markdown.normalize("NFKC")
  for (const [from, to] of replacementMap.entries()) {
    result = result.split(from).join(to)
  }

  // Remove remaining non-printable control chars except newline/tab/carriage return.
  result = result.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")

  return result
}

function parseCliArgs(argv) {
  const input = argv[0]
  const output = argv[1]
  if (!input) {
    throw new Error("Usage: node scripts/gen-pdf.js <input.md> [output.pdf]")
  }
  return {
    input: path.resolve(input),
    output: output ? path.resolve(output) : undefined
  }
}

if (require.main === module) {
  try {
    const args = parseCliArgs(process.argv.slice(2))
    const generatedFile = convertMarkdownToPdf(args.input, args.output)
    console.log(`Wrote PDF file to: ${generatedFile}`)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}

module.exports = {
  convertMarkdownToPdf
}

