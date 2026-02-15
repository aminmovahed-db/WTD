/// <reference types="vite/client" />

import type { KanbanApi } from '../shared/types';

declare global {
  interface Window {
    kanbanApi: KanbanApi;
  }
}
