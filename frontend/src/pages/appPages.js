import { lazy } from 'react';

// Page code loads on demand so /voice doesn't download dashboard/chart code.
// Each loader is kept so the shell can fetch a page's code ahead of time:
// the current page while the PIN is entered, the rest once the app is idle.
const loaders = {
  '/': () => import('./Dashboard'),
  '/transactions': () => import('./Transactions'),
  '/investments': () => import('./Investments'),
  '/cyclic': () => import('./Cyclic'),
  '/analytics': () => import('./Analytics'),
  '/categories': () => import('./Categories'),
  '/settings': () => import('./Settings'),
  '/settings/ai': () => import('./AiSettings'),
  '/settings/ai-training': () => import('./AiTraining'),
  '/settings/email': () => import('./EmailManagement'),
  '/settings/notifications': () => import('./NotificationSettings'),
};

// One import per page: preloading and React.lazy share the same promise.
const started = new Map();
const load = (path) => {
  if (!started.has(path)) {
    const p = loaders[path]().catch((err) => { started.delete(path); throw err; });
    started.set(path, p);
  }
  return started.get(path);
};

export const pages = Object.fromEntries(
  Object.keys(loaders).map((path) => [path, lazy(() => load(path))]),
);

export const preloadPage = (pathname) => {
  if (loaders[pathname]) load(pathname).catch(() => { /* retried on navigation */ });
};

export const preloadAllPages = () => Object.keys(loaders).forEach(preloadPage);
