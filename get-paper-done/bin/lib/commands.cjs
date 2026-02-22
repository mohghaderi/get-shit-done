/**
 * Commands — Standalone utility commands
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { safeReadFile, loadConfig, isGitIgnored, execGit, normalizePhaseName, getArchivedPhaseDirs, generateSlugInternal, getMilestoneInfo, resolveModelInternal, MODEL_PROFILES, output, error, findPhaseInternal } = require('./core.cjs');
const { extractFrontmatter } = require('./frontmatter.cjs');

function cmdGenerateSlug(text, raw) {
  if (!text) {
    error('text required for slug generation');
  }

  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const result = { slug };
  output(result, raw, slug);
}

function cmdCurrentTimestamp(format, raw) {
  const now = new Date();
  let result;

  switch (format) {
    case 'date':
      result = now.toISOString().split('T')[0];
      break;
    case 'filename':
      result = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
      break;
    case 'full':
    default:
      result = now.toISOString();
      break;
  }

  output({ timestamp: result }, raw, result);
}

function cmdListTodos(cwd, area, raw) {
  const pendingDir = path.join(cwd, '.planning', 'todos', 'pending');

  let count = 0;
  const todos = [];

  try {
    const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(pendingDir, file), 'utf-8');
        const createdMatch = content.match(/^created:\s*(.+)$/m);
        const titleMatch = content.match(/^title:\s*(.+)$/m);
        const areaMatch = content.match(/^area:\s*(.+)$/m);

        const todoArea = areaMatch ? areaMatch[1].trim() : 'general';

        // Apply area filter if specified
        if (area && todoArea !== area) continue;

        count++;
        todos.push({
          file,
          created: createdMatch ? createdMatch[1].trim() : 'unknown',
          title: titleMatch ? titleMatch[1].trim() : 'Untitled',
          area: todoArea,
          path: path.join('.planning', 'todos', 'pending', file),
        });
      } catch {}
    }
  } catch {}

  const result = { count, todos };
  output(result, raw, count.toString());
}

function cmdVerifyPathExists(cwd, targetPath, raw) {
  if (!targetPath) {
    error('path required for verification');
  }

  const fullPath = path.isAbsolute(targetPath) ? targetPath : path.join(cwd, targetPath);

  try {
    const stats = fs.statSync(fullPath);
    const type = stats.isDirectory() ? 'directory' : stats.isFile() ? 'file' : 'other';
    const result = { exists: true, type };
    output(result, raw, 'true');
  } catch {
    const result = { exists: false, type: null };
    output(result, raw, 'false');
  }
}

function cmdHistoryDigest(cwd, raw) {
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const digest = { phases: {}, decisions: [], tech_stack: new Set() };

  // Collect all phase directories: archived + current
  const allPhaseDirs = [];

  // Add archived phases first (oldest milestones first)
  const archived = getArchivedPhaseDirs(cwd);
  for (const a of archived) {
    allPhaseDirs.push({ name: a.name, fullPath: a.fullPath, milestone: a.milestone });
  }

  // Add current phases
  if (fs.existsSync(phasesDir)) {
    try {
      const currentDirs = fs.readdirSync(phasesDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .sort();
      for (const dir of currentDirs) {
        allPhaseDirs.push({ name: dir, fullPath: path.join(phasesDir, dir), milestone: null });
      }
    } catch {}
  }

  if (allPhaseDirs.length === 0) {
    digest.tech_stack = [];
    output(digest, raw);
    return;
  }

  try {
    for (const { name: dir, fullPath: dirPath } of allPhaseDirs) {
      const summaries = fs.readdirSync(dirPath).filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');

      for (const summary of summaries) {
        try {
          const content = fs.readFileSync(path.join(dirPath, summary), 'utf-8');
          const fm = extractFrontmatter(content);

          const phaseNum = fm.phase || dir.split('-')[0];

          if (!digest.phases[phaseNum]) {
            digest.phases[phaseNum] = {
              name: fm.name || dir.split('-').slice(1).join(' ') || 'Unknown',
              provides: new Set(),
              affects: new Set(),
              patterns: new Set(),
            };
          }

          // Merge provides
          if (fm['dependency-graph'] && fm['dependency-graph'].provides) {
            fm['dependency-graph'].provides.forEach(p => digest.phases[phaseNum].provides.add(p));
          } else if (fm.provides) {
            fm.provides.forEach(p => digest.phases[phaseNum].provides.add(p));
          }

          // Merge affects
          if (fm['dependency-graph'] && fm['dependency-graph'].affects) {
            fm['dependency-graph'].affects.forEach(a => digest.phases[phaseNum].affects.add(a));
          }

          // Merge patterns
          if (fm['patterns-established']) {
            fm['patterns-established'].forEach(p => digest.phases[phaseNum].patterns.add(p));
          }

          // Merge decisions
          if (fm['key-decisions']) {
            fm['key-decisions'].forEach(d => {
              digest.decisions.push({ phase: phaseNum, decision: d });
            });
          }

          // Merge tech stack
          if (fm['tech-stack'] && fm['tech-stack'].added) {
            fm['tech-stack'].added.forEach(t => digest.tech_stack.add(typeof t === 'string' ? t : t.name));
          }

        } catch (e) {
          // Skip malformed summaries
        }
      }
    }

    // Convert Sets to Arrays for JSON output
    Object.keys(digest.phases).forEach(p => {
      digest.phases[p].provides = [...digest.phases[p].provides];
      digest.phases[p].affects = [...digest.phases[p].affects];
      digest.phases[p].patterns = [...digest.phases[p].patterns];
    });
    digest.tech_stack = [...digest.tech_stack];

    output(digest, raw);
  } catch (e) {
    error('Failed to generate history digest: ' + e.message);
  }
}

function cmdResolveModel(cwd, agentType, raw) {
  if (!agentType) {
    error('agent-type required');
  }

  const config = loadConfig(cwd);
  const profile = config.model_profile || 'balanced';

  const agentModels = MODEL_PROFILES[agentType];
  if (!agentModels) {
    const result = { model: 'sonnet', profile, unknown_agent: true };
    output(result, raw, 'sonnet');
    return;
  }

  const resolved = agentModels[profile] || agentModels['balanced'] || 'sonnet';
  const model = resolved === 'opus' ? 'inherit' : resolved;
  const result = { model, profile };
  output(result, raw, model);
}

function cmdCommit(cwd, message, files, raw, amend) {
  if (!message && !amend) {
    error('commit message required');
  }

  const config = loadConfig(cwd);

  // Check commit_docs config
  if (!config.commit_docs) {
    const result = { committed: false, hash: null, reason: 'skipped_commit_docs_false' };
    output(result, raw, 'skipped');
    return;
  }

  // Check if .planning is gitignored
  if (isGitIgnored(cwd, '.planning')) {
    const result = { committed: false, hash: null, reason: 'skipped_gitignored' };
    output(result, raw, 'skipped');
    return;
  }

  // Stage files
  const filesToStage = files && files.length > 0 ? files : ['.planning/'];
  for (const file of filesToStage) {
    execGit(cwd, ['add', file]);
  }

  // Commit
  const commitArgs = amend ? ['commit', '--amend', '--no-edit'] : ['commit', '-m', message];
  const commitResult = execGit(cwd, commitArgs);
  if (commitResult.exitCode !== 0) {
    if (commitResult.stdout.includes('nothing to commit') || commitResult.stderr.includes('nothing to commit')) {
      const result = { committed: false, hash: null, reason: 'nothing_to_commit' };
      output(result, raw, 'nothing');
      return;
    }
    const result = { committed: false, hash: null, reason: 'nothing_to_commit', error: commitResult.stderr };
    output(result, raw, 'nothing');
    return;
  }

  // Get short hash
  const hashResult = execGit(cwd, ['rev-parse', '--short', 'HEAD']);
  const hash = hashResult.exitCode === 0 ? hashResult.stdout : null;
  const result = { committed: true, hash, reason: 'committed' };
  output(result, raw, hash || 'committed');
}

function cmdSummaryExtract(cwd, summaryPath, fields, raw) {
  if (!summaryPath) {
    error('summary-path required for summary-extract');
  }

  const fullPath = path.join(cwd, summaryPath);

  if (!fs.existsSync(fullPath)) {
    output({ error: 'File not found', path: summaryPath }, raw);
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const fm = extractFrontmatter(content);

  // Parse key-decisions into structured format
  const parseDecisions = (decisionsList) => {
    if (!decisionsList || !Array.isArray(decisionsList)) return [];
    return decisionsList.map(d => {
      const colonIdx = d.indexOf(':');
      if (colonIdx > 0) {
        return {
          summary: d.substring(0, colonIdx).trim(),
          rationale: d.substring(colonIdx + 1).trim(),
        };
      }
      return { summary: d, rationale: null };
    });
  };

  // Build full result
  const fullResult = {
    path: summaryPath,
    one_liner: fm['one-liner'] || null,
    key_files: fm['key-files'] || [],
    tech_added: (fm['tech-stack'] && fm['tech-stack'].added) || [],
    patterns: fm['patterns-established'] || [],
    decisions: parseDecisions(fm['key-decisions']),
  };

  // If fields specified, filter to only those fields
  if (fields && fields.length > 0) {
    const filtered = { path: summaryPath };
    for (const field of fields) {
      if (fullResult[field] !== undefined) {
        filtered[field] = fullResult[field];
      }
    }
    output(filtered, raw);
    return;
  }

  output(fullResult, raw);
}

async function cmdWebsearch(query, options, raw) {
  const apiKey = process.env.BRAVE_API_KEY;

  if (!apiKey) {
    // No key = silent skip, agent falls back to built-in WebSearch
    output({ available: false, reason: 'BRAVE_API_KEY not set' }, raw, '');
    return;
  }

  if (!query) {
    output({ available: false, error: 'Query required' }, raw, '');
    return;
  }

  const params = new URLSearchParams({
    q: query,
    count: String(options.limit || 10),
    country: 'us',
    search_lang: 'en',
    text_decorations: 'false'
  });

  if (options.freshness) {
    params.set('freshness', options.freshness);
  }

  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?${params}`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': apiKey
        }
      }
    );

    if (!response.ok) {
      output({ available: false, error: `API error: ${response.status}` }, raw, '');
      return;
    }

    const data = await response.json();

    const results = (data.web?.results || []).map(r => ({
      title: r.title,
      url: r.url,
      description: r.description,
      age: r.age || null
    }));

    output({
      available: true,
      query,
      count: results.length,
      results
    }, raw, results.map(r => `${r.title}\n${r.url}\n${r.description}`).join('\n\n'));
  } catch (err) {
    output({ available: false, error: err.message }, raw, '');
  }
}

function cmdProgressRender(cwd, format, raw) {
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const milestone = getMilestoneInfo(cwd);

  const phases = [];
  let totalPlans = 0;
  let totalSummaries = 0;

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort((a, b) => {
      const aNum = parseFloat(a.match(/^(\d+(?:\.\d+)?)/)?.[1] || '0');
      const bNum = parseFloat(b.match(/^(\d+(?:\.\d+)?)/)?.[1] || '0');
      return aNum - bNum;
    });

    for (const dir of dirs) {
      const dm = dir.match(/^(\d+(?:\.\d+)?)-?(.*)/);
      const phaseNum = dm ? dm[1] : dir;
      const phaseName = dm && dm[2] ? dm[2].replace(/-/g, ' ') : '';
      const phaseFiles = fs.readdirSync(path.join(phasesDir, dir));
      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').length;
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').length;

      totalPlans += plans;
      totalSummaries += summaries;

      let status;
      if (plans === 0) status = 'Pending';
      else if (summaries >= plans) status = 'Complete';
      else if (summaries > 0) status = 'In Progress';
      else status = 'Planned';

      phases.push({ number: phaseNum, name: phaseName, plans, summaries, status });
    }
  } catch {}

  const percent = totalPlans > 0 ? Math.round((totalSummaries / totalPlans) * 100) : 0;

  if (format === 'table') {
    // Render markdown table
    const barWidth = 10;
    const filled = Math.round((percent / 100) * barWidth);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
    let out = `# ${milestone.version} ${milestone.name}\n\n`;
    out += `**Progress:** [${bar}] ${totalSummaries}/${totalPlans} plans (${percent}%)\n\n`;
    out += `| Phase | Name | Plans | Status |\n`;
    out += `|-------|------|-------|--------|\n`;
    for (const p of phases) {
      out += `| ${p.number} | ${p.name} | ${p.summaries}/${p.plans} | ${p.status} |\n`;
    }
    output({ rendered: out }, raw, out);
  } else if (format === 'bar') {
    const barWidth = 20;
    const filled = Math.round((percent / 100) * barWidth);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
    const text = `[${bar}] ${totalSummaries}/${totalPlans} plans (${percent}%)`;
    output({ bar: text, percent, completed: totalSummaries, total: totalPlans }, raw, text);
  } else {
    // JSON format
    output({
      milestone_version: milestone.version,
      milestone_name: milestone.name,
      phases,
      total_plans: totalPlans,
      total_summaries: totalSummaries,
      percent,
    }, raw);
  }
}

function cmdTodoComplete(cwd, filename, raw) {
  if (!filename) {
    error('filename required for todo complete');
  }

  const pendingDir = path.join(cwd, '.planning', 'todos', 'pending');
  const completedDir = path.join(cwd, '.planning', 'todos', 'completed');
  const sourcePath = path.join(pendingDir, filename);

  if (!fs.existsSync(sourcePath)) {
    error(`Todo not found: ${filename}`);
  }

  // Ensure completed directory exists
  fs.mkdirSync(completedDir, { recursive: true });

  // Read, add completion timestamp, move
  let content = fs.readFileSync(sourcePath, 'utf-8');
  const today = new Date().toISOString().split('T')[0];
  content = `completed: ${today}\n` + content;

  fs.writeFileSync(path.join(completedDir, filename), content, 'utf-8');
  fs.unlinkSync(sourcePath);

  output({ completed: true, file: filename, date: today }, raw, 'completed');
}

function cmdScaffold(cwd, type, options, raw) {
  const { phase, name } = options;
  const padded = phase ? normalizePhaseName(phase) : '00';
  const today = new Date().toISOString().split('T')[0];

  // Find phase directory
  const phaseInfo = phase ? findPhaseInternal(cwd, phase) : null;
  const phaseDir = phaseInfo ? path.join(cwd, phaseInfo.directory) : null;

  if (phase && !phaseDir && type !== 'phase-dir') {
    error(`Phase ${phase} directory not found`);
  }

  let filePath, content;

  switch (type) {
    case 'context': {
      filePath = path.join(phaseDir, `${padded}-CONTEXT.md`);
      content = `---\nphase: "${padded}"\nname: "${name || phaseInfo?.phase_name || 'Unnamed'}"\ncreated: ${today}\n---\n\n# Phase ${phase}: ${name || phaseInfo?.phase_name || 'Unnamed'} — Context\n\n## Decisions\n\n_Decisions will be captured during /papergen:discuss-phase ${phase}_\n\n## Discretion Areas\n\n_Areas where the executor can use judgment_\n\n## Deferred Ideas\n\n_Ideas to consider later_\n`;
      break;
    }
    case 'uat': {
      filePath = path.join(phaseDir, `${padded}-UAT.md`);
      content = `---\nphase: "${padded}"\nname: "${name || phaseInfo?.phase_name || 'Unnamed'}"\ncreated: ${today}\nstatus: pending\n---\n\n# Phase ${phase}: ${name || phaseInfo?.phase_name || 'Unnamed'} — User Acceptance Testing\n\n## Test Results\n\n| # | Test | Status | Notes |\n|---|------|--------|-------|\n\n## Summary\n\n_Pending UAT_\n`;
      break;
    }
    case 'verification': {
      filePath = path.join(phaseDir, `${padded}-VERIFICATION.md`);
      content = `---\nphase: "${padded}"\nname: "${name || phaseInfo?.phase_name || 'Unnamed'}"\ncreated: ${today}\nstatus: pending\n---\n\n# Phase ${phase}: ${name || phaseInfo?.phase_name || 'Unnamed'} — Verification\n\n## Goal-Backward Verification\n\n**Phase Goal:** [From ROADMAP.md]\n\n## Checks\n\n| # | Requirement | Status | Evidence |\n|---|------------|--------|----------|\n\n## Result\n\n_Pending verification_\n`;
      break;
    }
    case 'phase-dir': {
      if (!phase || !name) {
        error('phase and name required for phase-dir scaffold');
      }
      const slug = generateSlugInternal(name);
      const dirName = `${padded}-${slug}`;
      const phasesParent = path.join(cwd, '.planning', 'phases');
      fs.mkdirSync(phasesParent, { recursive: true });
      const dirPath = path.join(phasesParent, dirName);
      fs.mkdirSync(dirPath, { recursive: true });
      output({ created: true, directory: `.planning/phases/${dirName}`, path: dirPath }, raw, dirPath);
      return;
    }
    default:
      error(`Unknown scaffold type: ${type}. Available: context, uat, verification, phase-dir`);
  }

  if (fs.existsSync(filePath)) {
    output({ created: false, reason: 'already_exists', path: filePath }, raw, 'exists');
    return;
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  const relPath = path.relative(cwd, filePath);
  output({ created: true, path: relPath }, raw, relPath);
}

function cmdPaperInit(cwd, topic, raw) {
  if (!topic || !topic.trim()) {
    error('topic required for paper init');
  }

  const today = new Date().toISOString().split('T')[0];
  const paperRoot = path.join(cwd, 'paper');
  const sectionsRoot = path.join(paperRoot, 'sections');
  const sourcesRoot = path.join(paperRoot, 'sources');
  const figuresRoot = path.join(paperRoot, 'figures');
  const imagesRoot = path.join(paperRoot, 'images');
  const methodologyRoot = path.join(paperRoot, 'methodology');
  const dataRoot = path.join(paperRoot, 'data');
  const reproducibilityRoot = path.join(paperRoot, 'reproducibility');
  const ethicsRoot = path.join(paperRoot, 'ethics');
  const appendixRoot = path.join(paperRoot, 'appendix');

  const created = [];
  const skipped = [];
  const toRel = (filePath) => path.relative(cwd, filePath).replace(/\\/g, '/');

  const writeIfMissing = (filePath, content) => {
    if (fs.existsSync(filePath)) {
      skipped.push(toRel(filePath));
      return;
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    created.push(toRel(filePath));
  };

  fs.mkdirSync(sectionsRoot, { recursive: true });
  fs.mkdirSync(sourcesRoot, { recursive: true });
  fs.mkdirSync(figuresRoot, { recursive: true });
  fs.mkdirSync(imagesRoot, { recursive: true });
  fs.mkdirSync(methodologyRoot, { recursive: true });
  fs.mkdirSync(dataRoot, { recursive: true });
  fs.mkdirSync(reproducibilityRoot, { recursive: true });
  fs.mkdirSync(ethicsRoot, { recursive: true });
  fs.mkdirSync(appendixRoot, { recursive: true });

  writeIfMissing(
    path.join(paperRoot, 'README.md'),
    `# Research Paper Workspace\n\nTopic: ${topic.trim()}\n\nGenerated: ${today}\n\n## Structure\n\n- \`paper/PAPER.md\`: Main manuscript entry point\n- \`paper/sections/\`: Nested section files\n- \`paper/sources/SOURCE-LOG.md\`: Citation/source ledger\n- \`paper/figures/\`: PlantUML diagrams\n- \`paper/images/IMAGE-SOURCES.md\`: External image tracking\n- \`paper/methodology/\`: Protocol, selection criteria, bias and quality appraisal\n- \`paper/data/\`: Extraction tables and evidence matrix\n- \`paper/reproducibility/\`: Search strings, run logs, reproducibility notes\n- \`paper/ethics/\`: Ethical considerations and disclosure\n`
  );

  writeIfMissing(
    path.join(paperRoot, 'PAPER.md'),
    `# ${topic.trim()}\n\n> Manuscript assembly entrypoint. Write section drafts as publication-ready prose with inline citations.\n\n## Abstract\n\nSee: [sections/01-front-matter/01-abstract.md](sections/01-front-matter/01-abstract.md)\n\n## Manuscript Order\n\n1. [Introduction](sections/02-introduction/01-background.md)\n2. [Methods](sections/03-methods/01-study-design.md)\n3. [Results](sections/04-results/01-main-findings.md)\n4. [Discussion](sections/05-discussion/01-interpretation.md)\n5. [Conclusion](sections/06-conclusion/01-conclusion.md)\n6. References (from [sources/SOURCE-LOG.md](sources/SOURCE-LOG.md))\n\n## Publication Build\n\n- Single Markdown: \`node scripts/gen-docs.js paper .tmp/paper.md\`\n- Single PDF: \`node scripts/gen-docs.js paper .tmp/paper.md --pdf\`\n\n## Research Rigor Artifacts\n\n- [Protocol](methodology/PROTOCOL.md)\n- [Inclusion and Exclusion Criteria](methodology/INCLUSION-EXCLUSION.md)\n- [Quality Appraisal](methodology/QUALITY-APPRAISAL.md)\n- [Bias Register](methodology/BIAS-REGISTER.md)\n- [Evidence Extraction Sheet](data/EXTRACTION-SHEET.md)\n- [Reproducibility Notes](reproducibility/REPRODUCIBILITY.md)\n- [Ethics Statement](ethics/ETHICS-STATEMENT.md)\n\n## Figures\n\n- [Research Workflow](figures/research-workflow.puml)\n- [Evidence Flow](figures/evidence-flow.puml)\n`
  );

  writeIfMissing(
    path.join(sourcesRoot, 'SOURCE-LOG.md'),
    `# Source Log\n\n| ID | Claim/Use | Source | Source Type | URL/DOI | Published | Accessed | Quality Score (1-5) | Confidence |\n|----|-----------|--------|-------------|---------|-----------|----------|---------------------|------------|\n`
  );

  writeIfMissing(
    path.join(imagesRoot, 'IMAGE-SOURCES.md'),
    `# Image Sources\n\n| Figure | Purpose | Source Page | Direct Image URL | License | Accessed |\n|--------|---------|-------------|------------------|---------|----------|\n`
  );

  writeIfMissing(
    path.join(methodologyRoot, 'PROTOCOL.md'),
    `# Research Protocol\n\n## Objective\n\n- Primary objective:\n- Secondary objectives:\n\n## Research Questions\n\n1. \n2. \n\n## Scope\n\n- Domain boundaries:\n- Population/context:\n- Time window:\n\n## Planned Outputs\n\n- Sections to produce:\n- Figures to include:\n- Evidence artifacts to maintain:\n`
  );

  writeIfMissing(
    path.join(methodologyRoot, 'INCLUSION-EXCLUSION.md'),
    `# Inclusion and Exclusion Criteria\n\n## Inclusion Criteria\n\n- \n\n## Exclusion Criteria\n\n- \n\n## Screening Workflow\n\n- Title/abstract screening:\n- Full-text screening:\n- Tie-break process:\n`
  );

  writeIfMissing(
    path.join(methodologyRoot, 'QUALITY-APPRAISAL.md'),
    `# Quality Appraisal Framework\n\n## Rubric\n\n| Criterion | Description | Score Range |\n|----------|-------------|-------------|\n| Methodological clarity | Is method clearly described? | 1-5 |\n| Evidence strength | Are claims supported by robust evidence? | 1-5 |\n| Recency/relevance | Is source current and in-scope? | 1-5 |\n| Replicability | Could another researcher reproduce process? | 1-5 |\n\n## Thresholds\n\n- High quality:\n- Medium quality:\n- Low quality:\n`
  );

  writeIfMissing(
    path.join(methodologyRoot, 'BIAS-REGISTER.md'),
    `# Bias Register\n\n| Bias Risk | Where Observed | Impact | Mitigation | Status |\n|----------|----------------|--------|------------|--------|\n`
  );

  writeIfMissing(
    path.join(dataRoot, 'EXTRACTION-SHEET.md'),
    `# Evidence Extraction Sheet\n\n| Source ID | Research Question | Key Finding | Counterevidence | Effect/Direction | Notes |\n|-----------|-------------------|-------------|-----------------|------------------|-------|\n`
  );

  writeIfMissing(
    path.join(reproducibilityRoot, 'REPRODUCIBILITY.md'),
    `# Reproducibility Notes\n\n## Search Queries Used\n\n- \n\n## Databases/Repositories\n\n- \n\n## Date of Searches\n\n- \n\n## Re-run Procedure\n\n1. Repeat queries above with same filters.\n2. Re-apply inclusion/exclusion criteria.\n3. Compare extracted findings and variance notes.\n`
  );

  writeIfMissing(
    path.join(ethicsRoot, 'ETHICS-STATEMENT.md'),
    `# Ethics and Disclosure\n\n## Ethical Considerations\n\n- Potential harms/misuse risks:\n- Fairness or representation concerns:\n- Sensitive data handling notes:\n\n## Conflicts of Interest\n\n- \n\n## Limitations Disclosure\n\n- \n`
  );

  writeIfMissing(
    path.join(appendixRoot, 'GLOSSARY.md'),
    `# Glossary\n\n| Term | Definition |\n|------|------------|\n`
  );

  writeIfMissing(
    path.join(figuresRoot, 'research-workflow.puml'),
    `@startuml\nskinparam monochrome true\nskinparam shadowing false\n\nstart\n:Define research question;\n:Collect sources;\n:Extract evidence and citations;\n:Draft section files;\n:Generate figures and integrate images;\n:Assemble manuscript;\nstop\n@enduml\n`
  );

  writeIfMissing(
    path.join(figuresRoot, 'evidence-flow.puml'),
    `@startuml\nskinparam monochrome true\nskinparam shadowing false\n\nstart\n:Collect candidate sources;\n:Screen by inclusion/exclusion;\n:Assess source quality;\n:Extract findings + counterevidence;\n:Synthesize into results/discussion;\nstop\n@enduml\n`
  );

  const sectionFiles = [
    {
      rel: '01-front-matter/01-abstract.md',
      title: 'Abstract',
      prompt: 'Summarize objective, method, core findings, and implications in 150-250 words.',
    },
    {
      rel: '02-introduction/01-background.md',
      title: 'Introduction: Background',
      prompt: 'Establish context and define domain terms needed for the paper.',
    },
    {
      rel: '02-introduction/02-research-questions.md',
      title: 'Introduction: Research Questions',
      prompt: 'State primary and secondary research questions with explicit scope.',
    },
    {
      rel: '03-methods/01-study-design.md',
      title: 'Methods: Study Design',
      prompt: 'Describe search strategy, inclusion criteria, and analysis approach.',
    },
    {
      rel: '03-methods/02-data-collection.md',
      title: 'Methods: Data Collection',
      prompt: 'Document data sources, collection period, and extraction method.',
    },
    {
      rel: '03-methods/03-quality-appraisal.md',
      title: 'Methods: Quality Appraisal',
      prompt: 'Define evidence quality rubric and explain how low-quality sources are handled.',
    },
    {
      rel: '03-methods/04-bias-and-validity.md',
      title: 'Methods: Bias and Validity',
      prompt: 'Identify major bias risks and describe mitigation strategy.',
    },
    {
      rel: '04-results/01-main-findings.md',
      title: 'Results: Main Findings',
      prompt: 'Present evidence-backed findings with source-linked claims.',
    },
    {
      rel: '04-results/02-limitations.md',
      title: 'Results: Limitations',
      prompt: 'List methodological and source-quality limitations.',
    },
    {
      rel: '04-results/03-evidence-matrix.md',
      title: 'Results: Evidence Matrix',
      prompt: 'Map each research question to supporting evidence and counterevidence.',
    },
    {
      rel: '05-discussion/01-interpretation.md',
      title: 'Discussion: Interpretation',
      prompt: 'Interpret findings and compare with competing explanations.',
    },
    {
      rel: '05-discussion/02-implications.md',
      title: 'Discussion: Implications',
      prompt: 'Explain practical and theoretical implications.',
    },
    {
      rel: '06-conclusion/01-conclusion.md',
      title: 'Conclusion',
      prompt: 'Summarize conclusions, contributions, and future work.',
    },
    {
      rel: '06-conclusion/02-future-work.md',
      title: 'Conclusion: Future Work',
      prompt: 'List unresolved questions and propose concrete next studies.',
    },
  ];

  for (const section of sectionFiles) {
    writeIfMissing(
      path.join(sectionsRoot, section.rel),
      `# ${section.title}\n\n## Objective\n\n${section.prompt}\n\n## Manuscript Draft\n\n_TODO: Write publication-ready prose (3+ paragraphs) with inline citations like [SRC-01]. Include tables/images directly in this section where relevant._\n\n## Citation Coverage\n\n| Claim Cluster | Source IDs | Counterevidence Source IDs | Confidence |\n|---------------|------------|----------------------------|------------|\n| _TODO_ | [] | [] | _TODO_ |\n\n## Reviewer Notes (Not for Publication)\n\n- Main uncertainty:\n- Methodological caveat:\n- Follow-up evidence to collect:\n`
    );
  }

  output({
    created: true,
    topic: topic.trim(),
    root: 'paper',
    section_count: sectionFiles.length,
    created_files: created,
    skipped_files: skipped,
  }, raw);
}

function cmdPaperValidate(cwd, raw) {
  const paperRoot = path.join(cwd, 'paper');
  const requiredFiles = [
    'paper/PAPER.md',
    'paper/sources/SOURCE-LOG.md',
    'paper/methodology/PROTOCOL.md',
    'paper/methodology/INCLUSION-EXCLUSION.md',
    'paper/methodology/QUALITY-APPRAISAL.md',
    'paper/methodology/BIAS-REGISTER.md',
    'paper/data/EXTRACTION-SHEET.md',
    'paper/reproducibility/REPRODUCIBILITY.md',
    'paper/ethics/ETHICS-STATEMENT.md',
  ];

  const missingFiles = requiredFiles.filter(rel => !fs.existsSync(path.join(cwd, rel)));

  const sourceLogPath = path.join(cwd, 'paper', 'sources', 'SOURCE-LOG.md');
  const extractionPath = path.join(cwd, 'paper', 'data', 'EXTRACTION-SHEET.md');
  const sectionsDir = path.join(cwd, 'paper', 'sections');

  const sectionSourceIds = new Set();
  let counterevidenceSignals = 0;
  const sectionFilesScanned = [];

  if (fs.existsSync(sectionsDir)) {
    const stack = [sectionsDir];
    while (stack.length > 0) {
      const dir = stack.pop();
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
          continue;
        }
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

        sectionFilesScanned.push(path.relative(cwd, full).replace(/\\/g, '/'));
        const content = fs.readFileSync(full, 'utf-8');
        const ids = content.match(/\[SRC-\d+\]/g) || [];
        ids.forEach(id => sectionSourceIds.add(id.replace(/[\[\]]/g, '')));

        // Counterevidence detection supports both legacy and current section templates.
        const legacyCounterMatch = content.match(/- Competing finding:\s*(.+)/i);
        if (legacyCounterMatch && legacyCounterMatch[1] && legacyCounterMatch[1].trim().length > 0) {
          counterevidenceSignals += 1;
        }

        const coverageTableLines = content
          .split(/\r?\n/)
          .filter((line) => /^\|/.test(line))
          .filter((line) => !/^\|\s*-+/.test(line));

        for (const row of coverageTableLines) {
          const cells = row.split('|').slice(1, -1).map((cell) => cell.trim());
          if (cells.length < 4) continue;
          const counterCell = cells[2];
          if (
            counterCell &&
            !/^\[\]$/.test(counterCell) &&
            !/^(_?todo_?|none|n\/a|na)$/i.test(counterCell)
          ) {
            counterevidenceSignals += 1;
            break;
          }
        }
      }
    }
  }

  const sourceRows = [];
  const logSourceIds = new Set();
  const invalidQualityRows = [];

  if (fs.existsSync(sourceLogPath)) {
    const content = fs.readFileSync(sourceLogPath, 'utf-8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      if (!/^\|\s*SRC-\d+/i.test(line)) continue;
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (cells.length < 9) continue;

      const id = cells[0];
      const qualityRaw = cells[7];
      const quality = Number(qualityRaw);
      logSourceIds.add(id);
      sourceRows.push({ id, qualityRaw });

      if (!Number.isFinite(quality) || quality < 1 || quality > 5) {
        invalidQualityRows.push({ id, quality: qualityRaw });
      }
    }
  }

  // Extraction-sheet based counterevidence check.
  let extractionCounterevidenceCount = 0;
  if (fs.existsSync(extractionPath)) {
    const content = fs.readFileSync(extractionPath, 'utf-8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      if (!/^\|\s*SRC-\d+/i.test(line)) continue;
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (cells.length < 6) continue;
      const counter = cells[3];
      if (counter && !/^(-|none|n\/a)$/i.test(counter)) {
        extractionCounterevidenceCount += 1;
      }
    }
  }

  const missingSourceIds = [...sectionSourceIds].filter(id => !logSourceIds.has(id));
  const hasCounterevidence = (counterevidenceSignals + extractionCounterevidenceCount) > 0;

  const checks = {
    required_files_present: missingFiles.length === 0,
    section_source_ids_present_in_log: missingSourceIds.length === 0,
    source_quality_scores_valid: invalidQualityRows.length === 0 && sourceRows.length > 0,
    counterevidence_present: hasCounterevidence,
  };

  const valid = Object.values(checks).every(Boolean);

  const result = {
    valid,
    checks,
    stats: {
      section_files_scanned: sectionFilesScanned.length,
      section_source_id_count: sectionSourceIds.size,
      source_log_row_count: sourceRows.length,
      counterevidence_signals: counterevidenceSignals + extractionCounterevidenceCount,
    },
    issues: {
      missing_files: missingFiles,
      missing_source_ids_in_log: missingSourceIds,
      invalid_quality_rows: invalidQualityRows,
    },
  };

  output(result, raw, valid ? 'valid' : 'invalid');
}

module.exports = {
  cmdGenerateSlug,
  cmdCurrentTimestamp,
  cmdListTodos,
  cmdVerifyPathExists,
  cmdHistoryDigest,
  cmdResolveModel,
  cmdCommit,
  cmdSummaryExtract,
  cmdWebsearch,
  cmdProgressRender,
  cmdTodoComplete,
  cmdScaffold,
  cmdPaperInit,
  cmdPaperValidate,
};
