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
                                    // 編集範囲を再計算して置き換えます
                                    // 注意: ドキュメントが外部で編集された場合、範囲がずれる可能性がありますが、
                                    // 現状はシンプルにカーソル位置のテーブル範囲を使用します。
                                    const start = new vscode.Position(tableInfo.range.startLine, 0);
                                    const end = new vscode.Position(tableInfo.range.endLine, document.lineAt(tableInfo.range.endLine).text.length);
                                    const range = new vscode.Range(start, end);

                                    editBuilder.replace(range, newTableMarkdown.trim());
                                });
                                return;
                        }
                    },
                    undefined,
                    context.subscriptions
                );
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
