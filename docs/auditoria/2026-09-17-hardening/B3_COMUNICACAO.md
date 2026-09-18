# B3 — comunicação pública verificável

Home e `/landing` passam a compartilhar a mesma página. Saem contagens de
usuários/consultas, avaliação e depoimentos sem comprovação, retorno financeiro
presumido, promessa de cancelamento em um clique e selos de conformidade.
Os destaques restantes descrevem recursos do produto.

Home e preços oferecem uma simulação com recebimento, custos e quantidade
informados pelo visitante. Campos vazios não viram zero; margem negativa,
quantidade fracionária e limites inválidos não produzem promessa de retorno.
O ciclo anual usa o equivalente mensal do catálogo e mantém o total anual
visível no cartão. Não há envio nem persistência das entradas da simulação.

O rodapé distingue assinatura, venda na loja e indicação externa com possível
comissão. Publica links para termos, privacidade e contato já usado pelo
produto. A entrega da caixa de suporte não foi testada; nenhuma mensagem foi
enviada. A clareza desses textos não constitui certificação jurídica.

Os testes de componente verificam o cálculo e a mudança de ciclo; não medem
contraste, entrega de e-mail ou a jornada financeira real.

Verificação local: 1.415 testes em 110 arquivos, typecheck e build aprovados.
Lint sem erros; removido o import que deixou de ser usado após a substituição
do banner. A revisão React conferiu estados derivados, rótulos associados aos
inputs, foco visível e atualização anunciada sem efeitos nem chamadas de rede.

PR #196 integrado após CI verde, commit `2bc239d`. Em navegador real na página
pública de preços: campos sintéticos 100/20/2 e seleção anual exibiram saldo
R$ 125,70, equivalente R$ 34,30, total anual R$ 411,60 e link de cadastro
preservando Profissional/yearly. Captura desktop inspecionada sem sobreposição
do simulador. Isto não atesta WCAG, responsividade completa nem jornada de
cobrança autenticada; nenhum checkout foi iniciado.
