"use client";
import { useState } from "react";
import { Check, Mic, Send } from "lucide-react";
import { ScenarioCard } from "@/components/cards";
import CorrectionCard from "@/features/ai-chat/components/CorrectionCard";
const correction = { original: "goed", fixed: "went", type: "grammar" as const, why: "Go has an irregular past tense: went." };
export default function HowPreview({ step }: { step: number }) {
 const [selected, setSelected] = useState(false);
 return <div className="min-w-0 rounded-[20px] border border-line bg-white p-4 text-sm">
 {step === 1 && <ScenarioCard compact s={{ id: "visa-us", title: "Visa interview", mode: "guided", minutes: 8, totalQuestions: 6, category: "Travel & visa", level: "B1", icon: null, description: "Practice your student visa interview." }} onStart={() => setSelected(true)} />}
 {step === 1 && selected && <p role="status" className="mt-3 rounded-2xl bg-mint p-3">What is the purpose of your trip?</p>}
 {step === 2 && <div className="space-y-4"><p className="rounded-2xl bg-black/[0.04] p-3">How was your day?</p><p className="ml-5 rounded-2xl bg-mint p-3">Yesterday I goed to the park.</p><div className="flex items-center gap-2 border-t border-line pt-4"><Mic size={18} aria-hidden /><span className="flex-1 rounded-full bg-black/[0.04] px-3 py-2 text-xs text-muted">Type your response here…</span><Send size={17} aria-hidden /></div></div>}
 {step === 3 && <CorrectionCard c={correction} />}
 {step === 4 && <div className="space-y-4"><p className="rounded-2xl bg-mint p-4 font-medium">Yesterday I went to the park.</p><button type="button" onClick={() => setSelected(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white">{selected ? <Check size={16} aria-hidden /> : <Mic size={16} aria-hidden />}{selected ? "Nailed it" : "Try the example"}</button><p className="text-xs text-muted">In the app, say it again to check your corrected sentence.</p></div>}
 <p className="mt-3 text-[11px] text-muted">Example preview · no microphone or credits used</p>
 </div>;
}
