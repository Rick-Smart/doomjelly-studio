import { createContext, useContext, useState } from "react";

const PlaybackContext = createContext({
  frameIndex: 0,
  setFrameIndex: () => {},
});

export function PlaybackProvider({ children }) {
  const [frameIndex, setFrameIndex] = useState(0);
  return (
    <PlaybackContext.Provider value={{ frameIndex, setFrameIndex }}>
      {children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback() {
  return useContext(PlaybackContext);
}
