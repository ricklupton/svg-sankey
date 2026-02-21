// Simple smoke tests for svg-sankey
// Run with: node test/test.js

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bin = join(__dirname, '..', 'index.js');
const fixtures = join(__dirname, 'fixtures');

let passed = 0;
let failed = 0;

function assert(desc, condition) {
  if (condition) {
    console.log(`  ✓ ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ ${desc}`);
    failed++;
  }
}

function runSvgSankey(args) {
  return execSync(`node ${bin} ${args}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

console.log('\nWidget format tests:');
{
  const svg = runSvgSankey(`${fixtures}/widget-format.json`);
  assert('produces SVG output', svg.startsWith('<?xml'));
  assert('renders from-elsewhere link (color #aaaaff)', svg.includes('aaaaff'));
  assert('renders to-elsewhere link (color #ffaaaa)', svg.includes('ffaaaa'));
  assert('renders regular link (color #4e79a7)', svg.includes('4e79a7'));
  assert('renders process node with stroke #888', svg.includes('#888'));
  assert('renders group title', svg.includes('Outputs'));
  assert('hides hidden node title', !svg.includes('Sink B'));
}

console.log('\nSankey-v2 format tests:');
{
  const svg = runSvgSankey(`${fixtures}/sankey-v2-format.json`);
  assert('produces SVG output', svg.startsWith('<?xml'));
  assert('renders diagram title', svg.includes('Example Sankey v2'));
  assert('renders process node with stroke #888', svg.includes('#888'));
  assert('reads link color from style.color', svg.includes('4e79a7'));
  assert('reads link color from style.color (waste)', svg.includes('bab0ac'));
  assert('renders group title', svg.includes('Outputs'));
}

console.log('\n--align-link-types flag:');
{
  const svg = runSvgSankey(`--align-link-types ${fixtures}/widget-format.json`);
  assert('produces SVG output', svg.startsWith('<?xml'));
}

console.log('\n--link-label-format flag:');
{
  const svg = runSvgSankey(`--link-label-format ".2s" --link-label-min-width 1 ${fixtures}/widget-format.json`);
  assert('produces SVG output', svg.startsWith('<?xml'));
  assert('includes link label element', svg.includes('label'));
}

console.log('\n--size and --margins flags:');
{
  const svg = runSvgSankey(`--size 1200,800 --margins 25,130 ${fixtures}/widget-format.json`);
  assert('produces SVG output', svg.startsWith('<?xml'));
  assert('sets correct width', svg.includes('width="1200"'));
  assert('sets correct height', svg.includes('height="800"'));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
