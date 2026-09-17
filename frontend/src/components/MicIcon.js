"use client";

export default function MicIcon({ size = 16, active = false, white = false, style = {}, className = "" }) {
  let filter = "none";
  if (white) {
    filter = "brightness(0) invert(1)";
  } else if (active) {
    filter = "invert(13%) sepia(94%) saturate(7460%) hue-rotate(352deg) brightness(91%) contrast(108%)";
  }

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
        src="/mic-icon.png"
        alt="Microphone"
        width={size}
        height={size}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          objectFit: "contain",
          display: "block",
          filter: style.filter || filter,
          transition: "filter 0.2s ease, transform 0.15s ease",
          transform: active ? "scale(1.1)" : "scale(1)"
        }}
      />
    </span>
  );
}
