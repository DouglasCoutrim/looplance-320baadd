import { createFileRoute } from '@tanstack/react-router';
import { MobileHeader } from '../../components/mobile/MobileHeader';
import { Play, Star, Clock, MapPin, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';

export const Route = createFileRoute('/mobile/replays')({
  component: MyReplays,
});

const mockReplays = [
  { id: 1, title: 'Lance de Basquete', arena: 'Arena Central', timestamp: '10:30', thumbnail: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&q=80', rating: '5.0', price: '$15.00' },
  { id: 2, title: 'Gol de Futsal', arena: 'Arena Norte', timestamp: '09:45', thumbnail: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=400&q=80', rating: '4.8', price: '$12.00' },
  { id: 3, title: 'Defesa espetacular', arena: 'Arena Central', timestamp: 'Ontem', thumbnail: 'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=400&q=80', rating: '4.5', price: '$10.00' },
];

function MyReplays() {
  return (
    <div className="flex flex-col min-h-screen bg-[#FFB347] pb-[calc(100px+env(safe-area-inset-bottom,0px))]">
      <MobileHeader title="Replays" />
      
      <div className="flex-1 bg-white rounded-t-[48px] -mt-5 relative z-10 px-6 pt-10">
        <div className="relative mb-8">
          <input 
            type="text" 
            placeholder="Search your replays" 
            className="w-full bg-gray-50 border border-gray-100 h-[56px] rounded-[24px] px-6 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 transition-all"
          />
          <Search size={20} className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300" />
        </div>

        <div className="space-y-8">
          {mockReplays.map((replay) => (
            <Link key={replay.id} to="/mobile/player" className="block active:scale-[0.98] transition-transform">
              <div className="relative rounded-[32px] overflow-hidden mb-4 shadow-sm border border-gray-50">
                <img 
                  src={replay.thumbnail} 
                  alt={replay.title} 
                  className="w-full h-48 object-cover"
                />
                <div className="absolute top-4 right-4 bg-[#F97316] w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg">
                  <Play size={20} fill="white" className="text-white ml-1" />
                </div>
              </div>
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-black text-[#2D3436] truncate">{replay.title}</h3>
                    <div className="flex items-center gap-1 bg-[#FDF2E9] px-2 py-0.5 rounded-full border border-[#F97316]/20 shrink-0">
                      <span className="text-[#F97316] text-[10px] font-black">{replay.rating}</span>
                      <Star size={8} fill="#F97316" className="text-[#F97316]" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-gray-400 text-[12px] font-medium">
                    <div className="flex items-center gap-1">
                      <MapPin size={12} />
                      <span className="truncate max-w-[100px]">{replay.arena}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={12} />
                      <span>{replay.timestamp}</span>
                    </div>
                  </div>
                </div>
                <span className="text-lg font-black text-[#F97316]">{replay.price}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}