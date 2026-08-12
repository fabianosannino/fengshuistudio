# ADR 0026 — Fila offline da vistoria: última escrita vence, nada é descartado

- **Status:** Aceito
- **Data:** 2026-08-12
- **Relaciona-se com:** ADR 0019 (erro genérico ≠ erro enganoso), ADR 0023 (degradação declarada)

## Contexto

A vistoria acontece andando pela casa do cliente: porão, banheiro, fundo do
corredor, área de serviço. É exatamente onde o celular perde sinal.

Com escrita direta ao Supabase, cada marcação feita sem sinal falha e some. O
consultor não vê nada — a interface já mostrou o item marcado — e só descobre ao
voltar para o escritório e encontrar o checklist como o deixou de manhã.

## Decisão

**Toda marcação entra numa fila em `localStorage` antes de qualquer tentativa de
rede** (`src/lib/fila-offline.ts`). A tela nunca espera pela rede para mostrar o
resultado; a sincronização acontece por trás, disparada pelo evento `online` do
navegador e por um botão explícito.

`localStorage` e não memória porque a fila precisa sobreviver a fechar o
navegador, ficar sem bateria e ao recarregamento que o iOS faz sozinho com o app
em segundo plano.

### Última escrita vence, por chave

Marcar «conforme» e depois «problema» no mesmo item deixa **uma** entrada, a
última. Guardar as duas daria o mesmo resultado no caso feliz e o resultado
**errado** se chegassem fora de ordem — e fora de ordem é o padrão quando a rede
volta e várias requisições saem juntas.

A chave é `<consultaId>:<campo>`, e o valor é o estado completo daquele campo.
Isso torna cada entrada idempotente: reenviar não faz mal.

### O que falha permanece na fila

Uma entrada descartada por erro de rede é indistinguível, do lado do consultor,
de uma marcação que ele nunca fez. `sincronizar` só remove da fila o que o
servidor confirmou; o resto fica e é tentado de novo.

### Falha ao enfileirar é dita, não engolida

`enfileirar` devolve `false` quando `localStorage` recusa (cota estourada, modo
privativo). A tela mostra o aviso e diz para ficar com sinal — sem isso, a
promessa «sincroniza depois» viraria promessa falsa, que é pior que não ter
promessa nenhuma.

### Foto não entra na fila

Um blob de 3 MB por item encheria a cota de 5 MB do `localStorage` na terceira
foto, e **falhar em gravar a fila é pior que não ter fila**: derrubaria também
as marcações do checklist, que são o trabalho principal.

A tela declara isso em vez de prometer: «fotos precisam de conexão — elas não
cabem na memória do navegador». Se um dia isso mudar, o caminho é IndexedDB, não
aumentar a fila atual.

## Consequências

- A fila é por consulta: sincronizar uma não mexe na fila de outra.
- JSON corrompido (aba fechada no meio da escrita) vira fila vazia, não exceção.
  Travar a tela com a fila seria pior que perder a fila.
- O indicador no cabeçalho — «salvo», «N na fila», «offline» — é informação, não
  decoração: é ele que diz se o trabalho da última meia hora está seguro.
