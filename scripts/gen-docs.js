/*
Concatenate Markdown files from a folder (default: current working directory)
into a single Markdown file with depth-based section titles.

Usage:
  node scripts/gen-docs.js [inputDir] [outputFile] [--pdf]

Examples:
  node scripts/gen-docs.js
  node scripts/gen-docs.js ./docs ./dist/paper.md
  node scripts/gen-docs.js ./docs ./dist/paper.md --pdf
*/

const fs = require("fs")
const path = require("path")
const { convertMarkdownToPdf } = require("./gen-pdf")

const cli = parseArgs(process.argv.slice(2))
const inputDir = path.resolve(cli.inputDir || process.cwd())
const outputFile = path.resolve(cli.outputFile || path.join(process.cwd(), "paper.md"))
const shouldGeneratePdf = cli.generatePdf

const IGNORE_DIRS = new Set([".git", "node_modules", "dist", "build", ".quasar"])
const MD_EXTENSION = ".md"

main()

function main() {
  if (!fs.existsSync(inputDir)) {
    fail(`Input directory does not exist: ${inputDir}`)
  }
  if (!fs.statSync(inputDir).isDirectory()) {
    fail(`Input path is not a directory: ${inputDir}`)
  }

  const mdFiles = collectMarkdownFiles(inputDir)
    .filter((file) => path.resolve(file) !== outputFile)
    .sort(comparePaths)

  if (mdFiles.length === 0) {
    fail(`No Markdown files found under: ${inputDir}`)
  }

  const outputDir = path.dirname(outputFile)
  fs.mkdirSync(outputDir, { recursive: true })

  const blocks = []
  for (const filePath of mdFiles) {
    const relFromRoot = path.relative(inputDir, filePath)
    const relPathPosix = normalizeToPosix(relFromRoot)
    const sectionTitle = titleFromPath(relFromRoot)
    const folderDepth = folderDepthFromRoot(relFromRoot)
    const sectionHeading = formatHeading(sectionTitle, folderDepth)
    const content = fs.readFileSync(filePath, "utf8")
    const normalized = normalizeMarkdownLinks(content, filePath, outputFile)
    blocks.push(
      `${sectionHeading}\n\n<!------ Begin ${relPathPosix} ------>\n${normalized.trimEnd()}\n<!------ End ${relPathPosix} ------>`
    )
  }

  fs.writeFileSync(outputFile, `${blocks.join("\n\n")}\n`, "utf8")
  console.log(`Wrote ${mdFiles.length} Markdown files to: ${outputFile}`)

  if (shouldGeneratePdf) {
    const pdfFile = outputFile.replace(/\.md$/i, ".pdf")
    try {
      convertMarkdownToPdf(outputFile, pdfFile)
    } catch (error) {
      fail(error.message)
    }
    console.log(`Wrote PDF file to: ${pdfFile}`)
  }
}

function collectMarkdownFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) {
        continue
      }
      files.push(...collectMarkdownFiles(fullPath))
      continue
    }
    if (entry.isFile() && path.extname(entry.name).toLowerCase() === MD_EXTENSION) {
      files.push(fullPath)
    }
  }

  return files
}

function folderDepthFromRoot(relativeFilePath) {
  const normalized = normalizeToPosix(relativeFilePath)
  const parts = normalized.split("/").filter(Boolean)
  return Math.max(0, parts.length - 1)
}

function titleFromPath(relativeFilePath) {
  const withoutExt = relativeFilePath.replace(/\.[^.]+$/, "")
  const normalized = normalizeToPosix(withoutExt)
  const parts = normalized.split("/").filter(Boolean)
  return parts.join(" / ")
}

function formatHeading(title, folderDepth) {
  // Root files => H1, first subfolder => H2, etc.
  // After H4, keep bold-only titles.
  const headingLevel = folderDepth + 1
  if (headingLevel <= 4) {
    return `${"#".repeat(headingLevel)} ${title}`
  }
  return `**${title}**`
}

function normalizeMarkdownLinks(markdown, sourceFilePath, targetOutputFilePath) {
  let result = markdown
  result = normalizeInlineLinks(result, sourceFilePath, targetOutputFilePath)
  result = normalizeReferenceLinks(result, sourceFilePath, targetOutputFilePath)
  return result
}

function normalizeInlineLinks(markdown, sourceFilePath, targetOutputFilePath) {
  const inlineLinkRegex = /(!?\[[^\]]*])\(([^)\s]+)(\s+"[^"]*")?\)/g
  return markdown.replace(inlineLinkRegex, (match, label, rawUrl, titlePart = "") => {
    const fixedUrl = rewriteRelativeUrl(rawUrl, sourceFilePath, targetOutputFilePath)
    return `${label}(${fixedUrl}${titlePart})`
  })
}

function normalizeReferenceLinks(markdown, sourceFilePath, targetOutputFilePath) {
  const refLinkRegex = /^(\s*\[[^\]]+]:\s*)(\S+)(\s+.*)?$/gm
  return markdown.replace(refLinkRegex, (match, prefix, rawUrl, suffix = "") => {
    const fixedUrl = rewriteRelativeUrl(rawUrl, sourceFilePath, targetOutputFilePath)
    return `${prefix}${fixedUrl}${suffix}`
  })
}

function rewriteRelativeUrl(rawUrl, sourceFilePath, targetOutputFilePath) {
  if (!rawUrl || isExternalOrAnchor(rawUrl)) {
    return rawUrl
  }

  // Keep angle-bracket notation if used.
  const wrappedInAngleBrackets = rawUrl.startsWith("<") && rawUrl.endsWith(">")
  const unwrapped = wrappedInAngleBrackets ? rawUrl.slice(1, -1) : rawUrl

  const hashIndex = unwrapped.indexOf("#")
  const queryIndex = unwrapped.indexOf("?")
  const splitIndex = minPositive(hashIndex, queryIndex)
  const basePart = splitIndex === -1 ? unwrapped : unwrapped.slice(0, splitIndex)
  const suffix = splitIndex === -1 ? "" : unwrapped.slice(splitIndex)

  if (!basePart || path.isAbsolute(basePart)) {
    return rawUrl
  }

  const sourceDir = path.dirname(sourceFilePath)
  const outputDir = path.dirname(targetOutputFilePath)
  const absoluteTarget = path.resolve(sourceDir, basePart)
  let relativeFromOutput = path.relative(outputDir, absoluteTarget)
  relativeFromOutput = normalizeToPosix(relativeFromOutput || ".")
  const rebuilt = `${relativeFromOutput}${suffix}`
  return wrappedInAngleBrackets ? `<${rebuilt}>` : rebuilt
}

function isExternalOrAnchor(url) {
  return /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|#|\/\/)/.test(url)
}

function comparePaths(a, b) {
  return normalizeToPosix(a).localeCompare(normalizeToPosix(b))
}

function normalizeToPosix(input) {
  return input.split(path.sep).join("/")
}

function minPositive(a, b) {
  if (a === -1) return b
  if (b === -1) return a
  return Math.min(a, b)
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function parseArgs(argv) {
  let inputArg = null
  let outputArg = null
  let generatePdf = false

  for (const arg of argv) {
    if (arg === "--pdf") {
      generatePdf = true
      continue
    }
    if (arg.startsWith("--")) {
      fail(`Unknown option: ${arg}`)
    }
    if (!inputArg) {
      inputArg = arg
      continue
    }
    if (!outputArg) {
      outputArg = arg
      continue
    }
    fail(`Unexpected argument: ${arg}`)
  }

  return {
    inputDir: inputArg,
    outputFile: outputArg,
    generatePdf
  }
}
