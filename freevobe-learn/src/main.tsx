import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LearnApp } from '@/components/learn/learn-app';
import './styles.css';

/*
 * Appen har inget eget tema-val: den följer systemet. Ljust läge läggs som klass på <html>,
 * vilket är samma krok som CSS-tokenöversättningen i styles.css lyssnar på.
 */
if (window.matchMedia('(prefers-color-scheme: light)').matches) {
  document.documentElement.classList.add('light');
}

const root = document.getElementById('root');
if (!root) throw new Error('Sidan saknar #root');

createRoot(root).render(
  <StrictMode>
    <LearnApp />
  </StrictMode>,
);
