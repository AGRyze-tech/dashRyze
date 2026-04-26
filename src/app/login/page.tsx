'use client'
import { useState } from 'react'
import Image from 'next/image'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError('Email ou senha inválidos.')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      setError('Erro ao conectar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[52%] relative bg-[#0A1A0F] flex-col justify-between p-12 overflow-hidden">
        {/* Background geometric pattern */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `repeating-linear-gradient(
                0deg, transparent, transparent 40px, rgba(64,145,108,0.5) 40px, rgba(64,145,108,0.5) 41px
              ), repeating-linear-gradient(
                90deg, transparent, transparent 40px, rgba(64,145,108,0.5) 40px, rgba(64,145,108,0.5) 41px
              )`,
            }}
          />
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #40916C 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
          />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-8"
            style={{ background: 'radial-gradient(circle, #1B4332 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }}
          />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center p-1.5" style={{ boxShadow: '0 0 24px rgba(64,145,108,0.3)' }}>
            <Image
              src="/logotipo-removebg-preview.png"
              alt="RyzeSystems"
              width={40}
              height={40}
              className="object-contain"
            />
          </div>
          <div>
            <div className="text-white text-xl font-bold tracking-tight">RYZESYSTEMS</div>
            <div className="text-[#4A6B52] text-[11px] font-medium tracking-[0.2em] uppercase">Saúde Digital</div>
          </div>
        </div>

        {/* Center content */}
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-[#40916C]/15 border border-[#40916C]/25 rounded-full px-3 py-1 mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-[#40916C] animate-pulse" />
            <span className="text-[#52B788] text-xs font-medium tracking-wide">Dashboard Interno</span>
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Gestão completa<br />
            <span className="text-[#40916C]">em um só lugar</span>
          </h2>
          <p className="text-[#8BA891] text-base leading-relaxed max-w-sm">
            Clientes, projetos, contratos e finanças da agência centralizados para você e Vinícius.
          </p>

          {/* Feature list */}
          <div className="mt-8 space-y-3">
            {['Gestão de clientes e projetos', 'Controle financeiro em tempo real', 'Integração com Meta Ads'].map(feat => (
              <div key={feat} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[#40916C]/20 border border-[#40916C]/40 flex items-center justify-center flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#40916C]" />
                </div>
                <span className="text-[#8BA891] text-[13px]">{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative text-[#2A4030] text-[12px]">
          RyzeSystems · Acesso restrito · v1.0
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center bg-[#F8FBF9] p-8">
        <div className="w-full max-w-sm" style={{ animation: 'slideUp 0.4s ease-out' }}>
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center p-1 shadow-sm">
              <Image
                src="/logotipo-removebg-preview.png"
                alt="RyzeSystems"
                width={28}
                height={28}
                className="object-contain"
              />
            </div>
            <span className="font-bold text-gray-900 text-lg tracking-tight">RYZESYSTEMS</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Bem-vindo</h1>
            <p className="text-gray-500 text-sm">Entre com suas credenciais para acessar o dashboard.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field"
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#40916C] hover:bg-[#2D6A4F] text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              style={{ boxShadow: '0 4px 16px rgba(64,145,108,0.25)' }}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-[12px] text-gray-400 mt-8">
            Acesso restrito · RyzeSystems © 2026
          </p>
        </div>
      </div>
    </div>
  )
}
