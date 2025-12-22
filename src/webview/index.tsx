import React from 'react';
import { createRoot } from 'react-dom/client';
import TableEditor from './TableEditor';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<TableEditor initialData={window.initialData} />);
}
