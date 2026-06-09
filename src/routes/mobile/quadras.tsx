import { createFileRoute } from '@tanstack/react-router';
import { MobileHeader } from '../../components/mobile/MobileHeader';
import { EmptyState } from '../../components/mobile/EmptyState';
import { MapPin } from 'lucide-react';

export const Route = createFileRoute('/mobile/quadras')({
  component: () => (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a] pb-[100px]">
      <MobileHeader title="Quadras" />
      <div className="flex-1 bg-[#0a0a0a] rounded-t-[24px] -mt-5 relative z-10 px-6 pt-6">
        <EmptyState 
          icon={MapPin} 
          title="Nenhuma quadra próxima" 
          subtitle="Explore arenas parceiras para encontrar quadras disponíveis." 
        />
      </div>
    </div>
  )
});
