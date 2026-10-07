import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles.css';
import App from './App';
import './reference-design.css';

createRoot(document.getElementById('root')).render(<BrowserRouter><App /></BrowserRouter>);
