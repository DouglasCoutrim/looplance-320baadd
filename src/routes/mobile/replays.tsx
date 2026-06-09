import { createFileRoute } from '@tanstack/react-router';
import { MobileHeader } from '../../components/mobile/MobileHeader';
import { TabsPill } from '../../components/mobile/TabsPill';
import { ReplayCardList } from '../../components/mobile/ReplayCardList';
import { EmptyState } from '../../components/mobile/EmptyState';
import { Play } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/mobile/replays')({
  component: MyReplays,
});

const tabOptions = [
  { id: 'live', label: 'Ao vivo' },
  { id: 'processed', label: 'Processados' },
  { id: 'archived', label: 'Arquivados' },
];

const mockReplays = [
  { id: 1, title: 'Lance de Basquete', arena: 'Arena Central', timestamp: '10:30', thumbnail: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=200&q=80', status: 'AO VIVO', type: 'live' },
  { id: 2, title: 'Gol de Futsal', arena: 'Arena Norte', timestamp: '09:45', thumbnail: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=200&q=80', status: 'PRONTO', type: 'processed' },
  { id: 3, title: 'Defesa espetacular', arena: 'Arena Central', timestamp: 'Ontem', thumbnail: 'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=200&q=80', status: 'PRONTO', type: 'processed' },
];

function MyReplays() {
  const [activeTab, setActiveTab] = useState('processed');

  const filteredReplays = mockReplays.filter(r => r.type === activeTab);

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a] pb-[100px]">
      <MobileHeader title="Meus Replays" />
      
      <div className="flex-1 bg-[#0a0a0a] rounded-t-[24px] -mt-5 relative z-10 px-6 pt-6">
        <div className="mb-6">
          <TabsPill 
            options={tabOptions} 
            activeId={activeTab} 
            onChange={setActiveTab} 
          />
        </div>

        <div className="flex flex-col">
          {filteredReplays.length > 0 ? (
            filteredReplays.map((replay) => (
              <ReplayCardList 
                key={replay.id}
                title={replay.title}
                arena={replay.arena}
                timestamp={replay.timestamp}
                thumbnail={replay.thumbnail}
                status={replay.status}
              />
            ))
          ) : (
            <EmptyState 
              icon={Play} 
              title="Nenhum replay ainda" 
              subtitle="Seus lances aparecerão aqui após processamento" 
            />
          )}
        </div>
      </div>
    </div>
  );
}
