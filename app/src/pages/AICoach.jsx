import { startTransition, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import {
  askCoach,
  canAttemptRoutineChange,
  COACH_MODEL_OPTIONS,
  COACH_RESPONSE_STYLE_OPTIONS,
  DEFAULT_COACH_MODEL,
  requestRoutineChange,
} from "../lib/groq";
import { optimizeImageForVision } from "../lib/visionImages";
import {
  RiArrowRightSLine,
  RiBrainFill,
  RiCheckLine,
  RiCloseLine,
  RiHeartPulseFill,
  RiImageAddFill,
  RiLoader4Line,
  RiQuestionLine,
  RiRestaurantFill,
  RiSendPlaneFill,
  RiSparklingFill,
} from "@remixicon/react";

const STORAGE_NAMESPACE = "repmax-ai-coach-v3";
const COACH_MODE_NAMESPACE = "repmax-ai-coach-mode-v1";
const COACH_MODEL_NAMESPACE = "repmax-ai-coach-model-v1";
const COACH_STYLE_NAMESPACE = "repmax-ai-coach-style-v1";
const META_PREFIX = "[[REPMAX_COACH_META:";
const META_SUFFIX = "]]";
const MAX_REMOTE_MESSAGES = 200;
const MAX_CONTEXT_MESSAGES = 14;
const MAX_MEMORY_CONVERSATIONS = 4;
const MAX_MEMORY_MESSAGES = 4;
const DEFAULT_COACH_CONTEXT = {
  activeProgram: null,
  recentWorkouts: [],
  recentPRs: [],
  nutritionProfile: null,
  todayNutrition: null,
  todayWater: null,
};
const MEMORY_STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "been",
  "between",
  "from",
  "have",
  "just",
  "like",
  "need",
  "show",
  "that",
  "them",
  "they",
  "this",
  "what",
  "when",
  "with",
  "would",
  "your",
]);

const SUGGESTED_PROMPTS = [
  {
    icon: <RiQuestionLine size={16} />,
    text: "Based on my profile, what should I focus on this week?",
  },
  {
    icon: <RiHeartPulseFill size={16} />,
    text: "My shoulder hurts after overhead press. What should I change?",
  },
  {
    icon: <RiRestaurantFill size={16} />,
    text: "Give me a high-protein post-workout meal that fits muscle growth.",
  },
  {
    icon: <RiSparklingFill size={16} />,
    text: "How should I use REPMAX better to stay consistent?",
  },
  {
    icon: <RiBrainFill size={16} />,
    text: "Replace overhead press with a shoulder-friendly swap in my current program.",
  },
];

const FOLLOW_UP_CHIPS = [
  "Go deeper on that",
  "Give me alternatives",
  "How do I apply this to my plan?",
  "Explain like I'm a beginner",
  "Can you rewrite my program with this?",
];

function getStorageKey(userId) {
  return `${STORAGE_NAMESPACE}:${userId}`;
}

function getCoachModeKey(userId) {
  return `${COACH_MODE_NAMESPACE}:${userId}`;
}

function getCoachModelKey(userId) {
  return `${COACH_MODEL_NAMESPACE}:${userId}`;
}

function getCoachStyleKey(userId) {
  return `${COACH_STYLE_NAMESPACE}:${userId}`;
}

function summarizePreview(content = "") {
  return content.replace(/\s+/g, " ").trim().slice(0, 88) || "Fresh chat";
}

function deriveConversationTitle(text = "") {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New chat";

  const words = cleaned.split(" ");
  const short = words.slice(0, 7).join(" ");
  return short.length < cleaned.length ? `${short}...` : short;
}

function createMessage(role, content, overrides = {}) {
  return {
    id: overrides.id || crypto.randomUUID(),
    role,
    content,
    createdAt: overrides.createdAt || new Date().toISOString(),
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanGymbroChunk(chunk = "") {
  return chunk
    .replace(/\[\[MSG\]\]/g, " ")
    .replace(/^[*-•]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitGymbroByLength(chunk = "", targetSize = 8) {
  const words = cleanGymbroChunk(chunk).split(" ").filter(Boolean);
  if (words.length <= 12) return [cleanGymbroChunk(chunk)];

  const parts = [];
  for (let index = 0; index < words.length; index += targetSize) {
    parts.push(words.slice(index, index + targetSize).join(" "));
  }
  return parts.filter(Boolean);
}

function stylizeGymbroChunk(chunk = "") {
  const normalized = cleanGymbroChunk(chunk)
    .replace(/[,:;]+/g, "")
    .replace(/\s+([!?])/g, "$1")
    .trim();

  if (!normalized) return "";

  const lower = normalized
    .toLowerCase()
    .replace(/\bas your girl\b/g, "")
    .replace(/\bi'm your girl\b/g, "")
    .replace(/\bi am your girl\b/g, "")
    .replace(/\bi'm a girl\b/g, "")
    .replace(/\bi am a girl\b/g, "")
    .replace(/\bgirlfriend\b/g, "")
    .replace(/\bbabe\b/g, "")
    .replace(/\bbaby\b/g, "")
    .replace(/\bpookie\b/g, "")
    .replace(/\bprincess\b/g, "")
    .replace(/\bshawty\b/g, "")
    .replace(/\b(alright|ok|okay|yo|listen)\b/g, "")
    .replace(/\b(nassim|brother|gang)\b/g, "bro")
    .replace(/\blet'?s get into it\b/g, "")
    .replace(/\blet'?s get down to business\b/g, "")
    .replace(/\bto be honest\b/g, "")
    .replace(/\bhonestly\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (lower === "you need to lock in") return "lock tf in";
  if (lower === "lock in") return "lock tf in";
  if (lower === "you need to get more consistent") return "get consistent bro";
  if (lower === "you need more intensity") return "push harder bro";
  if (lower === "check your dashboard") return "check ur dashboard";
  if (lower === "you ready to crush it bro?") return "u ready or what";

  return lower
    .replace(/\byou\b/g, "u")
    .replace(/\byour\b/g, "ur")
    .replace(/\bgoing to\b/g, "gonna")
    .replace(/\bwant to\b/g, "wanna")
    .replace(/\btrying to\b/g, "tryna")
    .replace(/\bkinds? of\b/g, "kinda")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "")
    .trim();
}

function mergeGymbroChunks(chunks = []) {
  const merged = [];

  for (const rawChunk of chunks) {
    const chunk = stylizeGymbroChunk(rawChunk);
    if (!chunk) continue;

    const wordCount = chunk.split(" ").filter(Boolean).length;
    const previous = merged[merged.length - 1];

    if (wordCount <= 2 && previous) {
      merged[merged.length - 1] = `${previous} ${chunk}`.trim();
      continue;
    }

    if (previous) {
      const previousWords = previous.split(" ").filter(Boolean).length;
      if (previousWords <= 4 && wordCount <= 4) {
        merged[merged.length - 1] = `${previous} ${chunk}`.trim();
        continue;
      }
    }

    merged.push(chunk);
  }

  if (merged.length <= 3) return merged;

  const compact = [];
  merged.forEach((chunk) => {
    if (compact.length < 2) {
      compact.push(chunk);
      return;
    }

    compact[compact.length - 1] = `${compact[compact.length - 1]} ${chunk}`.trim();
  });

  return compact;
}

function splitGymbroResponse(content = "") {
  const explicitChunks = content
    .split("[[MSG]]")
    .map((chunk) => cleanGymbroChunk(chunk))
    .filter(Boolean);

  if (explicitChunks.length > 1) {
    return mergeGymbroChunks(
      explicitChunks.flatMap((chunk) => splitGymbroByLength(chunk))
    ).slice(0, 3);
  }

  const paragraphChunks = content
    .split(/\n{2,}/)
    .map((chunk) => cleanGymbroChunk(chunk))
    .filter(Boolean);

  if (paragraphChunks.length > 1) {
    return mergeGymbroChunks(
      paragraphChunks.flatMap((chunk) => splitGymbroByLength(chunk))
    ).slice(0, 3);
  }

  const sentenceChunks = (content.match(/[^.!?\n]+[.!?]?/g) || [])
    .map((chunk) => cleanGymbroChunk(chunk))
    .filter(Boolean);

  const chunks = (sentenceChunks.length > 1 ? sentenceChunks : [content])
    .flatMap((chunk) => splitGymbroByLength(chunk));

  if (chunks.length) {
    return mergeGymbroChunks(chunks).slice(0, 3);
  }

  return [stylizeGymbroChunk(content)].filter(Boolean);
}

function normalizeAssistantChunks(content = "", mode = "coach") {
  const baseChunks =
    mode === "gymbro" ? splitGymbroResponse(content) : [content.trim()];

  const cleaned = baseChunks
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 8);

  if (!cleaned.length) return [content.trim()].filter(Boolean);

  if (mode === "gymbro" && cleaned.length === 1) {
    return mergeGymbroChunks(splitGymbroByLength(cleaned[0])).slice(0, 3);
  }

  if (mode === "gymbro") {
    return mergeGymbroChunks(cleaned).slice(0, 3);
  }

  return cleaned;
}

function getAssistantTypingDelay(chunk = "", index = 0) {
  const base = 1100 + chunk.length * 45;
  const stagger = index * 500;
  return Math.min(3200, base + stagger);
}

function buildConversationRecord(conversation = {}) {
  const messages = [...(conversation.messages || [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const firstUserMessage = messages.find((message) => message.role === "user");
  const lastMessage = messages[messages.length - 1];
  const title =
    conversation.title && conversation.title !== "New chat"
      ? conversation.title
      : deriveConversationTitle(
          firstUserMessage?.content || lastMessage?.content || "New chat"
        );

  return {
    id: conversation.id || crypto.randomUUID(),
    title,
    createdAt:
      conversation.createdAt || messages[0]?.createdAt || new Date().toISOString(),
    updatedAt:
      conversation.updatedAt || lastMessage?.createdAt || new Date().toISOString(),
    preview:
      conversation.preview ||
      summarizePreview(lastMessage?.content || firstUserMessage?.content || ""),
    messages,
  };
}

function createConversation(overrides = {}) {
  return buildConversationRecord({
    id: overrides.id,
    title: overrides.title || "New chat",
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt,
    preview: overrides.preview,
    messages: overrides.messages || [],
  });
}

function sortConversations(conversations = []) {
  return [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

function readCachedWorkspace(userId) {
  if (!userId || typeof window === "undefined") {
    return { activeConversationId: null, conversations: [] };
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return { activeConversationId: null, conversations: [] };
    const parsed = JSON.parse(raw);
    return {
      activeConversationId: parsed?.activeConversationId || null,
      conversations: Array.isArray(parsed?.conversations)
        ? parsed.conversations.map(buildConversationRecord)
        : [],
    };
  } catch {
    return { activeConversationId: null, conversations: [] };
  }
}

function persistWorkspace(userId, activeConversationId, conversations) {
  if (!userId || typeof window === "undefined") return;

  window.localStorage.setItem(
    getStorageKey(userId),
    JSON.stringify({
      activeConversationId,
      conversations: conversations.map(buildConversationRecord),
    })
  );
}

function readCoachMode(userId) {
  if (!userId || typeof window === "undefined") return "coach";

  try {
    const mode = window.localStorage.getItem(getCoachModeKey(userId));
    return mode === "gymbro" ? "gymbro" : "coach";
  } catch {
    return "coach";
  }
}

function persistCoachMode(userId, mode) {
  if (!userId || typeof window === "undefined") return;

  window.localStorage.setItem(
    getCoachModeKey(userId),
    mode === "gymbro" ? "gymbro" : "coach"
  );
}

function readCoachModel(userId) {
  if (!userId || typeof window === "undefined") return DEFAULT_COACH_MODEL;

  try {
    const value = window.localStorage.getItem(getCoachModelKey(userId));
    return COACH_MODEL_OPTIONS.some((option) => option.id === value)
      ? value
      : DEFAULT_COACH_MODEL;
  } catch {
    return DEFAULT_COACH_MODEL;
  }
}

function persistCoachModel(userId, modelId) {
  if (!userId || typeof window === "undefined") return;

  const nextModel = COACH_MODEL_OPTIONS.some((option) => option.id === modelId)
    ? modelId
    : DEFAULT_COACH_MODEL;

  window.localStorage.setItem(getCoachModelKey(userId), nextModel);
}

function readCoachStyle(userId) {
  if (!userId || typeof window === "undefined") return "balanced";

  try {
    const value = window.localStorage.getItem(getCoachStyleKey(userId));
    return COACH_RESPONSE_STYLE_OPTIONS.some((option) => option.id === value)
      ? value
      : "balanced";
  } catch {
    return "balanced";
  }
}

function persistCoachStyle(userId, styleId) {
  if (!userId || typeof window === "undefined") return;

  const nextStyle = COACH_RESPONSE_STYLE_OPTIONS.some(
    (option) => option.id === styleId
  )
    ? styleId
    : "balanced";

  window.localStorage.setItem(getCoachStyleKey(userId), nextStyle);
}

function getCoachModelMeta(modelId) {
  return (
    COACH_MODEL_OPTIONS.find((option) => option.id === modelId) ||
    COACH_MODEL_OPTIONS[0]
  );
}

function getCoachStyleMeta(styleId) {
  return (
    COACH_RESPONSE_STYLE_OPTIONS.find((option) => option.id === styleId) ||
    COACH_RESPONSE_STYLE_OPTIONS[1]
  );
}

function packStoredMessage(conversationId, conversationTitle, content) {
  const meta = JSON.stringify({ conversationId, conversationTitle });
  return `${META_PREFIX}${meta}${META_SUFFIX}\n${content}`;
}

function unpackStoredMessage(rawContent = "") {
  if (!rawContent.startsWith(META_PREFIX)) {
    return {
      content: rawContent,
      conversationId: null,
      conversationTitle: null,
    };
  }

  const metaEndIndex = rawContent.indexOf(META_SUFFIX);
  if (metaEndIndex === -1) {
    return {
      content: rawContent,
      conversationId: null,
      conversationTitle: null,
    };
  }

  try {
    const meta = JSON.parse(
      rawContent.slice(META_PREFIX.length, metaEndIndex)
    );
    return {
      content: rawContent.slice(metaEndIndex + META_SUFFIX.length).replace(/^\n/, ""),
      conversationId: meta?.conversationId || null,
      conversationTitle: meta?.conversationTitle || null,
    };
  } catch {
    return {
      content: rawContent,
      conversationId: null,
      conversationTitle: null,
    };
  }
}

function hydrateRemoteConversations(rows = []) {
  const conversationMap = new Map();

  rows.forEach((row) => {
    const parsed = unpackStoredMessage(row.content || "");
    const conversationId = parsed.conversationId || "legacy-import";

    if (!conversationMap.has(conversationId)) {
      conversationMap.set(
        conversationId,
        createConversation({
          id: conversationId,
          title: parsed.conversationTitle || "Imported chat",
          createdAt: row.created_at,
          updatedAt: row.created_at,
          preview: summarizePreview(parsed.content),
          messages: [],
        })
      );
    }

    const conversation = conversationMap.get(conversationId);
    conversation.messages.push(
      createMessage(row.role, parsed.content, {
        id: row.id,
        createdAt: row.created_at,
      })
    );
    conversation.updatedAt = row.created_at;
    conversation.preview = summarizePreview(parsed.content);

    if (parsed.conversationTitle && conversation.title === "Imported chat") {
      conversation.title = parsed.conversationTitle;
    }
  });

  return sortConversations(
    Array.from(conversationMap.values()).map((conversation) =>
      buildConversationRecord(conversation)
    )
  );
}

function mergeConversations(primary = [], secondary = []) {
  const merged = new Map();

  [...secondary, ...primary].forEach((conversation) => {
    const normalized = buildConversationRecord(conversation);
    const existing = merged.get(normalized.id);

    if (!existing) {
      merged.set(normalized.id, normalized);
      return;
    }

    const messagesById = new Map(
      existing.messages.map((message) => [message.id, message])
    );

    normalized.messages.forEach((message) => {
      messagesById.set(message.id, message);
    });

    merged.set(
      normalized.id,
      buildConversationRecord({
        ...existing,
        title:
          existing.title && existing.title !== "New chat"
            ? existing.title
            : normalized.title,
        createdAt:
          new Date(existing.createdAt).getTime() <
          new Date(normalized.createdAt).getTime()
            ? existing.createdAt
            : normalized.createdAt,
        updatedAt:
          new Date(existing.updatedAt).getTime() >
          new Date(normalized.updatedAt).getTime()
            ? existing.updatedAt
            : normalized.updatedAt,
        messages: Array.from(messagesById.values()),
      })
    );
  });

  return sortConversations(Array.from(merged.values()));
}

function extractMemoryKeywords(question = "") {
  return Array.from(
    new Set(
      (question.toLowerCase().match(/[a-z0-9]+/g) || []).filter(
        (word) => word.length > 2 && !MEMORY_STOPWORDS.has(word)
      )
    )
  ).slice(0, 8);
}

function countKeywordHits(text, keywords) {
  if (!keywords.length || !text) return 0;

  return keywords.reduce((total, keyword) => {
    if (!text.includes(keyword)) return total;
    return total + 1;
  }, 0);
}

function buildCoachMemory(conversations = [], activeId, question = "") {
  const keywords = extractMemoryKeywords(question);

  return conversations
    .filter(
      (conversation) =>
        conversation.id !== activeId && conversation.messages?.length > 0
    )
    .map((conversation) => {
      const messages = conversation.messages
        .filter((message) => message?.content && message?.role)
        .slice(-MAX_MEMORY_MESSAGES);
      const searchText = [
        conversation.title,
        conversation.preview,
        ...messages.map((message) => message.content),
      ]
        .join(" ")
        .toLowerCase();

      return {
        id: conversation.id,
        title: conversation.title || "Past chat",
        updatedAt: conversation.updatedAt,
        preview: conversation.preview || "",
        messages,
        keywordScore: countKeywordHits(searchText, keywords),
      };
    })
    .sort((a, b) => {
      if (b.keywordScore !== a.keywordScore) {
        return b.keywordScore - a.keywordScore;
      }

      return (
        new Date(b.updatedAt || 0).getTime() -
        new Date(a.updatedAt || 0).getTime()
      );
    })
    .slice(0, MAX_MEMORY_CONVERSATIONS)
    .map(({ keywordScore, ...conversation }) => conversation);
}

function insertMessageIntoConversation(
  conversations,
  conversationId,
  message,
  titleOverride
) {
  let found = false;

  const next = conversations.map((conversation) => {
    if (conversation.id !== conversationId) return conversation;
    found = true;

    return buildConversationRecord({
      ...conversation,
      title: titleOverride || conversation.title,
      updatedAt: message.createdAt,
      preview: summarizePreview(message.content),
      messages: [...conversation.messages, message],
    });
  });

  if (!found) {
    next.unshift(
      createConversation({
        id: conversationId,
        title: titleOverride || "New chat",
        createdAt: message.createdAt,
        updatedAt: message.createdAt,
        preview: summarizePreview(message.content),
        messages: [message],
      })
    );
  }

  return sortConversations(next);
}

function formatThreadStamp(timestamp) {
  if (!timestamp) return "";

  const value = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - value.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return "Now";
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d`;

  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatMessageTime(timestamp) {
  if (!timestamp) return "";

  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getGoalLabel(goal) {
  const labels = {
    hypertrophy: "Muscle Growth",
    strength: "Strength",
    athletic: "Athletic",
    general: "General Fitness",
  };

  return labels[goal] || "Fitness";
}

function getExperienceLabel(level) {
  const labels = {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  };

  return labels[level] || "Intermediate";
}

function getSplitLabel(split) {
  const labels = {
    ppl: "Push/Pull/Legs",
    upper_lower: "Upper/Lower",
    full_body: "Full Body",
    bro_split: "Bro Split",
    arnold: "Arnold Split",
    custom: "Custom",
  };

  return labels[split] || "Custom Split";
}

function MessageBody({ content }) {
  const blocks = content.split(/\n{2,}/);

  return blocks.map((block, index) => {
    const lines = block.split("\n").filter((line) => line.trim().length > 0);
    const isBulletList =
      lines.length > 0 && lines.every((line) => /^[*-•]\s+/.test(line.trim()));
    const isNumberedList =
      lines.length > 0 && lines.every((line) => /^\d+\.\s+/.test(line.trim()));

    if (isBulletList) {
      return (
        <ul key={index} className="coach-rich-list">
          {lines.map((line, lineIndex) => (
            <li key={lineIndex}>{line.replace(/^[*-•]\s+/, "")}</li>
          ))}
        </ul>
      );
    }

    if (isNumberedList) {
      return (
        <ol key={index} className="coach-rich-list coach-rich-list-numbered">
          {lines.map((line, lineIndex) => (
            <li key={lineIndex}>{line.replace(/^\d+\.\s+/, "")}</li>
          ))}
        </ol>
      );
    }

    return (
      <p key={index} className="coach-rich-paragraph">
        {block}
      </p>
    );
  });
}

export default function AICoach() {
  const { user, profile, isPro, isUltra } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [coachMode, setCoachMode] = useState("coach");
  const [coachModel, setCoachModel] = useState(DEFAULT_COACH_MODEL);
  const [responseStyle, setResponseStyle] = useState("balanced");
  const [coachModeReady, setCoachModeReady] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [coachContext, setCoachContext] = useState(DEFAULT_COACH_CONTEXT);
  const [pendingImage, setPendingImage] = useState(null);
  const messagesEndRef = useRef(null);
  const composerRef = useRef(null);
  const imageInputRef = useRef(null);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ||
    conversations[0] ||
    null;
  const activeCoachModel = isPro ? coachModel : DEFAULT_COACH_MODEL;
  const activeCoachModelMeta = getCoachModelMeta(activeCoachModel);
  const activeCoachStyleMeta = getCoachStyleMeta(responseStyle);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    document.body.classList.add("coach-route-active");

    return () => {
      document.body.classList.remove("coach-route-active");
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setCoachModeReady(false);
      return;
    }

    let cancelled = false;
    setCoachMode(readCoachMode(user.id));
    setCoachModel(readCoachModel(user.id));
    setResponseStyle(readCoachStyle(user.id));
    setCoachModeReady(true);

    async function loadCoachWorkspace() {
      setLoadingHistory(true);
      setCoachContext(DEFAULT_COACH_CONTEXT);

      const cached = readCachedWorkspace(user.id);
      const seededConversations = cached.conversations.length
        ? sortConversations(cached.conversations)
        : [createConversation()];

      if (!cancelled) {
        setConversations(seededConversations);
        setActiveConversationId(
          cached.activeConversationId || seededConversations[0]?.id || null
        );
      }

      try {
        const [remoteHistory, nextCoachContext] = await Promise.all([
          supabase
            .from("ai_messages")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true })
            .limit(MAX_REMOTE_MESSAGES),
          loadCoachContext(user.id),
        ]);

        if (cancelled) return;

        const remoteConversations = hydrateRemoteConversations(
          remoteHistory.data || []
        );
        const mergedConversations = mergeConversations(
          seededConversations,
          remoteConversations
        );
        const finalConversations = mergedConversations.length
          ? mergedConversations
          : [createConversation()];

        setCoachContext(nextCoachContext);
        setConversations(finalConversations);
        setActiveConversationId((currentId) => {
          const preferredId = cached.activeConversationId || currentId;
          return finalConversations.some(
            (conversation) => conversation.id === preferredId
          )
            ? preferredId
            : finalConversations[0].id;
        });
      } finally {
        if (!cancelled) {
          setLoadingHistory(false);
        }
      }
    }

    loadCoachWorkspace();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || loadingHistory || conversations.length === 0) return;
    persistWorkspace(user.id, activeConversationId, conversations);
  }, [user?.id, loadingHistory, activeConversationId, conversations]);

  useEffect(() => {
    if (!user?.id || !coachModeReady) return;
    persistCoachMode(user.id, coachMode);
  }, [user?.id, coachMode, coachModeReady]);

  useEffect(() => {
    if (!user?.id || !coachModeReady) return;
    persistCoachModel(user.id, coachModel);
  }, [user?.id, coachModel, coachModeReady]);

  useEffect(() => {
    if (!user?.id || !coachModeReady) return;
    persistCoachStyle(user.id, responseStyle);
  }, [user?.id, responseStyle, coachModeReady]);

  useEffect(() => {
    if (!conversations.length) return;

    if (!activeConversationId) {
      setActiveConversationId(conversations[0].id);
      return;
    }

    if (!conversations.some((conversation) => conversation.id === activeConversationId)) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversationId, activeConversation?.messages.length, loading]);

  useEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
  }, [input]);

  useEffect(() => {
    if (!copiedMessageId) return undefined;

    const timeout = setTimeout(() => setCopiedMessageId(null), 1600);
    return () => clearTimeout(timeout);
  }, [copiedMessageId]);

  async function loadCoachContext(userId) {
    const today = new Date().toISOString().split("T")[0];

    const [programRes, workoutRes, prRes, nutritionRes, foodLogsRes, waterRes] =
      await Promise.all([
      supabase
        .from("programs")
        .select("id, name, current_week, split_type, total_weeks, program_data")
        .eq("user_id", userId)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("workouts")
        .select("day_name, completed_at, total_volume")
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(5),
      supabase
        .from("personal_records")
        .select("exercise_name, weight, achieved_at")
        .eq("user_id", userId)
        .order("achieved_at", { ascending: false })
        .limit(4),
      supabase
        .from("nutrition_profiles")
        .select(
          "diet_goal, target_calories, target_protein, target_carbs, target_fat"
        )
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("food_logs")
        .select("calories, protein, carbs, fat")
        .eq("user_id", userId)
        .eq("logged_at", today),
      supabase
        .from("water_logs")
        .select("glasses")
        .eq("user_id", userId)
        .eq("logged_at", today)
        .maybeSingle(),
    ]);

    const todayTotals = (foodLogsRes?.data || []).reduce(
      (totals, log) => ({
        entryCount: totals.entryCount + 1,
        calories: totals.calories + Number(log.calories || 0),
        protein: totals.protein + Number(log.protein || 0),
        carbs: totals.carbs + Number(log.carbs || 0),
        fat: totals.fat + Number(log.fat || 0),
      }),
      { entryCount: 0, calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return {
      activeProgram: programRes?.data || null,
      recentWorkouts: workoutRes?.data || [],
      recentPRs: prRes?.data || [],
      nutritionProfile: nutritionRes?.data || null,
      todayNutrition: todayTotals,
      todayWater: waterRes?.data || null,
    };
  }

  async function persistCoachMessage(conversationId, conversationTitle, message) {
    if (!user?.id || !message?.content) return;

    await supabase.from("ai_messages").upsert(
      {
        id: message.id,
        user_id: user.id,
        role: message.role,
        content: packStoredMessage(
          conversationId,
          conversationTitle,
          message.content
        ),
      },
      { onConflict: "id" }
    );
  }

  async function persistActiveProgramUpdate(updatedProgram) {
    if (!user?.id || !coachContext?.activeProgram?.id || !updatedProgram) {
      throw new Error("No active routine is available to update.");
    }

    const payload = {
      name: updatedProgram.name,
      split_type: updatedProgram.split_type,
      total_weeks: updatedProgram.weeks?.length || 4,
      program_data: updatedProgram,
    };

    const { data, error } = await supabase
      .from("programs")
      .update(payload)
      .eq("id", coachContext.activeProgram.id)
      .eq("user_id", user.id)
      .select("id, name, current_week, split_type, total_weeks, program_data")
      .single();

    if (error) throw error;

    setCoachContext((prev) => ({
      ...prev,
      activeProgram: data,
    }));

    return data;
  }

  function openConversation(conversationId) {
    startTransition(() => {
      setActiveConversationId(conversationId);
      setHistoryOpen(false);
    });
  }

  function createFreshConversation() {
    if (activeConversation && activeConversation.messages.length === 0) {
      setHistoryOpen(false);
      return;
    }

    const freshConversation = createConversation();
    startTransition(() => {
      setConversations((prev) => sortConversations([freshConversation, ...prev]));
      setActiveConversationId(freshConversation.id);
      setInput("");
      setHistoryOpen(false);
    });
  }

  async function copyAssistantMessage(message) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
    } catch (err) {
      console.warn("[Coach] clipboard copy failed:", err);
    }
  }

  async function sendMessage(question) {
    const trimmed = question?.trim();
    if (!trimmed || loading) return;

    const targetConversationId =
      activeConversation?.id || createConversation().id;
    const previousMessages = activeConversation?.messages || [];
    const memory = buildCoachMemory(conversations, targetConversationId, trimmed);
    const nextTitle =
      previousMessages.length > 0
        ? activeConversation?.title || "New chat"
        : deriveConversationTitle(trimmed);

    const userMessage = createMessage("user", trimmed);
    const currentImage = pendingImage;

    setConversations((prev) =>
      insertMessageIntoConversation(
        prev,
        targetConversationId,
        userMessage,
        nextTitle
      )
    );
    setActiveConversationId(targetConversationId);
    setInput("");
    setPendingImage(null);
    setLoading(true);

    persistCoachMessage(targetConversationId, nextTitle, userMessage).catch((err) => {
      console.warn("[Coach] persist user message failed:", err);
    });

    try {
      let assistantContent = "";

      if (!currentImage && canAttemptRoutineChange(trimmed, coachContext)) {
        const routineChange = await requestRoutineChange({
          question: trimmed,
          profile,
          coachContext,
          history: previousMessages.slice(-MAX_CONTEXT_MESSAGES),
          memory,
          toneMode: coachMode,
          modelPreference: activeCoachModel,
        });

        assistantContent = routineChange.reply;

        if (routineChange.shouldUpdate && routineChange.updatedProgram) {
          await persistActiveProgramUpdate(routineChange.updatedProgram);
        }
      }

      if (!assistantContent) {
        assistantContent = await askCoach({
          question: trimmed,
          profile,
          coachContext,
          history: previousMessages.slice(-MAX_CONTEXT_MESSAGES),
          memory,
          toneMode: coachMode,
          responseStyle,
          modelPreference: activeCoachModel,
          imageDataUrl: currentImage || null,
        });
      }

      const assistantChunks = normalizeAssistantChunks(
        assistantContent,
        coachMode
      );

      for (let index = 0; index < assistantChunks.length; index += 1) {
        await wait(getAssistantTypingDelay(assistantChunks[index], index));

        const assistantMessage = createMessage(
          "assistant",
          assistantChunks[index]
        );

        setConversations((prev) =>
          insertMessageIntoConversation(
            prev,
            targetConversationId,
            assistantMessage,
            nextTitle
          )
        );

        persistCoachMessage(
          targetConversationId,
          nextTitle,
          assistantMessage
        ).catch((err) => {
          console.warn("[Coach] persist assistant message failed:", err);
        });
      }
    } catch (err) {
      console.error("[Coach] sendMessage failed:", err);
      const isRateLimit = err?.status === 429 || /daily.*limit|limit reached/i.test(err?.message || '');
      const errorText = isRateLimit
        ? (err?.message || "You've reached your daily message limit. Resets at midnight UTC. Try switching models!")
        : "I hit a connection issue. Try sending that again in a second.";
      const errorMessage = createMessage(
        "assistant",
        errorText
      );

      setConversations((prev) =>
        insertMessageIntoConversation(
          prev,
          targetConversationId,
          errorMessage,
          nextTitle
        )
      );

      persistCoachMessage(targetConversationId, nextTitle, errorMessage).catch((persistErr) => {
        console.warn("[Coach] persist error message failed:", persistErr);
      });
    } finally {
      setLoading(false);
    }
  }

  function handleComposerKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input);
    }
  }

  function handleComposerFocus() {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });

    window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 260);
  }

  async function handleImageSelect(event) {
    const file = event.target.files?.[0];
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (!file || !file.type.startsWith("image/")) return;

    try {
      const optimized = await optimizeImageForVision(file);
      setPendingImage(optimized);
    } catch (err) {
      console.warn("[Coach] image optimization failed:", err);
    }
  }

  const coachFacts = [
    { label: "Goal", value: getGoalLabel(profile?.goal) },
    {
      label: "Level",
      value: getExperienceLabel(profile?.experience_level),
    },
    {
      label: "Split",
      value:
        coachContext.activeProgram?.name ||
        (profile?.preferred_split
          ? getSplitLabel(profile.preferred_split)
          : null) ||
        `${profile?.training_days?.length || 3} days/week`,
    },
    {
      label: "Streak",
      value: `${profile?.current_streak || 0} days`,
    },
  ];

  const coachContent = (
    <div className="coach-page">
      <div className={`coach-history-overlay ${historyOpen ? "visible" : ""}`} onClick={() => setHistoryOpen(false)} />

      <div className="coach-shell">
        <aside className={`coach-sidebar ${historyOpen ? "open" : ""}`}>
          <div className="coach-sidebar-head">
            <div>
              <div className="coach-sidebar-eyebrow">REPMAX Coach</div>
              <div className="coach-sidebar-title">Chat History</div>
            </div>
            <button className="coach-primary-action" onClick={createFreshConversation}>
              <RiSparklingFill size={16} /> New chat
            </button>
          </div>

          <div className="coach-facts-grid">
            {coachFacts.map((fact) => (
              <div key={fact.label} className="coach-fact-card">
                <div className="coach-fact-label">{fact.label}</div>
                <div className="coach-fact-value">{fact.value}</div>
              </div>
            ))}
          </div>

          <div className="coach-sidebar-section">
            <div className="coach-sidebar-section-label">Recent conversations</div>
            <div className="coach-thread-list">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  className={`coach-thread-item ${
                    conversation.id === activeConversationId ? "active" : ""
                  }`}
                  onClick={() => openConversation(conversation.id)}
                >
                  <div className="coach-thread-item-top">
                    <div className="coach-thread-item-title">{conversation.title}</div>
                    <div className="coach-thread-item-time">
                      {formatThreadStamp(conversation.updatedAt)}
                    </div>
                  </div>
                  <div className="coach-thread-item-preview">
                    {conversation.preview || "Fresh chat"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="coach-main">
          <header className="coach-main-header">
            <div className="coach-main-header-left">
              <button className="coach-ghost-btn coach-mobile-only" onClick={() => setHistoryOpen(true)}>
                History
              </button>
              <div className="coach-hero-mark">
                <RiBrainFill size={20} />
              </div>
              <div className="coach-header-copy">
                <div className="coach-main-title">
                  {activeConversation?.title || "AI Coach"}
                </div>
                <div className="coach-main-subtitle">
                  Smarter training answers, routine edits, app guidance, and memory from your earlier coach chats.
                </div>
                <div className="coach-control-stack">
                  <div className="coach-control-group">
                    <div className="coach-control-label">Tone</div>
                    <div className="coach-mode-toggle" role="tablist" aria-label="Coach tone">
                      <button
                        className={`coach-mode-chip ${coachMode === "coach" ? "active" : ""}`}
                        onClick={() => setCoachMode("coach")}
                        type="button"
                        aria-pressed={coachMode === "coach"}
                      >
                        coach mode
                      </button>
                      <button
                        className={`coach-mode-chip ${coachMode === "gymbro" ? "active" : ""}`}
                        onClick={() => setCoachMode("gymbro")}
                        type="button"
                        aria-pressed={coachMode === "gymbro"}
                      >
                        gymbro mode
                      </button>
                    </div>
                  </div>

                  <div className="coach-control-group">
                    <div className="coach-control-label">Answer style</div>
                    <div className="coach-mode-toggle coach-style-toggle" role="tablist" aria-label="Coach answer style">
                      {COACH_RESPONSE_STYLE_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          className={`coach-mode-chip ${responseStyle === option.id ? "active" : ""}`}
                          onClick={() => setResponseStyle(option.id)}
                          type="button"
                          aria-pressed={responseStyle === option.id}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {isPro ? (
                    <div className="coach-control-group coach-model-group">
                      <div className="coach-control-label">Model</div>
                      <div className="coach-model-toggle" role="tablist" aria-label="Coach model" style={{ flexWrap: 'wrap' }}>
                        {COACH_MODEL_OPTIONS.filter(o => !o.paidOnly).map((option) => (
                          <button
                            key={option.id}
                            className={`coach-model-chip ${activeCoachModel === option.id ? "active" : ""}`}
                            onClick={() => setCoachModel(option.id)}
                            type="button"
                            aria-pressed={activeCoachModel === option.id}
                          >
                            {option.shortLabel}
                          </button>
                        ))}
                      </div>
                      <div className="coach-control-label" style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <RiSparklingFill size={12} style={{ color: '#ff2a85' }} /> Claude (Bedrock)
                        <span style={{ fontSize: '0.65rem', opacity: 0.6, marginLeft: 4 }}>
                          {isUltra ? '25/day' : '3/day'}
                        </span>
                      </div>
                      <div className="coach-model-toggle" role="tablist" aria-label="Claude model" style={{ flexWrap: 'wrap' }}>
                        {COACH_MODEL_OPTIONS.filter(o => o.paidOnly).map((option) => (
                          <button
                            key={option.id}
                            className={`coach-model-chip claude-chip ${activeCoachModel === option.id ? "active" : ""}`}
                            onClick={() => setCoachModel(option.id)}
                            type="button"
                            aria-pressed={activeCoachModel === option.id}
                          >
                            {option.shortLabel}
                          </button>
                        ))}
                      </div>
                      <div className="coach-control-note">
                        {activeCoachModelMeta.description}
                      </div>
                    </div>
                  ) : (
                    <div className="coach-control-note">
                      Coach chats recover through OpenRouter automatically. PRO unlocks Claude models (3/day), ULTRA gets 25/day.
                    </div>
                  )}
                </div>
              </div>
            </div>
            <button className="coach-ghost-btn" onClick={createFreshConversation}>
              New chat <RiArrowRightSLine size={16} />
            </button>
          </header>

          <div className="coach-messages">
            {loadingHistory ? (
              <div className="coach-loading-state">
                <RiLoader4Line size={20} className="spin" />
                Loading your coach workspace...
              </div>
            ) : activeConversation?.messages.length ? (
              activeConversation.messages.map((message) => {
                const isUser = message.role === "user";

                return (
                  <div key={message.id} className={`coach-msg ${message.role}`}>
                    {!isUser && (
                      <div className="coach-msg-avatar">
                        <RiBrainFill size={15} />
                      </div>
                    )}

                    <div className="coach-msg-card">
                      <div className="coach-msg-meta">
                        <div className="coach-msg-author">
                          {isUser ? "You" : "REPMAX Coach"}
                        </div>
                        <div className="coach-msg-tools">
                          <span>{formatMessageTime(message.createdAt)}</span>
                          {!isUser && (
                            <button
                              className="coach-copy-btn"
                              onClick={() => copyAssistantMessage(message)}
                            >
                              {copiedMessageId === message.id ? (
                                <>
                                  <RiCheckLine size={14} /> Copied
                                </>
                              ) : (
                                "Copy"
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className={`coach-msg-bubble ${isUser ? "user" : "assistant"}`}>
                        <MessageBody content={message.content} />
                      </div>
                      {!isUser && !loading && message.id === activeConversation?.messages?.[activeConversation.messages.length - 1]?.id && (
                        <div className="coach-followup-chips">
                          {FOLLOW_UP_CHIPS.map((chip) => (
                            <button
                              key={chip}
                              className="coach-followup-chip"
                              onClick={() => sendMessage(chip)}
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="coach-welcome">
                <div className="coach-welcome-badge">
                  <RiSparklingFill size={16} />
                  REPMAX Coach
                </div>
                <h2>A coach that can think through your full week, not just your last message.</h2>
                <p>
                  Ask about training, nutrition, recovery, pain-management basics,
                  or how to use REPMAX better. The coach can pull from your current
                  routine, recent progress, nutrition targets, and older chats so
                  the answers feel more like a real assistant and less like a reset every time.
                </p>

                <div className="coach-insights-row coach-insights-row--feature">
                  <div className="coach-insight-pill">
                    <span>Memory</span>
                    <strong>Earlier chats stay in play</strong>
                  </div>
                  <div className="coach-insight-pill">
                    <span>Routine edits</span>
                    <strong>Can rewrite your live plan</strong>
                  </div>
                  <div className="coach-insight-pill">
                    <span>Answer style</span>
                    <strong>{activeCoachStyleMeta.label}</strong>
                  </div>
                  <div className="coach-insight-pill">
                    <span>{isUltra ? "ULTRA model" : isPro ? "PRO model" : "Coach model"}</span>
                    <strong>{activeCoachModelMeta.label}</strong>
                  </div>
                </div>

                <div className="coach-suggestions-grid">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt.text}
                      className="coach-suggestion-card"
                      onClick={() => sendMessage(prompt.text)}
                    >
                      <div className="coach-suggestion-icon">{prompt.icon}</div>
                      <div className="coach-suggestion-text">{prompt.text}</div>
                    </button>
                  ))}
                </div>

                <div className="coach-insights-row">
                  {coachFacts.map((fact) => (
                    <div key={fact.label} className="coach-insight-pill">
                      <span>{fact.label}</span>
                      <strong>{fact.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loading && (
              <div className="coach-msg assistant">
                <div className="coach-msg-avatar">
                  <RiBrainFill size={15} />
                </div>
                <div className="coach-msg-card">
                  <div className="coach-msg-meta">
                    <div className="coach-msg-author">REPMAX Coach</div>
                    <div className="coach-msg-tools">
                      Thinking with {activeCoachModelMeta.shortLabel}...
                    </div>
                  </div>
                  <div className="coach-msg-bubble assistant">
                    <div className="typing-indicator">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="coach-composer">
            {pendingImage && (
              <div className="coach-image-preview">
                <img src={pendingImage} alt="Attached" />
                <button className="coach-image-remove" onClick={() => setPendingImage(null)}>
                  <RiCloseLine size={14} />
                </button>
              </div>
            )}
            <div className="coach-composer-shell">
              {isUltra && (
                <>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="coach-image-input"
                    onChange={handleImageSelect}
                    style={{ display: "none" }}
                  />
                  <button
                    className="coach-attach-btn"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={loading}
                    title="Attach image"
                  >
                    <RiImageAddFill size={18} />
                  </button>
                </>
              )}
              <textarea
                ref={composerRef}
                className="coach-composer-input"
                placeholder="Ask about your training, recovery, nutrition, or how to use REPMAX..."
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                onFocus={handleComposerFocus}
                disabled={loading}
                rows={1}
              />
              <button
                className="coach-send-btn"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
              >
                {loading ? <RiLoader4Line size={18} className="spin" /> : <RiSendPlaneFill size={18} />}
              </button>
            </div>
            <div className="coach-composer-hint">
              Enter to send. Shift + Enter for a new line. {coachMode === "gymbro" ? "gymbro mode" : "coach mode"} • {activeCoachStyleMeta.label} • {activeCoachModelMeta.shortLabel}
            </div>
          </div>
        </section>
      </div>
    </div>
  );

  return coachContent;
}
