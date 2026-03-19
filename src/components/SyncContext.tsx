"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const SYNC_STORAGE_KEY = "agency-os-sync-status";

interface SyncState {
  syncing: boolean;
  progress: string;
  startSync: (progressText: string) => void;
  updateProgress: (text: string) => void;
  endSync: () => void;
}

const SyncContext = createContext<SyncState>({
  syncing: false,
  progress: "",
  startSync: () => {},
  updateProgress: () => {},
  endSync: () => {},
});

function readStorage(): { syncing: boolean; progress: string; ts: number } | null {
  try {
    const raw = localStorage.getItem(SYNC_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // 10분 이상 된 상태는 무시 (비정상 종료 대비)
    if (Date.now() - (parsed.ts || 0) > 10 * 60 * 1000) {
      localStorage.removeItem(SYNC_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

function writeStorage(syncing: boolean, progress: string) {
  try {
    if (syncing) {
      localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify({ syncing, progress, ts: Date.now() }));
    } else {
      localStorage.removeItem(SYNC_STORAGE_KEY);
    }
  } catch { /* ignore */ }
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState("");

  // 마운트 시 localStorage에서 기존 동기화 상태 복원
  useEffect(() => {
    const stored = readStorage();
    if (stored?.syncing) {
      setSyncing(true);
      setProgress(stored.progress || "동기화 진행 중...");
    }

    // 다른 탭에서 상태 변경 시 실시간 반영
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== SYNC_STORAGE_KEY) return;
      if (e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          setSyncing(data.syncing);
          setProgress(data.progress || "");
        } catch { /* ignore */ }
      } else {
        // 삭제됨 = 동기화 종료
        setSyncing(false);
        setProgress("");
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const startSync = useCallback((text: string) => {
    setSyncing(true);
    setProgress(text);
    writeStorage(true, text);
  }, []);

  const updateProgress = useCallback((text: string) => {
    setProgress(text);
    writeStorage(true, text);
  }, []);

  const endSync = useCallback(() => {
    setSyncing(false);
    setProgress("");
    writeStorage(false, "");
  }, []);

  return (
    <SyncContext.Provider value={{ syncing, progress, startSync, updateProgress, endSync }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncContext() {
  return useContext(SyncContext);
}
