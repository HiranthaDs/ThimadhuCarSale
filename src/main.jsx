import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles.css';
import App from './App';
import './reference-design.css';
import './mobile.css';
import './dealership-home.css';
import './dealership-shell.css';

createRoot(document.getElementById('root')).render(<BrowserRouter><App /></BrowserRouter>);
