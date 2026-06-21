import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar.tsx";
import InventoryDashboard from "./screens/InventoryDashboard.tsx";
import IngredientDetail from "./screens/IngredientDetail.tsx";
import StockAdjustment from "./screens/StockAdjustment.tsx";
import RecipesList from "./screens/RecipesList.tsx";
import RecipeBuilder from "./screens/RecipeBuilder.tsx";
import BakeConfirmation from "./screens/BakeConfirmation.tsx";
import BakeLog, { BakeEntry } from "./screens/BakeLog.tsx";
import Stats from "./screens/Stats.tsx";
import Icon from "./components/Icon.tsx";
import { Ingredient, DEFAULT_INGREDIENTS } from "./data/inventory.ts";
import { Recipe, ALL_RECIPES } from "./data/recipes.ts";

function RecipePickerModal({ recipes, onSelect, onClose }: { recipes: Recipe[]; onSelect: (r: Recipe) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(29,27,26,0.6)" }} onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/10">
          <div>
            <h3 className="font-bold text-primary" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 20 }}>Start New Production</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">Pick a recipe to bake</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="p-4 space-y-2 max-h-[420px] overflow-y-auto">
          {recipes.map((r) => (
            <button key={r.name} onClick={() => onSelect(r)} className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-surface-container transition-colors text-left group">
              <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-outline-variant/20">
                <img src={r.img} alt={r.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-primary text-sm truncate" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>{r.name}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide bg-surface-container px-2 py-0.5 rounded-full">{r.category}</span>
                  <span className="text-xs text-on-surface-variant font-mono">{r.yield}</span>
                  <span className="text-xs text-on-surface-variant font-mono">{r.time}</span>
                </div>
              </div>
              <Icon name="chevron_right" size={16} className="text-outline group-hover:text-primary transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [inventory, setInventory] = useState<Ingredient[]>(DEFAULT_INGREDIENTS);
  const [recipes, setRecipes] = useState<Recipe[]>(ALL_RECIPES);
  const [bakeLogs, setBakeLogs] = useState<BakeEntry[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [confirmRecipe, setConfirmRecipe] = useState<Recipe | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const currentTab = (() => {
    const p = location.pathname;
    if (p.startsWith("/recipes")) return "recipes";
    if (p.startsWith("/bakelog")) return "bakelog";
    if (p.startsWith("/stats")) return "stats";
    return "inventory";
  })();

  const pickRecipe = (r: Recipe) => {
    setSelectedRecipe(r);
    setShowPicker(false);
    navigate("/recipes/builder");
  };

  const handleLogBake = (entry: BakeEntry) => {
    setBakeLogs((prev) => [entry, ...prev]);
    navigate("/bakelog");
  };

  const mobileNavItems = [
    { id: "inventory", path: "/inventory", icon: "inventory_2", label: "Inventory" },
    { id: "recipes", path: "/recipes", icon: "menu_book", label: "Recipes" },
    { id: "bakelog", path: "/bakelog", icon: "history_edu", label: "Log" },
    { id: "stats", path: "/stats", icon: "query_stats", label: "Stats" },
  ];

  return (
    <div className="flex min-h-screen bg-surface text-on-surface" style={{ fontFamily: "'Work Sans', sans-serif" }}>
      <Sidebar currentTab={currentTab} setCurrentTab={(tab) => navigate(`/${tab}`)} onNewProduction={() => setShowPicker(true)} />

      <main className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        <Routes>
          <Route path="/" element={<Navigate to="/inventory" replace />} />

          {/* Inventory — /adjust MUST come before /:id so it isn't matched as an id param */}
          <Route path="/inventory" element={
            <InventoryDashboard
              ingredients={inventory}
              onAddIngredient={(ing) => setInventory((prev) => [ing, ...prev])}
              onViewIngredient={(id) => navigate(`/inventory/${id}`)}
            />
          } />
          <Route path="/inventory/adjust" element={
            <StockAdjustment onBack={() => navigate(-1)} />
          } />
          <Route path="/inventory/:id" element={
            <IngredientDetail onBack={() => navigate("/inventory")} onAdjustStock={() => navigate("/inventory/adjust")} />
          } />

          {/* Recipes */}
          <Route path="/recipes" element={
            <RecipesList
              recipes={recipes}
              inventory={inventory}
              onAddRecipe={(r) => setRecipes((prev) => [r, ...prev])}
              onViewRecipe={(r) => { setSelectedRecipe(r); navigate("/recipes/builder"); }}
            />
          } />
          <Route path="/recipes/builder" element={
            selectedRecipe
              ? <RecipeBuilder
                  recipe={selectedRecipe}
                  inventory={inventory}
                  onBack={() => navigate("/recipes")}
                  onInitiateBake={(r) => { setConfirmRecipe(r); navigate("/recipes/confirm"); }}
                />
              : <Navigate to="/recipes" replace />
          } />
          <Route path="/recipes/confirm" element={
            confirmRecipe
              ? <BakeConfirmation
                  recipe={confirmRecipe}
                  onBack={() => navigate("/recipes/builder")}
                  onLogBake={handleLogBake}
                />
              : <Navigate to="/recipes" replace />
          } />

          {/* Bake Log */}
          <Route path="/bakelog" element={<BakeLog entries={bakeLogs} />} />

          {/* Stats */}
          <Route path="/stats" element={<Stats />} />

          <Route path="*" element={<Navigate to="/inventory" replace />} />
        </Routes>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-2 bg-surface-bright border-t border-outline-variant/10 shadow-sm">
        {mobileNavItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button key={item.id} onClick={() => navigate(item.path)} className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl transition-all ${isActive ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant"}`}>
              <Icon name={item.icon} size={22} />
              <span className="text-[10px] font-semibold uppercase tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {showPicker && <RecipePickerModal recipes={recipes} onSelect={pickRecipe} onClose={() => setShowPicker(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
