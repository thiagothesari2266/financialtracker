# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive financial tracker web application built with a full-stack TypeScript architecture. The application supports both personal and business financial management with features including transaction tracking, credit card management, invoice processing, project management, and AI-powered financial advice.

## Development Commands

- `npm run dev` - Start development server (runs both client and API server on port 5000)
- `npm run build` - Build the application for production
- `npm run start` - Start production server
- `npm run check` - Run TypeScript type checking
- `npm run db:push` - Push database schema changes using Drizzle Kit

## Architecture

### Full-Stack Monorepo Structure
- **Client**: React + TypeScript frontend in `/client` directory
- **Server**: Express.js + TypeScript backend in `/server` directory  
- **Shared**: Common schemas and types in `/shared` directory
- **Database**: PostgreSQL with Drizzle ORM

### Key Architectural Patterns

**Database Layer**:
- Drizzle ORM with PostgreSQL
- Schema defined in `shared/schema.ts` with Zod validation
- Database connection in `server/db.ts`
- Migrations managed in `/migrations` directory

**API Layer**:
- Express.js server with comprehensive REST API
- Routes defined in `server/routes.ts` and `/server/routes/` directory
- Rate limiting implemented for AI chat features
- File upload handling for invoice processing
- WebSocket support for real-time features

**Client Architecture**:
- React with Wouter for routing (not React Router)
- TanStack Query for server state management
- Context API for account management (`contexts/AccountContext.tsx`)
- Custom hooks pattern for data fetching (all in `/hooks` directory)
- Radix UI components with custom styling
- Tailwind CSS for styling

**State Management**:
- Server state: TanStack Query with custom hooks
- Client state: React Context + useState
- Account context provides current account selection across the app

## Database Schema

The application uses a multi-tenant architecture based on accounts:

**Core Entities**:
- `accounts` - Personal or business account containers
- `categories` - Income/expense categories per account
- `transactions` - Regular financial transactions
- `creditCards` - Credit card management with invoice tracking
- `creditCardTransactions` - Credit card specific transactions
- `bankAccounts` - Bank account management
- `invoicePayments` - Credit card invoice payment tracking

**Business Features**:
- `projects` - Project management with client association
- `costCenters` - Cost center tracking for business accounts
- `clients` - Client management for business accounts
- `invoiceImports` - AI-powered invoice processing and import

## Key Implementation Details

**Multi-Account Support**:
- All entities are scoped to an account via `accountId` foreign key
- Account selection persists in context and affects all data queries
- Account selector page at root path for account switching

**Credit Card System**:
- Separate transactions table for credit card purchases
- Invoice generation based on closing/due dates
- Payment tracking with status management
- AI-powered invoice import from images

**File Handling**:
- Invoice uploads stored in `server/uploads/invoices/`
- OpenAI integration for invoice text extraction
- Support for multiple image formats

**AI Integration**:
- Financial advisor chat feature using OpenAI
- Invoice processing with GPT-4 Vision
- Rate limiting on AI endpoints

**Development Environment**:
- Vite dev server proxies `/api` requests to Express server on port 3000
- Development server runs on port 5000 (client + API)
- Production serves static files from Express

## Component Patterns

**Custom Hooks**:
- All data fetching through custom hooks (e.g., `useTransactions`, `useCreditCards`)
- Hooks handle loading states, error handling, and TanStack Query integration
- Mutations include optimistic updates where appropriate

**Modal Architecture**:
- Modal components in `/components/Modals/` directory
- Form handling with React Hook Form + Zod validation
- Consistent create/edit patterns across all modals

**UI Components**:
- Shadcn/ui component library with Radix UI primitives
- Custom components in `/components/ui/` directory
- Consistent styling with Tailwind CSS and CVA (class-variance-authority)

## Important Configuration

**Environment Variables**:
- `DATABASE_URL` - PostgreSQL connection string (required)
- `OPENAI_API_KEY` - For AI features (optional but recommended)
- `NODE_ENV` - Environment setting

**Path Aliases**:
- `@/` - Points to `client/src/`
- `@shared/` - Points to `shared/`
- `@assets/` - Points to `attached_assets/`

## Testing and Quality

- TypeScript strict mode enabled
- Zod schemas for runtime validation
- Database migrations handled through Drizzle Kit
- No test framework currently configured - add tests using your preferred framework

## AI Features

The application includes sophisticated AI integration:
- Financial chat advisor accessible via floating chat button
- Invoice processing that extracts transaction data from images
- Rate limiting to prevent API abuse
- Conversation context maintained for better advice quality