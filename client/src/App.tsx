import { lazy, Suspense } from "react";
import { Analytics } from "@vercel/analytics/react";
import { Route, Switch } from "wouter";
import NotFound from "@/pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import Storefront from "./pages/Storefront";

const Admin = lazy(() => import("./pages/Admin"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));

function Router() {
  return (
    <Suspense fallback={<div className="route-loading" aria-live="polite">Loading Orange…</div>}>
      <Switch>
        <Route path="/" component={Storefront} />
        <Route path="/product/:slug" component={ProductDetail} />
        <Route path="/admin" component={Admin} />
        <Route path="/admin/items" component={Admin} />
        <Route path="/admin/photos" component={Admin} />
        <Route path="/admin/import" component={Admin} />
        <Route path="/admin/review-queue" component={Admin} />
        <Route path="/admin/security" component={Admin} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router />
      <Analytics mode="production" />
    </ErrorBoundary>
  );
}
