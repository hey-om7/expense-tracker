import React, { useState, useRef, useEffect } from 'react';
import { sendAiChat, fetchSettings } from '../../services/api';
import { Link } from 'react-router-dom';

const AiChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(true);
  // State to track which model the user chose
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash'); 
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hey! I\'m Vestor AI — your personal finance assistant. Ask me anything about your spending, investments, or subscriptions. 💰' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await fetchSettings();
        if (settings) {
          if (settings.aiEnabled === false) setAiEnabled(false);
          
          // Save the model to state so we can update the UI
          const modelName = settings.aiModel || 'gemini-2.5-flash';
          setSelectedModel(modelName);

          const isGroqModel = modelName.includes('llama') || modelName.includes('mixtral');

          // Check the correct API key based on the model
          if (isGroqModel) {
            if (!settings.groqApiKey || settings.groqApiKey.trim().length === 0) {
              setHasApiKey(false);
            }
          } else {
            if (!settings.geminiApiKey || settings.geminiApiKey.trim().length === 0) {
              setHasApiKey(false);
            }
          }
        }
      } catch (err) {}
    };
    loadSettings();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || loading) return;

    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setInput('');
    setLoading(true);

    try {
      const data = await sendAiChat(msg);
      setMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: `Sorry, I couldn't process that. ${err.message || 'Please try again.'}`, isError: true }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatMessage = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background:rgba(229,186,115,0.15);padding:1px 4px;border-radius:3px;font-size:12px">$1</code>')
      .replace(/\n/g, '<br/>');
  };

  if (!aiEnabled) return null;

  // Helper boolean for rendering UI text
  const isGroq = selectedModel.includes('llama') || selectedModel.includes('mixtral');

  return (
    <>
      {/* Floating Action Button */}
      <button
        id="ai-chatbot-fab"
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed z-[90] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 active:scale-90
          ${isOpen 
            ? 'bg-surface-container-highest text-on-surface-variant rotate-0' 
            : 'bg-gradient-to-br from-[#E5BA73] to-[#C99C45] text-[#1A120B] hover:shadow-[0_8px_32px_rgba(229,186,115,0.4)] hover:scale-105'
          }
          bottom-24 right-5
          md:bottom-8 md:right-8
        `}
        style={{ zIndex: 90 }}
      >
        <span className="material-symbols-outlined text-2xl transition-transform duration-300" style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}>
          {isOpen ? 'close' : 'auto_awesome'}
        </span>
      </button>

      {/* Chat Panel */}
      <div
        className={`fixed z-[89] transition-all duration-300 ease-out
          ${isOpen 
            ? 'opacity-100 pointer-events-auto translate-y-0' 
            : 'opacity-0 pointer-events-none translate-y-4'
          }
          bottom-0 left-0 right-0
          md:bottom-24 md:right-8 md:left-auto md:w-[400px]
        `}
        style={{ zIndex: 89 }}
      >
        <div className="bg-surface-container-high border border-outline/10 shadow-2xl overflow-hidden flex flex-col
          rounded-t-2xl max-h-[75vh]
          md:rounded-2xl md:max-h-[520px]
        ">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-outline/10 bg-surface-container-high shrink-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#E5BA73] to-[#C99C45] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[#1A120B] text-lg">auto_awesome</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-on-surface">Vestor AI</h3>
              {/*  Dynamic provider text */}
              <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">
                Powered by {isGroq ? 'Groq' : 'Gemini'}
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="md:hidden w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors"
            >
              <span className="material-symbols-outlined text-lg">keyboard_arrow_down</span>
            </button>
          </div>

          {/* No API Key Warning */}
          {!hasApiKey ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-3xl">key</span>
              </div>
              <div>
                <h3 className="font-bold text-base text-on-surface mb-2">API Key Required</h3>
                {/* Dynamic API Key prompt */}
                <p className="text-sm text-on-surface-variant leading-relaxed max-w-xs">
                  Please add your {isGroq ? 'Groq' : 'Gemini'} API key in Settings to use AI features.
                </p>
              </div>
              <Link
                to="/settings"
                onClick={() => setIsOpen(false)}
                className="mt-2 inline-flex items-center gap-2 bg-primary-container text-on-primary px-5 py-2.5 rounded-xl text-sm font-bold hover:brightness-110 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-base">settings</span>
                Go to Settings
              </Link>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0
                [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-outline/20 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full
              ">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed
                        ${msg.role === 'user'
                          ? 'bg-primary/20 text-on-surface rounded-2xl rounded-br-md'
                          : msg.isError
                            ? 'bg-error-container/20 text-on-surface rounded-2xl rounded-bl-md border border-error/20'
                            : 'bg-surface-container-lowest text-on-surface rounded-2xl rounded-bl-md border border-outline/5'
                        }`}
                      dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }}
                    />
                  </div>
                ))}

                {/* Typing indicator */}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-surface-container-lowest border border-outline/5 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="shrink-0 px-4 pb-4 pt-2 border-t border-outline/10 bg-surface-container-high
                max-md:pb-6
              ">
                <div className="flex items-center gap-2 bg-surface-container-lowest rounded-xl border border-outline/10 px-3 py-1 focus-within:border-primary/40 transition-colors">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about your finances..."
                    disabled={loading}
                    className="flex-1 bg-transparent text-[16px] md:text-sm text-on-surface py-2.5 focus:outline-none placeholder:text-on-surface-variant/50 disabled:opacity-50 min-w-0"
                    maxLength={2000}
                  />
                  <button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0 hover:bg-primary/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed active:scale-90"
                  >
                    <span className="material-symbols-outlined text-lg">send</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-[88] md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default AiChatbot;