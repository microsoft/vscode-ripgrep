# vscode-ripgrep-with-github-api-error-fix

Basically the same as [vscode-ripgrep](https://github.com/microsoft/vscode-ripgrep).

This fork fixes the github rate limiting error `Downloading ripgrep failed: Error: Request failed: 403` by downloading not using the github rest api and instead downloading the files directly.

### Usage example

```js
import { rgPath } = from "vscode-ripgrep-with-github-api-error-fix"

// child_process.spawn(rgPath, ...)
```
