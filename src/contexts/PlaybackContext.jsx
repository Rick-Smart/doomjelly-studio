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
  registerControls: () => {},
  seekTo: () => {},
  pausePlayback: () => {},
});

export function PlaybackProvider({ children }) {
  const [frameIndex, setFrameIndex] = useState(0);
  const seekRef = useRef(null);
  const pauseRef = useRef(null);

  const registerControls = useCallback((seek, pause) => {
    seekRef.current = seek;
    pauseRef.current = pause;
  }, []);

  const seekTo = useCallback((i) => seekRef.current?.(i), []);
  const pausePlayback = useCallback(() => pauseRef.current?.(), []);

  return (
    <PlaybackContext.Provider
      value={{
        frameIndex,
        setFrameIndex,
        registerControls,
        seekTo,
        pausePlayback,
      }}
    >
      {children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback() {
  return useContext(PlaybackContext);
}
