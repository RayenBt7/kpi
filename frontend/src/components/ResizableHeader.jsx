import React from 'react';

/**
 * ResizableHeader - A table header cell with resize handle
 * @param {string} columnKey - Unique identifier for the column
 * @param {string|React.ReactNode} children - Header label
 * @param {number} width - Current width of the column
 * @param {function} onMouseDown - Function to handle resize start
 * @param {boolean} resizing - Whether this column is currently being resized
 * @param {Object} props - Additional props for the th element
 */
const ResizableHeader = ({ 
  columnKey, 
  children, 
  width, 
  onMouseDown, 
  resizing,
  ...props 
}) => {
  return (
    <th 
      {...props}
      style={{ 
        width: width,
        position: 'relative',
        ...props.style 
      }}
    >
      <div className="resizable-header-content">
        {children}
      </div>
      <div
        className={`resizable-handle ${resizing ? 'resizing' : ''}`}
        onMouseDown={(e) => onMouseDown(e, columnKey)}
      >
        <div className="resizable-handle-line" />
      </div>
    </th>
  );
};

export default ResizableHeader;
