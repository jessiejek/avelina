import React from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon.tsx";
import { supabase } from "../lib/supabase.ts";

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onNewProduction: () => void;
}

const navItems = [
  { id: "inventory", icon: "inventory_2", label: "Inventory" },
  { id: "recipes", icon: "menu_book", label: "Recipes" },
  { id: "orders", icon: "assignment", label: "Orders" },
  { id: "bakelog", icon: "history_edu", label: "Bake Log" },
  { id: "finance", icon: "wallet", label: "Finance" },
  { id: "stats", icon: "query_stats", label: "Stats" },
];

export default function Sidebar({ currentTab, setCurrentTab, onNewProduction }: SidebarProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <aside className="hidden lg:flex flex-col h-screen sticky top-0 w-[280px] border-r shrink-0 bg-surface-container-low border-outline-variant/20">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-outline-variant/20">
        <h1 className="text-primary font-bold" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 20 }}>
          Avelina's
        </h1>
        <p className="text-[11px] text-on-surface-variant mt-0.5 uppercase tracking-widest">Artisan Bakery</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentTab === item.id || currentTab.startsWith(item.id + "-");
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 h-12 rounded-xl transition-all duration-150 text-left text-sm font-medium ${
                isActive
                  ? "bg-secondary-container text-on-secondary-container font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              <Icon name={item.icon} size={18} strokeWidth={isActive ? 2.5 : 1.75} />
              <span style={{ fontFamily: "'Work Sans', sans-serif" }}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* New Production CTA */}
      <div className="px-3 pb-3 border-t border-outline-variant/20 pt-3">
        <button
          onClick={onNewProduction}
          className="w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 text-on-primary transition-opacity hover:opacity-90 active:scale-95 bg-primary"
          style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
        >
          <Icon name="add" size={16} strokeWidth={2.5} />
          New Production
        </button>
      </div>

      {/* Settings + User + Logout */}
      <div className="px-3 pb-4 space-y-1">
        <button className="w-full flex items-center gap-3 px-4 h-11 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors text-sm">
          <Icon name="settings" size={18} />
          <span style={{ fontFamily: "'Work Sans', sans-serif" }}>Settings</span>
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 h-11 rounded-xl text-error hover:bg-error-container/30 transition-colors text-sm"
        >
          <Icon name="logout" size={18} />
          <span style={{ fontFamily: "'Work Sans', sans-serif" }}>Sign Out</span>
        </button>
        <div className="flex items-center gap-3 px-4 py-3 border-t border-outline-variant/20 mt-1">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 bg-primary-fixed text-on-primary-fixed" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
            AV
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Admin</span>
            <span className="text-sm font-medium text-on-surface truncate">Avelina's Bakery</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
