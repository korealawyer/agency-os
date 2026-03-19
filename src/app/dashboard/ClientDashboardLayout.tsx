"use client";

import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";
import { SyncProvider, useSyncContext } from "@/components/SyncContext";
import { RefreshCw } from "lucide-react";

function GlobalSyncBanner() {
  const { syncing, progress } = useSyncContext();
  if (!syncing) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 24,
      right: 24,
      zIndex: 9999,
      background: "linear-gradient(135deg, #1e40af, #3b82f6)",
      color: "#fff",
      padding: "12px 20px",
      borderRadius: 12,
      display: "flex",
      alignItems: "center",
      gap: 10,
      fontSize: "0.82rem",
      fontWeight: 500,
      boxShadow: "0 4px 20px rgba(37,99,235,0.4)",
      maxWidth: 400,
      backdropFilter: "blur(8px)",
      animation: "fadeSlideIn 0.3s ease",
    }}>
      <RefreshCw size={15} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
      <span style={{ flex: 1 }}>
        {progress || "동기화 준비 중..."}
      </span>
      <span style={{
        background: "rgba(255,255,255,0.2)",
        borderRadius: 10,
        padding: "2px 10px",
        fontSize: "0.7rem",
        whiteSpace: "nowrap",
      }}>
        진행 중
      </span>
    </div>
  );
}

export default function ClientDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <SyncProvider>
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            {children}
          </main>
        </div>
        <GlobalSyncBanner />
      </SyncProvider>
    </ToastProvider>
  );
}
