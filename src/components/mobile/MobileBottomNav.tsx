import { Home, Play, Heart, FileText, Headphones } from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";

const navItems = [
  { icon: Home, label: "Home", to: "/mobile" },
  { icon: Play, label: "Replays", to: "/mobile/replays" },
  { icon: Heart, label: "Favs", to: "/mobile/profile" },
  { icon: FileText, label: "List", to: "/mobile/settings" },
  { icon: Headphones, label: "Support", to: "/mobile/support" },
];

export const MobileBottomNav = () => {
  const location = useLocation();

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-6 pb-6 z-50">
      <div className="bg-[#F97316] h-[72px] rounded-[32px] flex items-center justify-between px-6 shadow-2xl">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              to={item.to}
              className="flex items-center justify-center transition-all duration-200"
            >
              <div className={`transition-all duration-200 ${isActive ? 'scale-110 opacity-100' : 'opacity-60 scale-90'}`}>
                <Icon 
                  size={24} 
                  className="text-white" 
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};