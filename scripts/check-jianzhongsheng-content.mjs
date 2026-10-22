import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ageAtOpening = String.raw`(?:我(?:今年)?|今年(?:我)?)?[零〇一二三四五六七八九十百两0-9]{1,4}岁(?:以后)?`;
const ageOpeningPattern = new RegExp(String.raw`^(${ageAtOpening})(?=[，,、。\s])`, 'u');
const maxTitleLength = 24;

function getProperty(object, name) {
  return object.properties.find((property) => (
    ts.isPropertyAssignment(property) && property.name.getText().replace(/^['"]|['"]$/g, '') === name
  ));
}

function readString(property) {
  const value = property?.initializer;
  return value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))
    ? value.text
    : undefined;
}

export function checkJianZhongShengContent(source) {
  const sourceFile = ts.createSourceFile('jianzhongsheng.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const violations = sourceFile.parseDiagnostics.map((diagnostic) => (
    `第 ${sourceFile.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1} 行语法错误：${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`
  ));
  const declaration = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find((candidate) => candidate.name.getText(sourceFile) === 'jianZhongShengSpace');
  const space = declaration?.initializer;
  const entries = space && ts.isObjectLiteralExpression(space) ? getProperty(space, 'entries')?.initializer : undefined;

  if (!entries || !ts.isArrayLiteralExpression(entries) || entries.elements.length === 0) {
    violations.push('找不到非空的 jianZhongShengSpace.entries 示例手记数组');
    return { violations, entryCount: 0 };
  }

  const titles = new Map();

  for (const [index, entry] of entries.elements.entries()) {
    const line = sourceFile.getLineAndCharacterOfPosition(entry.getStart(sourceFile)).line + 1;
    if (!ts.isObjectLiteralExpression(entry)) {
      violations.push(`第 ${line} 行的第 ${index + 1} 篇手记必须直接定义为对象`);
      continue;
    }

    const id = readString(getProperty(entry, 'id')) ?? `第 ${index + 1} 篇`;
    const location = `“${id}”（第 ${line} 行）`;
    const title = readString(getProperty(entry, 'title'));
    const authorId = readString(getProperty(entry, 'authorId'));

    if (title === undefined || title.trim() === '') {
      violations.push(`${location} 缺少非空的静态字符串 title`);
    } else {
      if (title !== title.trim()) violations.push(`${location} 的 title 首尾不能包含空白`);
      if ([...title].length > maxTitleLength) violations.push(`${location} 的 title 超过 ${maxTitleLength} 个 Unicode 码点`);
      if (title.trim() === authorId?.trim()) violations.push(`${location} 的 title 不能与 authorId 相同`);

      // Only exact titles collide; similar wording and punctuation can be intentional.
      const normalizedTitle = title.trim().normalize('NFC');
      if (titles.has(normalizedTitle)) {
        violations.push(`${location} 的 title“${title.trim()}”与“${titles.get(normalizedTitle)}”重复`);
      } else {
        titles.set(normalizedTitle, id);
      }
    }

    for (const field of ['excerpt', 'body']) {
      const value = readString(getProperty(entry, field));
      if (value === undefined || value.trim() === '') {
        violations.push(`${location} 缺少非空的静态字符串 ${field}`);
        continue;
      }
      const match = value.trimStart().match(ageOpeningPattern);
      if (match) violations.push(`${location} 的 ${field} 以年龄“${match[1]}”开头`);
    }
  }

  return { violations, entryCount: entries.elements.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const contentPath = new URL('../src/content/jianzhongsheng.ts', import.meta.url);
  const { violations, entryCount } = checkJianZhongShengContent(await readFile(contentPath, 'utf8'));

  if (violations.length > 0) {
    console.error('“见众生”内容检查失败：标题须完整、简洁且不重名；手记与摘要禁止以年龄模板开头。');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
  } else {
    console.log(`“见众生”内容检查通过，共 ${entryCount} 篇手记。`);
  }
}
