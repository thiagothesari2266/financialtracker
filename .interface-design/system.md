# NexFin Design System

## Direction: Sophistication & Trust (Fintech) + Boldness (Lime vibrante)

## Intent
Gestor financeiro pessoal/empresarial. Usuario: pessoa que quer controle
preciso sobre suas financas. Verbo: monitorar, categorizar, projetar.
Tom: confiante, preciso, moderno, energetico.

## Palette
- **Primary**: Lime vibrante #9FE870 (hsl 101 72% 67%)
- **Primary foreground**: Texto escuro #0f172a (contraste ~10:1)
- **Neutral**: Slate scale

### Semantic Tokens (CSS variables + Tailwind)
| Token | Light | Dark | Uso |
|-------|-------|------|-----|
| `success` | hsl(142 71% 45%) | hsl(142 71% 50%) | Valores positivos, pago, aceito |
| `success-foreground` | hsl(142 60% 25%) | hsl(142 60% 75%) | Texto sobre bg success |
| `destructive` | hsl(0 72% 51%) | hsl(0 63% 45%) | Valores negativos, erros, exclusao |
| `warning` | hsl(38 92% 50%) | hsl(38 80% 50%) | Pendente, alertas, expirado |
| `warning-foreground` | hsl(30 80% 30%) | hsl(38 90% 75%) | Texto sobre bg warning |
| `info` | hsl(217 91% 60%) | hsl(217 91% 65%) | Links, cartao credito, parcelas |
| `info-foreground` | hsl(217 70% 30%) | hsl(217 80% 80%) | Texto sobre bg info |

### Como usar
- Texto: `text-success`, `text-destructive`, `text-warning`, `text-info`
- Background sutil: `bg-success/10`, `bg-destructive/10`, `bg-warning/10`
- Background medio: `bg-success/15`, `bg-destructive/15`
- Bordas: `border-success/20`, `border-destructive/20`
- Texto sobre bg colorido: `text-success-foreground`, `text-warning-foreground`
- **NUNCA usar**: `text-green-600`, `bg-red-50`, `border-amber-200`, etc.

**Regra de contraste**: #9FE870 e para accents/botoes (com texto escuro).
Para texto verde sobre fundo claro, usar token `success`.

## Depth
Borders-only + surface color shifts. Sem shadows pesados.
Dark mode: bordas em HSL low-contrast (222 30% 16%).

## Surfaces
```
Level 0: Canvas (--background)     - hsl(222 47% 6%) dark / hsl(210 20% 98%) light
Level 1: Cards (--card)            - +3% lightness (dark) / white (light)
Level 2: Popovers (--popover)      - +6% lightness (dark) / white (light)
Level 3: Nested overlays           - +8% lightness (dark)
```

## Typography
- **Font**: Inter
- **Weights**: 400 (body), 500 (labels/UI), 600 (headings), 700 (display/values)
- **Data**: tabular-nums, font-medium
- **Currency**: tabular-nums, font-bold
- **Feature settings**: font-feature-settings: 'tnum' no body
- **Scale**: text-xs (12px), text-sm (14px), text-base (16px), text-lg (18px), text-xl (20px), text-2xl (24px)

## Spacing
- **Base unit**: 4px
- **Component padding**: 12-16px
- **Card padding**: 16px (p-4)
- **Section gaps**: 24px (gap-6)
- **Page padding**: 24px (px-6)

## Border Radius
- **Inputs/Buttons**: 6px (rounded-md)
- **Cards**: 10px (--radius: 0.625rem)
- **Modals**: 12px (rounded-xl)
- **Badges**: full (rounded-full)

## Components

### Button Primary
- Height: 36px (h-9)
- Padding: 0 16px
- Radius: 6px
- Font: 14px, 500 weight
- Color: bg-primary (#9FE870) text-primary-foreground (#0f172a escuro)
- Hover: bg-primary/90

### Card Standard
- Background: bg-card
- Border: 1px border-border
- Radius: 10px (rounded-[--radius])
- Padding: 16px
- Shadow: none (borders-only approach)

### Table Row
- Border-bottom: border-border/50
- Hover: bg-muted/20
- Padding: 12px 16px
- Financial values: tabular-nums, font-medium, cor semantica

### Input Field
- Height: 40px (h-10)
- Background: bg-background (inset feel no light, level 0 no dark)
- Border: 1px border-border
- Focus: ring-2 ring-primary/20 border-primary
- Radius: 6px
- Padding: 8px 12px

### Metric Card
- Layout: icon (circled) + label + value + trend
- Value: text-2xl font-bold tabular-nums
- Positive values: text-success (#22c55e) - NAO text-primary (contraste)
- Negative values: text-destructive
- Pending: text-warning (amber)

### Nav Item (Sidebar)
- Active: bg-sidebar-accent text-sidebar-accent-foreground + left border 2px primary
- Hover: bg-muted/50
- Icon: 16px in 28px container
- Font: 14px, 500 weight
- Padding: 8px 12px
- Radius: 6px

### Modal
- Overlay: bg-black/60 backdrop-blur-sm
- Container: bg-card border border-border rounded-xl
- Header: border-b border-border pb-4
- Footer: border-t border-border pt-4
- Max-width: contextual (sm/md/lg)

### Credit Card Visual
- Background: gradient slate-800 → slate-900 (escuro mesmo no light mode)
- Accent: chip/barra em lime (#9FE870)
- Text: white
- Radius: 12px
- Info: nome, bandeira, ultimos 4 digitos, limite
