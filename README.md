# vscode-ripgrep-with-github-api-error-fix

Basically the same as [vscode-ripgrep](https://github.com/microsoft/vscode-ripgrep).

This fork fixes the github rate limiting error `Downloading ripgrep failed: Error: Request failed: 403` by downloading the files directly instead of also using the github rest api.

### Usage example

```js
import { rgPath } = from "vscode-ripgrep-with-github-api-error-fix"

// child_process.spawn(rgPath, ...)
```
