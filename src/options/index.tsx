import { createRoot } from 'react-dom/client';
import { App } from './App';
import './tailwind.css';

const mount = document.getElementById('root')!;
createRoot(mount).render(<App />);
