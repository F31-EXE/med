import type { ReactNode } from "react";
import { Grid, Typography } from "antd";
import { BrandMark } from "../AdminLayout";
import { colors } from "../theme";

function Illustration() {
  return (
    <svg viewBox="0 0 420 360" width="100%" style={{ maxWidth: 380 }} aria-hidden="true">
      <ellipse cx="210" cy="350" rx="190" ry="18" fill="#2FA38A" opacity=".12" />
      <circle cx="120" cy="118" r="34" fill="#F6C9A8" />
      <path d="M86 112c0-26 16-40 36-40s34 14 34 38c-8-10-22-16-36-16s-26 6-34 18z" fill="#3B2F2F" />
      <path d="M54 350c0-82 28-140 66-140s66 58 66 140z" fill="#fff" />
      <path d="M120 210l-18 26 18 114 18-114z" fill="#CFE4F8" />
      <path d="M104 214c-6 30-4 70 4 94" stroke="#0B5ED7" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="108" cy="312" r="9" fill="#0B5ED7" />
      <circle cx="290" cy="104" r="36" fill="#E8B48F" />
      <path d="M254 100c2-30 18-42 38-42 22 0 38 16 36 44-6-14-20-20-36-20s-30 6-38 18z" fill="#6B4A3A" />
      <path d="M222 350c0-88 30-148 68-148s68 60 68 148z" fill="#2FA38A" />
      <path d="M290 202l-20 30 20 118 20-118z" fill="#fff" />
      <rect x="232" y="246" width="36" height="46" rx="8" fill="#fff" />
      <path d="M240 260h20M240 270h20M240 280h12" stroke="#2FA38A" strokeWidth="3" strokeLinecap="round" />
      <circle cx="206" cy="150" r="28" fill="#F1C3A0" />
      <path d="M178 146c0-22 12-34 28-34 18 0 30 12 28 34-6-10-16-14-28-14s-22 4-28 14z" fill="#2B2B3A" />
      <path d="M150 350c0-72 24-122 56-122s56 50 56 122z" fill="#0B5ED7" />
      <path d="M206 228l-14 22 14 100 14-100z" fill="#E7F0FC" />
      <circle cx="356" cy="64" r="16" fill="#FF9670" opacity=".8" />
      <path d="M350 64h12M356 58v12" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  const screens = Grid.useBreakpoint();
  const wide = screens.md;
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, background: colors.bgSoft }}>
      <div
        style={{
          width: "100%",
          maxWidth: wide ? 920 : 440,
          display: "grid",
          gridTemplateColumns: wide ? "1fr 1fr" : "1fr",
          background: "#fff",
          borderRadius: 28,
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(16,42,67,.10)",
        }}
      >
        {wide ? (
          <div
            style={{
              background: `linear-gradient(135deg, ${colors.mintSoft}, ${colors.skySoft})`,
              padding: 40,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 24,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <span style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", background: "#BFEBDD", opacity: 0.5, right: -90, top: -110 }} />
            <div style={{ position: "relative" }}>
              <span style={{ display: "inline-block", background: "#fff", color: colors.mintDark, borderRadius: 999, padding: "6px 14px", fontWeight: 700, fontSize: 13 }}>
                ♡ Для сотрудников
              </span>
              <Typography.Title level={3} style={{ marginTop: 16, marginBottom: 6 }}>
                Мероприятия, заявки и контент — в одном месте
              </Typography.Title>
              <Typography.Text type="secondary">Всё, что вы сохраните здесь, сразу появится на сайте.</Typography.Text>
            </div>
            <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
              <Illustration />
            </div>
          </div>
        ) : null}
        <div style={{ padding: wide ? 44 : 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
            <BrandMark />
            <span style={{ lineHeight: 1.15 }}>
              <span style={{ display: "block", fontFamily: "Nunito, Inter, sans-serif", fontWeight: 900, fontSize: 17 }}>Media Expo Group</span>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                админ-панель
              </Typography.Text>
            </span>
          </div>
          <Typography.Title level={2} style={{ marginTop: 0 }}>
            {title}
          </Typography.Title>
          {children}
        </div>
      </div>
    </div>
  );
}
