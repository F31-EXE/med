import { Route, Routes } from "react-router-dom";
import { PagesListPage } from "./PagesListPage";
import { PageEditPage } from "./PageEditPage";

export function PagesModule() {
  return (
    <Routes>
      <Route index element={<PagesListPage />} />
      <Route path=":key" element={<PageEditPage />} />
    </Routes>
  );
}
