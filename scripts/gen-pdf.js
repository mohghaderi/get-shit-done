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

function convertMarkdownToPdf(markdownFile, pdfFile) {
  const inputFile = path.resolve(markdownFile)
  const outputFile = path.resolve(pdfFile || inputFile.replace(/\.md$/i, ".pdf"))
  const pandoc = cp.spawnSync("pandoc", [inputFile, "--from", "markdown", "--to", "pdf", "--output", outputFile], {
    stdio: "inherit",
    shell: true
  })

  if (pandoc.status !== 0) {
    throw new Error("Failed to generate PDF. Ensure pandoc and a LaTeX engine are installed.")
  }

  return outputFile
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

