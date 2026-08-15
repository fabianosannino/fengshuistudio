/**
 * O segundo fator do painel admin — a decisão, separada da I/O.
 *
 * ## Por que o painel precisa de um segundo fator
 *
 * O que mora atrás de `/admin` não é configuração: é a geração de chaves de
 * ativação, a promoção de usuário a admin, o catálogo que a loja cobra e a
 * reconciliação que corrige pedido. Uma senha vazada entrega tudo isso de uma
 * vez, e senha vaza — por reuso, por phishing, por máquina comprometida.
 *
 * ## Por que a decisão está aqui e não junto do Supabase
 *
 * Porque a parte que erra não é a chamada à API: é o **encadeamento**. «Tem
 * fator, mas ainda não verificou nesta sessão» e «não tem fator nenhum» levam a
 * telas diferentes, e confundir os dois produz ou um cadastro duplicado ou uma
 * tela pedindo código que o usuário não tem como gerar. Isolado aqui, isso é
 * testável sem projeto Supabase, sem rede e sem sessão.
 *
 * ## A referência que não seguimos
 *
 * O Ervatório resolveu isto antes, e resolveu no cliente:
 *
 * ```js
 * catch(e){
 *   console.warn('[admin-mfa] indisponível, prosseguindo sem MFA:', e);
 *   return true;   // ← libera
 * }
 * ```
 *
 * São dois defeitos no mesmo bloco. O primeiro é **falhar aberto**: qualquer
 * erro na consulta do fator — rede instável, projeto mal configurado, resposta
 * inesperada — vira acesso liberado, que é exatamente o contrário do que um
 * segundo fator existe para fazer. O segundo é a verificação viver **só no
 * navegador**: quem chama a rota direto não passa por nenhum `if`.
 *
 * Aqui a falha é fechada e nomeada (`indeterminado`), e quem decide é o
 * servidor. Desligar o MFA é possível, mas exige dizer isso em voz alta — ver
 * `MFA_DESLIGADO_POR_CONFIG`.
 */

/**
 * O nível de garantia da sessão, no vocabulário do Supabase.
 *
 * - `aal1` — a pessoa provou a senha;
 * - `aal2` — provou a senha **e** o segundo fator.
 */
export type NivelDeGarantia = 'aal1' | 'aal2'

/**
 * O que fazer com quem está batendo na porta do admin.
 *
 * `precisa_verificar` e `precisa_cadastrar` são estados diferentes de propósito:
 * o primeiro tem um app autenticador configurado e só precisa digitar o código;
 * o segundo ainda vai escanear o QR. Uma resposta só para os dois obrigaria a
 * tela a adivinhar, e adivinhar erra na primeira vez que alguém troca de
 * celular.
 */
export type AcessoAoAdmin =
  | 'liberado'
  | 'precisa_verificar'
  | 'precisa_cadastrar'
  | 'indeterminado'

/**
 * O que o Supabase responde em `mfa.getAuthenticatorAssuranceLevel()`.
 *
 * `currentLevel` é o que a sessão **é** agora; `nextLevel` é o máximo que ela
 * **pode alcançar** — e é ele, não uma listagem de fatores, que diz se existe
 * um fator verificado. Os dois vêm nulos quando a consulta falha.
 */
export interface NiveisDaSessao {
  currentLevel: NivelDeGarantia | null
  nextLevel: NivelDeGarantia | null
}

/** O nível que o painel exige. Não é configurável: um segundo fator é aal2. */
export const NIVEL_EXIGIDO: NivelDeGarantia = 'aal2'

/**
 * O interruptor de nível 1 — variável de ambiente, não botão de admin.
 *
 * Esta é a distinção que a Fase 0 estabelece e que vale para os quatro portais:
 * **se desligar é medida de proteção, mora em variável de ambiente; se ligar é
 * decisão comercial, mora numa chave que o admin vira.** O segundo fator é do
 * primeiro grupo, e por um motivo circular que precisa ser dito: um MFA que o
 * painel desliga é um MFA que quem invadiu o painel desliga.
 *
 * O padrão é **exigir**. A ausência da variável não afrouxa nada — é o valor
 * `'false'`, escrito de propósito, que afrouxa.
 *
 * ## O que exatamente para de acontecer quando desligada
 *
 * O painel volta a aceitar sessão `aal1`: senha basta. Nenhuma outra proteção
 * muda — papel continua sendo conferido, RLS continua valendo, auditoria
 * continua registrando. É só o segundo fator que sai.
 *
 * ## Quando desligar é legítimo
 *
 * Quando o TOTP está desabilitado no projeto Supabase e o painel precisa ser
 * alcançado **agora** para religá-lo. É um caminho de recuperação, não um
 * modo de operação: religar é a mesma variável, e o `logger` registra que o
 * painel rodou sem segundo fator enquanto isso durou.
 */
export const VARIAVEL_DO_INTERRUPTOR = 'ADMIN_MFA_OBRIGATORIO'

/** Só a string exata desliga. Qualquer outro valor — inclusive lixo — exige. */
export const MFA_DESLIGADO_POR_CONFIG = 'false'

/**
 * O MFA está exigido? Lê a variável de ambiente com o padrão fechado.
 *
 * Recebe o valor em vez de ler `process.env` diretamente para que o teste possa
 * exercer os casos sem mexer no ambiente do processo — inclusive o caso que mais
 * importa, que é a variável ausente.
 */
export function mfaExigido(valorDaVariavel: string | undefined): boolean {
  return valorDaVariavel !== MFA_DESLIGADO_POR_CONFIG
}

/**
 * A decisão, em uma função pura.
 *
 * A tabela inteira, para que a leitura não dependa de seguir os `if`:
 *
 * | exigido | current | next | resultado |
 * |---|---|---|---|
 * | não | qualquer | qualquer | `liberado` |
 * | sim | `aal2` | `aal2` | `liberado` |
 * | sim | `aal1` | `aal2` | `precisa_verificar` |
 * | sim | `aal1` | `aal1` | `precisa_cadastrar` |
 * | sim | `null` | qualquer | `indeterminado` |
 *
 * A última linha é a que separa esta implementação da do Ervatório: nível
 * desconhecido **não** vira acesso. Se não deu para saber, não deu para
 * liberar.
 */
export function decidirAcesso(
  niveis: NiveisDaSessao,
  exigido: boolean
): AcessoAoAdmin {
  if (!exigido) return 'liberado'

  const { currentLevel, nextLevel } = niveis
  if (currentLevel === null || nextLevel === null) return 'indeterminado'

  if (currentLevel === NIVEL_EXIGIDO) return 'liberado'

  // Chegou aqui com `aal1`. O que decide a tela é existir ou não um fator
  // verificado — e é isso que `nextLevel === 'aal2'` significa.
  return nextLevel === NIVEL_EXIGIDO ? 'precisa_verificar' : 'precisa_cadastrar'
}

/**
 * A rota onde o segundo fator é cadastrado e conferido.
 *
 * Fica fora de `/admin/*` na guarda para não criar o laço que se fecha sozinho:
 * uma tela de verificação protegida pela exigência de verificação redireciona
 * para si mesma até o navegador desistir.
 */
export const ROTA_DE_VERIFICACAO = '/admin/verificacao'

/**
 * Esta rota está isenta da exigência de `aal2`?
 *
 * Só a de verificação, e por comparação exata — um `startsWith` deixaria
 * `/admin/verificacao-de-qualquer-coisa` entrar de carona numa isenção que
 * ninguém releu.
 */
export function isentaDeMfa(caminho: string): boolean {
  return caminho === ROTA_DE_VERIFICACAO
}

/**
 * O código que a resposta HTTP carrega quando falta o segundo fator.
 *
 * A rota devolve 403 com este código no corpo para que o cliente saiba levar à
 * verificação em vez de mostrar «acesso restrito» a quem **é** admin e só não
 * confirmou o código ainda. É o ADR 0019: erro genérico não pode ser erro
 * enganoso.
 */
export const CODIGO_MFA_PENDENTE = 'mfa_pendente'
