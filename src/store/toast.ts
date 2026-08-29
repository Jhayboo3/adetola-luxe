"use client";

import { create } from "zustand";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastEntry {
  id: number;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastStore {
  toasts: ToastEntry[];
  show: (message: string, type?: ToastType, title?: string) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  show: (message, type = "success", title) => {
    const id = ++counter;
    set((state) => ({ toasts: [...state.toasts, { id, type, message, title }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
