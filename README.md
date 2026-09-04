# IT'S AGRO · Programação de Embarque

Web app operacional para cadastrar classificadores e locais, montar programações de embarque, ordenar coletas, calcular horários regressivos, acompanhar a operação no mapa e compartilhar a rota pelo WhatsApp.

## O que já está funcionando

- Dashboard com próximos embarques, alertas e indicadores operacionais.
- CRUD de pessoas/classificadores e locais de embarque, com inativação sem apagar histórico.
- Programação por data, horário, destino, observações e pessoas selecionadas.
- Ordenação automática por coordenadas, reordenação manual por arrastar ou botões e endereço temporário por programação.
- Horário de coleta calculado de trás para frente, com antecedência de chegada e margem por parada.
- Mapa operacional responsivo com pins, status, filtros, ranking de proximidade, próximo destino e detalhe mobile.
- Inteligência logística opcional: compara o classificador mais distante da rota com um candidato disponível, mostra economia estimada de km/tempo/custo e registra aplicação ou recusa.
- Histórico com busca, filtros, abertura e duplicação de programações.
- Layout mobile-first validável em 360, 390, 393, 412 e 430 px.

## Arquitetura

O front-end usa React 19 + TypeScript + Tailwind/Vinext. A camada de domínio está separada em `lib/route-service.ts` e `lib/logistics-service.ts`, permitindo trocar o estimador local por um provedor rodoviário sem reescrever a interface. A migration PostgreSQL/Supabase em `db/migrations/001_init.sql` normaliza pessoas, locais, programações, participantes, rotas, paradas e histórico de sugestões.

Enquanto não há credenciais de produção, o navegador usa localStorage apenas em localhost e carrega dados de demonstração. Os dados persistem no navegador e não são enviados a terceiros. O modo de produção deve conectar o contrato da migration a Supabase/PostgreSQL e adicionar autenticação do operador.

## Estimativas e mapa

Sem `GOOGLE_MAPS_API_KEY`, a aplicação informa claramente que usa distância aproximada por coordenadas (linha geográfica ajustada e velocidade média). Não existe chave falsa no código. Para distância rodoviária, tempo real, trânsito e polilinha de provedor, configure a chave e substitua o adaptador em `lib/route-service.ts` por um endpoint server-side; nunca exponha segredo no cliente.

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

## Variáveis e Supabase

Copie `.env.example` para `.env.local` e preencha somente em ambiente local ou no provedor de deploy. Aplique `db/migrations/001_init.sql` no SQL Editor do Supabase. Em produção, defina `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GOOGLE_MAPS_API_KEY` e `NEXT_PUBLIC_APP_URL` no painel de segredos. As policies de RLS já estão habilitadas para usuários autenticados; a autenticação é a próxima camada antes de substituir o armazenamento local.

## Publicação

O projeto inclui `render.yaml` para Render Web Service, `healthCheckPath` e um launcher que respeita a porta fornecida pelo Render. O fluxo esperado é:

1. Criar um repositório GitHub privado ou público e apontar o remote deste diretório.
2. Conectar o repositório no Render ou executar o Blueprint `render.yaml`.
3. Configurar as variáveis no Render e aplicar a migration no Supabase.
4. Validar `/api/health`, o build publicado e os fluxos de criação, otimização, troca, histórico e WhatsApp.

O app legado `BI EMBARQUES ITS` não foi removido nem alterado; esta é uma evolução separada para a operação de programação.
