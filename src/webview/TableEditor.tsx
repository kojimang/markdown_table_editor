import React, { useState, useEffect } from 'react';

interface TableEditorProps {
    initialData: string[][];
}

const TableEditor: React.FC<TableEditorProps> = ({ initialData }) => {
    // Ensure we have at least one row and col
    const [data, setData] = useState<string[][]>(initialData.length > 0 ? initialData : [['', ''], ['', '']]);

    // Track active cell for toolbar actions
    const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);

    // Send update to VS Code whenever data changes
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

    const addRow = (indexOffset: number = 1) => { // default insert below (offset 1)
        const insertIndex = activeCell ? activeCell.row + indexOffset : data.length;
        const newRow = new Array(data[0].length).fill('');
        const newData = [...data];
        // Clamp index
        const actualIndex = Math.min(Math.max(insertIndex, 0), newData.length);
        newData.splice(actualIndex, 0, newRow);
        setData(newData);
    };

    const addColumn = (indexOffset: number = 1) => { // default insert right (offset 1)
        // If no active cell, append to end
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

    const focusCell = (rowIndex: number, colIndex: number) => {
        // Use requestAnimationFrame or setTimeout to allow render to complete
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
        // Ctrl + Enter: Add Row Below
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            addRow(1); // Insert 1 below current
            // Focus the same column in the new row
            focusCell(rowIndex + 1, colIndex);
            return;
        }

        // Enter: Move Right / Wrap
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            const isLastCol = colIndex === data[0].length - 1;
            if (isLastCol) {
                // Move to next row, first col
                if (rowIndex < data.length - 1) {
                    focusCell(rowIndex + 1, 0);
                } else {
                    // Last row, last col -> optional wrapping or do nothing
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
                    onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
                >
                    行追加
                </button>
                <button 
                    onClick={() => addColumn()}
                    onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
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
