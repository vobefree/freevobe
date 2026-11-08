import type { RegisteredTool } from './types.js';
import { fsTools } from './fs.js';
import { runTerminalCommandTool } from './terminal.js';
import { runTestsTool } from './tests.js';
import { gitTools } from './git.js';
import { webFetchTool } from './web.js';
import { browserTools } from './browser.js';
import { askUserTool } from './askuser.js';
import { proposePlanTool } from './plan.js';
import { runVerificationTool } from './verify.js';
import { mediaTools } from './media.js';
import { taskTools } from './tasks.js';
import { previewTools } from './preview.js';

/** Alla inbyggda verktyg. MCP-verktyg registreras separat när servrarna ansluts. */
export const builtinTools: RegisteredTool[] = [
  ...fsTools,
  runTerminalCommandTool,
  runTestsTool,
  ...gitTools,
  webFetchTool,
  ...browserTools,
  askUserTool,
  proposePlanTool,
  runVerificationTool,
  ...mediaTools,
  ...taskTools,
  ...previewTools,
];

export * from './types.js';
export * from './registry.js';
export * from './browser.js';
export { parseGitStatus, buildCommitMessagePrompt, type GitStatusSummary } from './git.js';
export { parseTestCounts } from './tests.js';
export { runVerificationTool, listVerificationSteps } from './verify.js';
export { htmlToText } from './web.js';
export { taskTools, todoWriteTool, runSubagentTool } from './tasks.js';
export { previewTools, previewCheckTool } from './preview.js';
