import { checker, type PartnerBrief } from "./partnerTypes";

export function PartnerLogo({ partner, width = 96, height = 48 }: { partner: Pick<PartnerBrief, "name" | "logoThumbUrl">; width?: number; height?: number }) {
  return (
    <div
      style={{
        width,
        height,
        flexShrink: 0,
        borderRadius: 6,
        border: "1px solid #f0f0f0",
        background: partner.logoThumbUrl ? checker : "#F3F6FA",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        color: "#8c8c8c",
        fontSize: 11,
        textAlign: "center",
        padding: 4,
      }}
    >
      {partner.logoThumbUrl ? (
        <img src={partner.logoThumbUrl} alt={partner.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
      ) : (
        "нет логотипа"
      )}
    </div>
  );
}
