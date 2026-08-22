export {};

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        theone?: {
          postMessage: (message: { type: string; tab?: string; payload?: unknown }) => void;
        };
      };
    };
  }
}
