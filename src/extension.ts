/**
 * VS Code Markdown Table Editor 拡張機能
 * 
 * Markdownファイル内のテーブルを、ExcelのようなUIで編集するための拡張機能です。
 * 
 * 主な機能:
 * - カーソル位置のMarkdownテーブルを検出してWebviewで開く
 * - Excel風のUIでセル編集、行/列の追加・削除・複製
 * - 編集内容をリアルタイムでMarkdownファイルに反映
 */
import * as vscode from 'vscode';
import { parseMarkdownTable, generateMarkdownTable, findTableAtPosition } from './markdownParser';

/**
 * 拡張機能が有効化されたときに呼び出されます。
 * コマンドの登録やイベントリスナーの設定を行います。
 */
export function activate(context: vscode.ExtensionContext) {

    let currentPanel: vscode.WebviewPanel | undefined = undefined;

    // 'markdownTableEditor.editTable' コマンドを登録します。
    // このコマンドは、ショートカットキー (デフォルト: Ctrl+K E) またはコマンドパレットから実行されます。
    context.subscriptions.push(
        vscode.commands.registerCommand('markdownTableEditor.editTable', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            const document = editor.document;
            const selection = editor.selection;
            const text = document.getText();

            // カーソル位置にあるテーブルを探索します
            const tableInfo = findTableAtPosition(text, selection.active.line);

            if (!tableInfo) {
                vscode.window.showErrorMessage('No Markdown table found at the cursor position.');
                return;
            }

            const tableData = parseMarkdownTable(tableInfo.content);

            if (currentPanel) {
                // 既にパネルが開いている場合は、そのパネルを表示します
                currentPanel.reveal(vscode.ViewColumn.Beside);
            } else {
                // 新しいWebviewパネルを作成します
                currentPanel = vscode.window.createWebviewPanel(
                    'markdownTableEditor',
                    'Edit Table',
                    vscode.ViewColumn.Beside,
                    {
                        enableScripts: true,
                        // distフォルダ内のリソース（スクリプト等）を読み込めるように設定
                        localResourceRoots: [vscode.Uri.file(context.extensionPath)]
                    }
                );

                currentPanel.onDidDispose(() => {
                    currentPanel = undefined;
                }, null, context.subscriptions);

                // Webviewからのメッセージを受信して処理します
                currentPanel.webview.onDidReceiveMessage(
                    message => {
                        switch (message.command) {
                            case 'updateTable':
                                const newData = message.data;
                                const newTableMarkdown = generateMarkdownTable(newData);

                                editor.edit(editBuilder => {
                                    // Make sure we are replacing the CURRENT table content.
                                    // The table might have changed size (previous edits), so we need to find it again.
                                    // We assume the start line hasn't changed drastically or we use the cached start line.
                                    // Robustness: re-scan from the original start line.
                                    const currentText = document.getText();
                                    const currentTableInfo = findTableAtPosition(currentText, tableInfo.range.startLine);

                                    if (currentTableInfo) {
                                        const start = new vscode.Position(currentTableInfo.range.startLine, 0);
                                        const end = new vscode.Position(currentTableInfo.range.endLine, document.lineAt(currentTableInfo.range.endLine).text.length);
                                        const range = new vscode.Range(start, end);
                                        editBuilder.replace(range, newTableMarkdown.trim());

                                        // Update the reference tableInfo if needed, though we find it fresh each time.
                                        // But we must update 'tableInfo' captured in closure if we want to rely on it? 
                                        // No, we just use 'currentTableInfo' derived from 'tableInfo.range.startLine'.
                                        // Note: If startLine moves (due to edits above), this will break. 
                                        // Ideally we track the range using a VS Code feature but for now this fixes the "cell edit -> duplicate rows" bug.
                                    }
                                });
                                return;
                        }
                    },
                    undefined,
                    context.subscriptions
                );

                // Two-way Sync: Update Webview when Markdown changes
                const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
                    if (e.document === document && currentPanel) {
                        // Check if the change is within the table
                        // We need the CURRENT table bounds.
                        const currentText = document.getText();
                        const currentTableInfo = findTableAtPosition(currentText, tableInfo.range.startLine);

                        if (currentTableInfo) {
                            // Check if changes overlap with table
                            // Simple optimization: Just parse and send. The Webview can decide if it needs to update (avoid loop).
                            // But we should debounce this?
                            // For now, let's send it.
                            const newTableData = parseMarkdownTable(currentTableInfo.content);
                            currentPanel.webview.postMessage({
                                command: 'syncData',
                                data: newTableData
                            });
                        }
                    }
                });
                // Ensure subscription is disposed when panel is closed
                currentPanel.onDidDispose(() => {
                    changeDocumentSubscription.dispose();
                    currentPanel = undefined;
                }, null, context.subscriptions);
            }

            // Get path to the webpack bundled webview script
            const scriptPathOnDisk = vscode.Uri.file(
                // @ts-ignore
                // path is available via require in node env but we need to assume files exist relative to this file
                // actually better to use context.extensionPath
                context.extensionPath + '/dist/webview.js'
            );
            const scriptUri = currentPanel.webview.asWebviewUri(scriptPathOnDisk);

            currentPanel.webview.html = getWebviewContent(scriptUri, tableData);
        })
    );
}

/**
 * WebviewのHTMLコンテンツを生成します。
 * Reactアプリケーションのエントリーポイントを含みます。
 */
function getWebviewContent(scriptUri: vscode.Uri, initialData: string[][]) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Table Editor</title>
</head>
<body>
    <div id="root"></div>
    <script>
        window.initialData = ${JSON.stringify(initialData)};
        const vscode = acquireVsCodeApi();
    </script>
    <script src="${scriptUri}"></script>
</body>
</html>`;
}

/**
 * 拡張機能が無効化されたときに呼び出されます。
 * リソースの解放処理などが必要な場合はここに記述します。
 */
export function deactivate() { }
