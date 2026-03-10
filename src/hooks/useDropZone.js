import { useState, useCallback, useRef } from "react";

export function useDropZone({ accept, onFile }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && (!accept || file.type === accept)) {
        onFile(file);
      }
    },
    [accept, onFile],
  );

  const handleInputChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (file) {
        onFile(file);
        // Reset so the same file can be re-selected
        e.target.value = "";
      }
    },
    [onFile],
  );

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const dropZoneProps = {
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };

  return { isDragging, dropZoneProps, inputRef, handleInputChange, openPicker };
}
