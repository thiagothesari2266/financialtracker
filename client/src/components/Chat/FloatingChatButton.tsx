import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bot } from 'lucide-react';
import FinancialChat from './FinancialChat';

export default function FloatingChatButton() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <>
      <FinancialChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

      {/* Botão flutuante fixo */}
      <Button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200 p-0 md:bottom-6 md:right-6"
        title="Assistente Financeiro IA"
      >
        <Bot className="h-6 w-6 text-white" />
      </Button>
    </>
  );
}
