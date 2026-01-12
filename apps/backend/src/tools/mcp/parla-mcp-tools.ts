import { createMCPClient, MCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import type { Tool } from "ai";

export interface ParlaMCPToolsResult {
	tools: Record<string, Tool>;
	cleanup: () => Promise<void>;
}

export const parlaMCPTools = async (): Promise<ParlaMCPToolsResult | null> => {
	let parlaLocalClient: MCPClient | undefined;
	//let clientTwo: MCPClient;
	//let clientThree: MCPClient;
	try {
		// Initialize an MCP client to connect to a `stdio` MCP server (local only):
		const transport = new Experimental_StdioMCPTransport({
			command: "node",
			args: ["/Users/maltebarth/Code/parla-mcp/dist/index.js"],
		});

		parlaLocalClient = await createMCPClient({
			transport,
		});
		// Connect to an HTTP MCP server directly via the client transport config
		/*const clientTwo = await createMCPClient({
            transport: {
            type: 'http',
            url: 'http://localhost:3000/mcp',

            // optional: configure headers
            // headers: { Authorization: 'Bearer my-api-key' },
            // optional: provide an OAuth client provider for automatic authorization
            // authProvider: myOAuthClientProvider,
            },
        });

        // Connect to a Server-Sent Events (SSE) MCP server directly via the client transport config
        const clientThree = await createMCPClient({
            transport: {
            type: 'sse',
            url: 'http://localhost:3000/sse',

            // optional: configure headers
            // headers: { Authorization: 'Bearer my-api-key' },
            // optional: provide an OAuth client provider for automatic authorization
            // authProvider: myOAuthClientProvider,
            },
        });

        // Alternatively, you can create transports with the official SDKs instead of direct config:
        // const httpTransport = new StreamableHTTPClientTransport(new URL('http://localhost:3000/mcp'));
        // clientTwo = await createMCPClient({ transport: httpTransport });
        // const sseTransport = new SSEClientTransport(new URL('http://localhost:3000/sse'));
        // clientThree = await createMCPClient({ transport: sseTransport });*/

		const parlaLocalToolSet = await parlaLocalClient.tools();
		//const toolSetTwo = await clientTwo.tools();
		//const toolSetThree = await clientThree.tools();
		const tools = {
			...parlaLocalToolSet,
			//...toolSetTwo,
			//...toolSetThree, // note: this approach causes subsequent tool sets to override tools with the same name
		};

		// Return tools and cleanup function instead of closing immediately
		return {
			tools: tools as Record<string, Tool>,
			cleanup: async () => {
				await Promise.all([
					parlaLocalClient?.close(),
					//clientTwo?.close(),
					//clientThree?.close(),
				]);
			},
		};
	} catch (error) {
		console.error("Error initializing MCP client:", error);
		return null;
	}
};
