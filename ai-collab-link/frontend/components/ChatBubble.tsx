type ChatBubbleProps = {
  role: "user" | "assistant" | "system";
  message: string;
};

export default function ChatBubble({ role, message }: ChatBubbleProps) {
  const color = role === "user" ? "#d8f3dc" : "#e7f5ff";
  return (
    <div style={{ background: color, borderRadius: 16, padding: 16, marginTop: 16 }}>
      <strong>{role}</strong>
      <p>{message}</p>
    </div>
  );
}
