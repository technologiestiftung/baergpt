import Content from "../../content.ts";
import { config } from "../../config.ts";

export interface ConnectorDefinition {
	id: string;
	isEnabled: boolean;
	logo: string;
	logoAlt: string;
	name: string;
	description: string;
}

export const builtInConnectors: ConnectorDefinition[] = [
	{
		id: "parla",
		isEnabled: config.featureFlagMcpParlaAllowed,
		logo: "/icons/parla-logo-icon.svg",
		logoAlt: "",
		name: Content["connectors.parla.name"],
		description: Content["connectors.parla.description"],
	},
	{
		id: "open-data",
		isEnabled: config.featureFlagMcpOpenDataAllowed,
		logo: "/icons/berlin-open-data-logo-icon.svg",
		logoAlt: "",
		name: Content["connectors.openData.name"],
		description: Content["connectors.openData.description"],
	},
];

export const datawrapperConnector: ConnectorDefinition = {
	id: "datawrapper",
	isEnabled: config.featureFlagMcpDatawrapperAllowed,
	logo: "/icons/datawrapper-icon.svg",
	logoAlt: "",
	name: Content["connectors.datawrapper.name"],
	description: Content["connectors.datawrapper.description"],
};
