import { createFileRoute } from '@tanstack/react-router';
import { MobileHeader } from '../../components/mobile/MobileHeader';
import { MapPin, Star, Navigation } from 'lucide-react';
import { Link } from '@tanstack/react-router';

export const Route = createFileRoute('/mobile/quadras')({
  component: () => (
    <div className="flex flex-col min-h-screen bg-[#FFB347] pb-[calc(100px+env(safe-area-inset-bottom,0px))]">
      <MobileHeader title="Arenas" />
      
      <div className="flex-1 bg-white rounded-t-[48px] -mt-5 relative z-10 px-6 pt-10">
        <div className="space-y-8">
          {[
            { id: 1, name: 'Arena Central', location: 'Centro, São Paulo', rating: '5.0', image: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&q=80', distance: '1.2 km' },
            { id: 2, name: 'Arena Norte', location: 'Santana, São Paulo', rating: '4.9', image: 'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=400&q=80', distance: '3.5 km' },
          ].map((arena) => (
            <div key={arena.id} className="group">
              <div className="relative rounded-[32px] overflow-hidden mb-4 shadow-sm border border-gray-50">
                <img 
                  src={arena.image} 
                  alt={arena.name} 
                  className="w-full h-48 object-cover"
                />
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl flex items-center gap-2 shadow-lg">
                  <Navigation size={14} className="text-[#F97316] fill-[#F97316]" />
                  <span className="text-[12px] font-black text-[#2D3436]">{arena.distance}</span>
                </div>
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-black text-[#2D3436]">{arena.name}</h3>
                    <div className="flex items-center gap-1 bg-[#FDF2E9] px-2 py-0.5 rounded-full border border-[#F97316]/20">
                      <span className="text-[#F97316] text-[11px] font-black">{arena.rating}</span>
                      <Star size={10} fill="#F97316" className="text-[#F97316]" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400 text-[14px] font-medium">
                    <MapPin size={14} />
                    <span>{arena.location}</span>
                  </div>
                </div>
                <button className="bg-[#F97316] text-white text-[12px] font-black px-6 py-3 rounded-2xl shadow-lg shadow-[#F97316]/20 active:scale-95 transition-all">
                  Explorar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
});