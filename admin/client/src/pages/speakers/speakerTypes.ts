export type SpeakerBrief = {
  id: string;
  fullName: string;
  degree: string | null;
  position: string | null;
  photoThumbUrl: string | null;
};

export type Speaker = SpeakerBrief & {
  lastName: string;
  firstName: string;
  middleName: string | null;
  city: string | null;
  bio: string | null;
  photoUrl: string | null;
  usage: { events: number; sessions: number };
};

export function speakerCaption(s: Pick<SpeakerBrief, "degree" | "position">) {
  return [s.degree, s.position].filter(Boolean).join(", ");
}
