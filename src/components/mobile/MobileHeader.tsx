import { ChevronLeft, Bell, ShoppingBag, User } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  rightElement?: React.ReactNode;
  isWelcome?: boolean;
}

export const MobileHeader = ({ title, showBack = false, rightElement, isWelcome = false }: MobileHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div className="bg-[#FFB347] pt-[env(safe-area-inset-top,44px)] pb-10 px-6">
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

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showBack && (
            <button 
              onClick={() => navigate({ to: '..' })}
              className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white backdrop-blur-md active:scale-95 transition-transform"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <h1 className="text-white text-[24px] font-black leading-tight uppercase tracking-tight">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {rightElement || (
            <>
              <div className="w-10 h-10 border border-white/30 rounded-full flex items-center justify-center">
                <ShoppingBag size={20} className="text-white" />
              </div>
              <div className="w-10 h-10 border border-white/30 rounded-full flex items-center justify-center">
                <Bell size={20} className="text-white" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};