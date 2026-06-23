export interface RecipeIngredient {
  ingredientId: string;
  name: string;
  qty: string;
  unit: string;
}

export interface RecipeStep {
  num: string;
  title: string;
  description: string;
}

export interface Recipe {
  id: string;
  name: string;
  category: string;
  yield: string;
  time: string;
  img: string;
  description?: string;
  prep_time?: string;
  difficulty?: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
}

export const ALL_RECIPES: Recipe[] = [
  {
    id: "rec-001",
    name: "Signature Sourdough Batard",
    category: "Sourdough",
    yield: "24 units",
    time: "18h 45m",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBDgc7Eo_mKPDx7RQkmK3E6Oeg55QQKBMRAT1pEHPGUta986kzcUL47FPPj-8cDc_WI6I_f2dtvxDAyYwcbPoDDht9sWmF4J1aJZytIK_oURhBgPwHm57llVjrVhEQGLdGgxFnklIJv8uHKahRkeHJ44wZXli3uxhZzJqTMnTf3tcR1LQUujai0kOGJ1RdMNdDu3T1cZQQDnbB9_mV9T3qa1CpFATf1UxhMiVp4raaczYYKzO3jRNzuWdcQ5X4V18E6mkisi6tuAfFe",
    ingredients: [
      { ingredientId: "flr-org-001", name: "Organic Bread Flour", qty: "700", unit: "g" },
      { ingredientId: "wtr-flt-001", name: "Filtered Water", qty: "500", unit: "ml" },
      { ingredientId: "str-act-001", name: "Active Sourdough Levain", qty: "150", unit: "g" },
      { ingredientId: "slt-fin-001", name: "Sea Salt (Fine)", qty: "14", unit: "g" },
    ],
    steps: [
      { num: "01", title: "Autolyse", description: "Combine flour and 700g water. Mix until no dry flour remains. Rest 45–60 minutes." },
      { num: "02", title: "Levain & Salt", description: "Add levain and remaining water. Slap-and-fold 8–10 minutes. Add salt and work in evenly." },
      { num: "03", title: "Bulk Fermentation", description: "4 sets of stretch and folds at 30-minute intervals over 4 hours. Ferment until 75–80% growth." },
    ],
  },
  {
    id: "rec-002",
    name: "Classic Butter Croissant",
    category: "Viennoiserie",
    yield: "18 units",
    time: "14h 30m",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCtc_UaixfCeUfz7q-g-E2U7ue-5DUoAJ4_Awhbcne1Q9gqtchX-DNHyKA_78DKpO4MQVzsGKgAWqIHGVnBxmghnEpD09aNRan9CnB0O2nYnluwMgE1zkNst8H6xU-qC8_SUBycg-_1T8HDgSax6NRSiGl7EpBwY3DoKjZUjQsKIkUewjQi1oeNPBE_dhZFu0FWi8lAHemG3mlXcn5sTkNyau0DkPRb96uym9FSc7LCVoWkm7kRKOlTPmyPjdMMTrQxb5izdTO2LJwz",
    ingredients: [
      { ingredientId: "flr-t45-001", name: "T45 Pastry Flour", qty: "500", unit: "g" },
      { ingredientId: "btr-eur-001", name: "European Block Butter", qty: "280", unit: "g" },
      { ingredientId: "wtr-flt-001", name: "Filtered Water", qty: "140", unit: "ml" },
      { ingredientId: "slt-fin-001", name: "Sea Salt (Fine)", qty: "10", unit: "g" },
    ],
    steps: [
      { num: "01", title: "Détrempe", description: "Mix flour, water, salt and a small amount of butter into a smooth dough. Refrigerate overnight." },
      { num: "02", title: "Lamination", description: "Encase butter block in dough. Perform 3 double folds with 30-minute rests between each." },
      { num: "03", title: "Shape & Proof", description: "Roll to 4mm, cut triangles, roll into croissants. Proof 2–3 hours at room temp until jiggly." },
    ],
  },
  {
    id: "rec-003",
    name: "Focaccia Barese",
    category: "Sourdough",
    yield: "2 trays",
    time: "6h 20m",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCZEA9Bb0E92ttiNPKygaTFeC4dzXBznNOXNamZP3o7bVGUwv6Hzf4GvcLSLSKZaHSEF3WxskKkxdKPSd_UpV32ZH-EcJT0uepYb2E7k70ffBDdz1mpaIjvaXKtezW-QbHZYtSSphohNe2_MDahWfWGmhNIjR2Ax8tQrOW0W190tn8Xz7E_Y9ub1lA0KNjOJPeiilJF4d6ef2YjqGkwBr9QIYmpcyzX5E1ShDsdKblhprVsIrizOMrkIEP0sEWCHaO8zlS_AEyfbhtm",
    ingredients: [
      { ingredientId: "flr-org-001", name: "Organic Bread Flour", qty: "500", unit: "g" },
      { ingredientId: "wtr-flt-001", name: "Filtered Water", qty: "400", unit: "ml" },
      { ingredientId: "str-act-001", name: "Active Sourdough Levain", qty: "100", unit: "g" },
      { ingredientId: "slt-fin-001", name: "Sea Salt (Fine)", qty: "12", unit: "g" },
    ],
    steps: [
      { num: "01", title: "Mix", description: "Combine all ingredients. Mix until cohesive. Rest 30 minutes." },
      { num: "02", title: "Bulk & Dimple", description: "3 sets of coil folds. Transfer to oiled tray. Dimple generously with fingers." },
      { num: "03", title: "Bake", description: "Drizzle olive oil. Bake at 230°C for 22–25 minutes until deep golden." },
    ],
  },
  {
    id: "rec-004",
    name: "Pain au Chocolat",
    category: "Viennoiserie",
    yield: "24 units",
    time: "15h 00m",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBDgc7Eo_mKPDx7RQkmK3E6Oeg55QQKBMRAT1pEHPGUta986kzcUL47FPPj-8cDc_WI6I_f2dtvxDAyYwcbPoDDht9sWmF4J1aJZytIK_oURhBgPwHm57llVjrVhEQGLdGgxFnklIJv8uHKahRkeHJ44wZXli3uxhZzJqTMnTf3tcR1LQUujai0kOGJ1RdMNdDu3T1cZQQDnbB9_mV9T3qa1CpFATf1UxhMiVp4raaczYYKzO3jRNzuWdcQ5X4V18E6mkisi6tuAfFe",
    ingredients: [
      { ingredientId: "flr-t45-001", name: "T45 Pastry Flour", qty: "500", unit: "g" },
      { ingredientId: "btr-eur-001", name: "European Block Butter", qty: "300", unit: "g" },
      { ingredientId: "wtr-flt-001", name: "Filtered Water", qty: "130", unit: "ml" },
      { ingredientId: "slt-fin-001", name: "Sea Salt (Fine)", qty: "10", unit: "g" },
    ],
    steps: [
      { num: "01", title: "Détrempe", description: "Same as croissant dough. Rest overnight refrigerated." },
      { num: "02", title: "Lamination", description: "3 double folds with butter. Rest between each fold." },
      { num: "03", title: "Shape", description: "Cut rectangles, place chocolate batons, roll and seal. Proof 2.5 hours." },
    ],
  },
  {
    id: "rec-005",
    name: "Génoise Layer Cake",
    category: "Cakes",
    yield: "12 slices",
    time: "3h 45m",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCtc_UaixfCeUfz7q-g-E2U7ue-5DUoAJ4_Awhbcne1Q9gqtchX-DNHyKA_78DKpO4MQVzsGKgAWqIHGVnBxmghnEpD09aNRan9CnB0O2nYnluwMgE1zkNst8H6xU-qC8_SUBycg-_1T8HDgSax6NRSiGl7EpBwY3DoKjZUjQsKIkUewjQi1oeNPBE_dhZFu0FWi8lAHemG3mlXcn5sTkNyau0DkPRb96uym9FSc7LCVoWkm7kRKOlTPmyPjdMMTrQxb5izdTO2LJwz",
    ingredients: [
      { ingredientId: "egg-001", name: "Eggs", qty: "6", unit: "units" },
      { ingredientId: "flr-t45-001", name: "T45 Pastry Flour", qty: "180", unit: "g" },
      { ingredientId: "btr-eur-001", name: "European Block Butter", qty: "60", unit: "g" },
    ],
    steps: [
      { num: "01", title: "Whip Eggs", description: "Whip eggs and sugar over bain-marie to ribbon stage (10 minutes)." },
      { num: "02", title: "Fold & Bake", description: "Fold in sifted flour gently. Add melted butter. Bake at 180°C for 25 minutes." },
      { num: "03", title: "Layer & Fill", description: "Cool completely. Slice into 3 layers. Fill with cream and assemble." },
    ],
  },
  {
    id: "rec-006",
    name: "Kouign-Amann Rounds",
    category: "Pastry",
    yield: "8 units",
    time: "5h 15m",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCZEA9Bb0E92ttiNPKygaTFeC4dzXBznNOXNamZP3o7bVGUwv6Hzf4GvcLSLSKZaHSEF3WxskKkxdKPSd_UpV32ZH-EcJT0uepYb2E7k70ffBDdz1mpaIjvaXKtezW-QbHZYtSSphohNe2_MDahWfWGmhNIjR2Ax8tQrOW0W190tn8Xz7E_Y9ub1lA0KNjOJPeiilJF4d6ef2YjqGkwBr9QIYmpcyzX5E1ShDsdKblhprVsIrizOMrkIEP0sEWCHaO8zlS_AEyfbhtm",
    ingredients: [
      { ingredientId: "flr-org-001", name: "Organic Bread Flour", qty: "250", unit: "g" },
      { ingredientId: "btr-eur-001", name: "European Block Butter", qty: "200", unit: "g" },
      { ingredientId: "wtr-flt-001", name: "Filtered Water", qty: "160", unit: "ml" },
      { ingredientId: "slt-fin-001", name: "Sea Salt (Fine)", qty: "5", unit: "g" },
    ],
    steps: [
      { num: "01", title: "Make Dough", description: "Mix flour, water, yeast and salt. Knead 8 minutes. Rest 1 hour." },
      { num: "02", title: "Layer Butter & Sugar", description: "Roll dough, spread cold butter and sugar. Fold and press in. Repeat twice." },
      { num: "03", title: "Bake", description: "Press into buttered tins. Bake at 200°C for 30–35 minutes until caramelised." },
    ],
  },
];
