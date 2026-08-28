import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  // Calculate actual theme ('light' or 'dark')
  const getSystemTheme = () => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;

  const applyThemeToDOM = useCallback((currentTheme) => {
    const root = document.documentElement;
    root.dataset.theme = currentTheme;
    root.style.colorScheme = currentTheme;
  }, []);

  // Set theme with smooth circular transition if supported
  const setTheme = useCallback((newTheme, event = null) => {
    const targetTheme = typeof newTheme === 'function' ? newTheme(theme) : newTheme;
    const targetResolved = targetTheme === 'system' ? getSystemTheme() : targetTheme;

    // If View Transitions API is supported and click event is provided
    if (
      event &&
      typeof document.startViewTransition === 'function' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      const x = event.clientX ?? window.innerWidth / 2;
      const y = event.clientY ?? window.innerHeight / 2;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const transition = document.startViewTransition(() => {
        setThemeState(targetTheme);
        localStorage.setItem('theme', targetTheme);
        applyThemeToDOM(targetResolved);
      });

      transition.ready.then(() => {
        const clipPath = [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`
        ];
        document.documentElement.animate(
          {
            clipPath: targetResolved === 'dark' ? clipPath : [...clipPath].reverse()
          },
          {
            duration: 450,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            pseudoElement: targetResolved === 'dark' ? '::view-transition-new(root)' : '::view-transition-old(root)'
          }
        );
      });
    } else {
      setThemeState(targetTheme);
      localStorage.setItem('theme', targetTheme);
      applyThemeToDOM(targetResolved);
    }
  }, [theme, applyThemeToDOM]);

  const toggleTheme = useCallback((event = null) => {
    const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme, event);
  }, [resolvedTheme, setTheme]);

  // Initial & updates DOM synchronization
  useEffect(() => {
    applyThemeToDOM(resolvedTheme);
  }, [resolvedTheme, applyThemeToDOM]);

  // Listen to system theme preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyThemeToDOM(getSystemTheme());
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, applyThemeToDOM]);

  // Synchronize across browser tabs
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'theme' && e.newValue) {
        setThemeState(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = {
    theme,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    setTheme,
    toggleTheme
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
