import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Bot, 
  Send, 
  Loader2, 
  X,
  Sparkles, 
  CheckCircle2, 
  Zap,
  Search,
  Mail,
  Users,
  ListTodo,
  Minimize2,
  Maximize2,
  History,
  Plus,
  Trash2,
  ChevronLeft,
  Building2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/LanguageProvider";
import { format } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: any[];
  toolResults?: any[];
}

interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface SuggestedPrompt {
  icon: React.ReactNode;
  titleKey: string;
  promptKey: string;
}

const suggestedPrompts: SuggestedPrompt[] = [
  {
    icon: <Search className="h-3 w-3" />,
    titleKey: "ai.prompt.findCarpentersTitle",
    promptKey: "ai.prompt.findCarpenters",
  },
  {
    icon: <Search className="h-3 w-3" />,
    titleKey: "ai.prompt.searchHairdressersTitle",
    promptKey: "ai.prompt.searchHairdressers",
  },
  {
    icon: <Mail className="h-3 w-3" />,
    titleKey: "ai.prompt.mailStatsTitle",
    promptKey: "ai.prompt.mailStats",
  },
  {
    icon: <Users className="h-3 w-3" />,
    titleKey: "ai.prompt.openedMailTitle",
    promptKey: "ai.prompt.openedMail",
  },
  {
    icon: <ListTodo className="h-3 w-3" />,
    titleKey: "ai.prompt.leadsWithoutSiteTitle",
    promptKey: "ai.prompt.leadsWithoutSite",
  },
];

interface AIAgentChatProps {
  isOpen: boolean;
  onClose: () => void;
}

// Component to render message content with clickable lead links
function MessageContent({ content, onLeadClick }: { content: string; onLeadClick: (id: string) => void }) {
  // Parse [LEAD:uuid:name] format and make them clickable
  const parts = content.split(/(\[LEAD:[^\]]+\])/g);
  
  return (
    <div className="whitespace-pre-wrap">
      {parts.map((part, index) => {
        const leadMatch = part.match(/\[LEAD:([a-f0-9-]+):([^\]]+)\]/i);
        if (leadMatch) {
          const [, leadId, leadName] = leadMatch;
          return (
            <button
              key={index}
              onClick={() => onLeadClick(leadId)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-md text-xs font-medium transition-colors"
            >
              <Building2 className="h-3 w-3" />
              {leadName}
            </button>
          );
        }
        // Safely render markdown using ReactMarkdown instead of dangerouslySetInnerHTML
        return (
          <span key={index} className="prose prose-sm dark:prose-invert max-w-none inline">
            <ReactMarkdown
              components={{
                p: ({ children }) => <span>{children}</span>,
                strong: ({ children }) => <strong>{children}</strong>,
                em: ({ children }) => <em>{children}</em>,
                code: ({ children }) => (
                  <code className="px-1 py-0.5 bg-muted rounded text-xs">{children}</code>
                ),
              }}
            >
              {part}
            </ReactMarkdown>
          </span>
        );
      })}
    </div>
  );
}

export function AIAgentChat({ isOpen, onClose }: AIAgentChatProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Load conversations when opening history
  const loadConversations = useCallback(async () => {
    if (!user) return;
    
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user]);

  useEffect(() => {
    if (showHistory) {
      loadConversations();
    }
  }, [showHistory, loadConversations]);

  // Load messages for a conversation
  const loadConversation = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from("ai_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const loadedMessages: Message[] = (data || []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      setMessages(loadedMessages);
      setActiveConversationId(conversationId);
      setShowHistory(false);
    } catch (error) {
      console.error("Error loading conversation:", error);
      toast.error(t("ai.error.loadConversation"));
    }
  };

  // Save message to database
  const saveMessage = async (conversationId: string, role: "user" | "assistant", content: string) => {
    try {
      await supabase.from("ai_messages").insert({
        conversation_id: conversationId,
        role,
        content,
      });

      // Update conversation's updated_at
      await supabase
        .from("ai_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    } catch (error) {
      console.error("Error saving message:", error);
    }
  };

  // Create new conversation
  const createConversation = async (firstMessage: string): Promise<string | null> => {
    if (!user) return null;

    try {
      // Generate title from first message (first 50 chars)
      const title = firstMessage.length > 50 
        ? firstMessage.substring(0, 50) + "..." 
        : firstMessage;

      const { data, error } = await supabase
        .from("ai_conversations")
        .insert({
          user_id: user.id,
          title,
        })
        .select()
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error("Error creating conversation:", error);
      return null;
    }
  };

  // Delete conversation
  const deleteConversation = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from("ai_conversations")
        .delete()
        .eq("id", conversationId);

      if (error) throw error;

      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
        setMessages([]);
      }

      toast.success(t("ai.toast.conversationDeleted"));
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast.error(t("ai.error.deleteConversation"));
    }
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text) return;

    const userMessage: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Create or use existing conversation
      let convId = activeConversationId;
      if (!convId) {
        convId = await createConversation(text);
        if (convId) {
          setActiveConversationId(convId);
        }
      }

      // Save user message
      if (convId) {
        await saveMessage(convId, "user", text);
      }

      const { data, error } = await supabase.functions.invoke("ai-agent-chat", {
        body: {
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          executeTools: true,
        },
      });

      if (error) {
        // For non-2xx responses supabase-js only exposes a generic message; the
        // real error is in the attached Response body. Surface it so failures
        // are never silent.
        let detail = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) detail = body.error;
        } catch { /* keep generic message */ }
        throw new Error(detail);
      }
      if (data.error) throw new Error(data.error);

      const assistantContent = data.message?.content || t("ai.fallback.noResponse");
      const assistantMessage: Message = {
        role: "assistant",
        content: assistantContent,
        toolCalls: data.toolCalls,
        toolResults: data.toolResults,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Save assistant message
      if (convId) {
        await saveMessage(convId, "assistant", assistantContent);
      }

    } catch (error: any) {
      console.error("AI Agent error:", error);
      toast.error(error.message || t("ai.error.generic"));

      setMessages(prev => [...prev, {
        role: "assistant",
        content: t("ai.fallback.error"),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setActiveConversationId(null);
    setShowHistory(false);
  };

  if (!isOpen) return null;

  return (
    <div 
      className={cn(
        "fixed z-50 bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300",
        isExpanded 
          ? "bottom-4 right-4 w-[600px] h-[80vh] max-h-[800px]" 
          : "bottom-4 right-4 w-[380px] h-[500px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          {showHistory && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 mr-1"
              onClick={() => setShowHistory(false)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">
              {showHistory ? t("ai.header.history") : t("ai.header.title")}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              {showHistory ? t("ai.header.historySubtitle") : t("ai.header.subtitle")}
            </p>
          </div>
          {!showHistory && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
              <Sparkles className="h-2.5 w-2.5 mr-0.5" />
              {t("ai.header.beta")}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!showHistory && (
            <>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={() => setShowHistory(true)}
                title={t("ai.header.showHistory")}
              >
                <History className="h-3.5 w-3.5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={startNewChat}
                title={t("ai.header.newChat")}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* History View */}
      {showHistory ? (
        <ScrollArea className="flex-1 p-3">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <History className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{t("ai.history.empty")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors",
                    activeConversationId === conv.id && "border-primary bg-primary/5"
                  )}
                  onClick={() => loadConversation(conv.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {conv.title || t("ai.history.untitled")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(conv.updated_at), "d MMM, HH:mm", { locale: dateLocale })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      ) : (
        <>
          {/* Messages */}
          <ScrollArea className="flex-1 p-3" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <div className="p-3 bg-primary/10 rounded-full mb-3">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-semibold mb-1 text-sm">{t("ai.empty.heading")}</h4>
                <p className="text-xs text-muted-foreground mb-4 max-w-[280px]">
                  {t("ai.empty.desc")}
                </p>
                
                {/* Suggested Prompts */}
                <div className="grid grid-cols-2 gap-2 w-full">
                  {suggestedPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(t(prompt.promptKey))}
                      className="flex items-center gap-2 p-2 text-left rounded-lg border hover:bg-accent transition-colors"
                    >
                      <div className="p-1.5 bg-primary/10 rounded-md shrink-0">
                        {prompt.icon}
                      </div>
                      <span className="text-xs font-medium truncate">{t(prompt.titleKey)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-2",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="p-1.5 bg-primary/10 rounded-lg h-fit shrink-0">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                    )}
                    
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {message.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                          <MessageContent 
                            content={message.content} 
                            onLeadClick={(id) => {
                              onClose();
                              navigate(`/leads/${id}`);
                            }}
                          />
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                      
                      {/* Show tool calls */}
                      {message.toolCalls && message.toolCalls.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                            <Zap className="h-2.5 w-2.5" />
                            {t("ai.message.actions")}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {message.toolCalls.map((tc: any, j: number) => (
                              <Badge key={j} variant="outline" className="text-[10px] px-1.5 py-0">
                                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5 text-green-500" />
                                {tc.function.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex gap-2">
                    <div className="p-1.5 bg-primary/10 rounded-lg h-fit">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {t("ai.message.thinking")}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <div className="p-3 border-t bg-muted/20">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("ai.input.placeholder")}
                className="min-h-[44px] max-h-[120px] resize-none text-sm"
                disabled={isLoading}
              />
              <Button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            {activeConversationId && (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {t("ai.input.autosave")}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
