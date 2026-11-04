import React from 'react';

const StaticPage = ({ title, theme = 'dark', children }) => {
  const isDark = theme === 'dark';

  return (
    <div className={`page-container ${isDark ? 'dark' : 'light'}`}>
      <div className="page-content">
        <h1 className={`title ${isDark ? 'dark' : 'light'}`}>{title}</h1>
        <div className={`leading-relaxed ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default StaticPage;
