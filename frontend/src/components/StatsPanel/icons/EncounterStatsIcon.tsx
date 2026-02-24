export default function EncounterStatsIcon() {
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
      {/* Sword blade */}
      <path d="M 12 2 L 14 8 L 12 14 L 10 8 Z" />
      {/* Sword hilt */}
      <rect x="10" y="14" width="4" height="2" />
      {/* Sword guard */}
      <line x1="8" y1="16" x2="16" y2="16" />
      {/* Sword grip */}
      <rect x="10.5" y="16" width="3" height="6" />
    </svg>
  );
}

