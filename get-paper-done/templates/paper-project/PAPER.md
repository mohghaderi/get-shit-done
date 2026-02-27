# Paper Template

Title: [Paper Title]

## Abstract

[Single narrative abstract (150-250 words) with source-backed claims and inline citations.]

## Contribution Statement

[What this paper adds beyond existing summaries]

## Manuscript Order

1. Introduction
2. Methods
3. Results
4. Discussion
5. Conclusion
6. References

## Writing Rules

- Main sections should read as narrative prose, not sparse bullets.
- Keep lists only where format requires them (for example limitations or contributions), and keep them short.
- Integrate figures and tables in the body where they are discussed.
- Every factual claim with external evidence must carry inline source IDs such as `[SRC-04]`.
- Every source ID used in text must exist in `paper/sources/SOURCE-LOG.md`.

## Scientific Rigor Artifacts

- Protocol: [paper/methodology/PROTOCOL.md](methodology/PROTOCOL.md)
- Inclusion/Exclusion: [paper/methodology/INCLUSION-EXCLUSION.md](methodology/INCLUSION-EXCLUSION.md)
- Quality Appraisal: [paper/methodology/QUALITY-APPRAISAL.md](methodology/QUALITY-APPRAISAL.md)
- Bias Register: [paper/methodology/BIAS-REGISTER.md](methodology/BIAS-REGISTER.md)
- Extraction Sheet: [paper/data/EXTRACTION-SHEET.md](data/EXTRACTION-SHEET.md)
- Reproducibility: [paper/reproducibility/REPRODUCIBILITY.md](reproducibility/REPRODUCIBILITY.md)
- Ethics: [paper/ethics/ETHICS-STATEMENT.md](ethics/ETHICS-STATEMENT.md)

## Publication Assembly Notes

- Final manuscript must be a single Markdown or PDF file.
- Keep tables and image embeds inline in section drafts so they appear in final assembly.
- Every in-text source ID must resolve to `paper/sources/SOURCE-LOG.md`.
- Use `node ~/.claude/scripts/gen-docs.js paper .tmp/paper.md` to build a single Markdown manuscript.
- Use `node ~/.claude/scripts/gen-docs.js paper .tmp/paper.md --pdf` to build a PDF from that manuscript.
