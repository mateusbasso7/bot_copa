# Bot Copa 2026

Bot de Discord no estilo album da Copa, refatorado para rodar na **Vercel** via **Discord Interactions webhook** e persistir dados em **Firebase Firestore**.

## Arquitetura

- `api/interactions.js`: endpoint que recebe slash commands e botoes do Discord
- `api/health.js`: endpoint simples de healthcheck
- `src/app.js`: roteamento das interacoes
- `src/game/album-service.js`: regras do jogo
- `src/discord-ui.js`: embeds e componentes
- `src/storage/firestore-store.js`: persistencia em Firestore
- `src/storage/json-store.js`: fallback local para desenvolvimento
- `src/deploy-commands.js`: registro dos comandos slash

## O que o bot faz

- Pacotes com jogadores aleatorios
- Album paginado com filtros
- Visao por selecao
- Favoritos
- Perfil do colecionador
- Ranking
- Conquistas
- Comparacao entre colecoes
- Trocas com botoes de aceitar/recusar
- Historico de trocas
- Preview do catalogo

## Variaveis de ambiente

Copie `.env.example` para `.env` no desenvolvimento local.

- `DISCORD_TOKEN`: token do bot
- `DISCORD_CLIENT_ID`: application ID do app
- `DISCORD_GUILD_ID`: servidor para registrar comandos de teste
- `DISCORD_PUBLIC_KEY`: public key do app no Discord
- `STORAGE_DRIVER`: use `firestore` na Vercel
- `FIREBASE_SERVICE_ACCOUNT_JSON`: JSON completo da service account em uma linha
- `SKIP_DISCORD_SIGNATURE`: apenas para desenvolvimento local manual

## Desenvolvimento local

1. Instale as dependencias:

```bash
npm install
```

2. Registre os comandos no servidor:

```bash
npm run deploy:commands
```

3. Suba o servidor local:

```bash
npm start
```

O servidor local sobe em `http://localhost:3000`.

## Deploy na Vercel

1. Crie um projeto na Vercel e conecte este repositorio.
2. Configure as env vars:
   - `DISCORD_TOKEN=<seu_token_do_bot>`
   - `DISCORD_CLIENT_ID=<application_id>`
   - `DISCORD_GUILD_ID=<guild_id_de_teste>`
   - `DISCORD_PUBLIC_KEY=<public_key_do_discord>`
   - `STORAGE_DRIVER=firestore`
   - `FIREBASE_SERVICE_ACCOUNT_JSON=<json_da_service_account_em_uma_linha>`

Exemplo de `FIREBASE_SERVICE_ACCOUNT_JSON`:

```json
{"type":"service_account","project_id":"seu-projeto","private_key_id":"<private_key_id>","private_key":"<private_key_pem_com_\\\\n_escapado>","client_email":"bot@seu-projeto.iam.gserviceaccount.com","client_id":"<client_id>","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/bot%40seu-projeto.iam.gserviceaccount.com","universe_domain":"googleapis.com"}
```

3. Faça o deploy.
4. Copie a URL publicada da rota:

```text
https://seu-projeto.vercel.app/api/interactions
```

5. No Discord Developer Portal, configure essa URL em `General Information > Interactions Endpoint URL`.

## Firestore

Estrutura usada:

- `users/{discordUserId}`
- `meta/app`
- `trades/{tradeId}`

Se `STORAGE_DRIVER` nao estiver definido como `firestore`, o bot usa `data/users.json` localmente.

## Comandos

### Basicos

- `/ping`
- `/iniciar`
- `/pacote`

### Album e colecao

- `/album`
  - filtros: `pais`, `raridade`, `status`
- `/selecao`
  - opcao: `pais`
- `/repetidas`
- `/catalogo`
  - filtros: `pais`, `raridade`

### Perfil e progresso

- `/perfil`
- `/ranking`
- `/conquistas`

### Favoritos

- `/favorito alternar`
- `/favorito listar`

### Social

- `/comparar`
- `/trocar`
- `/historico`

## Validacao

```bash
npm run check
```

## Observacoes

- O bot nao usa mais conexao persistente com Gateway; agora responde por webhook HTTP.
- Para testes em servidor real, os comandos continuam sendo registrados com `npm run deploy:commands`.
- Se o token do bot foi exposto em algum momento, gere um novo no Discord Developer Portal.
