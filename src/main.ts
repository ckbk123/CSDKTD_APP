import { createApp } from './app';
import './styles.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Application root not found');
const dispose = createApp(root);
if (import.meta.hot) import.meta.hot.dispose(dispose);
