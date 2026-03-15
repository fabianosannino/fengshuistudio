'use client'

export default function PoliticaPrivacidade() {
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
          Política de Privacidade
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px' }}>
          Última atualização: 15 de março de 2026
        </p>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 32px 80px' }}>
        {[
          {
            title: '1. Introdução',
            content: 'Esta Política de Privacidade descreve como o FengShui Studio coleta, utiliza, armazena e protege seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).',
          },
          {
            title: '2. Dados Coletados',
            content: 'Coletamos os seguintes dados: informações de cadastro (nome, e-mail, telefone, cidade, estado), dados profissionais (profissão, área de atuação, registro profissional, redes sociais), dados de uso da plataforma (consultas realizadas, relatórios gerados) e dados dos seus clientes que você cadastrar na plataforma.',
          },
          {
            title: '3. Finalidade do Tratamento',
            content: 'Seus dados são utilizados para: fornecer e manter o serviço, personalizar sua experiência, gerar relatórios e diagnósticos, processar pagamentos, enviar comunicações relevantes sobre o serviço e melhorar continuamente a plataforma.',
          },
          {
            title: '4. Base Legal',
            content: 'O tratamento dos seus dados pessoais é realizado com base no seu consentimento (ao criar a conta), na execução do contrato de prestação de serviço e no legítimo interesse do FengShui Studio em melhorar seus serviços.',
          },
          {
            title: '5. Compartilhamento de Dados',
            content: 'Não vendemos ou compartilhamos seus dados pessoais com terceiros para fins de marketing. Seus dados podem ser compartilhados com: provedores de infraestrutura (Supabase para banco de dados e autenticação), processadores de pagamento (quando aplicável) e autoridades governamentais quando exigido por lei.',
          },
          {
            title: '6. Rede de Parceiros',
            content: 'Se você é um profissional e ativa a opção "Aparecer na Rede de Parceiros", seus dados profissionais (nome, profissão, área de atuação, cidade e estado) ficarão visíveis para usuários pessoais da plataforma. Você pode desativar esta opção a qualquer momento no seu perfil.',
          },
          {
            title: '7. Segurança dos Dados',
            content: 'Utilizamos medidas técnicas e organizacionais para proteger seus dados, incluindo: criptografia em trânsito (HTTPS/TLS), autenticação segura com verificação por e-mail, isolamento de dados por usuário (Row Level Security) e backups regulares.',
          },
          {
            title: '8. Retenção de Dados',
            content: 'Seus dados são mantidos enquanto sua conta estiver ativa. Após o cancelamento da conta, os dados serão retidos por 30 dias para possibilitar a reativação. Após este período, os dados pessoais serão excluídos, exceto quando a retenção for necessária para cumprimento de obrigações legais.',
          },
          {
            title: '9. Seus Direitos (LGPD)',
            content: 'Você tem direito a: confirmar a existência de tratamento dos seus dados, acessar seus dados, corrigir dados incompletos ou desatualizados, solicitar a anonimização ou eliminação de dados desnecessários, solicitar a portabilidade dos dados e revogar o consentimento a qualquer momento.',
          },
          {
            title: '10. Cookies',
            content: 'Utilizamos cookies essenciais para o funcionamento da plataforma (autenticação e preferências como modo escuro). Não utilizamos cookies de rastreamento ou publicidade de terceiros.',
          },
          {
            title: '11. Alterações nesta Política',
            content: 'Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos os usuários sobre alterações significativas por e-mail ou através da plataforma.',
          },
          {
            title: '12. Contato do Encarregado (DPO)',
            content: 'Para exercer seus direitos ou esclarecer dúvidas sobre o tratamento de dados, entre em contato com nosso Encarregado de Proteção de Dados pelo e-mail privacidade@fengshuistudio.com.br.',
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
