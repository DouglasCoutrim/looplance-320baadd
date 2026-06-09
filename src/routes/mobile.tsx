import { createFileRoute, Outlet } from '@tanstack/react-router';
import { MobileBottomNav } from '../components/mobile/MobileBottomNav';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LoginForm } from '@/components/LoginForm';
import { Loader2 } from 'lucide-react';

export const Route = createFileRoute('/mobile')({
  component: MobileLayout,
});

function MobileLayout() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-10 w-10 text-[#F97316] animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-[390px] mx-auto min-h-screen bg-[#0a0a0a] relative shadow-2xl overflow-x-hidden border-x border-[rgba(255,255,255,0.05)]">
        <LoginForm />
      </div>
    );
  }

  return (
    <div className="max-w-[390px] mx-auto min-h-screen bg-[#0a0a0a] relative shadow-2xl overflow-x-hidden border-x border-[rgba(255,255,255,0.05)]">
      <Outlet />
      <MobileBottomNav />
    </div>
  );
}
