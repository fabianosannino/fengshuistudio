'use client'

export default function TermosDeUso() {
  return (
    <div style={{
      minHeight: '100vh', background: '#FAFAF9',
      fontFamily: "'Outfit', Arial, sans-serif", color: '#1a1a2e',
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:wght@400;700&display=swap');`}</style>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(165deg, #0f172a, #1E3A5F)',
        padding: '80px 32px 48px', textAlign: 'center',
      }}>
        <a href="/landing" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <span style={{ fontSize: '28px' }}>☯</span>
          <span style={{ fontFamily: "'Playfair Display', serif", color: '#C9A84C', fontSize: '22px', fontWeight: 700 }}>FengShui Studio</span>
        </a>
        <h1 style={{
          fontFamily: "'Playfair Display', serif", color: '#ffffff',
          fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, margin: '0 0 8px 0',
        }}>
          Termos de Uso
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px' }}>
          Última atualização: 15 de março de 2026
        </p>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 32px 80px' }}>
        {[
          {
            title: '1. Aceitação dos Termos',
            content: 'Ao acessar e utilizar a plataforma FengShui Studio, você concorda com estes Termos de Uso. Se você não concordar com algum dos termos aqui descritos, não utilize a plataforma.',
          },
          {
            title: '2. Descrição do Serviço',
            content: 'O FengShui Studio é uma plataforma digital voltada para consultores de Feng Shui e usuários pessoais, oferecendo ferramentas de gestão de clientes, diagnóstico Ba Gua, geração de relatórios PDF, calendário lunar e catálogo de produtos recomendados.',
          },
          {
            title: '3. Cadastro e Conta',
            content: 'Para utilizar a plataforma, é necessário criar uma conta com informações verdadeiras e atualizadas. Você é responsável por manter a confidencialidade de suas credenciais de acesso e por todas as atividades realizadas em sua conta.',
          },
          {
            title: '4. Planos e Pagamentos',
            content: 'A plataforma oferece um plano gratuito (Freemium) com funcionalidades limitadas e um plano pago (Pro) com acesso completo. Os valores, funcionalidades e limites de cada plano estão descritos na página de planos. Reservamo-nos o direito de alterar preços mediante aviso prévio de 30 dias.',
          },
          {
            title: '5. Uso Aceitável',
            content: 'Você concorda em não utilizar a plataforma para fins ilegais, não transmitir conteúdo ofensivo ou prejudicial, não tentar acessar contas de outros usuários e não realizar engenharia reversa do software.',
          },
          {
            title: '6. Propriedade Intelectual',
            content: 'Todo o conteúdo da plataforma, incluindo textos, gráficos, logos, ícones e software, é propriedade do FengShui Studio ou de seus licenciadores e está protegido pelas leis de propriedade intelectual brasileiras.',
          },
          {
            title: '7. Proteção de Dados',
            content: 'Tratamos seus dados pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD). Para mais detalhes sobre como coletamos, usamos e protegemos seus dados, consulte nossa Política de Privacidade.',
          },
          {
            title: '8. Limitação de Responsabilidade',
            content: 'O FengShui Studio é fornecido "como está". Não nos responsabilizamos por decisões tomadas com base nos diagnósticos gerados pela plataforma. Os relatórios e recomendações são ferramentas auxiliares e não substituem a análise profissional presencial.',
          },
          {
            title: '9. Cancelamento',
            content: 'Você pode cancelar sua conta a qualquer momento. Ao cancelar o plano Pro, você manterá acesso até o final do período já pago. Dados pessoais serão tratados conforme nossa Política de Privacidade.',
          },
          {
            title: '10. Alterações nos Termos',
            content: 'Podemos atualizar estes Termos de Uso periodicamente. Notificaremos os usuários sobre alterações significativas por e-mail ou através da plataforma. O uso continuado após as alterações constitui aceitação dos novos termos.',
          },
          {
            title: '11. Contato',
            content: 'Para dúvidas sobre estes Termos de Uso, entre em contato pelo e-mail contato@fengshuistudio.com.br.',
          },
        ].map((section, i) => (
          <div key={i} style={{ marginBottom: '32px' }}>
            <h2 style={{
              fontFamily: "'Playfair Display', serif", color: '#1E3A5F',
              fontSize: '20px', fontWeight: 700, margin: '0 0 12px 0',
            }}>
              {section.title}
            </h2>
            <p style={{
              color: '#4B5563', fontSize: '15px', lineHeight: 1.8, margin: 0,
            }}>
              {section.content}
            </p>
          </div>
        ))}

        <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '24px', marginTop: '16px' }}>
          <a href="/landing" style={{
            color: '#7C3AED', fontSize: '14px', fontWeight: 600, textDecoration: 'none',
          }}>← Voltar para a página inicial</a>
        </div>
      </div>
    </div>
  )
}
