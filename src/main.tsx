import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles.css';

// 開発用のプレビュー画面。本番の画面からは入れず、URL の末尾に #preview を付けたときだけ開く
const Preview = lazy(() => import('./screens/Preview'));
const isPreview = window.location.hash === '#preview';
window.addEventListener('hashchange', () => window.location.reload());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPreview ? (
      <Suspense fallback={null}>
        <Preview />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
