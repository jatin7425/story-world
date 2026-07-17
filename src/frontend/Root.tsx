import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import ReaderApp from "./ReaderApp";
import { ADMIN_PATH } from "./adminPath";

// Code-split: readers never download the admin bundle, and vice versa.
const AdminApp = lazy(() => import("./admin/AdminApp"));

export default function Root() {
  return (
    <Routes>
      <Route
        path={`${ADMIN_PATH}/*`}
        element={
          <Suspense fallback={<div className="admin-boot">Loading admin…</div>}>
            <AdminApp />
          </Suspense>
        }
      />
      <Route path="/*" element={<ReaderApp />} />
    </Routes>
  );
}
