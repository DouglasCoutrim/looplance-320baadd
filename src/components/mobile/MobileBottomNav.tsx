import { Home, Play, Grid, User, Settings } from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";

const navItems = [
  { icon: Home, label: "Home", to: "/mobile" },
  { icon: Play, label: "Replays", to: "/mobile/replays" },
  { icon: Grid, label: "Quadras", to: "/mobile/quadras" },
  { icon: User, label: "Perfil", to: "/mobile/profile" },
  { icon: Settings, label: "Config", to: "/mobile/settings" },
];

export const MobileBottomNav = () => {
  const location = useLocation();

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-[#F97316] h-[86px] rounded-t-[24px] px-4 flex items-start justify-around pt-3 safe-area-bottom z-50">
      {navItems.map((item) => {
        const isActive = location.pathname === item.to;
        const Icon = item.icon;

        return (
          <Link
            key={item.label}
            to={item.to}
            className="flex flex-col items-center gap-1 min-w-[50px] transition-all duration-200"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${isActive ? 'bg-white shadow-lg' : ''}`}>
              <Icon 
                size={22} 
                className={isActive ? 'text-[#F97316]' : 'text-white opacity-70'} 
              />
            </div>
            <span className="text-white text-[10px] font-medium">
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
};
