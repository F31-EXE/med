import { Route, Routes } from "react-router-dom";
import { NewsListPage } from "./NewsListPage";
import { NewsFormPage } from "./NewsFormPage";

export function NewsModule() {
  return (
    <Routes>
      <Route index element={<NewsListPage />} />
      <Route path="new" element={<NewsFormPage />} />
      <Route path=":id" element={<NewsFormPage key="edit" />} />
    </Routes>
  );
}
