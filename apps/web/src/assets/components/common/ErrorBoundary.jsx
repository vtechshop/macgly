import { Component } from 'react';
import { WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';

const isChunkError = (err) => /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(String(err?.message || err));
const RELOAD_KEY = 'macgly_chunk_reload';

/**
 * Replaces a blank screen with a message and a Retry button when a page fails
 * to render, most often because its code could not be downloaded (connection
 * dropped mid-load, or the cached page points at code from an older deploy).
 */
export default class ErrorBoundary extends Component {
  state = { error: null, offline: false };

  static getDerivedStateFromError(error) {
    return { error, offline: typeof navigator !== 'undefined' && navigator.onLine === false };
  }

  componentDidCatch(error) {
    console.error('[ErrorBoundary]', error);
    // Online but the page's code is missing: usually a new deploy replaced the
    // file. One automatic reload picks up the new version; the flag stops loops.
    if (isChunkError(error) && navigator.onLine !== false) {
      let recent = true; // if storage is blocked, never auto-reload (no way to stop a loop)
      try {
        recent = Date.now() - Number(sessionStorage.getItem(RELOAD_KEY) || 0) < 60_000;
        if (!recent) sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      } catch { /* storage blocked */ }
      if (!recent) window.location.reload();
    }
  }

  componentDidMount() {
    this.onOnline = () => { if (this.state.error) window.location.reload(); };
    window.addEventListener('online', this.onOnline);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.onOnline);
  }

  render() {
    const { error, offline } = this.state;
    if (!error) return this.props.children;

    const chunk = isChunkError(error);
    const Icon = offline ? WifiOff : AlertTriangle;
    const title = offline ? "You're offline" : chunk ? "This page couldn't load" : 'Something went wrong';
    const text = offline
      ? 'Check your internet connection. The page will reload automatically when you are back online.'
      : chunk
        ? 'Part of the page did not download. This usually fixes itself when you try again.'
        : 'An unexpected error stopped this page from loading. Please try again.';

    return (
      <div role="alert" className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6 py-16">
        <Icon size={40} className="text-secondary-400" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-bold text-secondary-900">{title}</h1>
        <p className="mt-2 max-w-sm text-sm text-secondary-600">{text}</p>
        <button type="button" onClick={() => window.location.reload()} className="btn-primary mt-6 px-6 py-2.5 text-sm font-semibold">
          <RefreshCw size={15} aria-hidden="true" /> Try again
        </button>
      </div>
    );
  }
}
