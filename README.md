# vscode-ripgrep-with-github-api-error-fix

Same as [vscode-ripgrep](https://github.com/microsoft/vscode-ripgrep), but fixes the github rate limiting error `Downloading ripgrep failed: Error: Request failed: 403` by downloading the files directly instead of also using the github rest api.

## Install

```
$ npm install vscode-ripgrep-with-github-api-error-fix
```

## Usage

```js
import { rgPath } = from "vscode-ripgrep-with-github-api-error-fix"
import { spawn } from 'child_process'

const childProcess = spawn(rgPath, ["abc", "."], {
  stdio: "inherit",
});
```

## Gitpod

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io#https://github.com/SimonSiefke/vscode-ripgrep)
