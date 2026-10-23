import React from "react";

export function DocuMindLogo({ size = 36, className = "", animate = false }) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative select-none shrink-0 transition-transform duration-300 hover:scale-105 ${className}`}
    >
      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md"
      >
        <defs>
          <linearGradient id="dml-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#2c2c30" />
            <stop offset="50%" stop-color="#222225" />
            <stop offset="100%" stop-color="#161618" />
          </linearGradient>

          <linearGradient id="dml-silver" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFFFFF" />
            <stop offset="35%" stop-color="#E2E2E6" />
            <stop offset="70%" stop-color="#C0C0C4" />
            <stop offset="100%" stop-color="#8E8E96" />
          </linearGradient>

          <linearGradient id="dml-red" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FF4D42" />
            <stop offset="60%" stop-color="#E10600" />
            <stop offset="100%" stop-color="#A80000" />
          </linearGradient>

          <radialGradient id="dml-flare" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#FF3B30" stop-opacity="0.85" />
            <stop offset="40%" stop-color="#E10600" stop-opacity="0.45" />
            <stop offset="100%" stop-color="#E10600" stop-opacity="0" />
          </radialGradient>

          <filter id="dml-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Charcoal Squircle Frame */}
        <rect
          width="120"
          height="120"
          rx="30"
          fill="url(#dml-bg)"
          stroke="rgba(192, 192, 192, 0.22)"
          stroke-width="1.8"
        />
        <rect
          x="2"
          y="2"
          width="116"
          height="116"
          rx="28"
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          stroke-width="1"
        />

        {/* Technical Coordinate Registration Marks */}
        <path
          d="M 60 14 L 60 22 M 60 98 L 60 106 M 14 60 L 22 60 M 98 60 L 106 60"
          stroke="rgba(192, 192, 192, 0.35)"
          stroke-width="1.5"
          stroke-linecap="round"
        />
        <circle
          cx="60"
          cy="60"
          r="42"
          stroke="rgba(192, 192, 192, 0.08)"
          stroke-dasharray="2 4"
          stroke-width="1"
          fill="none"
        />

        {/* Ambient Red Caustic Glow behind Core */}
        <circle cx="63" cy="60" r="26" fill="url(#dml-flare)" />

        {/* Isometric Stacked Document Plate Backing */}
        <path
          d="M 32 35 C 32 30 36 26 41 26 L 68 26 C 85 26 95 38 95 60 C 95 82 85 94 68 94 L 41 94 C 36 94 32 90 32 85 Z"
          fill="none"
          stroke="rgba(192, 192, 192, 0.2)"
          stroke-width="2"
        />

        {/* Solid Vertical Technical Spine */}
        <rect x="33" y="30" width="11" height="60" rx="5.5" fill="url(#dml-silver)" />

        {/* Outer Precision Curve forming 'D' */}
        <path
          d="M 44 35.5 H 64 C 78.5 35.5 88.5 46 88.5 60 C 88.5 74 78.5 84.5 64 84.5 H 44"
          fill="none"
          stroke="url(#dml-silver)"
          stroke-width="11"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        {/* Subtle Architectural Page Division Lines */}
        <path
          d="M 44 48 H 54 M 44 72 H 54"
          stroke="rgba(34, 34, 37, 0.7)"
          stroke-width="2.5"
          stroke-linecap="round"
        />

        {/* Signal Red Neural Aperture Core */}
        <circle
          cx="63"
          cy="60"
          r="14"
          stroke="#E10600"
          stroke-width="1.8"
          stroke-dasharray="3 2"
          fill="none"
          opacity="0.85"
          className={animate ? "animate-spin-slow origin-center" : ""}
        />

        <circle
          cx="63"
          cy="60"
          r="9.5"
          fill="url(#dml-red)"
          filter="url(#dml-glow)"
        />

        {/* White Laser Focal Spark */}
        <circle cx="63" cy="60" r="4" fill="#FFFFFF" />
        <circle cx="61.5" cy="58.5" r="1.5" fill="#FFFFFF" opacity="0.9" />

        {/* Optical Crosshair */}
        <path
          d="M 63 46 L 63 50 M 63 70 L 63 74 M 49 60 L 53 60 M 73 60 L 77 60"
          stroke="#FFFFFF"
          stroke-width="1.5"
          stroke-linecap="round"
          opacity="0.75"
        />
      </svg>
    </div>
  );
}
