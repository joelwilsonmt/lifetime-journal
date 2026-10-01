import '@fontsource/spectral/400.css';
import '@fontsource/spectral/400-italic.css';
import '@fontsource/spectral/500.css';
import '@fontsource/spectral/600.css';
// Alternate typefaces. Only the faces actually used get downloaded.
import '@fontsource/besley/400.css';
import '@fontsource/besley/400-italic.css';
import '@fontsource/besley/500.css';
import '@fontsource/besley/600.css';
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/400-italic.css';
import '@fontsource/instrument-sans/500.css';
import '@fontsource/instrument-sans/600.css';
import '@fontsource/courier-prime/400.css';
import '@fontsource/courier-prime/400-italic.css';
import '@fontsource/courier-prime/700.css';
import './styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
