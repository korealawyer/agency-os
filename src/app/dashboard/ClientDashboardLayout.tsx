"use client";

import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";

export default function ClientDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
