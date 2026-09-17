"use client";

export default function SpeakerIcon({ size = 16, active = false, style = {}, className = "" }) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        lineHeight: 1,
        verticalAlign: "middle",
        flexShrink: 0,
        ...style
      }}
    >
      <img
        src="/speaker-icon.png"
        alt="Speaker"
        width={size}
        height={size}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          objectFit: "contain",
          display: "block",
          filter: active ? "invert(13%) sepia(94%) saturate(7460%) hue-rotate(352deg) brightness(91%) contrast(108%)" : "none",
          transition: "filter 0.2s ease, transform 0.15s ease",
          transform: active ? "scale(1.1)" : "scale(1)"
        }}
      />
    </span>
  );
}
