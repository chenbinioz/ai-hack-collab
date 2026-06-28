/**
 * Homepage layout toggle:
 * Set NEXT_PUBLIC_LEGACY_HOME=true in .env.local to restore the previous homepage.
 * The previous layout is preserved in ./page.legacy.tsx
 */
import LegacyHomePage from "./page.legacy";
import HomePageV2 from "./home-page-v2";

export default function Home() {
  if (process.env.NEXT_PUBLIC_LEGACY_HOME === "true") {
    return <LegacyHomePage />;
  }
  return <HomePageV2 />;
}
