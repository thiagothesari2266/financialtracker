import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Menu, ChevronLeft, ChevronRight, Plus } from "lucide-react";

interface HeaderProps {
  onMenuToggle?: () => void;
  onMenuClick?: () => void;
  currentMonth?: string;
  onPreviousMonth?: () => void;
  onNextMonth?: () => void;
  onAddTransaction?: () => void;
}

export default function Header({
  onMenuToggle,
  onMenuClick,
  currentMonth,
  onPreviousMonth,
  onNextMonth,
  onAddTransaction,
}: HeaderProps) {
  const toggleMenu = onMenuClick ?? onMenuToggle;

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {toggleMenu && (
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleMenu}>
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menu</span>
            </Button>
          )}
          <span className="text-sm font-semibold text-muted-foreground">
            Operação financeira
          </span>
        </div>
        <div className="flex items-center gap-2">
          {currentMonth && (
            <>
              <div className="flex items-center gap-1 rounded-full border bg-card px-2 py-1 text-sm font-medium">
                <Button variant="ghost" size="icon" onClick={onPreviousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2">{currentMonth}</span>
                <Button variant="ghost" size="icon" onClick={onNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Separator orientation="vertical" className="h-6" />
            </>
          )}
          {onAddTransaction && (
            <Button size="sm" onClick={onAddTransaction}>
              <Plus className="mr-2 h-4 w-4" />
              Nova transação
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
