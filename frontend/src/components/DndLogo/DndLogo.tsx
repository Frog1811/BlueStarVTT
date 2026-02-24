interface DndLogoProps {
  size?: number;
  className?: string;
}

function DndLogo({ size = 48, className = '' }: DndLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* D20 Dice Shape */}
      <g>
        {/* Main body of D20 */}
        <path
          d="M50 5 L85 30 L85 70 L50 95 L15 70 L15 30 Z"
          fill="currentColor"
          opacity="0.2"
          stroke="currentColor"
          strokeWidth="2"
        />

        {/* Top facets */}
        <path
          d="M50 5 L85 30 L50 50 Z"
          fill="currentColor"
          opacity="0.3"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M50 5 L15 30 L50 50 Z"
          fill="currentColor"
          opacity="0.25"
          stroke="currentColor"
          strokeWidth="1.5"
        />

        {/* Middle facets */}
        <path
          d="M15 30 L50 50 L15 70 Z"
          fill="currentColor"
          opacity="0.15"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M85 30 L50 50 L85 70 Z"
          fill="currentColor"
          opacity="0.2"
          stroke="currentColor"
          strokeWidth="1.5"
        />

        {/* Bottom facets */}
        <path
          d="M50 95 L15 70 L50 50 Z"
          fill="currentColor"
          opacity="0.1"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M50 95 L85 70 L50 50 Z"
          fill="currentColor"
          opacity="0.15"
          stroke="currentColor"
          strokeWidth="1.5"
        />

        {/* Center lines for definition */}
        <line x1="50" y1="5" x2="50" y2="95" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
        <line x1="15" y1="30" x2="85" y2="30" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
        <line x1="15" y1="70" x2="85" y2="70" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />

        {/* Number 20 in the center */}
        <text
          x="50"
          y="58"
          fontSize="24"
          fontWeight="bold"
          textAnchor="middle"
          fill="currentColor"
          fontFamily="system-ui, sans-serif"
        >
          20
        </text>
      </g>
    </svg>
  );
}

export default DndLogo;

