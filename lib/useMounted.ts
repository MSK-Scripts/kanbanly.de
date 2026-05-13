'use client';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

// Returns true after client-side hydration; false during SSR.
// Use this to gate render of code that touches `document`, `window`, or `createPortal`.
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
