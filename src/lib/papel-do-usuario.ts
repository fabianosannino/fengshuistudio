/**
 * Papel do usuário — quem atende clientes e quem cuida da própria casa.
 *
 * ## Por que existe
 *
 * `tipo_usuario` guarda cinco valores (`pessoal`, `arquiteto`, `feng_shui`,
 * `decorador`, `outro_profissional`) porque o cadastro pedia a profissão antes
 * de deixar o usuário entrar. Só que a profissão nunca decidiu nada no produto:
 * o que muda de fato é **se a pessoa atende clientes ou não** — o menu, a home,
 * a existência de carteira de clientes e cobrança.
 *
 * `isProfissional` de `plano-utils.ts` é outra coisa e continua sendo: ela
 * responde «este plano tem os recursos pagos?». Papel é sobre para quem a
 * pessoa trabalha; plano é sobre o que ela comprou. Um consultor no plano free
 * é `consultor` com recursos de free.
 *
 * Os cinco valores antigos continuam válidos e são lidos aqui — ninguém é
 * remigrado. `arquiteto`, `feng_shui`, `decorador` e `outro_profissional` são
 * todos «atende clientes»; só `pessoal` não é.
 */

export type Papel = 'consultor' | 'pessoal'

/** Valor gravado em `tipo_usuario` pelo cadastro novo. */
export const TIPO_CONSULTOR = 'consultor'
export const TIPO_PESSOAL = 'pessoal'

/**
 * Papel de um perfil.
 *
 * O padrão é `consultor`: quem chega sem `tipo_usuario` legível são as contas
 * antigas e as criadas por caminhos que não passam pelo cadastro (admin,
 * convite). Mostrar a elas a home reduzida do cliente final esconderia clientes
 * e consultas que existem de verdade — o erro caro é esse, não o contrário.
 */
export function papelDoUsuario(
  profile?: { tipo_usuario?: string | null; role?: string | null } | null
): Papel {
  if (!profile) return 'consultor'

  const tipo = (profile.tipo_usuario ?? '').trim().toLowerCase()
  if (tipo === TIPO_PESSOAL) return 'pessoal'
  if (tipo !== '') return 'consultor'

  // Sem `tipo_usuario`, `role` é a segunda fonte — foi o que o cadastro antigo
  // gravou junto.
  const role = (profile.role ?? '').trim().toLowerCase()
  if (role === TIPO_PESSOAL) return 'pessoal'
  return 'consultor'
}

/** Atalho de leitura: `papelDoUsuario(p) === 'pessoal'`. */
export function ehClienteFinal(
  profile?: { tipo_usuario?: string | null; role?: string | null } | null
): boolean {
  return papelDoUsuario(profile) === 'pessoal'
}

export interface OpcaoDePapel {
  id: Papel
  titulo: string
  descricao: string
}

/** As duas opções do cadastro, na ordem em que aparecem. */
export const OPCOES_DE_PAPEL: OpcaoDePapel[] = [
  {
    id: 'consultor',
    titulo: 'Atendo clientes',
    descricao: 'Carteira de clientes, consultas, relatórios com sua marca e cobrança.',
  },
  {
    id: 'pessoal',
    titulo: 'É para minha casa',
    descricao: 'Mapa Ba Guá do seu lar, curas passo a passo e acesso a consultores.',
  },
]

/** O que vai para `user_metadata` no cadastro. */
export function metadadosDoPapel(papel: Papel): { tipo_usuario: string; role: string } {
  return papel === 'pessoal'
    ? { tipo_usuario: TIPO_PESSOAL, role: TIPO_PESSOAL }
    : { tipo_usuario: TIPO_CONSULTOR, role: TIPO_CONSULTOR }
}
