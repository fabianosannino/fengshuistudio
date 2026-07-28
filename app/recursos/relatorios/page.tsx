/* Design "Chi": subpágina Relatórios & Gestão de Clientes */
import type { Metadata } from 'next'
import { FileText, Users, Wallet } from 'lucide-react'
import FeaturePage from '../../components/marketing/FeaturePage'
import { ASSETS } from '../../components/marketing/assets'

export const metadata: Metadata = {
  title: 'Relatórios PDF & CRM — FengShui Studio',
  description:
    'Gere relatórios profissionais com a sua marca em um clique e acompanhe clientes, propostas e recebimentos sem sair da plataforma.',
}

export default function RecursoRelatorios() {
  return (
    <FeaturePage
      eyebrow="Recursos · Entrega & Gestão"
      title={
        <>
          O relatório que valoriza seu trabalho — e o CRM que organiza{' '}
          <span className="brush-underline">sua rotina</span>
        </>
      }
      subtitle="Gere documentos profissionais com a sua marca em um clique e acompanhe clientes, propostas e recebimentos sem sair da plataforma."
      heroImg={ASSETS.crm}
      heroAlt="Tela de clientes e financeiro com lista de clientes, status e recebimentos"
      benefits={[
        { icon: FileText, t: 'PDF com a sua marca', d: 'Capa personalizada, scores por setor e recomendações organizadas por prioridade.' },
        { icon: Users, t: 'CRM completo', d: 'Clientes com endereço por CEP automático, histórico de consultas e status de cada projeto.' },
        { icon: Wallet, t: 'Controle financeiro', d: 'Recebimentos, valores em aberto e a visão do mês em KPIs simples.' },
      ]}
      blocks={[
        {
          title: 'Uma entrega à altura dos seus honorários',
          text: 'O relatório é o que fica com o cliente — e o que ele mostra para amigos e família. Capa com o seu logo, tipografia elegante, mapa Ba Guá do imóvel, scores por setor e plano de ação classificado em urgente, melhoria e manutenção. Uma peça que justifica o valor da sua consultoria e gera indicações.',
          img: ASSETS.relatorioPdf,
          alt: 'Capa do relatório PDF premium com marca do consultor',
        },
        {
          title: 'Da proposta ao recebimento, tudo registrado',
          text: 'Cadastre clientes em segundos (o endereço vem sozinho pelo CEP), acompanhe cada consulta por status — proposta enviada, em andamento, concluída — e registre pagamentos com data e valor. Os KPIs do painel mostram recebimentos do mês e valores a receber, sem planilhas paralelas.',
          img: ASSETS.crm,
          alt: 'CRM com lista de clientes, badges de status e KPIs financeiros',
        },
      ]}
      faq={[
        { q: 'Posso personalizar o relatório com minha identidade visual?', a: 'Sim. Você adiciona seu logo e seus dados profissionais; no plano Profissional o relatório sai sem marca d\'água da plataforma.' },
        { q: 'O relatório é editável antes de enviar?', a: 'Você controla as observações e recomendações de cada setor antes de gerar o PDF, garantindo que o texto final tenha a sua voz.' },
        { q: 'O financeiro emite cobranças?', a: 'O módulo registra e organiza seus recebimentos. Para vender produtos e serviços com pagamento on-line, você pode ativar a Loja com Stripe.' },
      ]}
    />
  )
}
