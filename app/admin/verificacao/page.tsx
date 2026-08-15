/**
 * A tela do segundo fator do painel admin.
 *
 * Sem `AppShell` de propósito: quem cai aqui ainda **não** tem acesso ao
 * painel, e desenhar o menu em volta sugeriria o contrário. É a mesma razão de
 * `/pedido/[token]` não ter shell — a moldura conta uma história sobre onde a
 * pessoa está, e aqui ela está na porta.
 *
 * ## Quem decide o que esta tela mostra
 *
 * O Supabase, não uma prop. Ao montar, a tela pergunta se já existe um fator
 * verificado: se existe, pede o código; se não existe, começa o cadastro com o
 * QR. Passar essa decisão pela URL deixaria o estado divergir do real assim que
 * alguém abrisse a página com um link antigo — e o resultado seria um QR novo
 * para quem já tinha um fator, que é o caminho mais rápido de perder o acesso.
 *
 * ## O que esta tela não é
 *
 * Não é a proteção. A proteção está em `exigirAdmin`, no servidor, e no
 * middleware. Esta tela é a forma de **satisfazer** a exigência — se alguém a
 * pular, não ganha nada, porque nenhuma rota confia nela.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { supabase } from '../../../src/lib/supabase'
import { logger } from '../../../src/lib/logger'
import { ShieldCheck, TriangleAlert } from 'lucide-react'

/** O nome que aparece no app autenticador da pessoa. */
const NOME_DO_FATOR = 'FengShui Studio — Admin'

/** Um TOTP tem seis dígitos. Não é preferência de UI: é o formato. */
const DIGITOS_DO_CODIGO = 6

const ROTA_APOS_VERIFICAR = '/admin/pagamentos'

const inputStyle = {
  width: '100%', padding: '12px 14px', border: '1px solid #D1D5DB',
  borderRadius: '8px', fontSize: '20px', outline: 'none',
  boxSizing: 'border-box' as const, textAlign: 'center' as const,
  letterSpacing: '8px', fontVariantNumeric: 'tabular-nums' as const,
}

const botaoStyle = {
  width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
  background: '#2E7D6B', color: '#fff', fontSize: '15px',
  fontWeight: 'bold' as const, cursor: 'pointer', marginTop: '12px',
}

type Etapa = 'carregando' | 'cadastrar' | 'verificar' | 'indisponivel'

function Verificacao() {
  const router = useRouter()
  const params = useSearchParams()
  const [etapa, setEtapa] = useState<Etapa>('carregando')
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [segredo, setSegredo] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  /**
   * Prepara a tela: fator verificado → conferir; nenhum → cadastrar.
   *
   * Tentativas de cadastro abandonadas são removidas antes de abrir uma nova.
   * Sem isso, cada visita à tela deixa um fator `unverified` para trás, e o
   * Supabase passa a recusar novos cadastros por limite — com uma mensagem que
   * não diz que a causa foi essa.
   */
  const preparar = useCallback(async () => {
    try {
      const { data: fatores, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error

      const totp = fatores?.totp ?? []
      const verificado = totp.find((f) => f.status === 'verified')

      if (verificado) {
        setFactorId(verificado.id)
        setEtapa('verificar')
        return
      }

      for (const pendente of totp.filter((f) => f.status !== 'verified')) {
        await supabase.auth.mfa.unenroll({ factorId: pendente.id })
      }

      const { data: novo, error: erroDoCadastro } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: NOME_DO_FATOR,
      })
      if (erroDoCadastro) throw erroDoCadastro

      setFactorId(novo.id)
      setQrCode(novo.totp.qr_code)
      setSegredo(novo.totp.secret)
      setEtapa('cadastrar')
    } catch (e) {
      // Falha aqui quase sempre significa TOTP desabilitado no projeto. A tela
      // diz isso em vez de mostrar erro cru, porque o conserto é de config e
      // quem está lendo é quem tem acesso ao painel do Supabase.
      logger.error('Falha ao preparar o segundo fator', {
        erro: e instanceof Error ? e.message : 'desconhecido',
      })
      setEtapa('indisponivel')
    }
  }, [])

  useEffect(() => {
    if (params.get('estado') === 'indisponivel') {
      setEtapa('indisponivel')
      return
    }
    void preparar()
  }, [preparar, params])

  async function confirmar() {
    /*
     * Duas recusas, duas mensagens.
     *
     * As duas condições dividiam o mesmo texto, e as causas não são parecidas:
     * código curto é coisa de quem digita, `factorId` nulo é o cadastro que não
     * chegou a existir. Juntas, quem tivesse digitado os seis dígitos certos
     * leria uma instrução que acabou de cumprir — e ficaria tentando de novo
     * contra um problema que não é dele.
     *
     * Erro genérico ≠ erro enganoso (ADR 0019).
     */
    if (!factorId) {
      setErro('O cadastro não foi iniciado. Recarregue a página.')
      return
    }

    if (codigo.length !== DIGITOS_DO_CODIGO) {
      setErro(`Digite o código de ${DIGITOS_DO_CODIGO} dígitos.`)
      return
    }
    setEnviando(true)
    setErro('')
    try {
      const { data: desafio, error: erroDoDesafio } =
        await supabase.auth.mfa.challenge({ factorId })
      if (erroDoDesafio) throw erroDoDesafio

      const { error: erroDaVerificacao } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: desafio.id,
        code: codigo,
      })
      if (erroDaVerificacao) throw erroDaVerificacao

      // `refresh` antes de navegar: o middleware precisa reler a sessão, que
      // só agora subiu para aal2. Sem isso o redirecionamento volta para cá.
      router.refresh()
      router.replace(ROTA_APOS_VERIFICAR)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setErro(msg.includes('Invalid') ? 'Código inválido — tente novamente.' : 'Não foi possível verificar. Tente novamente.')
      setEnviando(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '20px', background: '#F9FAFB',
      fontFamily: 'var(--font-figtree), sans-serif',
    }}>
      <main style={{
        width: '100%', maxWidth: '420px', background: '#fff',
        border: '1px solid #E5E7EB', borderRadius: '14px', padding: '28px',
      }}>
        {etapa === 'carregando' && <p style={{ color: '#6B7280' }}>Carregando...</p>}

        {etapa === 'indisponivel' && (
          <>
            <TriangleAlert size={28} color="#B4533A" aria-hidden />
            <h1 style={{ fontSize: '18px', margin: '10px 0 8px' }}>
              Verificação em duas etapas indisponível
            </h1>
            {/*
              A tela afirmava «o TOTP está desabilitado no projeto Supabase».

              Ela não sabe disso. Este estado vem de `indeterminado`, que
              significa **não foi possível apurar o nível da sessão** — e a
              causa mais comum é sessão recém-criada, não configuração.

              Aconteceu em 15/08: o admin leu essa frase, foi conferir o painel
              do Supabase, e o TOTP estava habilitado — um fator foi cadastrado
              com sucesso minutos depois. A mensagem mandou consertar o que não
              estava quebrado, e escondeu a ação que resolvia: recarregar.

              Agora diz o que se sabe, na ordem do que custa menos tentar.
            */}
            <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: 1.6 }}>
              Não foi possível apurar o nível de segurança da sua sessão, e por
              isso o painel continua fechado.
            </p>
            <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: 1.6, marginTop: '10px' }}>
              <strong>Recarregue esta página.</strong> Logo depois de entrar, a
              sessão às vezes ainda não carrega esse nível, e uma segunda
              tentativa costuma resolver.
            </p>
            <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '12px', lineHeight: 1.6 }}>
              Se insistir, verifique se o TOTP está habilitado no projeto
              Supabase (<strong>Authentication → Multi-Factor</strong>). O motivo
              real fica registrado no log do servidor, com a mensagem original.
            </p>
            <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '12px', lineHeight: 1.6 }}>
              Se precisar entrar antes de corrigir, a exigência tem um
              interruptor de ambiente — está documentado no ADR 0033.
            </p>
            {/*
              Sem a query: `?estado=indisponivel` é o que trouxe para cá, e
              mantê-la faria o efeito devolver a esta mesma tela sem tentar
              nada. Recarregar com ela na URL é o botão que não faz nada.
            */}
            <button type="button" onClick={() => window.location.assign(window.location.pathname)} style={botaoStyle}>
              Tentar novamente
            </button>
          </>
        )}

        {(etapa === 'cadastrar' || etapa === 'verificar') && (
          <>
            <ShieldCheck size={28} color="#2E7D6B" aria-hidden />
            <h1 style={{ fontSize: '18px', margin: '10px 0 8px' }}>
              {etapa === 'cadastrar' ? 'Ativar verificação em duas etapas' : 'Verificação em duas etapas'}
            </h1>

            {etapa === 'cadastrar' && (
              <>
                <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: 1.6 }}>
                  O painel admin exige um segundo fator. Escaneie o QR no seu app
                  autenticador e digite o código de {DIGITOS_DO_CODIGO} dígitos.
                </p>
                {qrCode && (
                  <div style={{ background: '#fff', padding: '10px', display: 'flex', justifyContent: 'center', margin: '14px 0' }}>
                    {/*
                      `qr_code` do Supabase é uma **data URI**, não SVG cru:

                          data:image/svg+xml;utf-8,<svg …>

                      Injetado com `dangerouslySetInnerHTML`, o prefixo virava
                      texto solto na tela — «data:image/svg+xml;utf-8,» impresso
                      ao lado do QR — enquanto o `<svg>` seguinte renderizava por
                      acaso. Como imagem, o browser decodifica a URI inteira, que
                      é o que ela é. A CSP já libera `data:` em `img-src`.

                      De quebra some o `dangerouslySetInnerHTML`, que aqui nunca
                      foi necessário.
                    */}
                    {/* eslint-disable-next-line @next/next/no-img-element -- data URI: `next/image` não otimiza, e o QR já vem no tamanho final */}
                    <img src={qrCode} alt="QR code para cadastrar no app autenticador" width={200} height={200} />
                  </div>
                )}
                {segredo && (
                  <p style={{ fontSize: '11px', color: '#9CA3AF', wordBreak: 'break-all', marginBottom: '14px' }}>
                    Chave manual: {segredo}
                  </p>
                )}
              </>
            )}

            {etapa === 'verificar' && (
              <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: 1.6, marginBottom: '14px' }}>
                Digite o código do seu app autenticador.
              </p>
            )}

            <label htmlFor="codigo" style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#374151', marginBottom: '6px' }}>
              Código
            </label>
            <input
              id="codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, DIGITOS_DO_CODIGO))}
              onKeyDown={(e) => { if (e.key === 'Enter') void confirmar() }}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={DIGITOS_DO_CODIGO}
              placeholder="000000"
              style={inputStyle}
            />

            <button type="button" onClick={() => void confirmar()} disabled={enviando} style={{ ...botaoStyle, opacity: enviando ? 0.6 : 1 }}>
              {enviando ? 'Verificando...' : 'Confirmar'}
            </button>

            <p role="status" aria-live="polite" style={{ minHeight: '20px', fontSize: '13px', color: '#B4533A', marginTop: '10px' }}>
              {erro}
            </p>
          </>
        )}
      </main>
    </div>
  )
}

export default function VerificacaoDoAdmin() {
  return (
    <Suspense fallback={null}>
      <Verificacao />
    </Suspense>
  )
}
