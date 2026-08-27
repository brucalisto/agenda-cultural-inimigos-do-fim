import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

type AuthMode = "login" | "forgot" | "update";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getInitialMode(): AuthMode {
  if (typeof window === "undefined") return "login";

  const searchMode = new URLSearchParams(window.location.search).get("mode");
  const recoveryType = new URLSearchParams(window.location.hash.slice(1)).get("type");
  return searchMode === "reset" || recoveryType === "recovery" ? "update" : "login";
}

function AuthPage() {
  const [mode, setMode] = useState<AuthMode>(getInitialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("update");
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      window.location.href = "/";
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Não foi possível entrar. Verifique seus dados."));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordResetRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      const redirectTo = `${window.location.origin}/auth?mode=reset`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      setResetEmailSent(true);
      toast.success("Se o e-mail estiver cadastrado, você receberá as instruções em instantes.");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Não foi possível enviar o e-mail de recuperação."));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password.length < 8) {
      toast.error("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== passwordConfirmation) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha atualizada com sucesso.");
      window.history.replaceState({}, "", "/auth");
      window.location.href = "/";
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Não foi possível atualizar a senha."));
    } finally {
      setLoading(false);
    }
  };

  const returnToLogin = () => {
    setMode("login");
    setPassword("");
    setPasswordConfirmation("");
    setResetEmailSent(false);
    window.history.replaceState({}, "", "/auth");
  };

  const title =
    mode === "forgot"
      ? "Recupere seu acesso"
      : mode === "update"
        ? "Crie uma nova senha"
        : "Bem-vindo de volta";

  const description =
    mode === "forgot"
      ? "Informe seu e-mail para receber um link seguro de recuperação."
      : mode === "update"
        ? "Escolha uma senha segura para voltar ao painel."
        : "Entre para gerenciar a agenda cultural.";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#191512] text-[#25201c]">
      <img
        src="/images/auth/login-cultural-bg.webp"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-[42%_center] sm:object-center lg:object-left"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#15100b]/35 via-[#20140d]/30 to-[#110d09]/75 lg:bg-gradient-to-r lg:from-[#17100b]/5 lg:via-[#17100b]/20 lg:to-[#17100b]/80" />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1480px] items-center gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[1fr_460px] lg:px-14 xl:px-20">
        <section className="hidden max-w-2xl self-end pb-12 text-[#fff8e9] drop-shadow-lg lg:block">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-[#e6b557]">
            Cultura que conecta territórios
          </p>
          <h1 className="max-w-xl font-serif text-6xl font-semibold leading-[0.95] tracking-tight xl:text-7xl">
            Inimigos do Fim
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-[#fff8e9]/85">
            Encontros, arte e movimento reunidos em uma agenda feita coletivamente.
          </p>
        </section>

        <section className="w-full max-w-[460px] justify-self-center lg:justify-self-end">
          <div className="rounded-[2rem] border border-white/40 bg-[#fffaf0]/95 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-9">
            <div className="mb-8">
              <div className="mb-6 flex items-center gap-3 lg:hidden">
                <span className="grid size-11 place-items-center rounded-full bg-[#9f3d25] text-[#fff8e9] shadow-md">
                  <LockKeyhole className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-serif text-xl font-bold text-[#312820]">Inimigos do Fim</p>
                  <p className="text-xs uppercase tracking-[0.16em] text-[#805d3b]">
                    Agenda cultural
                  </p>
                </div>
              </div>

              {mode !== "login" && (
                <button
                  type="button"
                  onClick={returnToLogin}
                  className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#8f3925] transition-colors hover:text-[#632719] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f3d25] focus-visible:ring-offset-2"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Voltar para o login
                </button>
              )}

              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#a45231]">
                Acesso administrativo
              </p>
              <h2 className="font-serif text-3xl font-bold tracking-tight text-[#2d261f] sm:text-4xl">
                {title}
              </h2>
              <p className="mt-3 leading-relaxed text-[#6e6258]">{description}</p>
            </div>

            {mode === "forgot" && resetEmailSent ? (
              <div
                className="rounded-2xl border border-[#d6b36b]/50 bg-[#f5e8c8]/55 p-5"
                role="status"
              >
                <Mail className="mb-4 size-7 text-[#8f3925]" aria-hidden="true" />
                <h3 className="font-semibold text-[#312820]">Confira sua caixa de entrada</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#6e6258]">
                  Se <strong>{email}</strong> estiver cadastrado, enviaremos um link para criar uma
                  nova senha. Confira também a pasta de spam.
                </p>
                <Button
                  type="button"
                  onClick={returnToLogin}
                  className="mt-5 w-full bg-[#9f3d25] text-white hover:bg-[#84301f]"
                >
                  Voltar para o login
                </Button>
              </div>
            ) : mode === "forgot" ? (
              <form onSubmit={handlePasswordResetRequest} className="space-y-6">
                <EmailField email={email} onChange={setEmail} disabled={loading} />
                <SubmitButton loading={loading} loadingLabel="Enviando...">
                  Enviar link de recuperação
                </SubmitButton>
              </form>
            ) : mode === "update" ? (
              <form onSubmit={handlePasswordUpdate} className="space-y-5">
                <PasswordField
                  id="new-password"
                  label="Nova senha"
                  value={password}
                  onChange={setPassword}
                  visible={showPassword}
                  onToggleVisibility={() => setShowPassword((current) => !current)}
                  disabled={loading}
                  autoComplete="new-password"
                  minLength={8}
                />
                <PasswordField
                  id="password-confirmation"
                  label="Confirme a nova senha"
                  value={passwordConfirmation}
                  onChange={setPasswordConfirmation}
                  visible={showPassword}
                  onToggleVisibility={() => setShowPassword((current) => !current)}
                  disabled={loading}
                  autoComplete="new-password"
                  minLength={8}
                />
                <p className="text-xs text-[#7b6d61]">Use pelo menos 8 caracteres.</p>
                <SubmitButton loading={loading} loadingLabel="Atualizando...">
                  Salvar nova senha
                </SubmitButton>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-5">
                <EmailField email={email} onChange={setEmail} disabled={loading} />
                <PasswordField
                  id="password"
                  label="Senha"
                  value={password}
                  onChange={setPassword}
                  visible={showPassword}
                  onToggleVisibility={() => setShowPassword((current) => !current)}
                  disabled={loading}
                  autoComplete="current-password"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-sm font-semibold text-[#8f3925] underline-offset-4 transition-colors hover:text-[#632719] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f3d25] focus-visible:ring-offset-2"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <SubmitButton loading={loading} loadingLabel="Entrando...">
                  Entrar no painel
                </SubmitButton>
              </form>
            )}
          </div>
          <p className="mt-5 text-center text-xs text-white/75 drop-shadow-md">
            Painel de gestão da Agenda Cultural Inimigos do Fim
          </p>
        </section>
      </div>
    </main>
  );
}

interface EmailFieldProps {
  email: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

function EmailField({ email, onChange, disabled }: EmailFieldProps) {
  return (
    <div>
      <label className="text-sm font-semibold text-[#3a312a]" htmlFor="email">
        E-mail
      </label>
      <div className="relative mt-2">
        <Mail
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#9b8573]"
          aria-hidden="true"
        />
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          disabled={disabled}
          className="h-12 w-full rounded-xl border border-[#d8c9b8] bg-white/80 pl-10 pr-4 text-sm text-[#2d261f] outline-none transition placeholder:text-[#a49383] focus:border-[#a45231] focus:ring-4 focus:ring-[#a45231]/10 disabled:cursor-not-allowed disabled:opacity-60"
          value={email}
          onChange={(event) => onChange(event.target.value)}
          placeholder="seu@email.com"
        />
      </div>
    </div>
  );
}

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisibility: () => void;
  disabled: boolean;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggleVisibility,
  disabled,
  autoComplete,
  minLength,
}: PasswordFieldProps) {
  return (
    <div>
      <label className="text-sm font-semibold text-[#3a312a]" htmlFor={id}>
        {label}
      </label>
      <div className="relative mt-2">
        <LockKeyhole
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#9b8573]"
          aria-hidden="true"
        />
        <input
          id={id}
          type={visible ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          disabled={disabled}
          className="h-12 w-full rounded-xl border border-[#d8c9b8] bg-white/80 pl-10 pr-12 text-sm text-[#2d261f] outline-none transition placeholder:text-[#a49383] focus:border-[#a45231] focus:ring-4 focus:ring-[#a45231]/10 disabled:cursor-not-allowed disabled:opacity-60"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          disabled={disabled}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-[#7b6d61] transition-colors hover:bg-[#efe4d5] hover:text-[#8f3925] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f3d25] disabled:opacity-50"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

interface SubmitButtonProps {
  loading: boolean;
  loadingLabel: string;
  children: string;
}

function SubmitButton({ loading, loadingLabel, children }: SubmitButtonProps) {
  return (
    <Button
      type="submit"
      className="h-12 w-full rounded-xl bg-[#9f3d25] font-semibold text-white shadow-lg shadow-[#6e2415]/15 transition-all hover:-translate-y-0.5 hover:bg-[#84301f] hover:shadow-xl disabled:translate-y-0"
      disabled={loading}
    >
      {loading && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
      {loading ? loadingLabel : children}
    </Button>
  );
}
