export default function PlayerStatsIcon() {
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
      {/* Head circle */}
      <circle cx="12" cy="8" r="4" />
      {/* Body */}
      <path d="M 12 12 L 12 18" />
      {/* Left arm */}
      <path d="M 12 14 L 8 10" />
      {/* Right arm */}
      <path d="M 12 14 L 16 10" />
      {/* Left leg */}
      <path d="M 12 18 L 9 24" />
      {/* Right leg */}
      <path d="M 12 18 L 15 24" />
    </svg>
  );
}

