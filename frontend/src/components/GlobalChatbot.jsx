import { useEffect, useRef, useState } from "react";
import { FaComment, FaTimes, FaTrashAlt } from "react-icons/fa";
import { ollamaPublicChat } from "../services/api";
import "./GlobalChatbot.css";

const initialMessages = [
  {
    role: "bot",
    text: "Bonjour ! Je suis le Chat-Bot. Je peux répondre à vos questions générales.",
  },
];

const GlobalChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async () => {
    const message = prompt.trim();
    if (!message || isLoading) {
      return;
    }

    setPrompt("");
    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setIsLoading(true);

    try {
      const response = await ollamaPublicChat({
        message,
        model: "mistral",
        max_tokens: 512,
        temperature: 0.7,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text:
            response?.data?.response ||
            response?.data?.error ||
            "Aucune réponse reçue.",
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text:
            error?.response?.data?.error ||
            "Impossible de joindre le chat pour le moment.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          className="global-chatbot-launcher"
          onClick={() => setIsOpen(true)}
          type="button"
          aria-label="Ouvrir le Chat-Bot"
        >
          <FaComment aria-hidden="true" />
          Chat
        </button>
      )}

      <aside className={`global-chatbot ${isOpen ? "open" : "closed"}`}>
        <header className="global-chatbot-header">
          <div>
            <p className="global-chatbot-title">Chat-Bot</p>
            <p className="global-chatbot-subtitle">acces limité</p>
          </div>
          <button
            type="button"
            className="global-chatbot-icon-btn"
            onClick={() => setMessages(initialMessages)}
            aria-label="Effacer la conversation"
          >
            <FaTrashAlt aria-hidden="true" />
          </button>
          <button
            type="button"
            className="global-chatbot-icon-btn"
            onClick={() => setIsOpen(false)}
            aria-label="Fermer le chat"
          >
            <FaTimes aria-hidden="true" />
          </button>
        </header>

        <div className="global-chatbot-messages">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`global-message ${message.role}`}>
              <div className="global-bubble">{message.text}</div>
            </div>
          ))}
          {isLoading && (
            <div className="global-message bot">
              <div
                className="global-bubble global-thinking"
                role="status"
                aria-live="polite"
              >
                <span>Penser</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="global-chatbot-input-row">
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez une question"
            className="global-chatbot-input"
          />
          <button
            type="button"
            className="global-chatbot-send"
            onClick={sendMessage}
            disabled={isLoading}
          >
            Envoyer
          </button>
        </div>
      </aside>
    </>
  );
};

export default GlobalChatbot;
