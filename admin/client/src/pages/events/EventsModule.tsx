import { Route, Routes } from "react-router-dom";
import { EventsListPage } from "./EventsListPage";
import { EventFormPage } from "./EventFormPage";
import { EventSpeakersPage } from "./EventSpeakersPage";
import { EventDocumentsPage } from "./EventDocumentsPage";
import { EventPartnersPage } from "./EventPartnersPage";
import { ProgramPage } from "./program/ProgramPage";

export function EventsModule() {
  return (
    <Routes>
      <Route index element={<EventsListPage />} />
      <Route path="new" element={<EventFormPage />} />
      <Route path=":id" element={<EventFormPage key="edit" />} />
      <Route path=":id/program" element={<ProgramPage />} />
      <Route path=":id/speakers" element={<EventSpeakersPage />} />
      <Route path=":id/partners" element={<EventPartnersPage />} />
      <Route path=":id/documents" element={<EventDocumentsPage />} />
    </Routes>
  );
}
