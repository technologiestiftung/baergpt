![](https://img.shields.io/badge/Built%20with%20%E2%9D%A4%EF%B8%8F-at%20Technologiestiftung%20Berlin-blue)

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->

[![All Contributors](https://img.shields.io/badge/all_contributors-1-orange.svg?style=flat-square)](#contributors-)

<!-- ALL-CONTRIBUTORS-BADGE:END -->

# _BärGPT - AI chat assistant (v2)_

BärGPT is a productive AI testing environment available for employees of the Berlin state administration, provided by CityLAB Berlin. BärGPT is designed to help test the practical applications of artificial intelligence for administrative work. In addition to a generic chat function, BärGPT includes the possibility to upload documents. Those documents are pre-processed to allow features like searching, summarizing and translating.

## Why did we develop BärGPT?

In the spring of 2024, the Berlin Senate Chancellery convened an "AI Taskforce" and organized a series of workshops at CityLAB Berlin to discuss the potential applications of artificial intelligence in administrative work. During these discussions, it became clear that there was a need to provide employees with a low-threshold testing environment, allowing them to experiment with initial ideas in a protected setting. In response, CityLAB offered to establish such a platform.

## What should I keep in mind regarding data protection and data security?

### Large Language Models (LLMs)

BärGPT offers user the latest version in Mistral's "Small" model series. They are served by Mistral's own API which is served from a [data center in France](https://mistral.ai/products/mistral-compute) which falls under GDPR regulations. Input data is neither stored nor used for training purposes by Mistral. 

It is important to note that the used AI model is not operated within the Berlin state network. Therefore, personal or otherwise sensitive data, as well as data intended exclusively for use within the Berlin state network, must not be entered.

### Data Processing

BärGPT offers to upload PDF files, which are pre-processed to be able to offer features such as:

- Summarize the document
- Generate tags for the document
- Search in the documents

This processing relies on an external service called [Mistral OCR](https://mistral.ai/news/mistral-ocr). This service offers excellent processing (extraction of structured text from PDF files) and it is located in the EU and therefore follows existing GDPR laws of the EU.

It is important to note that the processing is not done within the Berlin state network. Therefore, personal or otherwise sensitive data, as well as data intended exclusively for use within the Berlin state network, must not be entered.

### Data storage

All data (chats, documents, your email address) is stored on cloud servers located in Germany. This is achieved by using [supabase.com](https://supabase.com/) option to host servers in the `Central EU (Frankfurt)` region.

It is important to note that the data is not stored within the Berlin state network. Therefore, personal or otherwise sensitive data, as well as data intended exclusively for use within the Berlin state network, must not be entered.

## Can BärGPT also be used for other use cases?

BärGPT is a flexible AI infrastructure and can, in principle, be adapted and further developed for various use cases and contexts. Do you have an idea for a specific use case where BärGPT could be helpful? If so, we would be happy to hear from you.

In line with the principle of "Public Money - Public Code," CityLAB Berlin releases all prototypes, including BärGPT, under an Open Source license. This means that BärGPT can and should be used and further developed without restrictions or prior permission. However, we would appreciate feedback if BärGPT is being used and are happy to assist with the initial steps.

## Getting started

Please note: This repository contains the frontend code for the BärGPT project. To setup the whole BärGPT suite locally or in deployment, also follow the steps in the README of the related projects:

- https://github.com/technologiestiftung/baer-gpt-v2-api-database
- https://github.com/technologiestiftung/baer-gpt-v2-data-processing

### Prerequisites

- Node.js / npm (https://nodejs.org/en)
- Completed setup of [baer-gpt-v2-api-database](https://github.com/technologiestiftung/baer-gpt-v2-api-database)
- Completed setup of [baer-gpt-v2-data-processing](https://github.com/technologiestiftung/baer-gpt-v2-data-processing)

### Development setup

Prepare required env variables:

- `cp .env.sample .env`
- The variables are set to their respective counterparts from the [baer-gpt-v2-api-database](https://github.com/technologiestiftung/baer-gpt-v2-api-database)

Install dependencies:

- `npm ci`

Run development server:

- `npm run dev`

Open [http://localhost:5173](http://localhost:5173) with your browser to see the application running.

### Deployment

You can deploy and run the BärGPT frontend on the platform of your choice.
We use [vercel.com](https://vercel.com), you can follow their step-by-step guides to deploy your version of BärGPT.

## Architecture / Data Flow

The following chart visualizes the flow of data and the overall architecture of the application. Not all possible frontend actions are visualized. The chart was created in this [internal Miro board](https://miro.com/app/board/uXjVNFAxyXE=/).

![Flow BärGPT v2](flow_baergpt_v2.jpg "Flow BärGPT v2")

## Related Projects

- https://github.com/technologiestiftung/baer-gpt-v2-api-database
- https://github.com/technologiestiftung/baer-gpt-v2-data-processing

## Previos projects (BärGPT v1)

- https://github.com/technologiestiftung/ber-gpt-frontend
- https://github.com/technologiestiftung/ber-gpt-backend

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
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Jaszkowic"><img src="https://avatars.githubusercontent.com/u/10830180?v=4?s=64" width="64px;" alt="Jonas Jaszkowic"/><br /><sub><b>Jonas Jaszkowic</b></sub></a><br /><a href="https://github.com/technologiestiftung/template-default/commits?author=Jaszkowic" title="Code">💻</a> <a href="#infra-Jaszkowic" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#ideas-Jaszkowic" title="Ideas, Planning, & Feedback">🤔</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!

This project is heavily influenced by and uses large parts of its code:

- https://github.com/technologiestiftung/ber-gpt-frontend

Thanks to all contributors of this influencing project.

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
