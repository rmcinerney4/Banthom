import React from 'react';
import ReactDOM from 'react-dom';
import { App } from './App.jsx';

document.documentElement.lang = 'en';
const mount = document.getElementById('root');
if (window.React && window.ReactDOM && ReactDOM.createRoot) {
  ReactDOM.createRoot(mount).render(<App />);
} else {
  mount.innerHTML = '<div class="boot" role="alert">Banthom could not load its interface library. Check your connection and reload the page.</div>';
}
