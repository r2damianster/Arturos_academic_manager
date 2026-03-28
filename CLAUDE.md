# Custom Instructions for Claude Code

## Token Optimization (Windows Workaround)
Since the distill tool is currently incompatible with Windows, you MUST use Ollama to compress large outputs.

CRITICAL: If a command output is likely to be large (logs, tests, git diff), pipe it through this command:

**Bash/WSL:**
```
| ollama run llama3.2 "Summarize this output. Focus only on errors or relevant changes. Be extremely concise."
```

**PowerShell (Windows):**
```powershell
| Out-String | ForEach-Object { ollama run llama3.2 "Summarize this output. Focus only on errors or relevant changes. Be extremely concise. $_" }
```
