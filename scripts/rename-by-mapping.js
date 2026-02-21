#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function printHelp() {
  console.log(`Rename files, folders, and file contents using string mappings.

Usage:
  node scripts/rename-by-mapping.js --dir <workingDir> [options]
  node scripts/rename-by-mapping.js --dir <workingDir> --mapping '<json>' [options]
  node scripts/rename-by-mapping.js --dir <workingDir> --mapping-file <file.json> [options]

Required:
  --dir, -d           Working directory to process
                      Mapping is read from scripts/rename-mapping.json by default
  --mapping, -m       JSON array of single-key objects or key/value tuples
                      Example: '[{"gpd":"gpd"},{"get-paper-done":"get-paper-done"}]'
  --mapping-file, -f  Path to JSON file with mapping array (overrides default file)

Options:
  --dry-run           Show changes without modifying files
  --ignore            Comma-separated directory names to skip
                      Default: .git,node_modules
  --no-content        Do not replace text inside files
  --help, -h          Show this help
`);
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    includeContent: true,
    ignore: new Set(['.git', 'node_modules'])
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];

    if (a === '--help' || a === '-h') {
      args.help = true;
    } else if (a === '--dry-run') {
      args.dryRun = true;
    } else if (a === '--no-content') {
      args.includeContent = false;
    } else if (a === '--dir' || a === '-d') {
      args.dir = argv[i + 1];
      i += 1;
    } else if (a === '--mapping' || a === '-m') {
      args.mappingJson = argv[i + 1];
      i += 1;
    } else if (a === '--mapping-file' || a === '-f') {
      args.mappingFile = argv[i + 1];
      i += 1;
    } else if (a === '--ignore') {
      const raw = argv[i + 1] || '';
      args.ignore = new Set(raw.split(',').map((x) => x.trim()).filter(Boolean));
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }

  return args;
}

function normalizeMappingEntry(entry) {
  if (Array.isArray(entry) && entry.length === 2) {
    const from = String(entry[0]);
    const to = String(entry[1]);
    return [from, to];
  }

  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    const keys = Object.keys(entry);
    if (keys.length !== 1) {
      throw new Error(`Each mapping object must contain exactly one key. Got: ${JSON.stringify(entry)}`);
    }

    const from = String(keys[0]);
    const to = String(entry[from]);
    return [from, to];
  }

  throw new Error(`Invalid mapping entry: ${JSON.stringify(entry)}`);
}

function parseMappings(args) {
  let raw;
  const defaultMappingFile = path.join(__dirname, 'rename-mapping.json');

  if (args.mappingJson) {
    raw = args.mappingJson;
  } else if (args.mappingFile) {
    raw = fs.readFileSync(path.resolve(args.mappingFile), 'utf8');
  } else if (fs.existsSync(defaultMappingFile)) {
    raw = fs.readFileSync(defaultMappingFile, 'utf8');
  } else {
    throw new Error(`Missing mapping. Provide --mapping, --mapping-file, or create ${defaultMappingFile}.`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse mapping JSON: ${err.message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Mapping must be a JSON array.');
  }

  const pairs = parsed.map(normalizeMappingEntry);

  for (const [from, to] of pairs) {
    if (from.length === 0) {
      throw new Error('Mapping key cannot be an empty string.');
    }
    if (from === to) {
      throw new Error(`Mapping key and value are the same: "${from}"`);
    }
  }

  return pairs;
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitWords(value) {
  return value.split(/[\s_-]+/).filter(Boolean);
}

function isLetter(ch) {
  return /[A-Za-z]/.test(ch);
}

function applyCasePattern(patternText, targetText) {
  const patternCases = [];
  for (const ch of patternText) {
    if (isLetter(ch)) {
      patternCases.push(ch === ch.toUpperCase());
    }
  }

  if (patternCases.length === 0) {
    return targetText;
  }

  let caseIndex = 0;
  const chars = [];

  for (const ch of targetText) {
    if (!isLetter(ch)) {
      chars.push(ch);
      continue;
    }

    const useUpper = patternCases[Math.min(caseIndex, patternCases.length - 1)];
    chars.push(useUpper ? ch.toUpperCase() : ch.toLowerCase());
    caseIndex += 1;
  }

  return chars.join('');
}

function buildRules(mappings) {
  return mappings.map(([from, to]) => {
    const fromWords = splitWords(from);
    const toWords = splitWords(to);
    const isPhraseRule = fromWords.length > 1 || /[\s_-]/.test(from);

    if (!isPhraseRule) {
      return {
        type: 'single',
        from,
        to,
        regex: new RegExp(escapeRegex(from), 'gi')
      };
    }

    const parts = [];
    for (let i = 0; i < fromWords.length; i += 1) {
      parts.push(`(${escapeRegex(fromWords[i])})`);
      if (i < fromWords.length - 1) {
        parts.push('([\\s_-]+)');
      }
    }

    return {
      type: 'phrase',
      from,
      to,
      fromWords,
      toWords,
      regex: new RegExp(parts.join(''), 'gi')
    };
  });
}

function applyRule(text, rule) {
  if (rule.type === 'single') {
    return text.replace(rule.regex, (matched) => applyCasePattern(matched, rule.to));
  }

  const tokenCount = rule.fromWords.length;
  const captureCount = tokenCount * 2 - 1;

  return text.replace(rule.regex, (...args) => {
    const groups = args.slice(1, 1 + captureCount);

    const sourceWords = [];
    const separators = [];

    for (let i = 0; i < tokenCount; i += 1) {
      sourceWords.push(groups[i * 2]);
      if (i < tokenCount - 1) {
        separators.push(groups[i * 2 + 1]);
      }
    }

    const styledWords = rule.toWords.map((toWord, index) => {
      const sourceWord = sourceWords[Math.min(index, sourceWords.length - 1)] || sourceWords[0] || '';
      return applyCasePattern(sourceWord, toWord);
    });

    if (styledWords.length <= 1) {
      return styledWords[0] || '';
    }

    const output = [styledWords[0]];
    for (let i = 1; i < styledWords.length; i += 1) {
      const sep = separators[Math.min(i - 1, separators.length - 1)] || separators[0] || ' ';
      output.push(sep, styledWords[i]);
    }

    return output.join('');
  });
}

function replaceAllByRules(text, rules) {
  let out = text;
  for (const rule of rules) {
    out = applyRule(out, rule);
  }
  return out;
}

function isLikelyBinary(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  for (let i = 0; i < sample.length; i += 1) {
    if (sample[i] === 0) return true;
  }
  return false;
}

function collectEntries(rootDir, ignoreNames) {
  const files = [];
  const dirs = [];

  function walk(currentDir) {
    const names = fs.readdirSync(currentDir);
    for (const name of names) {
      if (ignoreNames.has(name)) continue;

      const fullPath = path.join(currentDir, name);
      const stat = fs.lstatSync(fullPath);

      if (stat.isDirectory()) {
        dirs.push(fullPath);
        walk(fullPath);
      } else if (stat.isFile()) {
        files.push(fullPath);
      }
    }
  }

  walk(rootDir);
  return { files, dirs };
}

function depthOf(p) {
  return p.split(path.sep).length;
}

function renamePathIfNeeded(oldPath, rules, dryRun) {
  const parent = path.dirname(oldPath);
  const oldBase = path.basename(oldPath);
  const newBase = replaceAllByRules(oldBase, rules);

  if (newBase === oldBase) {
    return { changed: false, newPath: oldPath };
  }

  const newPath = path.join(parent, newBase);

  if (fs.existsSync(newPath)) {
    throw new Error(`Cannot rename because target already exists:\n  from: ${oldPath}\n  to:   ${newPath}`);
  }

  if (!dryRun) {
    fs.renameSync(oldPath, newPath);
  }

  return { changed: true, newPath };
}

function toTitleCaseWord(word) {
  return word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word;
}

function mappingPreviewVariants(from, to) {
  const fromWords = splitWords(from);
  const toWords = splitWords(to);

  const variants = [];
  const seen = new Set();
  function addVariant(left, right) {
    const key = `${left}\u0000${right}`;
    if (seen.has(key)) return;
    seen.add(key);
    variants.push([left, right]);
  }

  if (fromWords.length === 1 && toWords.length === 1) {
    addVariant(from.toLowerCase(), to.toLowerCase());
    addVariant(from.toUpperCase(), to.toUpperCase());
    addVariant(toTitleCaseWord(from), toTitleCaseWord(to));
    return variants;
  }

  const separators = [' ', '-', '_'];
  const caseFns = [
    (w) => w.toLowerCase(),
    (w) => toTitleCaseWord(w),
    (w) => w.toUpperCase()
  ];

  for (const sep of separators) {
    for (const caseFn of caseFns) {
      const left = fromWords.map(caseFn).join(sep);
      const right = toWords.map(caseFn).join(sep);
      addVariant(left, right);
    }
  }

  return variants;
}

function logMappingsBeforeRun(mappings) {
  console.log('Mappings (base):');
  for (const [from, to] of mappings) {
    console.log(`  ${from} -> ${to}`);
  }

  console.log('Mappings (style/case variants):');
  for (const [from, to] of mappings) {
    const variants = mappingPreviewVariants(from, to);
    for (const [left, right] of variants) {
      console.log(`  ${left} -> ${right}`);
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.dir) {
    throw new Error('Missing --dir argument.');
  }

  const rootDir = path.resolve(args.dir);
  if (!fs.existsSync(rootDir) || !fs.lstatSync(rootDir).isDirectory()) {
    throw new Error(`Directory does not exist or is not a directory: ${rootDir}`);
  }

  const mappings = parseMappings(args);
  const rules = buildRules(mappings);

  console.log(`Root: ${rootDir}`);
  console.log(`Mode: ${args.dryRun ? 'dry-run' : 'apply'}`);
  console.log(`Ignore dirs: ${Array.from(args.ignore).join(', ') || '(none)'}`);
  logMappingsBeforeRun(mappings);

  const { files, dirs } = collectEntries(rootDir, args.ignore);

  let contentUpdates = 0;
  if (args.includeContent) {
    for (const filePath of files) {
      const buffer = fs.readFileSync(filePath);
      if (isLikelyBinary(buffer)) {
        continue;
      }

      const original = buffer.toString('utf8');
      const replaced = replaceAllByRules(original, rules);
      if (replaced !== original) {
        contentUpdates += 1;
        if (!args.dryRun) {
          fs.writeFileSync(filePath, replaced, 'utf8');
        }
        console.log(`[content] ${filePath}`);
      }
    }
  }

  let fileRenames = 0;
  const sortedFiles = [...files].sort((a, b) => depthOf(b) - depthOf(a));
  for (const filePath of sortedFiles) {
    const { changed, newPath } = renamePathIfNeeded(filePath, rules, args.dryRun);
    if (changed) {
      fileRenames += 1;
      console.log(`[file] ${filePath} -> ${newPath}`);
    }
  }

  let dirRenames = 0;
  const sortedDirs = [...dirs].sort((a, b) => depthOf(b) - depthOf(a));
  for (const dirPath of sortedDirs) {
    const { changed, newPath } = renamePathIfNeeded(dirPath, rules, args.dryRun);
    if (changed) {
      dirRenames += 1;
      console.log(`[dir]  ${dirPath} -> ${newPath}`);
    }
  }

  console.log('\nDone.');
  console.log(`Content files updated: ${contentUpdates}`);
  console.log(`Files renamed: ${fileRenames}`);
  console.log(`Directories renamed: ${dirRenames}`);
}

try {
  main();
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
