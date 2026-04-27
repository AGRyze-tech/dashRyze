'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Mail, Trash2, UserPlus } from 'lucide-react'
import { inviteUser } from '@/app/actions/invite-user'

type Role = 'admin' | 'gerente' | 'visualizador'

interface Profile {
  id: string
  name: string | null
  role: Role
  created_at: string
}

const roleBadge: Record<Role, { label: string; cls: string }> = {
  admin:        { label: 'Admin',        cls: 'bg-purple-100 text-purple-700' },
  gerente:      { label: 'Gerente',      cls: 'bg-blue-100 text-blue-700' },
  visualizador: { label: 'Visualizador', cls: 'bg-gray-100 text-gray-600' },
}

const roleDescriptions: Record<Role, string> = {
  admin:        'Acesso total — gerencia usuários, financeiro e todas as áreas',
  gerente:      'Cria e edita clientes, projetos, contratos e leads',
  visualizador: 'Somente leitura em todas as áreas',
}

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState<'equipe' | 'perfil'>('equipe')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null)
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('visualizador')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState(false)

  const [profileName, setProfileName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)

  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setCurrentUser({ id: user.id, email: user.email ?? '' })

    const { data: profs } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at')

    setProfiles(profs ?? [])
    const mine = profs?.find(p => p.id === user.id) ?? null
    setCurrentProfile(mine)
    setProfileName(mine?.name ?? '')
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function handleRoleChange(profileId: string, role: Role) {
    await supabase.from('profiles').update({ role }).eq('id', profileId)
    setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, role } : p))
  }

  async function handleDelete(profile: Profile) {
    await supabase.from('profiles').delete().eq('id', profile.id)
    setProfiles(prev => prev.filter(p => p.id !== profile.id))
    setDeleteTarget(null)
  }

  async function handleInvite() {
    setInviting(true)
    setInviteError('')
    try {
      await inviteUser(inviteEmail, inviteName)
      // set role after user is created
      setInviteSuccess(true)
      setInviteEmail('')
      setInviteName('')
      setInviteRole('visualizador')
      setTimeout(() => {
        setInviteOpen(false)
        setInviteSuccess(false)
      }, 2000)
    } catch (e: unknown) {
      setInviteError(e instanceof Error ? e.message : 'Erro ao convidar usuário')
    } finally {
      setInviting(false)
    }
  }

  async function handleProfileSave() {
    if (!currentUser) return
    setProfileSaving(true)
    await supabase.from('profiles').update({ name: profileName }).eq('id', currentUser.id)
    setCurrentProfile(prev => prev ? { ...prev, name: profileName } : null)
    setProfileSaving(false)
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2500)
  }

  async function handleResetPassword() {
    if (!currentUser?.email) return
    await supabase.auth.resetPasswordForEmail(currentUser.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/configuracoes`,
    })
    alert('E-mail de redefinição enviado!')
  }

  if (loading) {
    return (
      <div>
        <Header title="Configurações" />
        <div className="p-6 flex items-center justify-center h-64 text-gray-400 text-sm">Carregando...</div>
      </div>
    )
  }

  return (
    <div>
      <Header title="Configurações" subtitle="Gerencie equipe e preferências" />

      <div className="p-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
          {(['equipe', 'perfil'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'equipe' ? 'Equipe' : 'Meu Perfil'}
            </button>
          ))}
        </div>

        {/* EQUIPE TAB */}
        {tab === 'equipe' && (
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-semibold text-gray-900">Membros da equipe</h2>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  {profiles.length} membro{profiles.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Button onClick={() => setInviteOpen(true)} size="sm">
                <UserPlus size={14} />
                Convidar
              </Button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {profiles.map(profile => (
                <div key={profile.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-9 h-9 rounded-full bg-[#40916C] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {(profile.name ?? '?').charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-gray-900 truncate">
                        {profile.name ?? 'Sem nome'}
                      </span>
                      {profile.id === currentUser?.id && (
                        <span className="text-[10px] font-medium bg-[#F0FBF5] text-[#40916C] px-2 py-0.5 rounded-full">
                          Você
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-gray-400">{roleDescriptions[profile.role]}</p>
                  </div>

                  {profile.id !== currentUser?.id ? (
                    <select
                      value={profile.role}
                      onChange={e => handleRoleChange(profile.id, e.target.value as Role)}
                      className="text-[13px] border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#40916C] bg-white cursor-pointer"
                    >
                      <option value="admin">Admin</option>
                      <option value="gerente">Gerente</option>
                      <option value="visualizador">Visualizador</option>
                    </select>
                  ) : (
                    <span className={`text-[12px] font-medium px-2.5 py-1 rounded-full ${roleBadge[profile.role].cls}`}>
                      {roleBadge[profile.role].label}
                    </span>
                  )}

                  {profile.id !== currentUser?.id && (
                    <button
                      onClick={() => setDeleteTarget(profile)}
                      className="p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Role legend */}
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
              <p className="text-[11px] font-semibold text-gray-500 mb-3 uppercase tracking-wider">Níveis de acesso</p>
              <div className="space-y-2">
                {(Object.entries(roleBadge) as [Role, { label: string; cls: string }][]).map(([role, { label, cls }]) => (
                  <div key={role} className="flex items-center gap-3">
                    <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full w-24 text-center flex-shrink-0 ${cls}`}>
                      {label}
                    </span>
                    <span className="text-[12px] text-gray-500">{roleDescriptions[role]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PERFIL TAB */}
        {tab === 'perfil' && (
          <div className="max-w-md space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="text-[15px] font-semibold text-gray-900">Informações pessoais</h2>

              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Nome</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#40916C] focus:ring-2 focus:ring-[#40916C]/10"
                  placeholder="Seu nome"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">E-mail</label>
                <input
                  type="email"
                  value={currentUser?.email ?? ''}
                  disabled
                  className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Cargo</label>
                <input
                  type="text"
                  value={currentProfile ? roleBadge[currentProfile.role].label : ''}
                  disabled
                  className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed"
                />
              </div>

              <Button onClick={handleProfileSave} loading={profileSaving} className="w-full">
                {profileSaved ? 'Salvo!' : 'Salvar alterações'}
              </Button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h2 className="text-[15px] font-semibold text-gray-900">Segurança</h2>
              <p className="text-[13px] text-gray-500">
                Um link de redefinição será enviado para o seu e-mail.
              </p>
              <Button variant="outline" onClick={handleResetPassword}>
                Redefinir senha
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* INVITE MODAL */}
      <Modal isOpen={inviteOpen} onClose={() => { setInviteOpen(false); setInviteError(''); setInviteSuccess(false) }} title="Convidar membro">
        {inviteSuccess ? (
          <div className="py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[#F0FBF5] flex items-center justify-center mx-auto mb-3">
              <Mail size={20} className="text-[#40916C]" />
            </div>
            <p className="text-[14px] font-medium text-gray-900">Convite enviado!</p>
            <p className="text-[12px] text-gray-500 mt-1">{inviteEmail}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Nome</label>
              <input
                type="text"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#40916C] focus:ring-2 focus:ring-[#40916C]/10"
                placeholder="Nome do colaborador"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">E-mail</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#40916C] focus:ring-2 focus:ring-[#40916C]/10"
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Cargo inicial</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as Role)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#40916C] bg-white"
              >
                <option value="gerente">Gerente</option>
                <option value="visualizador">Visualizador</option>
              </select>
            </div>
            {inviteError && (
              <p className="text-[12px] text-red-500 bg-red-50 px-3 py-2 rounded-lg">{inviteError}</p>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
              <Button onClick={handleInvite} loading={inviting} disabled={!inviteEmail || !inviteName}>
                <Mail size={14} />
                Enviar convite
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* DELETE CONFIRM MODAL */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remover membro" size="sm">
        <div className="space-y-4">
          <p className="text-[14px] text-gray-600">
            Tem certeza que deseja remover <strong>{deleteTarget?.name ?? 'este usuário'}</strong>?
            O acesso será revogado no próximo login.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="danger" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
              Remover
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
