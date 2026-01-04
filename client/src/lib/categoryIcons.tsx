import {
  Utensils,
  Car,
  Home,
  DollarSign,
  Laptop,
  Target,
  Shirt,
  Heart,
  BookOpen,
  Zap,
  ShoppingCart,
  Film,
  Plane,
  Lightbulb,
  CreditCard,
  Fuel,
  Phone,
  Wifi,
  Building,
  Users,
  Coffee,
  Gift,
  Gamepad2,
  Music,
  Camera,
  Dumbbell,
  Briefcase,
  Handshake,
  Receipt,
} from 'lucide-react';

export const categoryIconMap = {
  Utensils: Utensils,
  Car: Car,
  Home: Home,
  DollarSign: DollarSign,
  Laptop: Laptop,
  Target: Target,
  Shirt: Shirt,
  Heart: Heart,
  BookOpen: BookOpen,
  Zap: Zap,
  ShoppingCart: ShoppingCart,
  Film: Film,
  Plane: Plane,
  CreditCard: CreditCard,
  Fuel: Fuel,
  Phone: Phone,
  Wifi: Wifi,
  Building: Building,
  Users: Users,
  Coffee: Coffee,
  Gift: Gift,
  Gamepad2: Gamepad2,
  Music: Music,
  Camera: Camera,
  Dumbbell: Dumbbell,
  Briefcase: Briefcase,
  Handshake: Handshake,
  Receipt: Receipt,
  Lightbulb: Lightbulb,
};

export const categoryColors = {
  income: '#22c55e', // Verde
  expense: '#ef4444', // Vermelho
};

export function getCategoryIcon(iconName: string, className?: string, color?: string) {
  const IconComponent = categoryIconMap[iconName as keyof typeof categoryIconMap];

  if (!IconComponent) {
    return <Lightbulb className={className} style={{ color }} />;
  }

  return <IconComponent className={className} style={{ color }} />;
}
