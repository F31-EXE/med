import type { EventFormat } from "../generated/prisma/client.js";

const line = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Icon = {
  calendar: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...line}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  pin: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...line}>
      <path d="M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  ),
  users: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...line}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-4 3-6 7-6s7 2 7 6M16 4a3.5 3.5 0 0 1 0 7M18 14c2.5.5 4 2.5 4 6" />
    </svg>
  ),
  phone: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...line}>
      <path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z" />
    </svg>
  ),
  mail: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...line}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  ),
  clock: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...line}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  route: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...line}>
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
      <path d="M8 19h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" />
    </svg>
  ),
  car: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...line}>
      <path d="M5 17h14M4 17v-4l2-5h12l2 5v4M7 17v2M17 17v2" />
      <circle cx="8" cy="13.5" r="1" />
      <circle cx="16" cy="13.5" r="1" />
    </svg>
  ),
  bed: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...line}>
      <path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5" />
      <circle cx="7" cy="11" r="2" />
    </svg>
  ),
  doc: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...line}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  ),
  eye: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...line}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  chat: () => (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="6" y="9" width="30" height="22" rx="8" fill="#BFEBDD" />
      <path d="M14 31l-4 8 10-8" fill="#BFEBDD" />
      <rect x="16" y="17" width="26" height="18" rx="7" fill="#2FA38A" />
      <circle cx="23" cy="26" r="2" fill="#fff" />
      <circle cx="29" cy="26" r="2" fill="#fff" />
      <circle cx="35" cy="26" r="2" fill="#fff" />
    </svg>
  ),
  clipboard: () => (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="10" y="8" width="28" height="34" rx="6" fill="#CFE4F8" />
      <rect x="17" y="5" width="14" height="7" rx="3" fill="#0B5ED7" />
      <path d="M17 22h14M17 29h14M17 36h8" stroke="#0B5ED7" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
  bus: () => (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="7" y="9" width="34" height="26" rx="7" fill="#FFD9C9" />
      <rect x="11" y="13" width="26" height="10" rx="3" fill="#fff" />
      <circle cx="15" cy="38" r="4" fill="#FF9670" />
      <circle cx="33" cy="38" r="4" fill="#FF9670" />
    </svg>
  ),
  star: () => (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="18" fill="#E2DCFA" />
      <path d="M24 12l3.5 7.5 8 .9-6 5.5 1.7 8L24 30l-7.2 3.9 1.7-8-6-5.5 8-.9z" fill="#9585E6" />
    </svg>
  ),
};

export function FormatIllustration({ format }: { format: EventFormat }) {
  switch (format) {
    case "CONGRESS":
      return (
        <svg viewBox="0 0 96 96" aria-hidden="true">
          <circle cx="48" cy="30" r="12" fill="#2FA38A" />
          <path d="M26 74c0-14 10-24 22-24s22 10 22 24z" fill="#2FA38A" />
          <circle cx="20" cy="40" r="8" fill="#8ED6C3" />
          <path d="M6 76c0-10 6-17 14-17s14 7 14 17z" fill="#8ED6C3" />
          <circle cx="76" cy="40" r="8" fill="#8ED6C3" />
          <path d="M62 76c0-10 6-17 14-17s14 7 14 17z" fill="#8ED6C3" />
        </svg>
      );
    case "CONFERENCE":
      return (
        <svg viewBox="0 0 96 96" aria-hidden="true">
          <rect x="14" y="16" width="68" height="44" rx="10" fill="#9CCDF0" />
          <path d="M26 48l12-12 10 8 16-16" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="48" cy="72" r="8" fill="#4A9FD8" />
          <path d="M34 92c0-8 6-12 14-12s14 4 14 12z" fill="#4A9FD8" />
        </svg>
      );
    case "SEMINAR":
      return (
        <svg viewBox="0 0 96 96" aria-hidden="true">
          <path d="M12 36l36-18 36 18-36 18z" fill="#FFB596" />
          <path d="M26 44v16c12 10 32 10 44 0V44l-22 11z" fill="#FF9670" />
          <rect x="80" y="36" width="4" height="22" rx="2" fill="#FF9670" />
        </svg>
      );
    case "EXHIBITION":
      return (
        <svg viewBox="0 0 96 96" aria-hidden="true">
          <rect x="12" y="26" width="72" height="48" rx="12" fill="#BDB2F2" />
          <path d="M28 52h10l5-10 8 18 5-8h12" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="38" y="76" width="20" height="8" rx="4" fill="#9585E6" />
        </svg>
      );
    case "ONLINE_SYMPOSIUM":
      return (
        <svg viewBox="0 0 96 96" aria-hidden="true">
          <rect x="10" y="20" width="76" height="52" rx="12" fill="#8ED6C3" />
          <circle cx="48" cy="42" r="10" fill="#fff" />
          <path d="M32 66c0-10 7-14 16-14s16 4 16 14z" fill="#fff" />
          <circle cx="76" cy="30" r="5" fill="#FF8A8A" />
        </svg>
      );
  }
}

export const formatTint: Record<EventFormat, string> = {
  CONGRESS: "var(--mint-soft)",
  CONFERENCE: "var(--sky-soft)",
  SEMINAR: "var(--peach-soft)",
  EXHIBITION: "var(--lav-soft)",
  ONLINE_SYMPOSIUM: "var(--mint-soft)",
};

export function CoverIllustration({ format }: { format: EventFormat }) {
  return (
    <span className="cover-ill" aria-hidden="true">
      <FormatIllustration format={format} />
    </span>
  );
}

export function DoctorsIllustration() {
  return (
    <svg viewBox="0 0 420 360" aria-hidden="true">
      <ellipse cx="210" cy="350" rx="190" ry="18" fill="#2FA38A" opacity=".12" />
      <g>
        <circle cx="120" cy="118" r="34" fill="#F6C9A8" />
        <path d="M86 112c0-26 16-40 36-40s34 14 34 38c-8-10-22-16-36-16s-26 6-34 18z" fill="#3B2F2F" />
        <path d="M54 350c0-82 28-140 66-140s66 58 66 140z" fill="#fff" />
        <path d="M120 210l-18 26 18 114 18-114z" fill="#CFE4F8" />
        <path d="M104 214c-6 30-4 70 4 94" stroke="#0B5ED7" strokeWidth="5" fill="none" strokeLinecap="round" />
        <circle cx="108" cy="312" r="9" fill="#0B5ED7" />
        <rect x="150" y="250" width="26" height="34" rx="5" fill="#BFEBDD" />
      </g>
      <g>
        <circle cx="290" cy="104" r="36" fill="#E8B48F" />
        <path d="M254 100c2-30 18-42 38-42 22 0 38 16 36 44-6-14-20-20-36-20s-30 6-38 18z" fill="#6B4A3A" />
        <path d="M222 350c0-88 30-148 68-148s68 60 68 148z" fill="#2FA38A" />
        <path d="M290 202l-20 30 20 118 20-118z" fill="#fff" />
        <rect x="232" y="246" width="36" height="46" rx="8" fill="#fff" />
        <path d="M240 260h20M240 270h20M240 280h12" stroke="#2FA38A" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g>
        <circle cx="206" cy="150" r="28" fill="#F1C3A0" />
        <path d="M178 146c0-22 12-34 28-34 18 0 30 12 28 34-6-10-16-14-28-14s-22 4-28 14z" fill="#2B2B3A" />
        <path d="M150 350c0-72 24-122 56-122s56 50 56 122z" fill="#0B5ED7" />
        <path d="M206 228l-14 22 14 100 14-100z" fill="#E7F0FC" />
      </g>
      <circle cx="356" cy="64" r="16" fill="#FF9670" opacity=".8" />
      <path d="M350 64h12M356 58v12" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="56" cy="70" r="10" fill="#9585E6" opacity=".7" />
    </svg>
  );
}
