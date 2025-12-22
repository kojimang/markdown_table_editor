import { parseMarkdownTable, generateMarkdownTable, findTableAtPosition } from './markdownParser';
import * as assert from 'assert';

console.log('Running Parser Tests...');

// Test 1: Parse simple table
const simpleTable = `
| Header 1 | Header 2 |
|---|---|
| Row 1 Col 1 | Row 1 Col 2 |
`;
const parsed = parseMarkdownTable(simpleTable);
console.log('Parsed:', JSON.stringify(parsed));
assert.strictEqual(parsed.length, 2, 'Should have 2 rows (header + 1 data row)');
assert.strictEqual(parsed[0][0], 'Header 1');

// Test 2: Generate table
const generated = generateMarkdownTable(parsed);
console.log('Generated (JSON):', JSON.stringify(generated));
console.log('Checking generated table content...');
if (!generated.includes('Header 1')) {
    console.error('Assertion Failed: Generated table does not contain header');
    process.exit(1);
}

// Test 3: Find table
const docText = `
Some text
${simpleTable}
More text
`;
// split docText to find line index of table
const lines = docText.split('\n');
const tableLineIndex = lines.findIndex(l => l.includes('Header 1'));
console.log('Table line index:', tableLineIndex);

const tableInfo = findTableAtPosition(docText, tableLineIndex);
console.log('Found Table:', tableInfo ? 'Yes' : 'No');
if (tableInfo) {
    console.log('Table Content:', tableInfo.content);
}

assert.ok(tableInfo, 'Should find table');
if (tableInfo) {
    assert.ok(tableInfo.content.includes('Header 1'), 'Content should match');
}

console.log('All tests passed!');
