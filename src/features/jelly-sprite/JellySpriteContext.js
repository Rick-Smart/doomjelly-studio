import { createContext, useContext } from "react";

export const JellySpriteCtx = createContext(null);
export const useJellySprite = () => useContext(JellySpriteCtx);
