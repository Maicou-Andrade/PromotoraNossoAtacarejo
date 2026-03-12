import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useState } from "react";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Promotoras from "./pages/Promotoras";
import Lancamentos from "./pages/Lancamentos";
import Graficos from "./pages/Graficos";
import Metas from "./pages/Metas";

function App() {
  const [activeTab, setActiveTab] = useState("promotoras");

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <div className="min-h-screen flex flex-col bg-background">
            <Header activeTab={activeTab} onTabChange={setActiveTab} />
            <main className="flex-1 container mx-auto py-6">
              {activeTab === "promotoras" && <Promotoras />}
              {activeTab === "lancamentos" && <Lancamentos />}
              {activeTab === "graficos" && <Graficos />}
              {activeTab === "metas" && <Metas />}
            </main>
            <Footer />
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
