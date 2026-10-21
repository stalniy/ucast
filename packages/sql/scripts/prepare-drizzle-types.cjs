const fs = require('node:fs');
const path = require('node:path');

// Drizzle exposes distinct ESM and CommonJS types. Resolve our public SQL return
// type in the consumer's module mode so its private members share that identity.
const declaration = path.resolve(__dirname, '../dist/types/lib/drizzle-orm/v0.x.d.ts');
for (const extension of ['d.mts', 'd.cts']) {
  fs.copyFileSync(declaration, declaration.replace(/d\.ts$/, extension));
}
