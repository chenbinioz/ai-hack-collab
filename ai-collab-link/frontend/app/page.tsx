import ChatBubble from "../components/ChatBubble";

export default function HomePage() {
  return (
    <main style={{ padding: 24, fontFamily: "Inter, sans-serif" }}>
      <h1>AI Collab Link</h1>
      <p>Next.js frontend starter for chat and coach workflows.</p>
      <ChatBubble role="assistant" message="Welcome to AI Collab Link!" />
    </main>
  );
}
