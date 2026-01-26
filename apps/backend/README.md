![](https://img.shields.io/badge/Built%20with%20%E2%9D%A4%EF%B8%8F-at%20Technologiestiftung%20Berlin-blue)

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->

[![All Contributors](https://img.shields.io/badge/all_contributors-1-orange.svg?style=flat-square)](#contributors-)

<!-- ALL-CONTRIBUTORS-BADGE:END -->

# BärGPT v2 Backend

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
    - **Inbucket (Email Testing Server)**: http://localhost:54324
      - When registering a new user in development, confirmation and password reset emails are sent to Inbucket instead of a real email address. Open [http://localhost:54324](http://localhost:54324) in your browser to view and access these emails, including registration confirmation links.
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

## Contributors

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Jaszkowic"><img src="https://avatars.githubusercontent.com/u/10830180?v=4?s=64" width="64px;" alt="Jonas Jaszkowic"/><br /><sub><b>Jonas Jaszkowic</b></sub></a><br /><a href="https://github.com/technologiestiftung/baer-got-v2-api-database/commits?author=Jaszkowic" title="Code">💻</a> <a href="#infra-Jaszkowic" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#ideas-Jaszkowic" title="Ideas, Planning, & Feedback">🤔</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!

This project is heavily influenced by:

- https://github.com/technologiestiftung/parla-api
- https://github.com/technologiestiftung/ber-gpt-backend

Thanks to all contributors of those influencing projects.

## Content Licensing

Texts and content available as [CC BY](https://creativecommons.org/licenses/by/3.0/de/).

## Credits

<table>
  <tr>
    <td>
      Made by <a href="https://citylab-berlin.org/de/start/">
        <br />
        <br />
        <img width="200" src="https://logos.citylab-berlin.org/logo-citylab-berlin.svg" />
      </a>
    </td>
    <td>
      A project by <a href="https://www.technologiestiftung-berlin.de/">
        <br />
        <br />
        <img width="150" src="https://logos.citylab-berlin.org/logo-technologiestiftung-berlin-de.svg" />
      </a>
    </td>
    <td>
      Supported by <a href="https://www.berlin.de/rbmskzl/">
        <br />
        <br />
        <img width="80" src="https://logos.citylab-berlin.org/logo-berlin-senatskanzelei-de.svg" />
      </a>
    </td>
  </tr>
</table>

just a test, will revert after
