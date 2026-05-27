import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LanguageRouter from "./components/LanguageRouter";
import { DebugProvider } from "./contexts/DebugContext";
import { useLanguageDebugInfo } from "@/hooks/useLanguageDebugInfo";
import { HelmetProvider } from 'react-helmet-async';

/**
 * Calls useLanguageDebugInfo to register language info in DebugContext.
 * Must be rendered inside DebugProvider.
 */
const LanguageDebugInfoProvider = () => {
  useLanguageDebugInfo();
  return null;
};

const queryClient = new QueryClient();

const App = () => {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <DebugProvider>
            <LanguageDebugInfoProvider /> {/* Now inside DebugProvider */}
            <Toaster />
            <Sonner />
            <LanguageRouter />
            {/* Hidden by request: keep debug data plumbing, but do not render bottom debug UI. */}
          </DebugProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;
