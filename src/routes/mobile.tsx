import { createFileRoute, Outlet } from '@tanstack/react-router';
import { MobileBottomNav } from '../components/mobile/MobileBottomNav';

export const Route = createFileRoute('/mobile')({
  component: MobileLayout,
});

function MobileLayout() {
  return (
    <div className="max-w-[390px] mx-auto min-h-screen bg-[#0a0a0a] relative shadow-2xl overflow-x-hidden border-x border-[rgba(255,255,255,0.05)]">
      <Outlet />
      <MobileBottomNav />
    </div>
  );
}
