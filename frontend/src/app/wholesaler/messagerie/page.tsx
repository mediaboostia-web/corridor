'use client';

import { MessagingView } from '@/components/messaging/messaging-view';

export default function WholesalerMessageriePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Messagerie</h1>
      <MessagingView />
    </div>
  );
}
