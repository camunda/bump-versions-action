## Bumps versions by Search & Replace

### Setup

Add the following to your GitHub repository `.github/workflows/main.yml` to enable the action:

```yaml
name: Bump versions
on:
  workflow_dispatch:
    inputs:
      oldVersion:
        description: 'Old Version (search)'
        required: true
        default: '7.X.0'
      newVersion:
        description: 'New Version (replace)'
        required: true
        default: '7.X.0'
      ignoredFiles:
        description: 'Files to ignore (comma separated)'
        required: true
        default: 'README.md,**/package-lock.json'

jobs:
  bump-versions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Bump versions
        uses: camunda/bump-versions-action@v1
        with:
          path: "/examples"
          oldVersion: ${{ github.event.inputs.oldVersion }}
          newVersion: ${{ github.event.inputs.newVersion }}
          ignoredFiles: ${{ github.event.inputs.ignoredFiles }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

### License

The source files in this repository are made available under the [Apache License Version 2.0](./LICENSE).