![](https://img.shields.io/badge/Built%20with%20%E2%9D%A4%EF%B8%8F-at%20Technologiestiftung%20Berlin-blue)

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-1-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

# BärGPT 🐻

This is the monorepo for the BärGPT project.
You'll find here the [frontend](./apps/frontend), [backend](./apps/backend) and [admin-panel](./apps/admin-panel) code.

## Prerequisites

- the node version specified in the [`.nvmrc`](./.nvmrc) file
- the supabase-cli version specified in the [`.tool-versions`](./.tool-versions) file

## Installation

Run the following commands to install the dependencies:

```bash
npm ci
```

To use Turborepo, install it once globally:

```bash
npm install turbo --global
```

## Development

Run the following command to start what you need. You'll need some environment variables,
please check the .env.sample files in each app folder.

```bash
cd apps/frontend && npm run dev
```

```bash
cd apps/backed && npm run dev
```

```bash
cd apps/admin-panel && npm run dev
```

## Tests

You need to install playwright browsers and have supabase and the backend running for e2e tests to work.

```bash
npx playwright install --with-deps
```

Run the following command to execute the test suites:

```bash
cd apps/frontend && npm run test:e2e
```

```bash
cd apps/backend && npm run test
```

```bash
cd apps/admin-panel && npm run test:e2e
```

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
      <td align="center" valign="top" width="14.28%"><a href="http://www.awsm.de"><img src="https://avatars.githubusercontent.com/u/434355?v=4?s=64" width="64px;" alt="Ingo Hinterding"/><br /><sub><b>Ingo Hinterding</b></sub></a><br /><a href="#ideas-Esshahn" title="Ideas, Planning, & Feedback">🤔</a> <a href="#projectManagement-Esshahn" title="Project Management">📆</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!

## Content Licensing

Texts and content available as [CC BY](https://creativecommons.org/licenses/by/3.0/de/).

Illustrations by {MARIA_MUSTERFRAU}, all rights reserved.

## Credits

<table>
  <tr>
    <td>
      Made by <a href="https://citylab-berlin.org/de/start/">
        <br />
        <br />
        <img width="200" src="https://logos.citylab-berlin.org/logo-citylab-color.svg" alt="Link to the CityLAB Berlin website" />
      </a>
    </td>
    <td>
      A project by <a href="https://www.technologiestiftung-berlin.de/">
        <br />
        <br />
        <img width="150" src="https://logos.citylab-berlin.org/logo-technologiestiftung-berlin-de.svg" alt="Link to the Technologiestiftung Berlin website" />
      </a>
    </td>
    <td>
      Supported by <a href="https://www.berlin.de/rbmskzl/">
        <br />
        <br />
        <img width="80" src="https://logos.citylab-berlin.org/logo-berlin-senatskanzelei-de.svg" alt="Link to the Senate Chancellery of Berlin"/>
      </a>
    </td>
  </tr>
</table>

## Related Projects
