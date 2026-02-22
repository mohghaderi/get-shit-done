<purpose>
Initialize a document-first research-paper workspace and draft section files using web evidence, citations, diagrams, and image references.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
Treat `references/scientific-rigor-checklist.md` as a hard quality gate.
</required_reading>

<process>

## 1. Setup

Run first:

```bash
INIT=$(node ~/.claude/get-paper-done/bin/papergen-tools.cjs init new-paper)
```

Parse JSON for: `researcher_model`, `synthesizer_model`, `commit_docs`, `paper_exists`, `has_git`, `paper_path`, `sections_dir`, `source_log_path`, `image_log_path`, `figures_dir`.

If `paper_exists` is true, ask user whether to extend existing paper or stop. Do not overwrite existing files without approval.

If `has_git` is false:

```bash
git init
```

## 2. Ask Scoping Questions

Use AskUserQuestion to capture:
- Paper type: literature review, survey, empirical analysis, technical position paper
- Target audience: academic, industry, policy, mixed
- Citation style: APA, IEEE, Chicago
- Time horizon: include only recent sources (e.g., last 3/5 years) or historical baseline
- Minimum source count for the first draft
- Publication target constraints: intended venue or format limits (word count, structure, citation style mandates)
- Evidence threshold: minimum peer-reviewed ratio and minimum high-quality-source ratio
- Rigor mode: standard review vs systematic-review style (with explicit inclusion/exclusion and quality appraisal)

Then ask inline for final topic framing in one sentence.

## 3. Scaffold Paper Workspace

Run:

```bash
node ~/.claude/get-paper-done/bin/papergen-tools.cjs paper init "$ARGUMENTS"
```

Read generated files under `paper/`.

## 4. Research Plan

Define section-specific search queries. For each section file in `paper/sections/`:
1. Run WebSearch with targeted, source-quality-focused queries.
2. Prefer primary sources (official docs, peer-reviewed publications, standards bodies, reputable institutions).
3. Record each source in `paper/sources/SOURCE-LOG.md` with a stable source ID.
4. Write section draft text as publication-ready narrative prose (not checklist bullets) with explicit in-text source IDs like `[SRC-03]`.
5. For standard sections, target 4-8 coherent paragraphs with clear transitions and argument flow.
6. Keep bullets minimal in manuscript sections (0-2 short bullets total per section unless structure requires a list).
7. Keep claim-to-source traceability in `Citation Coverage` tables and in `paper/data/EXTRACTION-SHEET.md` rather than dumping note blocks in the main narrative.
8. For each major finding, record at least one counterevidence source (or explicitly note none found) in `Citation Coverage` and extraction artifacts.
9. Assign source quality scores using `paper/methodology/QUALITY-APPRAISAL.md`.
10. Include tables and image embeds directly in section draft content where evidence is discussed.

If evidence quality is weak, run another search pass before writing assertions.

## 4.5 Method Rigor Artifacts

Fill these files before final synthesis:

- `paper/methodology/PROTOCOL.md` (objective, research questions, scope)
- `paper/methodology/INCLUSION-EXCLUSION.md` (screening criteria)
- `paper/methodology/QUALITY-APPRAISAL.md` (quality rubric + thresholds)
- `paper/methodology/BIAS-REGISTER.md` (selection/publication/measurement bias risks)
- `paper/data/EXTRACTION-SHEET.md` (question -> finding -> counterevidence mapping)
- `paper/reproducibility/REPRODUCIBILITY.md` (exact search strings, dates, re-run steps)
- `paper/ethics/ETHICS-STATEMENT.md` (ethics, conflicts, limitations disclosures)

## 5. Create Diagrams (PlantUML)

Create at least 2 diagrams in `paper/figures/`:
- `research-workflow.puml` (pipeline/method)
- `evidence-flow.puml` (source screening -> appraisal -> synthesis)
- One domain-specific diagram (concept map, system map, taxonomy, or timeline)

Reference the diagrams from relevant section markdown files and `paper/PAPER.md`.

## 6. Add Web Images With Provenance

Find candidate visual assets using WebSearch (e.g., authoritative datasets, institutional graphics, open-license repositories).

For each chosen image:
- Add markdown image embed in relevant section
- Record source page URL, direct image URL, license/usage notes, and access date in `paper/images/IMAGE-SOURCES.md`
- Avoid unlicensed or unclear-license assets

## 7. Assemble Draft Manuscript

Update `paper/PAPER.md` with:
- final publication order
- section-level links
- figure references
- explicit references location (`paper/sources/SOURCE-LOG.md`)

Before build, run publication checks:
- Each section contains narrative prose with paragraph structure (not sparse bullet-only output).
- Every table and image needed to understand claims appears inline in section content.
- Every `[SRC-##]` used in sections exists in `SOURCE-LOG.md`.
- Every research question has at least one evidence entry in `EXTRACTION-SHEET.md`.
- Claims flagged as uncertain are explicitly labeled in text.

Generate the single-file manuscript:

```bash
node scripts/gen-docs.js paper .tmp/paper.md
```

Optional PDF output:

```bash
node scripts/gen-docs.js paper .tmp/paper.md --pdf
```

Treat `.tmp/paper.md` (and optional `.tmp/paper.pdf`) as the publishable compiled artifact for handoff/review.

## 8. Commit Artifacts

If `commit_docs` is true:

```bash
node ~/.claude/get-paper-done/bin/papergen-tools.cjs commit "docs: initialize research paper workspace" --files paper/
```

## 9. Completion Output

Report:
- topic framing
- number of section files drafted
- number of sources logged
- number of counterevidence entries logged
- peer-reviewed/high-quality source ratios
- diagrams created
- images linked with provenance
- next command recommendation: continue refinement via `/papergen:quick`

</process>

<success_criteria>

- [ ] `paper/` workspace scaffolded
- [ ] Nested markdown section files created
- [ ] Each section contains draft content and evidence notes
- [ ] Source log populated with traceable IDs and URLs
- [ ] Method-rigor artifacts completed (protocol, criteria, quality, bias, extraction, reproducibility, ethics)
- [ ] PlantUML diagrams created under `paper/figures/`
- [ ] Image sources recorded with licensing/provenance notes
- [ ] `paper/PAPER.md` assembled and linked
- [ ] Section claims reconciled with source log IDs
- [ ] Single-file manuscript generated with `scripts/gen-docs.js`

</success_criteria>
