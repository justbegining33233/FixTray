/**
 * Wrap user-visible JSX copy in say() so it resolves through message catalogs.
 * Does not translate at runtime and does not walk the DOM.
 *
 * Usage: node scripts/wrap-ui-phrases.mjs [--write]
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const root = process.cwd();
const write = process.argv.includes('--write');

const DISPLAY_ATTRS = new Set([
  'placeholder',
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'alt',
  'title',
  'label',
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'api') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function looksTranslatable(text) {
  const trimmed = text.trim();
  if (trimmed.length < 2 || trimmed.length > 240) return false;
  if (!/[A-Za-z]/.test(trimmed)) return false;
  if (/^https?:\/\//.test(trimmed)) return false;
  if (/^\/[A-Za-z0-9/_?=&%.{}-]+$/.test(trimmed)) return false;
  if (/^[a-z0-9_.:/#%-]+$/.test(trimmed)) return false;
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return false;
  if (/^(?:rgb|rgba|hsl)a?\(/.test(trimmed)) return false;
  if (/^[\d\s.,:%$+-]+$/.test(trimmed)) return false;
  return true;
}

function isFunction(node) {
  return ts.isFunctionDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node);
}

function isCallback(node) {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) return true;
  if (ts.isJsxAttribute(parent)) return true;
  if (ts.isDecorator(parent)) return true;
  return false;
}

function functionName(node) {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) return node.name?.text || '';
  if (node.name && ts.isIdentifier(node.name)) return node.name.text;
  const parent = node.parent;
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  return '';
}

function isComponentName(name) {
  return /^[A-Z]/.test(name);
}

function insideEventHandler(node) {
  let current = node;
  while (current) {
    if (isFunction(current) && current.parent && ts.isJsxAttribute(current.parent)) {
      const attr = current.parent.name?.text || '';
      if (attr.startsWith('on')) return true;
    }
    current = current.parent;
  }
  return false;
}

function alreadySay(node) {
  const parent = node.parent;
  return !!parent
    && ts.isCallExpression(parent)
    && ts.isIdentifier(parent.expression)
    && parent.expression.text === 'say'
    && parent.arguments[0] === node;
}

function sayCall(text) {
  return `say(${JSON.stringify(text)})`;
}

function jsxTextReplacement(node) {
  const raw = node.getText();
  const trimmed = raw.trim();
  if (!looksTranslatable(trimmed)) return null;
  const lead = /^[ \t]/.test(raw) && !raw.startsWith('\n') ? "{' '}" : '';
  const trail = /[ \t]$/.test(raw) && !raw.endsWith('\n') ? "{' '}" : '';
  return `${lead}{${sayCall(trimmed)}}${trail}`;
}

function shouldWrapExpressionIdentifier(node) {
  if (!ts.isIdentifier(node) && !ts.isPropertyAccessExpression(node)) return false;
  if (ts.isIdentifier(node)) {
    const name = node.text;
    if (['say', 't', 'undefined', 'null', 'true', 'false', 'NaN', 'children', 'className', 'style', 'ref', 'key', 'props'].includes(name)) return false;
    if (/^(set|handle|on|use|is|has|dispatch|router|navigate)[A-Z_]/.test(name)) return false;
  }
  return true;
}

function collect(sourceFile) {
  const edits = [];
  function overlaps(start, end) {
    return edits.some((edit) => start < edit.end && end > edit.start);
  }
  function push(start, end, text) {
    if (start == null || end == null || start >= end) return;
    if (overlaps(start, end)) return;
    edits.push({ start, end, text });
  }
  function visit(node) {
    if (ts.isJsxText(node)) {
      const next = jsxTextReplacement(node);
      if (next) push(node.getStart(sourceFile), node.getEnd(), next);
    } else if (ts.isJsxAttribute(node) && DISPLAY_ATTRS.has(node.name.text) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const value = node.initializer.text;
      if (looksTranslatable(value) && !insideEventHandler(node)) {
        push(node.initializer.getStart(sourceFile), node.initializer.getEnd(), `{${sayCall(value)}}`);
      }
    } else if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      && looksTranslatable(node.text)
      && !alreadySay(node)
      && !insideEventHandler(node)
      && !ts.isImportDeclaration(node.parent)
      && inDisplayExpression(node)
      && !callArgument(node)
      && !(node.parent && ts.isJsxAttribute(node.parent))
    ) {
      push(node.getStart(sourceFile), node.getEnd(), sayCall(node.text));
    } else if (
      ts.isJsxExpression(node)
      && node.parent
      && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
      && node.expression
      && shouldWrapExpressionIdentifier(node.expression)
      && !alreadySay(node.expression)
    ) {
      push(node.expression.getStart(sourceFile), node.expression.getEnd(), `say(${node.expression.getText(sourceFile)})`);
    } else if (
      ts.isJsxAttribute(node)
      && DISPLAY_ATTRS.has(node.name.text)
      && node.initializer
      && ts.isJsxExpression(node.initializer)
      && node.initializer.expression
      && shouldWrapExpressionIdentifier(node.initializer.expression)
      && !alreadySay(node.initializer.expression)
    ) {
      const expr = node.initializer.expression;
      push(expr.getStart(sourceFile), expr.getEnd(), `say(${expr.getText(sourceFile)})`);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return edits;
}

function callArgument(node) {
  return ts.isCallExpression(node.parent) || ts.isNewExpression(node.parent);
}

function inDisplayExpression(node) {
  let current = node.parent;
  while (current) {
    if (isFunction(current)) return false;
    if (ts.isJsxAttribute(current)) return DISPLAY_ATTRS.has(current.name?.text || '');
    if (ts.isJsxElement(current) || ts.isJsxFragment(current)) return true;
    current = current.parent;
  }
  return false;
}

function applyEdits(source, edits) {
  const ordered = [...edits].sort((a, b) => b.start - a.start);
  let next = source;
  for (const edit of ordered) {
    next = next.slice(0, edit.start) + edit.text + next.slice(edit.end);
  }
  return next;
}

function injectHooks(filePath, source) {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const owners = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'say') {
      const owner = hookOwner(node);
      if (owner && !owners.includes(owner)) owners.push(owner);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  const inserts = [];
  for (const owner of owners) {
    if (ownerHasSay(owner)) continue;
    if (ts.isArrowFunction(owner) && !ts.isBlock(owner.body)) {
      const body = owner.body;
      const bodyText = body.getText(sourceFile);
      inserts.push({
        start: body.getStart(sourceFile),
        end: body.getEnd(),
        text: `{ const say = usePhrase();\nreturn (${bodyText}); }`,
      });
      continue;
    }
    const body = owner.body;
    if (!body || !ts.isBlock(body)) continue;
    const brace = body.getStart(sourceFile);
    inserts.push({
      start: brace + 1,
      end: brace + 1,
      text: '\n  const say = usePhrase();',
    });
  }

  let next = applyEdits(source, inserts);
  if (inserts.length && !next.includes("from '@/lib/usePhrase'") && !next.includes('from "@/lib/usePhrase"')) {
    const useClient = next.match(/^\s*['"]use client['"];?\s*\n/);
    const importLine = "import { usePhrase } from '@/lib/usePhrase';\n";
    if (useClient) {
      const at = useClient.index + useClient[0].length;
      next = next.slice(0, at) + importLine + next.slice(at);
    } else {
      next = `'use client';\n${importLine}${next}`;
    }
  }
  return { next, hooks: inserts.length };
}

function hookOwner(node) {
  let current = node.parent;
  let fallback = null;
  while (current) {
    if (isFunction(current) && !isCallback(current)) {
      fallback = current;
      const name = functionName(current);
      if (isComponentName(name) || !current.parent || ts.isSourceFile(current.parent) || ts.isExportAssignment(current.parent)) {
        return current;
      }
    }
    current = current.parent;
  }
  return fallback;
}

function ownerHasSay(owner) {
  if (!owner.body) return false;
  const body = ts.isBlock(owner.body) ? owner.body.statements : [];
  return body.some((statement) => {
    const text = statement.getText();
    return text.includes('usePhrase()');
  });
}

function transform(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  if (!original.includes('use client') && !original.includes("use client")) {
    return { changed: false, reason: 'server' };
  }
  const sourceFile = ts.createSourceFile(filePath, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = collect(sourceFile);
  if (!edits.length) return { changed: false, reason: 'none', edits: 0 };
  const wrapped = applyEdits(original, edits);
  const { next, hooks } = injectHooks(filePath, wrapped);
  const check = ts.createSourceFile(filePath, next, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const parseDiag = check.parseDiagnostics || [];
  if (parseDiag.length) {
    const diag = parseDiag[0];
    const start = diag.start ?? 0;
    const snippet = next.slice(Math.max(0, start - 80), start + 80).replace(/\n/g, '\\n');
    return { changed: false, reason: 'parse', detail: `${typeof diag.messageText === 'string' ? diag.messageText : 'parse'} @ ${start}: ${snippet}` };
  }
  if (write) fs.writeFileSync(filePath, next);
  return { changed: true, edits: edits.length, hooks };
}

const files = [
  ...walk(path.join(root, 'src/app')),
  ...walk(path.join(root, 'src/components')),
].filter((file) => !file.includes(`${path.sep}api${path.sep}`) && !file.endsWith(`${path.sep}LanguageSwitcher.tsx`) && !file.endsWith(`${path.sep}usePhrase.ts`));

let changed = 0;
let edits = 0;
const skipped = [];
for (const file of files) {
  const result = transform(file);
  if (result.changed) {
    changed += 1;
    edits += result.edits;
  } else if (result.reason === 'parse') {
    skipped.push(`${path.relative(root, file)}: ${JSON.stringify(result.detail)}`);
  }
}
console.log(JSON.stringify({ files: files.length, changed, edits, write, skipped }, null, 2));
