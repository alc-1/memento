# Architecture decision records

One short file per decision that shapes the project, numbered in order: `NNNN-title.md`.
Each states the context, the decision and its consequences. A decision that changes gets a new
record that supersedes the old one; the old one stays, marked as superseded.

Template:

```
# NNNN. Title

Date: YYYY-MM-DD
Status: accepted | superseded by NNNN

## Context
## Decision
## Consequences
```

| # | Decision |
|---|----------|
| [0001](0001-generate-images-at-import.md) | Generate optimized images when a meme is added, not at every build (superseded by 0002) |
| [0002](0002-commit-generated-images.md) | Commit the generated images with each meme |
| [0003](0003-per-meme-share-pages.md) | A static page per meme behind the Share button |
