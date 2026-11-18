import { readFile } from 'node:fs/promises';
import ts from 'typescript';

import { assertAppendOnly } from './growth-rules.mjs';

function propertyName(name) {
  return name.getText().replace(/^['"]|['"]$/g, '');
}

function getProperty(object, name) {
  return object.properties.find((property) => (
    ts.isPropertyAssignment(property) && propertyName(property.name) === name
  ));
}

export function entryTexts(source) {
  const sourceFile = ts.createSourceFile('jianzhongsheng.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declaration = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find((candidate) => candidate.name.getText(sourceFile) === 'jianZhongShengSpace');
  const space = declaration?.initializer;
  const entries = space && ts.isObjectLiteralExpression(space)
    ? getProperty(space, 'entries')?.initializer
    : undefined;
  if (!entries || !ts.isArrayLiteralExpression(entries) || entries.elements.length === 0) {
    throw new Error('找不到非空的 jianZhongShengSpace.entries');
  }
  return entries.elements.map((element) => element.getText(sourceFile));
}

if (process.argv[1] && process.argv[1].endsWith('jianzhongsheng-growth.mjs')) {
  const [oldPath, newPath] = process.argv.slice(2);
  const oldTexts = entryTexts(await readFile(oldPath, 'utf8'));
  const newTexts = entryTexts(await readFile(newPath, 'utf8'));
  assertAppendOnly(oldTexts, newTexts);
  console.log(`见众生手记 ${oldTexts.length} → ${newTexts.length}`);
}
