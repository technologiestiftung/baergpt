![](https://img.shields.io/badge/Built%20with%20%E2%9D%A4%EF%B8%8F-at%20Technologiestiftung%20Berlin-blue)

# BärGPT Backend

This project serves as the backend for the _BärGPT_ project.

It exposes various endpoints which are used to communicate with LLMs.

It allows for using the `mistral-small` LLM via Mistral API.

## Prerequisites

- Node.js (https://nodejs.org/en)
- NVM (https://github.com/nvm-sh/nvm)

## Development setup

- Install dependencies: `nvm install && nvm use` and `npm ci`
- Start database: `supabase start`
  - After running `supabase start`, several local services will be available:
    - **API**: http://localhost:54321
    - **Supabase Studio**: http://localhost:54323
    - **Mailpit (Email Testing Server)**: http://localhost:54324
      - When registering a new user in development, confirmation and password reset emails are sent to Mailpit instead of a real email address. Open [http://localhost:54324](http://localhost:54324) in your browser to view and access these emails, including registration confirmation links. Mailpit also exposes a JSON API on the same port (`/api/v1/messages`), which the e2e tests use to read the confirmation code.
- Manually enable _Database Publications_: Go to http://localhost:54323/project/default/database/publications -> on _Source_, enable the following tables:
  - `document_folders`
  - `documents`
- Prepare env variables by copying `.env.sample` to `.env` and setting the appropriate values
- Run the API: `npm run dev`
  - Alternatively run the API with Docker:
    - Initial build: `docker build -t baergpt-backend .`
    - Running the container the first time: `docker run -d --network host --name baergpt-backend --env-file ./.env baergpt-backend`
    - Subsequent runs: `docker start baergpt-backend`
- API is now running on `http://localhost:3000`

## Contributing

Before you create a pull request, write an issue so we can discuss your changes.

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!

This project is heavily influenced by:

- https://github.com/technologiestiftung/parla-api
- https://github.com/technologiestiftung/ber-gpt-backend

## Content Licensing

Texts and content available as [CC BY](https://creativecommons.org/licenses/by/3.0/de/).
