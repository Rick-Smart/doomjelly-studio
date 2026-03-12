import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from "react";

const PlaybackContext = createContext({
  frameIndex: 0,
  setFrameIndex: () => {},
  isPlaying: false,
  setIsPlaying: () => {},
  registerControls: () => {},
  playPlayback: () => {},
  seekTo: () => {},
  pausePlayback: () => {},
  previewAnimIds: [],
  togglePreviewAnim: () => {},
});

export function PlaybackProvider({ children }) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const playRef = useRef(null);
  const seekRef = useRef(null);
  const pauseRef = useRef(null);

  const registerControls = useCallback((play, pause, seek) => {
    playRef.current = play;
    pauseRef.current = pause;
    seekRef.current = seek;
  }, []);

  const playPlayback = useCallback(() => playRef.current?.(), []);
  const seekTo = useCallback((i) => seekRef.current?.(i), []);
  const pausePlayback = useCallback(() => pauseRef.current?.(), []);

  const [previewAnimIds, setPreviewAnimIds] = useState([]);
  // togglePreviewAnim: clicking an eye when nothing is selected enters composite
  // mode (adds active anim + clicked anim); subsequent clicks toggle in/out.
  const togglePreviewAnim = useCallback((id, activeId) => {
    setPreviewAnimIds((prev) => {
      if (prev.length === 0) {
        // Entering composite mode for the first time
        return activeId && activeId !== id ? [activeId, id] : [id];
      }
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id); // empty = back to solo-active mode
      }
      return [...prev, id];
    });
  }, []);

  return (
    <PlaybackContext.Provider
      value={{
        frameIndex,
        setFrameIndex,
        isPlaying,
        setIsPlaying,
        registerControls,
        playPlayback,
        seekTo,
        pausePlayback,
        previewAnimIds,
        togglePreviewAnim,
      }}
    >
      {children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback() {
  return useContext(PlaybackContext);
}
