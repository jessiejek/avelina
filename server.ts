import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support high-limit body sizes for image diagnostic logging
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ extended: true, limit: "15mb" }));

  // Initialize server-side Gemini client
  const apiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;

  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }

  // API endpoints FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", hasAi: !!ai });
  });

  // Diagnostic Assistant Endpoint using the modern @google/genai SDK
  app.post("/api/gemini/diagnose", async (req, res) => {
    try {
      if (!ai) {
        return res.status(500).json({
          error: "Gemini API Client is not configured. Please add GEMINI_API_KEY in the Secrets panel."
        });
      }

      const { prompt, context, image } = req.body;

      // Build context summary for Julian (the AI Master Baker)
      let customSystemInstruction = `You are Julian Pierre, an elite French boulanger & pastry chef with decades of artisanal bakery expertise.
You assist bakers in diagnosing and polishing their sourdough and pastries.
Always deliver precise, warm, encouraging, but highly technical feedback.
Reference flour types (like T55, Stoneground Whole Wheat, Rye), hydration physics, dough viscoelasticity, ambient temperatures, and fermentation stages (like Autolyse, Bulk, Cold Retard).
Focus your advice strictly on baking science (yeast behavior, hydration, oven spring, gluten development). Keep advice practical, actionable, and structured with elegant, humanized language. Do not output raw JSON unless requested.`;

      const assistantPrompt = `
User Query: "${prompt}"

Current Precision Tools Context:
${JSON.stringify(context || {}, null, 2)}

Provide your master advice:`;

      let response;

      if (image && image.startsWith("data:")) {
        // Parse base64 parts
        const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const base64Data = matches[2];

          const imagePart = {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            }
          };

          const textPart = {
            text: assistantPrompt
          };

          response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: { parts: [imagePart, textPart] },
            config: {
              systemInstruction: customSystemInstruction,
              temperature: 0.75,
            }
          });
        }
      }

      if (!response) {
        // Fallback or non-multimodal request
        response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: assistantPrompt,
          config: {
            systemInstruction: customSystemInstruction,
            temperature: 0.75,
          }
        });
      }

      const answer = response.text || "I was unable to formulate an answer. Let's check our dough values again.";
      res.json({ response: answer });

    } catch (err: any) {
      console.error("Gemini Diagnosis Error:", err);
      res.status(500).json({ error: err?.message || "Internal Server Error executing diagnosis" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
