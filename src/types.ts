/**
 * Shared Type Definitions for Bakelog: Artisanal Baking Journal & Precision Toolkit
 */

export type RecipeType = 'sourdough' | 'croissant' | 'focaccia' | 'baguette' | 'cookies' | 'tarts' | 'macarons';

export interface BakeStep {
  name: string;
  durationMinutes: number;
  completed: boolean;
  startedAt: string | null;     // To calculate real-time countdown
  remainingSeconds: number;     // Countdown state
  instruction: string;
}

export interface ActiveBake {
  id: string;
  name: string;
  recipeType: 'sourdough' | 'croissant' | 'focaccia' | 'baguette';
  startedAt: string;
  flourWeight: number;
  waterWeight: number;
  starterWeight: number;
  saltWeight: number;
  totalPureFlour: number;       // Adjusted for starter flour (e.g. starter is 50% water / 50% flour)
  totalPureWater: number;       // Adjusted for starter water
  hydrationPct: number;        // Computed hydration
  currentStepIdx: number;
  image: string;
  steps: BakeStep[];
  temperatureDough: number;     // in Celsius
  humidity: number;             // in Pct
  notes: string;
  isPaused: boolean;
}

export interface JournalEntry {
  id: string;
  name: string;
  recipeType: RecipeType;
  date: string;
  hydrationPct: number;
  rating: number;               // 1 to 5 wheat ears
  image: string;
  crumbPhoto?: string;
  notes: string;
  ambientTemp: number;          // in Celsius
  humidity: number;             // in Pct
  flourDetails: string;        // breakdown details
  fermentationTime: string;    // text summary description
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  image?: string;               // Base64 file attachment for crumb diagnostics
}
