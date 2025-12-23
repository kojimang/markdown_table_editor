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

    // 列幅の管理 (各列の幅を保持)
    const [colWidths, setColWidths] = useState<number[]>([]);
    
    // リサイズ中の状態
    const [isResizing, setIsResizing] = useState<{ index: number; startX: number; startWidth: number } | null>(null);

    // 1列目を行番号として扱うかどうか
    const [isRowIndexColumn, setIsRowIndexColumn] = useState<boolean>(false);

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

    // データ初期化時に列幅の初期値を設定 (初回のみ)
    useEffect(() => {
        if (initialData.length > 0 && colWidths.length === 0) {
            // 文字数ベースで簡易的に計算、または固定値
            setColWidths(new Array(initialData[0].length).fill(150));
        } else if (data.length > 0 && data[0].length !== colWidths.length) {
            // 列数が増減した場合の同期
            const newWidths = [...colWidths];
            if (data[0].length > colWidths.length) {
                // 増えた分をデフォルト幅で追加
                for (let i = colWidths.length; i < data[0].length; i++) {
                    newWidths.push(150);
                }
            } else {
                // 減った分を削除
                newWidths.length = data[0].length;
            }
            setColWidths(newWidths);
        }
    }, [data[0].length]);

    // リサイズ処理 (Global mouse events)
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            
            const diff = e.clientX - isResizing.startX;
            const newWidth = Math.max(50, isResizing.startWidth + diff); // 最小幅 50px
            
            setColWidths(prev => {
                const next = [...prev];
                next[isResizing.index] = newWidth;
                return next;
            });
        };

        const handleMouseUp = () => {
             setIsResizing(null);
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    // Handle messages from VS Code
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            switch (message.command) {
                case 'syncData': 
                    // Receive data from VS Code (Markdown change)
                    const newData = message.data;
                    // Check if data is actually different to avoid loops/unnecessary renders
                    if (JSON.stringify(newData) !== JSON.stringify(data)) {
                        setData(newData);
                    }
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [data]); // Depend on data for comparison

    // 行番号列の設定が変更された場合や、行数が変わった場合に番号を更新
    useEffect(() => {
        if (isRowIndexColumn) {
            updateRowNumbers();
        }
    }, [isRowIndexColumn, data.length]);

    const updateRowNumbers = () => {
        const newData = data.map((row, index) => {
            // ヘッダー行(index 0)の場合はスキップするか、特別な扱いにしたいが
            // 現状の実装では data[0] はヘッダーとして扱われているため、
            // データ行は index 1 から始まる。
            // しかし data は全データを含むので、index 0 はヘッダー。
            // ここではデータ行(1以降)の1列目を更新する
            if (index === 0) return row; // ヘッダーは変更しない（または空にする？）
            const newRow = [...row];
            newRow[0] = String(index); // 行番号 (1-based index)
            return newRow;
        });
        
        // 変更がある場合のみ更新 (無限ループ防止)
        if (JSON.stringify(newData) !== JSON.stringify(data)) {
            setData(newData);
        }
    };

    /**
     * セルの内容が変更されたときに呼び出されます。
     * ステートを更新し、useEffect経由でVS Codeに通知されます。
     */

    const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
        // 行番号列が有効な場合、1列目は編集不可
        if (isRowIndexColumn && colIndex === 0 && rowIndex > 0) {
            return;
        }
        // Save as <br> internally
        const newValue = value.replace(/\n/g, '<br>');
        const newData = data.map((row) => [...row]);
        newData[rowIndex][colIndex] = newValue;
        setData(newData);
    };

    /**
     * セルにフォーカスが当たったときに呼び出されます。
     * アクティブなセルを追跡します。
     */

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
        
        // 行番号列が有効な場合、新しい行の1列目に番号をセット
        if (isRowIndexColumn) {
            // ここでは空文字を入れておき、useEffectで番号が再計算されるのを待つか、
            // 即座に計算する。useEffectにお任せするのがシンプル。
           newRow[0] = ''; 
        }

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
        
        // Update column widths
        setColWidths(prev => {
            const newWidths = [...prev];
            const actualIndex = Math.min(Math.max(insertIndex, 0), newWidths.length);
            newWidths.splice(actualIndex, 0, 150);
            return newWidths;
        });

        setData(newData);
    };

    /**
     * 指定した行を削除します。
     * 行が1つしかない場合は削除しません。
     */

    const removeRow = (index: number) => {
        if (data.length <= 1) return;
        const newData = data.filter((_, i) => i !== index);
        setData(newData);
    };

    /**
     * 指定した列を削除します。
     * 列が1つしかない場合は削除しません。
     */

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
            const el = document.getElementById(`cell-${rowIndex}-${colIndex}`) as HTMLInputElement | HTMLTextAreaElement;
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

    /**
     * キーボードイベントを処理します。
     * ショートカットキーによる操作およびナビゲーションを実装しています。
     */

    const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
        // Shift + Enter: 改行を許可 (デフォルト動作)
        if (e.shiftKey && e.key === 'Enter') {
            e.stopPropagation(); // 他のハンドラに伝播しないようにする (例えば行追加など)
            return;
        }

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
                    // 行番号列が有効な場合、2列目(index 1)へ移動
                    const nextColIndex = isRowIndexColumn ? 1 : 0;
                    focusCell(rowIndex + 1, nextColIndex);
                } else {
                    // 最後の行の最後の列の場合は何もしない (将来的に新しい行を追加するオプションも検討可能)
                }
            } else {
                focusCell(rowIndex, colIndex + 1);
            }
        }
    };

    /**
     * リサイズ開始
     */
    const startResize = (index: number, e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing({
            index,
            startX: e.clientX,
            startWidth: colWidths[index] || 150
        });
    };

    /**
     * 自動調整 (ダブルクリック)
     */
    const autoFitColumn = (index: number) => {
        // Find max content width (approximate)
        let maxLen = 1; // min chars
        for (const row of data) {
             if (row[index]) {
                 // シンプルに文字数、全角は2文字分換算などのロジックを入れるとベター
                 // ここでは簡易的に文字数 * 1.5 (マルチバイトなど考慮) ぐらいで計算してみる
                 let len = 0;
                 for (let i = 0; i < row[index].length; i++) {
                     len += row[index].charCodeAt(i) > 255 ? 2 : 1;
                 }
                 maxLen = Math.max(maxLen, len);
             }
        }
        // フォントサイズなどによるが、概算: 文字数 * 8px + padding
        const newWidth = Math.max(50, Math.min(500, maxLen * 10 + 20));
        setColWidths(prev => {
            const next = [...prev];
            next[index] = newWidth;
            return next;
        });
    };

    return (
        <div className="table-editor-container">
            <div className="toolbar">
                <button 
                    onClick={() => addRow()} 
                    title="Ctrl + Enter"
                    onMouseDown={(e) => e.preventDefault()} // フォーカスが外れるのを防ぐ
                    style={{ flexShrink: 0 }}
                >
                    行追加
                </button>
                <button 
                    onClick={() => addColumn()}
                    onMouseDown={(e) => e.preventDefault()} // フォーカスが外れるのを防ぐ
                    style={{ flexShrink: 0 }}
                >
                    列追加
                </button>
                <label style={{ display: 'flex', alignItems: 'center', marginLeft: '10px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                    <input 
                        type="checkbox" 
                        checked={isRowIndexColumn} 
                        onChange={(e) => setIsRowIndexColumn(e.target.checked)} 
                    />
                    1列目を行番号として扱う
                </label>
            </div>
            <div className="table-wrapper">
                <table style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                         <col style={{ width: '30px' }} />
                         {colWidths.map((width, i) => (
                             <col key={`col-${i}`} style={{ width: `${width}px` }} />
                         ))}
                    </colgroup>
                    <thead>
                        <tr>
                            <th className="row-action-header"></th>
                            {data[0].map((cell, colIndex) => (
                                <th key={`header-${colIndex}`} style={{ position: 'relative' }}>
                                    <div className="cell-wrapper">
                                        <input
                                            id={`cell-0-${colIndex}`}
                                            type="text"
                                            value={cell.replace(/<br>/g, '\n')}
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
                                        <div 
                                            className="resizer"
                                            onMouseDown={(e) => startResize(colIndex, e)}
                                            onDoubleClick={() => autoFitColumn(colIndex)}
                                        />
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
                                        <td key={`cell-${rowIndex}-${colIndex}`} style={{ position: 'relative' }}>
                                             <textarea
                                                id={`cell-${rowIndex}-${colIndex}`}
                                                value={cell.replace(/<br>/g, '\n')}
                                                onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                                                onFocus={() => handleFocus(rowIndex, colIndex)}
                                                onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                                readOnly={isRowIndexColumn && colIndex === 0}
                                                style={isRowIndexColumn && colIndex === 0 ? { backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)', cursor: 'default' } : {}}
                                                rows={1}
                                            />
                                            <div 
                                                className="resizer"
                                                onMouseDown={(e) => startResize(colIndex, e)}
                                                onDoubleClick={() => autoFitColumn(colIndex)}
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
