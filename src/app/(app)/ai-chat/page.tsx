"use client";

import { TopBar } from "@/components/TopBar";
import { ChatPanel } from "@/components/ChatPanel";
import { GLOBAL_ASSISTANT_SUBJECT_ID } from "@/lib/local/types";

export default function AiChatPage() {
  return (
    <div>
      <TopBar crumbs={["Workspace", "AI Chat"]} />
      <div className="px-8 pb-6">
        <ChatPanel subjectId={GLOBAL_ASSISTANT_SUBJECT_ID} />
      </div>
    </div>
  );
}
