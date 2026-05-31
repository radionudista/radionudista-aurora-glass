import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import LanguageRouter from "./components/LanguageRouter";
import { DebugProvider } from "./contexts/DebugContext";
import { PublicContentProvider } from "./contexts/PublicContentContext";
import { useLanguageDebugInfo } from "@/hooks/useLanguageDebugInfo";
import { HelmetProvider } from 'react-helmet-async';

const LanguageDebugInfoProvider = () => {
  useLanguageDebugInfo();
  return null;
};

const App = () => {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <DebugProvider>
            <LanguageDebugInfoProvider />
            <Toaster />
            <Sonner />
            <PublicContentProvider>
              <LanguageRouter />
            </PublicContentProvider>
          </DebugProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;
