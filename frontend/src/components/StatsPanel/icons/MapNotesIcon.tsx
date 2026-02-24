export default function MapNotesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="24"
      height="24"
    >
      {/* Scroll/parchment background */}
      <path d="M 4 3 L 20 3 Q 21 3 21 4 L 21 20 Q 21 21 20 21 L 4 21 Q 3 21 3 20 L 3 4 Q 3 3 4 3" />
      {/* Text lines */}
      <line x1="7" y1="8" x2="17" y2="8" strokeWidth="1.5" />
      <line x1="7" y1="12" x2="17" y2="12" strokeWidth="1.5" />
      <line x1="7" y1="16" x2="14" y2="16" strokeWidth="1.5" />
    </svg>
  );
}

