import { AdminPage } from "./admin/AdminPage";
import { PARTIFUL_URL, RULES_VIDEO_URL } from "./links";
import { HomePage } from "./pages/HomePage";
import { LivePage } from "./pages/LivePage";
import { Link, usePath } from "./router";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/live", label: "Live bracket" },
  { href: "/admin", label: "Admin" },
];

export default function App() {
  const path = usePath().replace(/\/+$/, "") || "/";

  return (
    <div className="app">
      <header className="site-header">
        <Link href="/" className="brand">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>Tipsy Toss</span>
        </Link>
        <nav>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={path === item.href ? "active" : ""}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="container">
        {path === "/live" ? <LivePage /> : path === "/admin" ? <AdminPage /> : <HomePage />}
      </main>

      <footer className="site-footer">
        <span>The Tipsy Toss Tournament #2 · Sat, Oct 17 · 3pm</span>
        <span className="footer-links">
          <a href={PARTIFUL_URL} target="_blank" rel="noreferrer">
            Partiful
          </a>
          <a href={RULES_VIDEO_URL} target="_blank" rel="noreferrer">
            Rules video
          </a>
        </span>
      </footer>
    </div>
  );
}
