import ts from "typescript";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
const root = resolve("src");
const files: string[] = [];
function scan(dir: string) {
  for (const file of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, file.name);
    if (file.isDirectory()) scan(path);
    else if (/\.tsx?$/.test(path)) files.push(path);
  }
}
scan(root);
const layers = ["app", "pages", "widgets", "features", "entities", "shared"];
const graph = new Map<string, string[]>();
for (const file of files) {
  const edges: string[] = [];
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  for (const node of source.statements) {
    if (
      !ts.isImportDeclaration(node) ||
      !ts.isStringLiteral(node.moduleSpecifier)
    )
      continue;
    const spec = node.moduleSpecifier.text;
    if (!spec.startsWith(".")) continue;
    const targetBase = resolve(dirname(file), spec);
    const target = [
      targetBase,
      targetBase + ".ts",
      targetBase + ".tsx",
      resolve(targetBase, "index.ts"),
      resolve(targetBase, "index.tsx"),
    ].find((p) => existsSync(p) && files.includes(p));
    if (!target) continue;
    edges.push(target);
    const from = relative(root, file).split("/");
    const to = relative(root, target).split("/");
    const a = layers.indexOf(from[0]);
    const b = layers.indexOf(to[0]);
    if (
      b < a ||
      (a === b && !["app", "shared"].includes(from[0]) && from[1] !== to[1])
    )
      throw new Error(`FSD boundary: ${file} -> ${target}`);
    if (
      from[0] !== to[0] &&
      !/\/index\.tsx?$/.test(target) &&
      !["app"].includes(to[0])
    )
      throw new Error(`Use public API: ${file} -> ${target}`);
  }
  graph.set(file, edges);
}
const visited = new Set<string>(),
  active = new Set<string>();
function visit(file: string) {
  if (active.has(file)) throw new Error(`Import cycle: ${file}`);
  if (visited.has(file)) return;
  active.add(file);
  for (const next of graph.get(file) ?? []) visit(next);
  active.delete(file);
  visited.add(file);
}
for (const file of files) visit(file);
console.log(
  `Architecture: ${files.length} source modules, no import cycles or forbidden FSD dependencies.`,
);
