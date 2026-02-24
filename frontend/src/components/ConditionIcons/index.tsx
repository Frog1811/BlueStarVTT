// SVG icons for D&D 5e conditions
export const ConditionIcons = {
  Blinded: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 5C7 5 2.73 8.11 1 12.5 2.73 16.89 7 20 12 20s9.27-3.11 11-7.5C21.27 8.11 17 5 12 5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="2"/>
      <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),

  Charmed: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor"/>
      <circle cx="8" cy="9" r="1.5" fill="white"/>
      <circle cx="16" cy="9" r="1.5" fill="white"/>
    </svg>
  ),

  Deafened: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2a6 6 0 0 0-6 6v4a6 6 0 0 0 12 0V8a6 6 0 0 0-6-6z" stroke="currentColor" strokeWidth="2"/>
      <path d="M19 12a7 7 0 0 1-14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),

  Frightened: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
      <circle cx="8" cy="10" r="1.5" fill="currentColor"/>
      <circle cx="16" cy="10" r="1.5" fill="currentColor"/>
      <path d="M7 16c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M6 8L4 6M18 8l2-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),

  Grappled: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 2v4m8-4v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M4 8h4m8 0h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="2"/>
      <circle cx="16" cy="8" r="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M8 11v5c0 1.1.9 2 2 2h4c1.1 0 2-.9 2-2v-5" stroke="currentColor" strokeWidth="2"/>
      <path d="M10 18v4m4-4v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="14" r="1.5" fill="currentColor"/>
    </svg>
  ),

  Incapacitated: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/>
      <path d="M6 22v-4c0-2.2 1.8-4 4-4h4c2.2 0 4 1.8 4 4v4" stroke="currentColor" strokeWidth="2"/>
      <line x1="10" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="9" cy="6" r="1" fill="currentColor"/>
      <circle cx="15" cy="6" r="1" fill="currentColor"/>
      <circle cx="12" cy="18" r="2" stroke="currentColor" strokeWidth="2"/>
      <line x1="12" y1="16" x2="12" y2="20" stroke="currentColor" strokeWidth="2"/>
    </svg>
  ),

  Invisible: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" strokeDasharray="2 2" opacity="0.4"/>
      <path d="M6 22v-4c0-2.2 1.8-4 4-4h4c2.2 0 4 1.8 4 4v4" stroke="currentColor" strokeWidth="2" strokeDasharray="2 2" opacity="0.4"/>
      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),

  Paralyzed: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L4 7v5l8 5 8-5V7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M12 12v5m0-10v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M8 9.5L4 12m16-2.5L16 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="20" r="2" fill="currentColor"/>
      <line x1="12" y1="17" x2="12" y2="18" stroke="currentColor" strokeWidth="2"/>
    </svg>
  ),

  Petrified: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/>
      <path d="M6 22v-4c0-2.2 1.8-4 4-4h4c2.2 0 4 1.8 4 4v4" stroke="currentColor" strokeWidth="2"/>
      <path d="M8 6l2 2m4-2l-2 2m-2 2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <rect x="10" y="16" width="1.5" height="1.5" fill="currentColor"/>
      <rect x="12.5" y="16" width="1.5" height="1.5" fill="currentColor"/>
      <rect x="11.25" y="18" width="1.5" height="1.5" fill="currentColor"/>
      <rect x="9" y="18" width="1.5" height="1.5" fill="currentColor"/>
      <rect x="13.5" y="18" width="1.5" height="1.5" fill="currentColor"/>
    </svg>
  ),

  Poisoned: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L8 6h8z" fill="currentColor"/>
      <path d="M6 10h12l-2 10H8z" stroke="currentColor" strokeWidth="2" fill="none"/>
      <circle cx="12" cy="14" r="1.5" fill="currentColor"/>
      <circle cx="9" cy="16" r="1" fill="currentColor"/>
      <circle cx="15" cy="16" r="1" fill="currentColor"/>
      <path d="M10 12c.5-1 1.5-1.5 2-1.5s1.5.5 2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),

  Prone: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="18" cy="6" r="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M4 12h12l-3 6H7z" stroke="currentColor" strokeWidth="2" fill="currentColor" opacity="0.3"/>
      <line x1="4" y1="18" x2="16" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),

  Restrained: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M6 22v-4c0-2.2 1.8-4 4-4h4c2.2 0 4 1.8 4 4v4" stroke="currentColor" strokeWidth="2"/>
      <path d="M3 8h3m13 0h3M8 4l2 2m4-2l-2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="4" cy="8" r="1.5" fill="currentColor"/>
      <circle cx="20" cy="8" r="1.5" fill="currentColor"/>
      <path d="M9 15l-2 2m8-2l2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),

  Stunned: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 2v4m0 12v4M2 12h4m12 0h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M5.6 5.6l2.8 2.8m7.2 7.2l2.8 2.8m-14-7.2l2.8-2.8m7.2-7.2l2.8 2.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="12" r="4" fill="currentColor"/>
    </svg>
  ),

  Unconscious: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="18" cy="7" r="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M4 13h10c1.1 0 2 .9 2 2v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M4 20h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="16" y1="11" x2="16" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="14" y1="7" x2="16" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="18" y1="7" x2="20" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
};

export type ConditionType = keyof typeof ConditionIcons;

export const CONDITIONS: ConditionType[] = [
  'Blinded',
  'Charmed',
  'Deafened',
  'Frightened',
  'Grappled',
  'Incapacitated',
  'Invisible',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Stunned',
  'Unconscious',
];

