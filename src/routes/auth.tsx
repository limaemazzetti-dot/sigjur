import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoGold from "@/assets/lima-mazzetti-logo-gold.png";
import scalesCropAsset from "@/assets/scales-of-justice.jpg";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Acesso — Lima & Mazzetti Advocacia" },
      { name: "description", content: "Área restrita do escritório." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Mode = "auth" | "forgot" | "reset";

const GOLD = "#B48C49";
const GOLD_LIGHT = "#E4C678";
const GOLD_DARK = "#7A5A2C";
const INK = "#090603";

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("auth");
  const [showPwd, setShowPwd] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && mode === "auth") navigate({ to: "/resumo", replace: true });
    });
  }, [navigate, mode]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Login efetuado!");
    navigate({ to: "/resumo", replace: true });
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail) return toast.error("Informe o e-mail cadastrado.");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Código enviado. Verifique seu e-mail.");
    setMode("reset");
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error("A senha deve ter ao menos 6 caracteres.");
    if (newPassword !== confirmPassword) return toast.error("As senhas não conferem.");
    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: resetEmail,
      token: code.trim(),
      type: "recovery",
    });
    if (verifyError) {
      setLoading(false);
      return toast.error("Código inválido ou expirado.");
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (updateError) return toast.error(updateError.message);
    toast.success("Senha redefinida. Entrando...");
    navigate({ to: "/resumo", replace: true });
  }

  const labelCls =
    "block text-xs uppercase tracking-[0.15em] mb-2 ml-5 text-[color:var(--gold)]/80";
  const fieldStyle = {
    borderColor: `${GOLD}66`,
    background: INK,
  } as React.CSSProperties;
  const fieldWrap =
    "relative flex items-center rounded-full border-2 h-14 px-5 transition-all focus-within:border-[color:var(--gold-light)] focus-within:shadow-[0_0_0_4px_rgba(228,198,120,0.15)]";
  const inputCls =
    "w-full bg-transparent pl-3 pr-2 text-[color:var(--gold-light)] placeholder:text-[color:var(--gold)]/30 focus:outline-none [-webkit-text-fill-color:var(--gold-light)] [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_#090603_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#E4C678] [&:-webkit-autofill]:caret-[color:var(--gold-light)]";
  const iconCls = "h-4 w-4 text-[color:var(--gold)]/70 shrink-0";
  const primaryBtn =
    "w-full h-14 rounded-full text-base font-semibold tracking-wide transition-all shadow-[0_10px_40px_-10px_rgba(200,169,106,0.6)] hover:shadow-[0_14px_50px_-10px_rgba(200,169,106,0.8)] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div
      className="h-screen w-full flex overflow-hidden"
      style={
        {
          background: INK,
          ["--gold" as string]: GOLD,
          ["--gold-light" as string]: GOLD_LIGHT,
        } as React.CSSProperties
      }
    >
      {/* Form — Left */}
      <main className="w-full md:w-1/2 lg:w-[45%] h-screen flex flex-col justify-center items-center px-6 sm:px-12 md:px-12 lg:px-16 relative overflow-y-auto">
        <div className="w-full max-w-md">
          {mode === "auth" && (
            <>
              <img
                src={logoGold}
                alt="Lima & Mazzetti"
                className="h-32 md:h-48 lg:h-56 w-full max-w-md object-contain mb-6 mx-auto md:mx-0"
              />

              <h1
                className="text-5xl md:text-6xl font-bold mb-10 leading-none text-center md:text-left"
                style={{ color: GOLD_LIGHT }}
              >
                Faça seu Login
                <span style={{ color: GOLD }}>.</span>
              </h1>

              <form onSubmit={handleSignIn} className="space-y-5">
                <div>
                  <label className={labelCls}>E-mail de acesso</label>
                  <div className={fieldWrap} style={fieldStyle}>
                    <Mail className={iconCls} />
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Senha</label>
                  <div className={fieldWrap} style={fieldStyle}>
                    <Lock className={iconCls} />
                    <input
                      type={showPwd ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="text-[color:var(--gold)]/70 hover:text-[color:var(--gold)]"
                      aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="mt-2 ml-5">
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail(email);
                        setMode("forgot");
                      }}
                      className="text-sm text-[color:var(--gold-light)]/80 hover:text-[color:var(--gold-light)] underline underline-offset-4"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                </div>
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className={primaryBtn}
                    style={{
                      background: `linear-gradient(90deg, ${GOLD_DARK} 0%, ${GOLD} 50%, ${GOLD_LIGHT} 100%)`,
                      color: INK,
                    }}
                  >
                    {loading ? "Acessando..." : "Entrar com e-mail"}
                  </button>
                </div>
                <p className="text-center text-xs text-[color:var(--gold-light)]/55">
                  O acesso é concedido pelo administrador da plataforma.
                </p>
              </form>
            </>
          )}

          {mode === "forgot" && (
            <>
              <h1
                className="text-5xl md:text-6xl font-bold mb-4 leading-none"
                style={{ color: GOLD_LIGHT }}
              >
                Redefinir<span style={{ color: GOLD }}>.</span>
              </h1>
              <p className="text-sm text-[color:var(--gold-light)]/70 mb-8">
                Informe seu e-mail e enviaremos um código.
              </p>
              <form onSubmit={handleSendCode} className="space-y-5">
                <div>
                  <label className={labelCls}>Email</label>
                  <div className={fieldWrap} style={fieldStyle}>
                    <Mail className={iconCls} />
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className={primaryBtn}
                    style={{
                      background: `linear-gradient(90deg, ${GOLD_DARK} 0%, ${GOLD} 50%, ${GOLD_LIGHT} 100%)`,
                      color: INK,
                    }}
                  >
                    {loading ? "Enviando..." : "Enviar Código"}
                  </button>
                </div>
                <p className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setMode("auth")}
                    className="text-sm text-[color:var(--gold-light)]/80 hover:text-[color:var(--gold-light)] underline underline-offset-4"
                  >
                    ← Voltar para login
                  </button>
                </p>
              </form>
            </>
          )}

          {mode === "reset" && (
            <>
              <h1
                className="text-5xl md:text-6xl font-bold mb-4 leading-none"
                style={{ color: GOLD_LIGHT }}
              >
                Nova senha<span style={{ color: GOLD }}>.</span>
              </h1>
              <p className="text-sm text-[color:var(--gold-light)]/70 mb-8">
                Código enviado para <span className="text-[color:var(--gold)]">{resetEmail}</span>
              </p>
              <form onSubmit={handleReset} className="space-y-5">
                <div>
                  <label className={labelCls}>Código</label>
                  <div className={fieldWrap} style={fieldStyle}>
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="······"
                      className="w-full bg-transparent px-2 text-[color:var(--gold-light)] tracking-[0.5em] text-center text-lg focus:outline-none placeholder:text-[color:var(--gold)]/30"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Nova senha</label>
                  <div className={fieldWrap} style={fieldStyle}>
                    <Lock className={iconCls} />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Confirmar nova senha</label>
                  <div className={fieldWrap} style={fieldStyle}>
                    <Lock className={iconCls} />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className={primaryBtn}
                    style={{
                      background: `linear-gradient(90deg, ${GOLD_DARK} 0%, ${GOLD} 50%, ${GOLD_LIGHT} 100%)`,
                      color: INK,
                    }}
                  >
                    {loading ? "Redefinindo..." : "Redefinir e Entrar"}
                  </button>
                </div>
                <div className="flex justify-between text-xs pt-2">
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-[color:var(--gold-light)]/80 hover:text-[color:var(--gold-light)] underline underline-offset-4"
                  >
                    Reenviar código
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("auth")}
                    className="text-[color:var(--gold-light)]/60 hover:text-[color:var(--gold-light)] underline underline-offset-4"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </>
          )}
          <div className="mt-6 text-center text-xs text-[color:var(--gold-light)]/40">
            © {new Date().getFullYear()} Lima & Mazzetti Advocacia
          </div>
        </div>
      </main>

      {/* Image — Right */}
      <aside
        className="hidden md:block md:w-1/2 lg:w-[55%] h-screen relative overflow-hidden"
        style={{ backgroundColor: INK }}
      >
        <img
          src={scalesCropAsset}
          alt=""
          className="absolute inset-0 h-full w-full object-contain object-center"
        />
        {/* Left-edge fade into form panel */}
        <div
          className="absolute inset-y-0 left-0 w-40 pointer-events-none"
          style={{
            background: `linear-gradient(90deg, ${INK} 0%, transparent 100%)`,
          }}
        />
        {/* Bottom fade */}
        <div
          className="absolute inset-x-0 bottom-0 h-40 pointer-events-none"
          style={{
            background: `linear-gradient(180deg, transparent 0%, ${INK}CC 100%)`,
          }}
        />
      </aside>
    </div>
  );
}
