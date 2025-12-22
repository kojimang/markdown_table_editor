import * as vscode from 'vscode';
import { parseMarkdownTable, generateMarkdownTable, findTableAtPosition } from './markdownParser';

export function activate(context: vscode.ExtensionContext) {
    
    let currentPanel: vscode.WebviewPanel | undefined = undefined;

    context.subscriptions.push(
        vscode.commands.registerCommand('markdownTableEditor.editTable', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            const document = editor.document;
            const selection = editor.selection;
            const text = document.getText();
            
            // Find table at current cursor position
            const tableInfo = findTableAtPosition(text, selection.active.line);

            if (!tableInfo) {
                vscode.window.showErrorMessage('No Markdown table found at the cursor position.');
                return;
            }

            const tableData = parseMarkdownTable(tableInfo.content);

            if (currentPanel) {
                currentPanel.reveal(vscode.ViewColumn.Beside);
            } else {
                currentPanel = vscode.window.createWebviewPanel(
                    'markdownTableEditor',
                    'Edit Table',
                    vscode.ViewColumn.Beside,
                    {
                        enableScripts: true,
                         // To allow loading local resources from the dist folder
                        localResourceRoots: [vscode.Uri.file(context.extensionPath)]
                    }
                );

                currentPanel.onDidDispose(() => {
                    currentPanel = undefined;
                }, null, context.subscriptions);

                // Handle messages from the webview
                currentPanel.webview.onDidReceiveMessage(
                    message => {
                        switch (message.command) {
                            case 'updateTable':
                                const newData = message.data;
                                const newTableMarkdown = generateMarkdownTable(newData);
                                
                                editor.edit(editBuilder => {
                                    // We need to re-calculate the range because the document might have changed? 
                                    // ideally we keep track of the range, but simple for now:
                                    // Use the captured range.
                                    // NOTE: This is simplistic. If the user edits the doc outside, this range might be stale.
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

export function deactivate() {}
