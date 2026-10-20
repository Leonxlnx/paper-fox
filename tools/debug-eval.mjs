// Evaluate a JS module snippet inside the app page (debug helper).
//   node tools/debug-eval.mjs "<async js body returning JSON-able value>"
import { openApp } from './lib/browser.mjs';

const body = process.argv[2];
const app = await openApp();
try {
  const res = await app.page.evaluate(`(async () => { ${body} })()`);
  console.log(JSON.stringify(res, null, 2));
  if (app.errors.length) console.log(app.errors.filter((e) => !e.includes('favicon')).join('\n'));
} finally {
  await app.close();
}
