import React, { useState, useEffect } from 'react';

interface TableEditorProps {
    initialData: string[][];
}

/**
 * テーブル編集コンポーネント (ExcelライクなUI)
 * 
 * 主な機能:
 * - データの表示と編集
 * - キーボードショートカットによる操作 (Ctrl+Enterで行追加、Shift+Alt+Downで行複製など)
 * - VS Code拡張機能とのデータ同期
 */
const TableEditor: React.FC<TableEditorProps> = ({ initialData }) => {
    // データがない場合は空のテーブルで初期化
    const [data, setData] = useState<string[][]>(initialData.length > 0 ? initialData : [['', ''], ['', '']]);

    // ツールバー操作のためにアクティブなセルを追跡
    const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);

    // データ変更時にVS Codeへメッセージを送信 (反映)
    // パフォーマンスのためにデバウンス処理を入れることも検討できますが、
    // タイピングの即時反映のために現状は300msの遅延で行っています。
    useEffect(() => {
        const timer = setTimeout(() => {
             // @ts-ignore
            if (typeof vscode !== 'undefined') {
                 // @ts-ignore
                vscode.postMessage({
                    command: 'updateTable',
                    data: data
                });
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [data]);

    const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
        const newData = data.map((row) => [...row]);
        newData[rowIndex][colIndex] = value;
        setData(newData);
    };

    const handleFocus = (rowIndex: number, colIndex: number) => {
        setActiveCell({ row: rowIndex, col: colIndex });
    };

    /**
     * 行を追加します。デフォルトではアクティブな行の下に追加します。
     * @param indexOffset アクティブ行からのオフセット (1なら下、0なら上など)
     */
    const addRow = (indexOffset: number = 1) => { // デフォルトは下に追加 (offset 1)
        const insertIndex = activeCell ? activeCell.row + indexOffset : data.length;
        const newRow = new Array(data[0].length).fill('');
        const newData = [...data];
        // Clamp index
        const actualIndex = Math.min(Math.max(insertIndex, 0), newData.length);
        newData.splice(actualIndex, 0, newRow);
        setData(newData);
    };

    /**
     * 列を追加します。デフォルトではアクティブな列の右に追加します。
     */
    const addColumn = (indexOffset: number = 1) => { // デフォルトは右に追加 (offset 1)
        // アクティブなセルがない場合は末尾に追加
        const insertIndex = activeCell ? activeCell.col + indexOffset : data[0].length;
        const newData = data.map(row => {
             const newRow = [...row];
             const actualIndex = Math.min(Math.max(insertIndex, 0), newRow.length);
             newRow.splice(actualIndex, 0, '');
             return newRow;
        });
        setData(newData);
    };

    const removeRow = (index: number) => {
        if (data.length <= 1) return;
        const newData = data.filter((_, i) => i !== index);
        setData(newData);
    };

    const removeColumn = (index: number) => {
        if (data[0].length <= 1) return;
        const newData = data.map(row => row.filter((_, i) => i !== index));
        setData(newData);
    };

    /**
     * 指定した行を複製して、その直下に挿入します。
     */
    const duplicateRow = (rowIndex: number) => {
        // 現在の行データをコピー
        const newRow = [...data[rowIndex]];
        const newData = [...data];
        // Insert it below the current row
        newData.splice(rowIndex + 1, 0, newRow);
        setData(newData);
    };

    /**
     * 特定のセルにフォーカスを移動し、テキストを選択状態にします。
     */
    const focusCell = (rowIndex: number, colIndex: number) => {
        // レンダリング完了を待つためにsetTimeoutを使用
        setTimeout(() => {
            const el = document.getElementById(`cell-${rowIndex}-${colIndex}`) as HTMLInputElement;
            if (el) {
                el.focus();
                // Select text for easier editing
                el.select();
                setActiveCell({ row: rowIndex, col: colIndex });
            } else {
                console.warn('Could not find cell to focus:', rowIndex, colIndex);
            }
        }, 50);
    };

    const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
        // Shift + Alt + 下矢印: 行の複製
        if (e.shiftKey && e.altKey && e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            duplicateRow(rowIndex);
            focusCell(rowIndex + 1, colIndex);
            return;
        }

        // Ctrl + Enter: 下に行を追加
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            addRow(1); // Insert 1 below current
            // Focus the same column in the new row
            focusCell(rowIndex + 1, colIndex);
            return;
        }

        // Enter: 右隣のセルへ移動 / 行末なら次の行の先頭へラップ
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            const isLastCol = colIndex === data[0].length - 1;
            if (isLastCol) {
                // 次の行の最初の列へ移動
                if (rowIndex < data.length - 1) {
                    focusCell(rowIndex + 1, 0);
                } else {
                    // 最後の行の最後の列の場合は何もしない (将来的に新しい行を追加するオプションも検討可能)
                }
            } else {
                focusCell(rowIndex, colIndex + 1);
            }
        }
    };

    return (
        <div className="table-editor-container">
            <div className="toolbar">
                <button 
                    onClick={() => addRow()} 
                    title="Ctrl + Enter"
                    onMouseDown={(e) => e.preventDefault()} // フォーカスが外れるのを防ぐ
                >
                    行追加
                </button>
                <button 
                    onClick={() => addColumn()}
                    onMouseDown={(e) => e.preventDefault()} // フォーカスが外れるのを防ぐ
                >
                    列追加
                </button>
            </div>
            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th className="row-action-header"></th>
                            {data[0].map((cell, colIndex) => (
                                <th key={`header-${colIndex}`}>
                                    <div className="cell-wrapper">
                                        <input
                                            id={`cell-0-${colIndex}`}
                                            type="text"
                                            value={cell}
                                            onChange={(e) => handleCellChange(0, colIndex, e.target.value)}
                                            onFocus={() => handleFocus(0, colIndex)}
                                            onKeyDown={(e) => handleKeyDown(e, 0, colIndex)}
                                        />
                                        <button 
                                            className="delete-btn" 
                                            onClick={() => removeColumn(colIndex)} 
                                            onMouseDown={(e) => e.preventDefault()}
                                            tabIndex={-1}
                                        >×</button>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.slice(1).map((row, rIndex) => {
                            const rowIndex = rIndex + 1;
                            return (
                                <tr key={`row-${rowIndex}`}>
                                    <td>
                                        <button 
                                            className="delete-btn row-btn" 
                                            onClick={() => removeRow(rowIndex)} 
                                            onMouseDown={(e) => e.preventDefault()}
                                            tabIndex={-1}
                                        >×</button>
                                    </td>
                                    {row.map((cell, colIndex) => (
                                        <td key={`cell-${rowIndex}-${colIndex}`}>
                                             <input
                                                id={`cell-${rowIndex}-${colIndex}`}
                                                type="text"
                                                value={cell}
                                                onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                                                onFocus={() => handleFocus(rowIndex, colIndex)}
                                                onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TableEditor;
