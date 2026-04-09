"use client";

import { Dashboard } from "@/features/bot/components/dashboard";

interface MiniAppProps {
  botUsername: string;
}

export function MiniApp({ botUsername }: MiniAppProps) {
  return <Dashboard botUsername={botUsername} />;
}
