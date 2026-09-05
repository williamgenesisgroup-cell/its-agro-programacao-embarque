# IT'S AGRO · Programação de Embarque

Web app operacional para cadastrar classificadores e locais, montar programações de embarque, ordenar coletas, calcular horários regressivos, acompanhar a operação no mapa e compartilhar a rota pelo WhatsApp.

## O que já está funcionando

- Dashboard com próximos embarques, alertas e indicadores operacionais.
- CRUD de pessoas/classificadores e locais de embarque, com inativação sem apagar histórico.
- Tipos oficiais de local de embarque: `FAZENDA`, `ARMAZÉM` e `VAGÃO`; entradas `VAGAO` são canonizadas para `VAGÃO`.
- Programação por data, horário, destino, observações e pessoas selecionadas.
- Ordenação automática por coordenadas, reordenação manual por arrastar ou botões e endereço temporário por programação.
- Horário de coleta calculado de trás para frente, com antecedência de chegada e margem por parada.
- Mapa operacional responsivo com pins, status, filtros, ranking de proximidade, próximo destino e detalhe mobile.
- Inteligência logística opcional: compara o classificador mais distante da rota com um candidato disponível, mostra economia estimada de km/tempo/custo e registra aplicação ou recusa.
- Histórico com busca, filtros, abertura e duplicação de programações.
- WhatsApp em massa: uma única mensagem por programação, prévia, edição, cópia, modo resumido/completo e endereços opcionais.
- Indicador de sincronização online, detecção de conflito e migração idempotente do legado local.
- Marcadores Leaflet com SVG interno, número + nome resumido, destino identificado e snapshot do local na programação.
- O modelo já reserva `wagonNumber`/`wagon_number` opcional para futura identificação individual de vagões, sem campo obrigatório na interface atual.
- Layout mobile-first validável em 360, 390, 393, 412 e 430 px.

## Arquitetura

O front-end usa React 19 + TypeScript + Tailwind/Vinext. A camada de domínio está separada em `lib/route-service.ts` e `lib/logistics-service.ts`, permitindo trocar o estimador local por um provedor rodoviário sem reescrever a interface. A migration PostgreSQL/Supabase em `db/migrations/001_init.sql` normaliza pessoas, locais, programações, participantes, rotas, paradas e histórico de sugestões.

Em produção, o estado operacional é salvo no PostgreSQL compartilhado do Render através de `/api/state`, com versionamento, lock otimista, auditoria e RLS. O localStorage é usado somente em localhost ou como fonte legada para migração explícita/recuperação quando o banco estiver indisponível; ele não é a fonte principal da aplicação publicada.

## Estimativas e mapa

Sem um adaptador rodoviário ativo, a aplicação informa claramente `ESTIMATIVA RÁPIDA`: distância aproximada por coordenadas (linha geográfica ajustada e velocidade média), sem se passar por rota real. `buildRoutePlan` e `analyzeOperation` aceitam `calculationMode: 'real'` com um `realRouteCalculator` injetado, permitindo conectar OSRM, OpenRouteService ou Google Routes por endpoint server-side. O otimizador pode usar esse calculador com a mesma interface depois da etapa rápida de candidatos; nunca exponha chave ou segredo no cliente.

## Rodar localmente

Requisitos: Node `>=22.13.0` e pnpm.

```bash
pnpm install
pnpm dev
```

Comandos de verificação:

```bash
pnpm test
pnpm run lint
pnpm run build
```

O endpoint de saúde é `/api/health`.

## Variáveis e banco online

Copie `.env.example` para `.env.local` somente para desenvolvimento. No Render, `DATABASE_URL` é configurada como segredo pela conexão interna do PostgreSQL; não coloque esse valor no código ou no GitHub. A migration executada pela API está em `db/migrations/002_render_shared_state.sql` e é idempotente. A migration relacional legada `001_init.sql` foi preservada para compatibilidade Supabase, sem apagar estruturas existentes.

O endpoint `/api/health` confirma se o PostgreSQL está acessível e `/api/state` expõe somente o estado operacional necessário ao front-end. A API nunca devolve a senha da conexão.

## Publicação

O projeto inclui `render.yaml` para Render Web Service, `healthCheckPath` e um launcher que respeita a porta fornecida pelo Render. O fluxo esperado é:

1. Criar um repositório GitHub privado ou público e apontar o remote deste diretório.
2. Conectar o repositório no Render ou executar o Blueprint `render.yaml`.
3. Configurar o PostgreSQL e as variáveis secretas no Render.
4. Validar `/api/health`, o build publicado, sincronização entre navegadores e os fluxos de criação, otimização, troca, histórico e WhatsApp.

O app legado `BI EMBARQUES ITS` não foi removido nem alterado; esta é uma evolução separada para a operação de programação.
