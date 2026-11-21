/**
 * The picture side of the "Find us" slide: a drawn map of the block, from the
 * front of the Discover Burien building on SW 152nd St round to the
 * makerspace door at the back. North is up. Drawn, not a satellite photo, so
 * it reads from across the street and carries nobody else's imagery.
 */
export function DisplayMap() {
  return (
    <svg
      role="img"
      aria-label="Map: from SW 152nd St, walk east, turn right at 6th Ave SW and come along the back to the door behind the Discover Burien building"
      viewBox="0 0 782 1000"
      preserveAspectRatio="xMidYMid slice"
      className="display-photo-in absolute inset-0 h-full w-full font-display"
    >
      <rect width="782" height="1000" fill="#f3e3bd" />

      {/* Streets */}
      <rect x="0" y="150" width="782" height="92" fill="#fffaf0" />
      <line x1="0" y1="196" x2="620" y2="196" stroke="#e2cf9f" strokeWidth="4" strokeDasharray="26 20" />
      <rect x="640" y="150" width="96" height="850" fill="#fffaf0" />
      <line x1="688" y1="260" x2="688" y2="1000" stroke="#e2cf9f" strokeWidth="4" strokeDasharray="26 20" />
      <text x="40" y="128" fontSize="34" fontWeight="700" fill="#645e5e" letterSpacing="2">
        SW 152nd St
      </text>
      <text
        x="748"
        y="560"
        fontSize="34"
        fontWeight="700"
        fill="#645e5e"
        letterSpacing="2"
        transform="rotate(90 748 560)"
      >
        6th Ave SW
      </text>

      {/* The lot behind the buildings */}
      <rect x="30" y="610" width="590" height="170" rx="10" fill="#ecd9aa" />
      <text x="440" y="745" textAnchor="middle" fontSize="26" fontWeight="700" fill="#9a8556" letterSpacing="3">
        PARKING LOT
      </text>

      {/* The row of buildings on SW 152nd St */}
      <rect x="30" y="270" width="110" height="320" rx="8" fill="#dcc691" />
      <rect x="150" y="270" width="190" height="320" rx="8" fill="#cf9426" />
      <rect x="350" y="270" width="110" height="320" rx="8" fill="#dcc691" />
      <rect x="470" y="270" width="100" height="320" rx="8" fill="#dcc691" />
      <text textAnchor="middle" fontSize="30" fontWeight="700" fill="#ffffff">
        <tspan x="245" y="395">Discover</tspan>
        <tspan x="245" y="432">Burien</tspan>
      </text>
      <text textAnchor="middle" fontSize="21" fontWeight="700" fill="#7a6535">
        <tspan x="405" y="425">KW Korean</tspan>
        <tspan x="405" y="451">BBQ</tspan>
      </text>
      <text textAnchor="middle" fontSize="21" fontWeight="700" fill="#7a6535">
        <tspan x="520" y="425">Computer</tspan>
        <tspan x="520" y="451">Sonics</tspan>
      </text>

      {/* The way round */}
      <path
        d="M245 256 H604 V668 H245 V612"
        fill="none"
        stroke="#e37263"
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M211 632 L245 586 L279 632 Z" fill="#e37263" />
      <circle cx="245" cy="256" r="20" fill="#ffffff" stroke="#e37263" strokeWidth="10" />

      {/* The door */}
      <line x1="245" y1="690" x2="245" y2="792" stroke="#3a2408" strokeWidth="5" strokeDasharray="4 12" strokeLinecap="round" />
      <path d="M225 818 L245 792 L265 818 Z" fill="#3a2408" />
      <rect x="110" y="818" width="400" height="118" rx="20" fill="#3a2408" />
      <text x="310" y="866" textAnchor="middle" fontSize="23" fontWeight="700" fill="#fbc84b" letterSpacing="3">
        OUR DOOR
      </text>
      <text x="310" y="908" textAnchor="middle" fontSize="31" fontWeight="700" fill="#ffffff">
        Around back, lower level
      </text>
    </svg>
  );
}
