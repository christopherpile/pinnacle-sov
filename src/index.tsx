import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import ProductionSOVProcessor from './components/ProductionSOVProcessor';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <ProductionSOVProcessor />
  </React.StrictMode>
); 