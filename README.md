# Escalas — Promessa Vila Camargo

Site (Next.js) para montar as escalas mensais dos cultos (quarta, sábado e
domingo). Cada **voluntário** tem seu próprio login e marca/desmarca a si
mesmo nas funções em que está habilitado, em `/escala`. Um **administrador**
escala qualquer pessoa em qualquer função, gerencia categorias/funções e
pessoas, e exporta a escala do mês em PDF, tudo em `/admin`.

Tudo fica salvo num banco Postgres próprio (grátis, via Neon) — o site fica
publicado de verdade na internet (Vercel), independente de qualquer
assinatura do Claude.

## Passo 1 — banco de dados (Neon, grátis)

1. Crie uma conta em https://neon.tech (dá pra entrar com GitHub/Google).
2. Crie um projeto novo, nomeie algo como `escalas-promessa`.
3. Copie a *connection string* que aparece (formato
   `postgresql://usuario:senha@host/dbname?sslmode=require`) → isso vai em
   `DATABASE_URL`.

## Passo 2 — variáveis de ambiente e instalar

```bash
cp .env.example .env
npm install
```

Preencha no `.env`:
- `SESSION_SECRET`: gere com `openssl rand -base64 32` (ou qualquer texto
  aleatório longo).
- `DATABASE_URL`: do Passo 1.
- `ADMIN_SEED_USERNAME` / `ADMIN_SEED_PASSWORD`: o primeiro login de
  administrador, criado automaticamente no Passo 3. Troque a senha em
  `/conta` assim que logar pela primeira vez.

## Passo 3 — criar as tabelas, a taxonomia padrão e o primeiro admin

```bash
npx prisma migrate dev --name init
npm run seed
```

O seed cria o usuário admin e, se ainda não existir nenhuma categoria,
também cria a taxonomia padrão (Direção e Palavra, Mídia, Transmissão, Som,
com as funções de cada uma). Rodar de novo depois não reseta nada que o
admin já tiver editado.

## Passo 4 — rodar local

```bash
npm run dev
```

Abre em http://localhost:3010. Login em `/login` (admin cai em `/admin`,
voluntário cai em `/escala`).

## Passo 5 — publicar (Vercel)

1. Suba este projeto para um repositório no GitHub.
2. Em https://vercel.com, **Add New > Project**, importe esse repositório.
3. Em **Environment Variables**, cole as mesmas variáveis do seu `.env`
   (`SESSION_SECRET`, `DATABASE_URL`, `ADMIN_SEED_USERNAME`,
   `ADMIN_SEED_PASSWORD`).
4. Deploy. Depois do primeiro deploy, rode uma vez (do seu computador,
   apontando `DATABASE_URL` pro banco de produção) para garantir que as
   tabelas existem:
   ```bash
   npx prisma migrate deploy
   npm run seed
   ```
5. Pronto — o link que a Vercel dá (ou um domínio próprio, se configurar um)
   é o link fixo pra mandar pros voluntários.

## Pegadinha de `.env`

O Next.js expande `$algumacoisa` dentro de `.env` como referência a outra
variável — se algum dia colar um segredo que comece com `$` direto ali,
escape cada `$` como `\$`, senão vira string vazia sem erro nenhum.

## Como funciona

- **Login**: usuário/senha por pessoa (Postgres via Prisma, senha com hash
  bcrypt), papel `ADMIN` ou `VOLUNTARIO`. Sessão em cookie JWT que guarda só
  o ID do usuário — papel, funções habilitadas e se a conta está ativa são
  sempre conferidos de novo no banco a cada página, então desativar alguém
  ou trocar suas funções vale já na próxima página que essa pessoa abrir.
- **`/admin/pessoas`** (só ADMIN): cria/edita categorias e funções, cadastra
  voluntários com nome + funções habilitadas + login opcional, ativa/
  desativa e redefine senha de qualquer um.
- **`/admin/escala`** (só ADMIN): quadro do mês (quarta/sábado/domingo),
  escala qualquer pessoa habilitada em qualquer função, exporta PDF (com
  aviso antes se houver função sem responsável).
- **`/escala`** (voluntário): mesmo quadro, mas só pode se marcar/desmarcar
  nas próprias funções habilitadas — não vê nem mexe no resto.
- **`/conta`**: qualquer pessoa troca a própria senha.
