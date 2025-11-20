import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onMenuToggle: () => void;
}

export default function Header({ 
  onMenuToggle 
}: HeaderProps) {

  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {/* Mobile Menu Button */}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onMenuToggle}
            className="lg:hidden p-2"
          >
            <Menu className="h-5 w-5 text-slate-600" />
          </Button>
        </div>
        
        <div></div>
      </div>
    </header>
  );
}
