# Subagent dispatch contract

Read this file completely before any named or generic subagent dispatch. Role-specific inputs, isolation, concurrency, and main-session fallback limits remain in the calling skill.

## Provider capability gate

If the active model provider is identified as Amazon Bedrock, treat subagents as unavailable and do not invoke either the named or generic path. Codex's current Bedrock transport can reject multi-agent input before an agent starts.

If provider identity was not visible in advance and an attempted dispatch returns `validation_error` with `Invalid 'input': value did not match any expected variant`, do not retry with the named agent, a generic agent, or a different role. Mark subagents unavailable for the rest of the command and use the calling skill's main-session fallback, recording the isolation limitation.

## Dispatch chain

1. Invoke the named agent when the client can discover it.
2. Otherwise resolve the calling skill's `${CLAUDE_PLUGIN_ROOT}/agents/*.md` file to an **absolute path** and instruct a generic read-only subagent to read that file completely and follow it.
3. Do not load the agent file into the main session or paste its full text into the initial dispatch prompt. Pass task inputs separately and require only the agent file's existing output contract, never an instruction echo, raw input dump, or exploratory transcript.
4. If the generic subagent cannot read the absolute path, fall back once to passing the file's full text so capability is preserved, and record that path-based context isolation was unavailable.
5. If neither dispatch path is available, follow the calling skill's role-specific main-session fallback.
