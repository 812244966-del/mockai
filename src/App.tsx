/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  FileText, 
  Briefcase, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ChevronRight,
  User,
  Target,
  MessageSquare,
  X
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

// Types
interface CoreRequirement {
  title: string;
  description: string;
}

interface InterviewQuestion {
  question: string;
  answer: {
    framework: string;
    core: string;
    points: string[];
    logicChain: string[];
    example: string;
  };
}

interface AnalysisResult {
  matchScore: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  coreRequirements: CoreRequirement[];
  interviewQuestions: InterviewQuestion[];
}

interface FileData {
  base64: string;
  mimeType: string;
  name: string;
}

interface QuestionItemProps {
  question: string;
  answer: InterviewQuestion['answer'];
  index: number;
}

const QuestionItem: React.FC<QuestionItemProps> = ({ question, answer, index }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5 + index * 0.1 }}
      className="rounded-2xl bg-black/5 border border-black/5 hover:border-black/10 transition-colors overflow-hidden"
    >
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex gap-4 text-left items-start group"
      >
        <span className="text-blue-600 font-display font-bold text-lg mt-0.5">{index + 1}</span>
        <div className="flex-1">
          <p className="text-[#1D1D1F]/80 group-hover:text-[#1D1D1F] transition-colors font-medium">{question}</p>
          <div className="mt-2 flex items-center gap-1 text-blue-500 text-xs font-semibold uppercase tracking-wider">
            <span>{isOpen ? "收起参考答案" : "查看结构化参考答案"}</span>
            <ChevronRight size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
          </div>
        </div>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="px-4 pb-4 pt-0 ml-11">
              <div className="p-5 rounded-xl bg-blue-500/5 border border-blue-500/10 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-blue-600 text-xs uppercase tracking-widest">核心回答思路</p>
                    <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 text-[10px] font-bold uppercase tracking-tighter border border-blue-500/20">
                      框架: {answer.framework}
                    </span>
                  </div>
                  <p className="text-[#1D1D1F]/80 text-sm leading-relaxed">{answer.core}</p>
                </div>
                
                <div>
                  <p className="font-bold text-blue-600 text-xs uppercase tracking-widest mb-2">关键得分点</p>
                  <ul className="space-y-1.5">
                    {answer.points.map((point, i) => (
                      <li key={i} className="text-[#1D1D1F]/70 text-sm flex gap-2">
                        <span className="text-blue-500/50">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="font-bold text-blue-600 text-xs uppercase tracking-widest mb-2">思考逻辑链 (Thinking Process)</p>
                  <div className="space-y-2">
                    {answer.logicChain.map((step, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <div className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <p className="text-[#1D1D1F]/70 text-sm leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-bold text-blue-600 text-xs uppercase tracking-widest mb-2">实战案例建议</p>
                  <p className="text-[#1D1D1F]/70 text-sm italic leading-relaxed bg-white/40 p-3 rounded-lg border border-blue-500/5">
                    {answer.example}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function App() {
  const [resume, setResume] = useState<FileData | null>(null);
  const [jobDesc, setJobDesc] = useState<FileData | null>(null);
  const [jobText, setJobText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const analysisRef = useRef<boolean>(true);

  const resumeInputRef = useRef<HTMLInputElement>(null);
  const jobInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>, type: 'resume' | 'job') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError("仅支持 PDF 和图片 (PNG, JPG, WEBP) 格式。");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      const data = { base64, mimeType: file.type, name: file.name };
      if (type === 'resume') setResume(data);
      else setJobDesc(data);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const cancelAnalysis = () => {
    analysisRef.current = false;
    setIsAnalyzing(false);
    setError("分析已取消。");
  };

  const analyze = async () => {
    if (!resume) {
      setError("请先上传您的简历。");
      return;
    }
    if (!jobDesc && !jobText.trim()) {
      setError("请提供岗位描述（上传或输入文本）。");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    analysisRef.current = true;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const parts: any[] = [
        { text: "请根据以下简历和岗位描述进行深度分析。请使用中文输出所有内容。提供以下内容：\n1. 匹配度评分（0-100）\n2. 匹配总结\n3. 核心优势（数组）\n4. 潜在差距（数组）\n5. 岗位核心3要素/能力点 (coreRequirements)：从 JD 中提炼出最重要的 3 个核心要求，每个包含标题和简短描述。\n6. 10 个最可能的面试问题：对于每个问题，请提供结构化的参考答案。答案不限于 STAR 法则，请根据问题类型灵活选择最合适的框架（如 STAR、用户体验路径、产品增长模型、SWOT、PDCA 等），并在 'framework' 字段中注明所选框架。答案包含：核心回答思路 (core)、关键得分点 (points，数组)、思考逻辑链 (logicChain，数组，展示处理该问题的深度思考过程和策略逻辑)、实战案例建议 (example，详细描述，展示具体行动和结果)。\n请确保输出的 JSON 格式严格符合要求。" },
        { inlineData: { data: resume.base64, mimeType: resume.mimeType } },
        { text: "岗位描述内容如下：" }
      ];

      if (jobDesc) {
        parts.push({ inlineData: { data: jobDesc.base64, mimeType: jobDesc.mimeType } });
      }
      if (jobText.trim()) {
        parts.push({ text: jobText });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
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

      if (!analysisRef.current) return;

      const data = JSON.parse(response.text || "{}");
      setResult(data);
    } catch (err) {
      if (!analysisRef.current) return;
      console.error(err);
      setError("分析失败，请重试。");
    } finally {
      if (analysisRef.current) {
        setIsAnalyzing(false);
      }
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 lg:p-12 flex flex-col items-center">
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight mb-4 liquid-glass-text">
          MockAI
        </h1>
        <p className="text-[#1D1D1F]/60 text-lg max-w-2xl mx-auto font-light">
          利用 AI 深度分析简历与岗位匹配度，助您轻松应对面试。
        </p>
      </motion.header>

      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-6">
          {/* Resume Upload */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card rounded-3xl p-8 relative overflow-hidden group"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                <User size={24} />
              </div>
              <h2 className="text-2xl font-display font-semibold text-[#1D1D1F]">请上传你的简历</h2>
            </div>
            
            <input 
              type="file" 
              ref={resumeInputRef}
              onChange={(e) => handleFileChange(e, 'resume')}
              className="hidden"
              accept=".pdf,image/*"
            />
            
            <button 
              onClick={() => resumeInputRef.current?.click()}
              className={`w-full aspect-video rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-4 ${
                resume 
                ? 'border-emerald-500/50 bg-emerald-500/5' 
                : 'border-black/5 hover:border-black/10 hover:bg-black/5'
              }`}
            >
              {resume ? (
                <>
                  <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2 size={32} />
                  </div>
                  <div className="text-center">
                    <p className="text-[#1D1D1F] font-medium">{resume.name}</p>
                    <p className="text-[#1D1D1F]/40 text-sm">点击更换</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-4 rounded-full bg-black/5 text-black/20 group-hover:text-black/40 transition-colors">
                    <Upload size={32} />
                  </div>
                  <div className="text-center">
                    <p className="text-[#1D1D1F]/60 font-medium">上传 PDF 或图片</p>
                    <p className="text-[#1D1D1F]/30 text-sm">支持拖拽上传</p>
                  </div>
                </>
              )}
            </button>
          </motion.div>

          {/* Job Description */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-3xl p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                <Briefcase size={24} />
              </div>
              <h2 className="text-2xl font-display font-semibold text-[#1D1D1F]">请上传你的目标岗位描述</h2>
            </div>

            <div className="space-y-4">
              <textarea 
                placeholder="在此粘贴岗位描述文本..."
                value={jobText}
                onChange={(e) => setJobText(e.target.value)}
                className="w-full h-32 bg-black/5 border border-black/5 rounded-2xl p-4 text-[#1D1D1F] placeholder:text-[#1D1D1F]/20 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all resize-none"
              />
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-black/5"></span>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white/80 px-2 text-[#1D1D1F]/30">或上传截图</span>
                </div>
              </div>

              <input 
                type="file" 
                ref={jobInputRef}
                onChange={(e) => handleFileChange(e, 'job')}
                className="hidden"
                accept=".pdf,image/*"
              />

              <button 
                onClick={() => jobInputRef.current?.click()}
                className={`w-full py-4 rounded-2xl border border-black/5 flex items-center justify-center gap-2 transition-all ${
                  jobDesc ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'hover:bg-black/5 text-[#1D1D1F]/60'
                }`}
              >
                {jobDesc ? <CheckCircle2 size={18} /> : <Upload size={18} />}
                {jobDesc ? jobDesc.name : "上传岗位图片/PDF"}
              </button>
            </div>
          </motion.div>

          {/* Action Button */}
          <div className="flex gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={analyze}
              disabled={isAnalyzing}
              className="flex-1 py-6 rounded-3xl liquid-gradient text-white font-display font-bold text-xl shadow-[0_10px_30px_rgba(0,122,255,0.2)] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="animate-spin" />
                  正在分析...
                </>
              ) : (
                <>
                  <Sparkles size={24} />
                  开始分析
                </>
              )}
            </motion.button>

            {isAnalyzing && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={cancelAnalysis}
                className="px-8 py-6 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-600 font-display font-bold text-lg hover:bg-red-500/20 transition-all"
              >
                停止
              </motion.button>
            )}
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-red-600 flex items-center gap-3"
            >
              <AlertCircle size={20} />
              {error}
            </motion.div>
          )}
        </div>

        {/* Results Section */}
        <div className="relative">
          <AnimatePresence mode="wait">
            {!result && !isAnalyzing ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full glass-card rounded-3xl p-12 flex flex-col items-center justify-center text-center border-dashed border-black/5"
              >
                <div className="w-24 h-24 rounded-full bg-black/5 flex items-center justify-center mb-6">
                  <Target size={48} className="text-black/10" />
                </div>
                <h3 className="text-2xl font-display font-medium text-[#1D1D1F]/40 mb-2">准备就绪</h3>
                <p className="text-[#1D1D1F]/20 max-w-xs">上传文档后，AI 将为您生成匹配报告与面试预测。</p>
              </motion.div>
            ) : isAnalyzing ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full glass-card rounded-3xl p-12 flex flex-col items-center justify-center text-center"
              >
                <div className="relative w-32 h-32 mb-8">
                  <div className="absolute inset-0 rounded-full border-4 border-black/5"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles size={40} className="text-blue-500 animate-pulse" />
                  </div>
                </div>
                <h3 className="text-2xl font-display font-medium mb-2 text-[#1D1D1F]">AI 正在深度思考</h3>
                <p className="text-[#1D1D1F]/40">正在比对技能、经验与岗位需求...</p>
              </motion.div>
            ) : result && (
              <motion.div 
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                {/* Score Card */}
                <div className="glass-card rounded-3xl p-8 overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] -mr-32 -mt-32"></div>
                  
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="relative w-40 h-40 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="80"
                          cy="80"
                          r="70"
                          stroke="currentColor"
                          strokeWidth="12"
                          fill="transparent"
                          className="text-black/5"
                        />
                        <motion.circle
                          cx="80"
                          cy="80"
                          r="70"
                          stroke="currentColor"
                          strokeWidth="12"
                          fill="transparent"
                          strokeDasharray={440}
                          initial={{ strokeDashoffset: 440 }}
                          animate={{ strokeDashoffset: 440 - (440 * result.matchScore) / 100 }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                          className="text-blue-500"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-5xl font-display font-bold text-[#1D1D1F]">{result.matchScore}</span>
                        <span className="text-[#1D1D1F]/40 text-sm font-medium uppercase tracking-widest">匹配度</span>
                      </div>
                    </div>
                    
                    <div className="flex-1 text-center md:text-left">
                      <h3 className="text-2xl font-display font-semibold mb-3 text-[#1D1D1F]">分析总结</h3>
                      <p className="text-[#1D1D1F]/70 leading-relaxed font-light">
                        {result.summary}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Strengths & Gaps */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="glass-card rounded-3xl p-6">
                    <h4 className="text-emerald-600 font-display font-semibold mb-4 flex items-center gap-2">
                      <CheckCircle2 size={18} />
                      核心优势
                    </h4>
                    <ul className="space-y-3">
                      {result.strengths.map((s, i) => (
                        <li key={i} className="text-[#1D1D1F]/70 text-sm flex gap-2">
                          <span className="text-emerald-500/50">•</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="glass-card rounded-3xl p-6">
                    <h4 className="text-amber-600 font-display font-semibold mb-4 flex items-center gap-2">
                      <AlertCircle size={18} />
                      潜在差距
                    </h4>
                    <ul className="space-y-3">
                      {result.gaps.map((g, i) => (
                        <li key={i} className="text-[#1D1D1F]/70 text-sm flex gap-2">
                          <span className="text-amber-500/50">•</span>
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Core Requirements Section */}
                <div className="glass-card rounded-3xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                      <Target size={24} />
                    </div>
                    <h3 className="text-2xl font-display font-semibold text-[#1D1D1F]">岗位核心 3 要素</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {result.coreRequirements.map((req, i) => (
                      <div key={i} className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/10 hover:border-blue-500/20 transition-all">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold mb-3">
                          {i + 1}
                        </div>
                        <h4 className="font-display font-bold text-[#1D1D1F] mb-1">{req.title}</h4>
                        <p className="text-[#1D1D1F]/60 text-xs leading-relaxed">{req.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Interview Questions */}
                <div className="glass-card rounded-3xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                      <MessageSquare size={24} />
                    </div>
                    <h3 className="text-2xl font-display font-semibold text-[#1D1D1F]">预测面试问题</h3>
                  </div>
                  <div className="space-y-4">
                    {result.interviewQuestions.map((item, i) => (
                      <QuestionItem 
                        index={i} 
                        question={item.question} 
                        answer={item.answer} 
                        key={i}
                      />
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => setResult(null)}
                  className="w-full py-4 rounded-2xl border border-black/5 text-[#1D1D1F]/40 hover:text-[#1D1D1F]/60 hover:bg-black/5 transition-all flex items-center justify-center gap-2"
                >
                  <X size={18} />
                  清除结果
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="mt-auto py-8 text-gray-300 text-xs">
        &copy; 2026 MockAI. All rights reserved.
      </footer>
    </div>
  );
}
