import { Route, Routes } from "react-router-dom";
import { EventsListPage } from "./EventsListPage";
import { EventFormPage } from "./EventFormPage";

export function EventsModule() {
  return (
    <Routes>
      <Route index element={<EventsListPage />} />
      <Route path="new" element={<EventFormPage />} />
      <Route path=":id" element={<EventFormPage key="edit" />} />
    </Routes>
  );
}
