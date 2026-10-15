import '@fontsource/marcellus';
import './app.css'; // first: each component's own rules then win ties with these shared ones
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

createRoot(document.getElementById('app')!).render(<App />);
