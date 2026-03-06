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
      }}
    >
      {children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback() {
  return useContext(PlaybackContext);
}
