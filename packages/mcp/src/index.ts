import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerWeaveTools } from './tools.js'

const server = new McpServer({
  name: 'weaver',
  version: '0.1.0',
})

registerWeaveTools(server)

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Weaver MCP server running on stdio')
}

main().catch((err) => {
  console.error('Weaver MCP server error:', err)
  process.exit(1)
})
