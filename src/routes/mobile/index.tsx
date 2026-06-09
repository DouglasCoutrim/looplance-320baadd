import { createFileRoute } from '@tanstack/react-router';
import { Search, MapPin, ChevronRight, Play } from 'lucide-react';
import { MobileHeader } from '../../components/mobile/MobileHeader';
import { ReplayCardLarge } from '../../components/mobile/ReplayCardLarge';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';


export const Route = createFileRoute('/mobile/')({
  component: MobileHome,
});

const categories = [
  { id: 'all', label: 'Todos', icon: '🔥' },
  { id: 'basket', label: 'Basquete', icon: '🏀' },
  { id: 'futsal', label: 'Futsal', icon: '⚽' },
  { id: 'volley', label: 'Vôlei', icon: '🏐' },
  { id: 'tennis', label: 'Tênis', icon: '🎾' },
];

function MobileHome() {
  const [activeCategory, setActiveCategory] = useState('all');

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a] pb-[calc(100px+env(safe-area-inset-bottom,0px))]">
      <MobileHeader title="Bem-vindo, Atleta 👋" isWelcome />
      
      <div className="flex-1 bg-[#0a0a0a] rounded-t-[24px] -mt-5 relative z-10 px-6 pt-6">
        {/* Search Bar */}
        <div className="relative h-[46px] bg-[#252525] rounded-[12px] flex items-center px-4 mb-8">
          <input 
            type="text" 
            placeholder="Buscar replay ou quadra..." 
            className="flex-1 bg-transparent border-none outline-none text-white text-[14px] placeholder:text-[rgba(255,255,255,0.4)]"
          />
          <Search size={20} className="text-[#F97316]" />
        </div>

        {/* Categories Scroll */}
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-6 px-6 no-scrollbar mb-8">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-4 h-[40px] rounded-full border transition-all duration-200 whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'bg-[#F97316] border-[#F97316] text-black font-bold'
                  : 'bg-[#1a1a1a] border-[#2a2a2a] text-[rgba(255,255,255,0.6)]'
              }`}
            >
              <span>{cat.icon}</span>
              <span className="text-[14px]">{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Recent Replays Section */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[16px] font-bold text-white">Replays recentes</h2>
          <button className="text-[#F97316] text-[14px] font-medium">Ver todos</button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <Link to="/mobile/player" className="block active:scale-[0.98] transition-transform">
            <ReplayCardLarge 
              title="Lance do Jogo" 
              duration="00:08" 
              arena="Arena Central" 
              timestamp="Hoje, 14:20" 
              thumbnail="https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&q=80"
            />
          </Link>
          <Link to="/mobile/player" className="block active:scale-[0.98] transition-transform">
            <ReplayCardLarge 
              title="Cesta incrível" 
              duration="00:12" 
              arena="Arena Central" 
              timestamp="Hoje, 13:45" 
              thumbnail="https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=400&q=80"
            />
          </Link>
        </div>

        {/* Highlight Section */}
        <div className="bg-gradient-to-br from-[#F97316]/20 to-transparent border border-[#F97316]/30 rounded-[24px] p-5 flex items-center justify-between mb-8">
          <div>
            <h3 className="text-white text-[15px] font-bold mb-1">Sua arena</h3>
            <p className="text-[rgba(255,255,255,0.6)] text-[13px] mb-3">Arena Central • 12 replays hoje</p>
            <button className="bg-[#F97316] text-black text-[12px] font-bold px-4 py-1.5 rounded-full">
              Acessar
            </button>
          </div>
          <div className="w-16 h-16 bg-[#1a1a1a] rounded-full flex items-center justify-center border border-[#F97316]/50">
            <MapPin size={24} className="text-[#F97316]" />
          </div>
        </div>
      </div>
    </div>
  );
}
