import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Server is running" });
  });

  app.post("/api/analyze", async (req, res) => {
    console.log("Received analysis request");
    const { resume, jobDesc, jobText } = req.body;

    if (!resume) {
      console.log("Error: Resume missing");
      return res.status(400).json({ error: "请先上传您的简历。" });
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.log("Error: GEMINI_API_KEY missing in environment");
        return res.status(500).json({ error: "服务器未配置 GEMINI_API_KEY。" });
      }

      console.log("Calling Gemini API with model: gemini-3-flash-preview");
      const ai = new GoogleGenAI({ apiKey });
      
      const parts: any[] = [
        { text: "请根据以下简历和岗位描述进行深度分析。请使用中文输出所有内容。提供以下内容：\n1. 匹配度评分（0-100）\n2. 匹配总结\n3. 核心优势（数组）\n4. 潜在差距（数组）\n5. 岗位核心3要素/能力点 (coreRequirements)：从 JD 中提炼出最重要的 3 个核心要求，每个包含标题和简短描述。\n6. 10 个最可能的面试问题：对于每个问题，请提供结构化的参考答案。答案不限于 STAR 法则，请根据问题类型灵活选择最合适的框架（如 STAR、用户体验路径、产品增长模型、SWOT、PDCA 等），并在 'framework' 字段中注明所选框架。答案包含：核心回答思路 (core)、关键得分点 (points，数组)、思考逻辑链 (logicChain，数组，展示处理该问题的深度思考过程和策略逻辑)、实战案例建议 (example，详细描述，展示具体行动和结果)。\n请确保输出的 JSON 格式严格符合要求。" },
        { inlineData: { data: resume.base64, mimeType: resume.mimeType } },
        { text: "岗位描述内容如下：" }
      ];

      if (jobDesc) {
        parts.push({ inlineData: { data: jobDesc.base64, mimeType: jobDesc.mimeType } });
      }
      if (jobText && jobText.trim()) {
        parts.push({ text: jobText });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              matchScore: { type: Type.NUMBER },
              summary: { type: Type.STRING },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
              coreRequirements: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING }
                  },
                  required: ["title", "description"]
                },
                minItems: 3,
                maxItems: 3
              },
              interviewQuestions: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    answer: { 
                      type: Type.OBJECT,
                      properties: {
                        framework: { type: Type.STRING },
                        core: { type: Type.STRING },
                        points: { type: Type.ARRAY, items: { type: Type.STRING } },
                        logicChain: { type: Type.ARRAY, items: { type: Type.STRING } },
                        example: { type: Type.STRING }
                      },
                      required: ["framework", "core", "points", "logicChain", "example"]
                    }
                  },
                  required: ["question", "answer"]
                } 
              }
            },
            required: ["matchScore", "summary", "strengths", "gaps", "coreRequirements", "interviewQuestions"]
          }
        }
      });

      let data;
      try {
        data = JSON.parse(response.text || "{}");
      } catch (parseErr) {
        console.error("Failed to parse Gemini response as JSON:", response.text);
        return res.status(500).json({ error: "模型返回格式错误，请重试。", details: response.text });
      }
      res.json(data);
    } catch (err: any) {
      console.error("Gemini API Error:", err);
      res.status(500).json({ error: err.message || "分析过程中发生错误" });
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled Server Error:", err);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
