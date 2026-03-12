import { LOGO_URL } from "@/lib/constants";
import { Users, FileText, BarChart3, Target } from "lucide-react";

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  const tabs = [
    { id: "promotoras", label: "Promotoras", icon: Users },
    { id: "lancamentos", label: "Lançamentos", icon: FileText },
    { id: "metas", label: "Metas", icon: Target },
    { id: "graficos", label: "Dashboard", icon: BarChart3 },
  ];

  return (
    <header className="bg-ms-dark shadow-lg sticky top-0 z-50">
      <div className="container mx-auto">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img
              src={LOGO_URL}
              alt="MS Consultoria"
              className="h-10 w-10 rounded-lg object-cover border-2 border-ms-teal shadow-md"
            />
            <div className="hidden sm:block">
              <h1 className="text-white font-bold text-lg leading-tight">
                MS Consultoria
              </h1>
              <p className="text-ms-teal-light text-xs font-medium">
                Gestão de Promotoras
              </p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-ms-teal/30 text-white shadow-inner"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
