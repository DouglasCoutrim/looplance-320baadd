import { createFileRoute } from '@tanstack/react-router';
import { Search, MapPin, Bell, ShoppingBag, User, SlidersHorizontal, Star } from 'lucide-react';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';

export const Route = createFileRoute('/mobile/')({
  component: MobileHome,
});

const categories = [
  { id: 'snacks', label: 'Snacks', icon: '🍿', color: '#FEF9E7' },
  { id: 'meal', label: 'Meal', icon: '🍽️', color: '#FDF2E9' },
  { id: 'vegan', label: 'Vegan', icon: '🥦', color: '#E9F7EF' },
  { id: 'dessert', label: 'Dessert', icon: '🧁', color: '#F5EEF8' },
  { id: 'drinks', label: 'Drinks', icon: '🍹', color: '#EBF5FB' },
];

function MobileHome() {
  const [activeCategory, setActiveCategory] = useState('snacks');

  return (
    <div className="flex flex-col min-h-screen bg-[#FFB347] pb-[calc(100px+env(safe-area-inset-bottom,0px))]">
      {/* Header Area */}
      <div className="px-6 pt-[env(safe-area-inset-top,44px)] pb-10">
        <div className="flex items-center justify-between mb-6">
          <span className="text-white text-sm font-medium">16:04</span>
          <div className="flex items-center gap-1.5 text-white">
            <div className="flex items-end gap-0.5 h-3">
              <div className="w-0.5 h-1 bg-white opacity-50 rounded-full"></div>
              <div className="w-0.5 h-1.5 bg-white opacity-70 rounded-full"></div>
              <div className="w-0.5 h-2 bg-white rounded-full"></div>
              <div className="w-0.5 h-3 bg-white rounded-full"></div>
            </div>
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 21c-4.41 0-8-3.59-8-8 0-4.41 3.59-8 8-8s8 3.59 8 8c0 4.41-3.59 8-8 8zm0-14.5c-3.59 0-6.5 2.91-6.5 6.5s2.91 6.5 6.5 6.5 6.5-2.91 6.5-6.5-2.91-6.5-6.5-6.5z"/>
            </svg>
            <div className="border border-white/40 rounded-sm px-1 py-0.5 text-[8px] font-bold">100%</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <input 
              type="text" 
              placeholder="Search" 
              className="w-full bg-white h-11 rounded-full pl-6 pr-12 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none shadow-sm"
            />
            <button className="absolute right-1 top-1 w-9 h-9 bg-[#F97316] rounded-full flex items-center justify-center">
              <SlidersHorizontal size={18} className="text-white" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 border border-white/30 rounded-full flex items-center justify-center">
              <ShoppingBag size={20} className="text-white" />
            </div>
            <div className="w-10 h-10 border border-white/30 rounded-full flex items-center justify-center">
              <Bell size={20} className="text-white" />
            </div>
            <div className="w-10 h-10 border border-white/30 rounded-full flex items-center justify-center overflow-hidden">
              <User size={20} className="text-white" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 bg-white rounded-t-[40px] -mt-5 relative z-10">
        {/* Categories */}
        <div className="bg-[#F97316] rounded-t-[40px] px-6 pt-8 pb-12 flex justify-between">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="flex flex-col items-center gap-2"
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all duration-200 ${
                activeCategory === cat.id ? 'bg-white shadow-xl scale-110' : 'bg-[#FEF9E7]/20 border border-white/10'
              }`}>
                {cat.icon}
              </div>
              <span className={`text-[12px] font-bold ${
                activeCategory === cat.id ? 'text-white' : 'text-white/60'
              }`}>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Content Section */}
        <div className="bg-white rounded-t-[40px] -mt-8 px-6 pt-8 pb-20">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-400">Sort By</span>
              <span className="text-sm font-bold text-[#F97316]">Popular</span>
            </div>
            <button className="w-8 h-8 bg-[#F97316] rounded-lg flex items-center justify-center">
              <SlidersHorizontal size={16} className="text-white" />
            </button>
          </div>

          <div className="space-y-8">
            {/* Item 1 */}
            <Link to="/mobile/player" className="block group">
              <div className="relative rounded-[32px] overflow-hidden mb-4 shadow-sm border border-gray-100">
                <img 
                  src="https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&q=80" 
                  alt="Mexican Appetizer" 
                  className="w-full h-56 object-cover"
                />
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-black text-[#2D3436]">Mexican Appetizer</h3>
                    <div className="flex items-center gap-1 bg-[#FDF2E9] px-2 py-0.5 rounded-full border border-[#F97316]/20">
                      <span className="text-[#F97316] text-[11px] font-black">5.0</span>
                      <Star size={10} fill="#F97316" className="text-[#F97316]" />
                    </div>
                  </div>
                  <p className="text-[12px] text-gray-400 leading-tight">Tortilla Chips With Toppins</p>
                </div>
                <span className="text-xl font-black text-[#F97316]">$15.00</span>
              </div>
            </Link>

            {/* Item 2 */}
            <Link to="/mobile/player" className="block group">
              <div className="relative rounded-[32px] overflow-hidden mb-4 shadow-sm border border-gray-100">
                <img 
                  src="https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=600&q=80" 
                  alt="Pork Skewer" 
                  className="w-full h-56 object-cover"
                />
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-black text-[#2D3436]">Pork Skewer</h3>
                    <div className="flex items-center gap-1 bg-[#FDF2E9] px-2 py-0.5 rounded-full border border-[#F97316]/20">
                      <span className="text-[#F97316] text-[11px] font-black">4.0</span>
                      <Star size={10} fill="#F97316" className="text-[#F97316]" />
                    </div>
                  </div>
                  <p className="text-[12px] text-gray-400 leading-tight">Marinated in a rich blend of herbs and spices, then grilled to perfection, served with a side of zesty dipping sauce.</p>
                </div>
                <span className="text-xl font-black text-[#F97316]">$12.99</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}