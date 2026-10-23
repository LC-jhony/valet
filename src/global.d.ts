import type { ValetApi } from '../shared/api';

declare global {
  interface Window {
    valet: ValetApi;
  }
}

export {};
