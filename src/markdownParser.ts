
/**
 * Markdownテキストを解析して、2次元配列のグリッドデータに変換します。
 * @param text Markdownのテーブル文字列
 * @returns 文字列の2次元配列 (行 x 列)
 */
export function parseMarkdownTable(text: string): string[][] {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) {
        return [];
    }

    const rows = lines.map(line => {
        // Simple regex to split by pipe, ignoring escaped pipes could be added later if needed
        const cells = line.split('|').map(cell => cell.trim());
        // Remove first and last empty elements if the row starts/ends with a pipe
        if (line.trim().startsWith('|')) cells.shift();
        if (line.trim().endsWith('|')) cells.pop();
        return cells;
    });

    // Remove the separator line (usually the second line e.g. |---|---|)
    // We assume the second line is structural if it contains dashes
    if (rows.length > 1 && rows[1].every(cell => cell.match(/^[-:]+$/))) {
        rows.splice(1, 1);
    }

    return rows;
}

/**
 * 2次元配列のグリッドデータからMarkdownのテーブル文字列を生成します。
 * 列幅を計算して整形します。
 * @param data 文字列の2次元配列
 * @returns 整形されたMarkdownテーブル文字列
 */
export function generateMarkdownTable(data: string[][]): string {
    if (data.length === 0) return '';

    // Calculate column widths for pretty printing
    const colWidths: number[] = new Array(data[0].length).fill(0);
    data.forEach(row => {
        row.forEach((cell, i) => {
            // Handle case where row might be shorter than header
            if (i < colWidths.length) {
                colWidths[i] = Math.max(colWidths[i], cell.length);
            }
        });
    });

    // Ensure minimum width of 3 for "---"
    for (let i = 0; i < colWidths.length; i++) {
        colWidths[i] = Math.max(colWidths[i], 3);
    }

    const formatRow = (row: string[]) => {
        return '| ' + row.map((cell, i) => cell.padEnd(colWidths[i] || 0)).join(' | ') + ' |';
    };

    const header = data[0];
    const body = data.slice(1);

    const separator = colWidths.map(w => '-'.repeat(w));

    let result = formatRow(header) + '\n';
    result += '| ' + separator.join(' | ') + ' |\n';

    body.forEach(row => {
        result += formatRow(row) + '\n';
    });

    return result;
}

/**
 * 指定された行番号にあるテーブルを探し、その範囲と内容を返します。
 * 上下に探索を行ってテーブルの全範囲を特定します。
 * @param documentText ドキュメント全体のテキスト
 * @param lineIndex 探索を開始する行番号
 * @returns テーブルの情報 (範囲と内容)、または見つからない場合はnull
 */
export function findTableAtPosition(documentText: string, lineIndex: number): { range: { startLine: number, endLine: number }, content: string } | null {
    const lines = documentText.split(/\r?\n/);

    // Check if current line is part of a table
    if (!lines[lineIndex].trim().includes('|')) {
        return null;
    }

    let startLine = lineIndex;
    let endLine = lineIndex;

    // Expand upwards
    while (startLine > 0 && lines[startLine - 1].trim().includes('|')) {
        startLine--;
    }

    // Expand downwards
    while (endLine < lines.length - 1 && lines[endLine + 1].trim().includes('|')) {
        endLine++;
    }

    const content = lines.slice(startLine, endLine + 1).join('\n');
    return {
        range: { startLine, endLine },
        content
    };
}
