// Simple stroke icons, drawn to sit inside .chrome-icon tiles.
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24" };

export const IconPencil = () => (
  <svg {...base}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>
);
export const IconLock = () => (
  <svg {...base}><rect x="5" y="10.5" width="14" height="9.5" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /><circle cx="12" cy="15.2" r="1.2" /></svg>
);
export const IconCamera = () => (
  <svg {...base}><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.4-2h5l1.4 2h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-8Z" /><circle cx="12" cy="12.5" r="3.5" /></svg>
);
export const IconRelease = () => (
  <svg {...base}><circle cx="12" cy="12" r="8" /><path d="M9.5 9.6c.4-.9 1.4-1.5 2.6-1.5 1.5 0 2.6.8 2.6 2s-1 1.7-2.6 2-2.7.8-2.7 2 1.1 2 2.7 2c1.2 0 2.2-.6 2.6-1.5M12 6.5v1.6M12 15.9v1.6" /></svg>
);
export const IconCheck = () => (
  <svg {...base}><path d="m5 12.5 4.2 4.2L19 7" /></svg>
);
export const IconRetry = () => (
  <svg {...base}><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" /><path d="M4 4v4.5h4.5" /></svg>
);
export const IconUser = () => (
  <svg {...base}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
);
export const IconUnlock = () => (
  <svg {...base}><rect x="5" y="10.5" width="14" height="9.5" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 7.6-1.7" /></svg>
);
export const ChevronLeft = () => (
  <svg {...base} width="18" height="18"><path d="m14.5 6-6 6 6 6" /></svg>
);
export const ChevronRight = () => (
  <svg {...base} width="18" height="18"><path d="m9.5 6 6 6-6 6" /></svg>
);
