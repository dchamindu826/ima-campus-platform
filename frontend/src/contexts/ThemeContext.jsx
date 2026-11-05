import React, { createContext, useState, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // appTheme: 'classic' (Glassmorphism & Wallpapers) | 'modern' (Clean SaaS UI)
  const [appTheme, setAppTheme] = useState(() => {
    const isExplicit = localStorage.getItem('appTheme_explicit');
    if (isExplicit === 'true') {
      return localStorage.getItem('appTheme') || 'classic';
    }
    // Default to 'classic' (Glass & Wallpapers) for everyone on the web
    return 'classic';
  });

  // isDarkMode: boolean
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('themeMode');
    return saved !== null ? saved === 'dark' : true;
  });

  // bgImage: wallpaper/gradient/live anim for Classic theme
  const [bgImage, setBgImage] = useState(() => {
    return localStorage.getItem('adminTheme') || 'wall1';
  });

  useEffect(() => {
    localStorage.setItem('appTheme', appTheme);
    document.documentElement.dataset.theme = appTheme;
  }, [appTheme]);

  useEffect(() => {
    localStorage.setItem('themeMode', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('adminTheme', bgImage);
  }, [bgImage]);

  const toggleThemeMode = () => {
    // Disable any heavy transitions during theme change to prevent freezing/lag
    document.documentElement.classList.add('no-transitions');

    setIsDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('themeMode', next ? 'dark' : 'light');
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });

    // Re-enable interactive transitions on next animation frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove('no-transitions');
      });
    });
  };

  return (
    <ThemeContext.Provider value={{
      appTheme,
      setAppTheme,
      isDarkMode,
      setIsDarkMode,
      toggleThemeMode,
      bgImage,
      setBgImage,
      theme: isDarkMode ? 'dark' : 'light'
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);