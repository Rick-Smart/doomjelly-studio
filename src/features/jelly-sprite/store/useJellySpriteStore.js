import { useContext } from "react";
import { JellySpriteStoreCtx } from "../store/JellySpriteProvider";

/**
 * Primary hook for consuming the JellySprite store.
 * Returns { state, dispatch, refs }.
 *
 * Must be used inside a <JellySpriteProvider> — throws a clear error if not.
 */
export function useJellySpriteStore() {
  const ctx = useContext(JellySpriteStoreCtx);
  if (!ctx) {
    throw new Error(
      "useJellySpriteStore must be used inside <JellySpriteProvider>",
    );
  }
  return ctx;
}
