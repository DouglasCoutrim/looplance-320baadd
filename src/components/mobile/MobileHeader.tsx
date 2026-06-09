import { ChevronLeft, Bell } from "lucide-react";
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
    <div className="bg-[#F97316] h-[120px] pt-[env(safe-area-inset-top,48px)] px-6 flex items-start justify-between relative overflow-hidden">
      {showBack && (
        <button 
          onClick={() => navigate({ to: '..' })}
          className="p-1 -ml-1 text-white active:scale-95 transition-transform"
        >
          <ChevronLeft size={24} />
        </button>
      )}
      
      <div className={`flex-1 ${isWelcome ? 'text-left' : 'text-center'}`}>
        <h1 className="text-white text-[20px] font-bold leading-tight">
          {title}
        </h1>
      </div>

      <div className="min-w-[24px]">
        {rightElement || (isWelcome && (
          <button className="p-1 text-white active:scale-95 transition-transform">
            <Bell size={24} />
          </button>
        ))}
      </div>
    </div>
  );
};
