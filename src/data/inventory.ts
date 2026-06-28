export interface Ingredient {
  id: string;
  name: string;
  sku: string;
  stock: string;
  quantity: number | null;
  unit: string;
  status: "optimal" | "low" | "critical" | "untracked";
  icon: string;
  img: string;
  costPerUnit?: number;
  lowThreshold?: number;
}

export const DEFAULT_INGREDIENTS: Ingredient[] = [
  {
    id: "flr-org-001",
    name: "Organic Bread Flour",
    sku: "FLR-ORG-001",
    stock: "45.5 kg",
    quantity: 45.5,
    unit: "kg",
    status: "optimal",
    icon: "wheat",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCpSnC71P8IBi6VGgsyrsm0jMtSjUwWW6bdfRJ5yE7C-v6Qf-CM7jNvJYs3JNr-O3K0Dgg2Nd1eRjAJ9WVwaxRKvKqYjBlVLa_icCC7iKLMDm4gU1sYsgys3wFc6NJAc9aTwMM9LnvBj-hg-YFR33Tu0IJx4glef1ST0pQB6GQqcn_6oxNUfLiscc_l3_IX1lwfW7Z0xlZyWBSA8H4VO7CE2o03FzpDIpzk_cUu3S2PAj9sIiUsIVChaduWlKCN0HhwS7L_iWYrIExc",
  },
  {
    id: "str-act-001",
    name: "Active Sourdough Levain",
    sku: "STR-ACT-001",
    stock: "0.80 kg",
    quantity: 0.8,
    unit: "kg",
    status: "critical",
    icon: "sparkles",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBDgc7Eo_mKPDx7RQkmK3E6Oeg55QQKBMRAT1pEHPGUta986kzcUL47FPPj-8cDc_WI6I_f2dtvxDAyYwcbPoDDht9sWmF4J1aJZytIK_oURhBgPwHm57llVjrVhEQGLdGgxFnklIJv8uHKahRkeHJ44wZXli3uxhZzJqTMnTf3tcR1LQUujai0kOGJ1RdMNdDu3T1cZQQDnbB9_mV9T3qa1CpFATf1UxhMiVp4raaczYYKzO3jRNzuWdcQ5X4V18E6mkisi6tuAfFe",
  },
  {
    id: "slt-fin-001",
    name: "Sea Salt (Fine)",
    sku: "SLT-FIN-001",
    stock: "5.00 kg",
    quantity: 5.0,
    unit: "kg",
    status: "optimal",
    icon: "flask",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCtc_UaixfCeUfz7q-g-E2U7ue-5DUoAJ4_Awhbcne1Q9gqtchX-DNHyKA_78DKpO4MQVzsGKgAWqIHGVnBxmghnEpD09aNRan9CnB0O2nYnluwMgE1zkNst8H6xU-qC8_SUBycg-_1T8HDgSax6NRSiGl7EpBwY3DoKjZUjQsKIkUewjQi1oeNPBE_dhZFu0FWi8lAHemG3mlXcn5sTkNyau0DkPRb96uym9FSc7LCVoWkm7kRKOlTPmyPjdMMTrQxb5izdTO2LJwz",
  },
  {
    id: "wtr-flt-001",
    name: "Filtered Water",
    sku: "WTR-FLT-001",
    stock: "6.20 kg",
    quantity: 6.2,
    unit: "kg",
    status: "low",
    icon: "droplets",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCZEA9Bb0E92ttiNPKygaTFeC4dzXBznNOXNamZP3o7bVGUwv6Hzf4GvcLSLSKZaHSEF3WxskKkxdKPSd_UpV32ZH-EcJT0uepYb2E7k70ffBDdz1mpaIjvaXKtezW-QbHZYtSSphohNe2_MDahWfWGmhNIjR2Ax8tQrOW0W190tn8Xz7E_Y9ub1lA0KNjOJPeiilJF4d6ef2YjqGkwBr9QIYmpcyzX5E1ShDsdKblhprVsIrizOMrkIEP0sEWCHaO8zlS_AEyfbhtm",
  },
  {
    id: "btr-eur-001",
    name: "European Block Butter",
    sku: "BTR-EUR-001",
    stock: "12.0 kg",
    quantity: 12.0,
    unit: "kg",
    status: "optimal",
    icon: "leaf",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBDgc7Eo_mKPDx7RQkmK3E6Oeg55QQKBMRAT1pEHPGUta986kzcUL47FPPj-8cDc_WI6I_f2dtvxDAyYwcbPoDDht9sWmF4J1aJZytIK_oURhBgPwHm57llVjrVhEQGLdGgxFnklIJv8uHKahRkeHJ44wZXli3uxhZzJqTMnTf3tcR1LQUujai0kOGJ1RdMNdDu3T1cZQQDnbB9_mV9T3qa1CpFATf1UxhMiVp4raaczYYKzO3jRNzuWdcQ5X4V18E6mkisi6tuAfFe",
  },
  {
    id: "flr-t45-001",
    name: "T45 Pastry Flour",
    sku: "FLR-T45-001",
    stock: "8.2 kg",
    quantity: 8.2,
    unit: "kg",
    status: "low",
    icon: "wheat",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCpSnC71P8IBi6VGgsyrsm0jMtSjUwWW6bdfRJ5yE7C-v6Qf-CM7jNvJYs3JNr-O3K0Dgg2Nd1eRjAJ9WVwaxRKvKqYjBlVLa_icCC7iKLMDm4gU1sYsgys3wFc6NJAc9aTwMM9LnvBj-hg-YFR33Tu0IJx4glef1ST0pQB6GQqcn_6oxNUfLiscc_l3_IX1lwfW7Z0xlZyWBSA8H4VO7CE2o03FzpDIpzk_cUu3S2PAj9sIiUsIVChaduWlKCN0HhwS7L_iWYrIExc",
  },
  {
    id: "egg-001",
    name: "Eggs",
    sku: "EGG-001",
    stock: "48 units",
    quantity: 48,
    unit: "units",
    status: "optimal",
    icon: "egg",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCtc_UaixfCeUfz7q-g-E2U7ue-5DUoAJ4_Awhbcne1Q9gqtchX-DNHyKA_78DKpO4MQVzsGKgAWqIHGVnBxmghnEpD09aNRan9CnB0O2nYnluwMgE1zkNst8H6xU-qC8_SUBycg-_1T8HDgSax6NRSiGl7EpBwY3DoKjZUjQsKIkUewjQi1oeNPBE_dhZFu0FWi8lAHemG3mlXcn5sTkNyau0DkPRb96uym9FSc7LCVoWkm7kRKOlTPmyPjdMMTrQxb5izdTO2LJwz",
  },
];
