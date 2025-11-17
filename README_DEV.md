![](https://img.shields.io/badge/Built%20with%20%E2%9D%A4%EF%B8%8F-at%20Technologiestiftung%20Berlin-blue)

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->

[![All Contributors](https://img.shields.io/badge/all_contributors-0-orange.svg?style=flat-square)](#contributors-)

<!-- ALL-CONTRIBUTORS-BADGE:END -->

# <img src="https://raw.githubusercontent.com/technologiestiftung/baergpt/refs/heads/main/apps/frontend/public/logos/baergpt-logo.svg?token=GHSAT0AAAAAADPA7IA6FNQI4HW26GZXL7NW2I3AMBQ" width="170px" >

![Screenshot of _Gieß den Kiez_](public/screenshots/beargpt_ui.png)

# BärGPT Dev Setup

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
