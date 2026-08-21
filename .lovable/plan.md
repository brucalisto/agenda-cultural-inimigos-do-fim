# Plan: Admin Dashboard Stage 1 - Structure and Navigation

Build the initial structure, authentication, and navigation for a WhatsApp monitoring dashboard in Portuguese (Brazil).

## Design System
- Modern, clean, professional administrative interface.
- Responsive sidebar navigation.
- Dashboard cards and charts for "Visão Geral".
- Portuguese (PT-BR) localization.

## Technical Details
- **Auth**: Lovable Cloud (Supabase) email/password authentication.
- **Roles**: `admin` and `revisor`.
- **Navigation**: TanStack Router with sidebar layout.
- **Components**: Shadcn/UI for dashboard elements and forms.
- **Charts**: Recharts or Lucide-based visuals for content distribution.

## Implementation Steps

### 1. Backend & Auth Setup
- Enable Lovable Cloud.
- Create `user_roles` table and `has_role` function.
- Configure auth middleware.

### 2. Layout & Navigation
- Create a `_authenticated` layout route with a responsive sidebar.
- Implement sidebar links: Visão geral, Caixa de entrada, etc.
- Add user profile/logout section in sidebar.

### 3. Dashboard (Visão Geral)
- Design the main dashboard at `/`.
- Implement KPI cards (Mensagens hoje, Processados, etc.).
- Add placeholder charts for content distribution.
- Create status indicators for Evolution API and Gemini.
- Add a "Recent Activity" list.

### 4. Placeholder Routes
- Create empty routes for all other menu items to verify navigation.

### 5. Authentication UI
- Create `/auth` route with a professional login form.
