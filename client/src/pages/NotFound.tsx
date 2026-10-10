import { Home } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return <main id="main-content" className="page-state">
    <p className="eyebrow">404</p>
    <h1>Page not found</h1>
    <p>This page may have moved or is no longer available.</p>
    <Link href="/"><Home size={16} aria-hidden="true" />Return to shop</Link>
  </main>;
}
