import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { callGroq } from "../lib/groq";
import PaywallGate from "../components/PaywallGate";
import {
  RiBrainFill,
  RiSendPlaneFill,
  RiSparklingFill,
  RiQuestionLine,
  RiHeartPulseFill,
  RiRestaurantFill,
} from "@remixicon/react";

const SUGGESTED_PROMPTS = [
  {
    icon: <RiQuestionLine size={16} />,
    text: "How can I improve my bench press?",
  },
  {
    icon: <RiHeartPulseFill size={16} />,
    text: "My shoulder hurts after overhead press. What should I do?",
  },
  {
    icon: <RiRestaurantFill size={16} />,
    text: "What should I eat after training for muscle growth?",
  },
  {
    icon: <RiSparklingFill size={16} />,
    text: "Create a quick ab workout I can do at home",
  },
];

export default function AICoach() {
  const { user, profile, isPro } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadHistory();
  }, []);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadHistory() {
    const { data } = await supabase
      .from("ai_messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(50);
    setMessages(data || []);
    setLoadingHistory(false);
  }

  async function sendMessage(text) {
    if (!text?.trim() || loading) return;
    const userMsg = {
      role: "user",
      content: text.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    await supabase
      .from("ai_messages")
      .insert({ user_id: user.id, role: "user", content: text.trim() });

    try {
      const context = buildContext();
      const history = messages
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const data = await callGroq({
        messages: [
          {
            role: "system",
            content: `You are REPMAX AI Coach — a friendly, knowledgeable fitness expert. You provide evidence-based advice on training, nutrition, recovery, and form.

USER PROFILE:
- Name: ${profile?.display_name || "Athlete"}
- Experience: ${profile?.experience_level || "intermediate"}
- Goal: ${profile?.goal || "general fitness"}
- Training days: ${profile?.training_days?.join(", ") || "N/A"}
- Equipment: ${profile?.equipment?.join(", ") || "full gym"}

${context}

RULES:
- Be concise but thorough. Use bullet points.
- If they describe pain, always recommend seeing a doctor/physio first.
- Give specific, actionable advice — not generic platitudes.
- Use their profile data to personalize responses.
- If asked about nutrition, give examples of actual meals.
- Keep responses under 300 words unless they ask for detail.`,
          },
          ...history,
          { role: "user", content: text.trim() },
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_tokens: 1000,
      });

      const assistantContent =
        data.choices?.[0]?.message?.content ||
        "Sorry, I couldn't generate a response. Try again.";
      const assistantMsg = {
        role: "assistant",
        content: assistantContent,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      await supabase.from("ai_messages").insert({
        user_id: user.id,
        role: "assistant",
        content: assistantContent,
      });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Connection error. Please try again.",
          created_at: new Date().toISOString(),
        },
      ]);
    }
    setLoading(false);
  }

  function buildContext() {
    const parts = [];
    if (profile?.total_workouts)
      parts.push(`Total workouts completed: ${profile.total_workouts}`);
    if (profile?.current_streak)
      parts.push(`Current training streak: ${profile.current_streak} days`);
    return parts.length ? "RECENT ACTIVITY:\n" + parts.join("\n") : "";
  }

  const coachContent = (
    <div className="coach-page">
      <div className="coach-header">
        <div className="coach-avatar">
          <RiBrainFill size={24} />
        </div>
        <div>
          <h1 className="coach-title">AI Coach</h1>
          <p className="coach-subtitle">Your personal fitness expert</p>
        </div>
      </div>

      <div className="coach-messages">
        {messages.length === 0 && !loadingHistory && (
          <div className="coach-welcome">
            <RiSparklingFill size={32} className="accent-icon" />
            <h3>Ask me anything about fitness</h3>
            <p>Training, nutrition, recovery, form tips — I'm here to help.</p>
            <div className="coach-suggestions">
              {SUGGESTED_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  className="suggestion-chip"
                  onClick={() => sendMessage(p.text)}
                >
                  {p.icon} {p.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`coach-msg ${msg.role}`}>
            {msg.role === "assistant" && (
              <div className="coach-msg-avatar">
                <RiBrainFill size={16} />
              </div>
            )}
            <div className="coach-msg-bubble">
              {msg.content.split("\n").map((line, j) => (
                <p key={j} style={{ marginBottom: line ? 4 : 0 }}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        ))}

        {loading && (
          <div className="coach-msg assistant">
            <div className="coach-msg-avatar">
              <RiBrainFill size={16} />
            </div>
            <div className="coach-msg-bubble">
              <div className="typing-indicator">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="coach-input-bar">
        <input
          className="input coach-input"
          placeholder="Ask your AI coach..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
          disabled={loading}
        />
        <button
          className="btn btn-primary coach-send"
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
        >
          <RiSendPlaneFill size={20} />
        </button>
      </div>
    </div>
  );

  if (!isPro) {
    return (
      <div className="page">
        <PaywallGate feature="AI Coach">{coachContent}</PaywallGate>
      </div>
    );
  }

  return coachContent;
}
