import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(root, 'design/mobile-ui.tokens.json');
const contract = JSON.parse(await readFile(sourcePath, 'utf8'));

const camelToKebab = (value) => value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
const swiftName = (value) => value.replace(/[^a-zA-Z0-9]/g, '_');
const swiftString = (value) => JSON.stringify(value);

function cssVariables() {
  const rows = [];
  for (const [name, value] of Object.entries(contract.colors)) rows.push(`  --ui-color-${camelToKebab(name)}: ${value.toLowerCase()};`);
  for (const [name, value] of Object.entries(contract.alpha)) rows.push(`  --ui-alpha-${camelToKebab(name)}: ${value};`);
  for (const [name, value] of Object.entries(contract.fontFamilies)) rows.push(`  --ui-font-${camelToKebab(name)}: ${value};`);
  for (const [name, value] of Object.entries(contract.spacing)) rows.push(`  --ui-space-${camelToKebab(name)}: ${value}px;`);
  for (const [name, value] of Object.entries(contract.radii)) rows.push(`  --ui-radius-${camelToKebab(name)}: ${value}px;`);
  for (const [name, value] of Object.entries(contract.motion)) {
    if (Array.isArray(value)) rows.push(`  --ui-motion-${camelToKebab(name)}: cubic-bezier(${value.join(', ')});`);
    else if (name.includes('Stiffness') || name.includes('Damping')) rows.push(`  --ui-motion-${camelToKebab(name)}: ${value};`);
    else rows.push(`  --ui-motion-${camelToKebab(name)}: ${value}s;`);
  }
  rows.push(`  --ui-content-max-width: ${contract.referenceViewport.contentMaxWidth}px;`);
  rows.push(`  --ui-page-horizontal: ${contract.spacing.pageHorizontal}px;`);
  rows.push(`  --ui-page-content-bottom: ${contract.spacing.contentBottom}px;`);
  rows.push(`  --ui-navigation-height: ${contract.navigation.minimumTapHeight}px;`);
  return `/* Generated from design/mobile-ui.tokens.json. Do not edit. */\n:root {\n${rows.join('\n')}\n}\n`;
}

function swiftContract() {
  const colors = Object.entries(contract.colors).map(([name, value]) => `        static let ${swiftName(name)} = ${swiftString(value)}`).join('\n');
  const alpha = Object.entries(contract.alpha).map(([name, value]) => `        static let ${swiftName(name)}: Double = ${value}`).join('\n');
  const spacing = Object.entries(contract.spacing).map(([name, value]) => `        static let ${swiftName(name)}: CGFloat = ${value}`).join('\n');
  const radii = Object.entries(contract.radii).map(([name, value]) => `        static let ${swiftName(name)}: CGFloat = ${value}`).join('\n');
  const header = Object.entries(contract.header).map(([name, value]) => `        static let ${swiftName(name)}: CGFloat = ${value}`).join('\n');
  const navigation = Object.entries(contract.navigation).map(([name, value]) => `        static let ${swiftName(name)}: CGFloat = ${value}`).join('\n');
  const typography = Object.entries(contract.typography).map(([name, value]) => `        static let ${swiftName(name)} = TextStyle(family: ${swiftString(value.family)}, size: ${value.size}, lineHeight: ${value.lineHeight}, letterSpacing: ${value.letterSpacing}, weight: ${value.weight})`).join('\n');
  const screens = Object.entries(contract.screens).map(([name, value]) => `        ${swiftString(name)}: Screen(title: ${swiftString(value.title)}, subtitle: ${swiftString(value.subtitle)}, symbol: ${swiftString(value.symbol)})`).join(',\n');
  const motion = Object.entries(contract.motion).filter(([, value]) => !Array.isArray(value)).map(([name, value]) => `        static let ${swiftName(name)}: Double = ${value}`).join('\n');
  return `// Generated from design/mobile-ui.tokens.json. Do not edit.\nimport Foundation\n\nenum UIContract {\n    static let version = ${contract.version}\n    static let referenceViewportWidth: CGFloat = ${contract.referenceViewport.width}\n    static let referenceViewportHeight: CGFloat = ${contract.referenceViewport.height}\n    static let contentMaxWidth: CGFloat = ${contract.referenceViewport.contentMaxWidth}\n\n    struct TextStyle {\n        let family: String\n        let size: CGFloat\n        let lineHeight: CGFloat\n        let letterSpacing: CGFloat\n        let weight: Int\n    }\n\n    struct Screen {\n        let title: String\n        let subtitle: String\n        let symbol: String\n    }\n\n    enum Colors {\n${colors}\n    }\n\n    enum Alpha {\n${alpha}\n    }\n\n    enum Spacing {\n${spacing}\n    }\n\n    enum Radii {\n${radii}\n    }\n\n    enum Typography {\n${typography}\n    }\n\n    enum Header {\n${header}\n    }\n\n    enum Navigation {\n${navigation}\n    }\n\n    enum Motion {\n${motion}\n    }\n\n    static let screens: [String: Screen] = [\n${screens}\n    ]\n}\n`;
}

const stableJson = `${JSON.stringify(contract, null, 2)}\n`;
const outputs = [
  ['src/generated/mobile-ui.css', cssVariables()],
  ['src/generated/mobile-ui.ts', `/* Generated from design/mobile-ui.tokens.json. Do not edit. */\nexport const mobileUI = ${stableJson.trim()} as const;\n`],
  ['ios/TheOne/Generated/UIContract.generated.swift', swiftContract()],
];

const check = process.argv.includes('--check');
let stale = false;
for (const [relativePath, expected] of outputs) {
  const outputPath = resolve(root, relativePath);
  if (check) {
    const current = await readFile(outputPath, 'utf8').catch(() => '');
    if (current !== expected) {
      console.error(`UI contract is stale: ${relativePath}`);
      stale = true;
    }
  } else {
    await writeFile(outputPath, expected);
    console.log(`generated ${relativePath}`);
  }
}
if (stale) process.exit(1);
