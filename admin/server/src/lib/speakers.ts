import type { Speaker } from "../generated/prisma/client.js";

export const speakerBriefSelect = {
  id: true,
  lastName: true,
  firstName: true,
  middleName: true,
  degree: true,
  position: true,
  photoThumbUrl: true,
} as const;

export function fullName(s: Pick<Speaker, "lastName" | "firstName" | "middleName">) {
  return [s.lastName, s.firstName, s.middleName].filter(Boolean).join(" ");
}

export function speakerBrief(s: Pick<Speaker, keyof typeof speakerBriefSelect>) {
  return {
    id: s.id,
    fullName: fullName(s),
    degree: s.degree,
    position: s.position,
    photoThumbUrl: s.photoThumbUrl,
  };
}
