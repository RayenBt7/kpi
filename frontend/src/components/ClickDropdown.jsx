import { useRef, useEffect } from 'react';

/**
 * Reusable click-based dropdown component
 * - Toggles on click (not hover)
 * - Closes when clicking outside the dropdown
 * - Supports keyboard accessibility (Escape to close)
 */
function ClickDropdown({
  trigger,
  children,
  isOpen,
  onToggle,
  className = '',
  align = 'left',
}) {
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onToggle(false);
      }
    };

    // Close on Escape key
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onToggle(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onToggle]);

  return (
    <div
      className={`click-dropdown ${className} ${isOpen ? 'open' : ''}`}
      ref={dropdownRef}
    >
      <div className="click-dropdown-trigger" onClick={() => onToggle(!isOpen)}>
        {trigger}
      </div>
      <div
        className={`click-dropdown-menu ${align === 'right' ? 'align-right' : ''}`}
        role="menu"
        aria-label="Dropdown menu"
      >
        {children}
      </div>
    </div>
  );
}

export default ClickDropdown;
