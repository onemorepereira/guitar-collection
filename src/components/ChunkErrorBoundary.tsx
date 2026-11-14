import { Component, useEffect, type ReactNode } from 'react';

const RELOAD_FLAG = 'chunk-reload-attempted';

const isChunkLoadError = (error: unknown) =>
  error instanceof Error &&
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(
    `${error.name} ${error.message}`
  );

/**
 * Render inside the Suspense boundary next to the lazy screen: it only commits
 * once the screen's code has loaded, so the flag is cleared after a success,
 * never before (which would allow a reload loop).
 */
export const ClearReloadFlag = () => {
  useEffect(() => {
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {
      /* storage blocked */
    }
  }, []);
  return null;
};

/**
 * After a deploy removes old code chunks, a tab that was open on the previous
 * version fails to load the next screen. Reload once to pick up the new
 * version; if that already happened, ask the user instead. Other errors are
 * passed on unchanged.
 */
export class ChunkErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    if (!isChunkLoadError(error)) return;
    try {
      if (!sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, '1');
        window.location.reload();
      }
    } catch {
      /* storage blocked: show the message */
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (!isChunkLoadError(error)) throw error;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-gray-800 dark:text-gray-200">A new version of GuitarHelp is available.</p>
        <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
