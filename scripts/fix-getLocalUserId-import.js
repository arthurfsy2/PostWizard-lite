const fs = require('fs');
const path = require('path');

const IMPORT_LINE = "import { getLocalUserId } from '@/lib/local-user';";

function findFiles(dir, ext) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) results.push(...findFiles(full, ext));
    else if (item.name.endsWith(ext)) results.push(full);
  }
  return results;
}

const apiDir = path.join(__dirname, '..', 'src', 'app', 'api');
const files = findFiles(apiDir, '.ts');
let fixed = 0;
let skipped = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8');
  
  // Only process files that call getLocalUserId()
  if (!content.includes('getLocalUserId()')) continue;
  
  // Already has the import
  if (content.includes("import { getLocalUserId } from '@/lib/local-user'")) {
    skipped++;
    console.log('Already OK:', path.relative(process.cwd(), file));
    continue;
  }
  
  let newContent = content;
  
  // Try inserting after prisma import
  if (content.includes("import { prisma } from '@/lib/prisma';")) {
    newContent = content.replace(
      "import { prisma } from '@/lib/prisma';",
      "import { prisma } from '@/lib/prisma';\n" + IMPORT_LINE
    );
  }
  // Fallback: insert after first import line
  else {
    const lines = content.split('\n');
    const firstImportIdx = lines.findIndex(l => l.startsWith('import '));
    if (firstImportIdx >= 0) {
      lines.splice(firstImportIdx + 1, 0, IMPORT_LINE);
      newContent = lines.join('\n');
    } else {
      newContent = IMPORT_LINE + '\n' + content;
    }
  }
  
  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf-8');
    fixed++;
    console.log('Fixed:', path.relative(process.cwd(), file));
  }
}

console.log('\nFixed:', fixed, '| Already OK:', skipped);
