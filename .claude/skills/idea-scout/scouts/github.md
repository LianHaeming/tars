# GitHub scout

Open-source projects in the space, and above all their **issues and discussions**: feature requests carry 👍
reactions, which are votes. `gh` is logged in; use `gh api` (the search API gives reaction counts, `gh search` doesn't).

1. **Find the projects.** Start from the brief's known products, then search:
   ```
   gh api -X GET search/repositories -f q='<phrase> in:name,description,readme' -f sort=stars -f per_page=15 \
     --jq '.items[]|"\(.stargazers_count)★ \(.full_name) — \(.description) (pushed \(.pushed_at[:10]))"'
   ```
   Try 3–5 phrasings, and topics (`topic:personal-finance`, `topic:language-learning`, …). Look for
   `awesome-<topic>` lists too: they're curated maps of the space. Pick the 4–8 most relevant, alive projects.
2. **Mine their feature requests**, most-wanted first:
   ```
   gh api -X GET search/issues -f q='repo:<owner>/<repo> <words> is:issue' -f sort=reactions -f order=desc -f per_page=20 \
     --jq '.items[]|"\(.reactions["+1"])👍 \(.comments)💬 [\(.state)] \(.title)\n   \(.html_url)"'
   ```
   Without `<words>` you get the repo's most-wanted issues overall; with them (`dashboard`, `report`, `chart`,
   `feature`, `idea`, the topic's own nouns) you get the relevant ones. Labels like `label:enhancement` or
   `label:"feature request"` help. Across many repos at once: `q='<words> is:issue label:enhancement'` sorted by
   reactions.
3. **Discussions** (ideas boards) where a repo uses them — GraphQL:
   ```
   gh api graphql -f query='{ search(query:"repo:<owner>/<repo> <words>", type:DISCUSSION, first:15) { nodes { ... on Discussion { title url upvoteCount comments{totalCount} category{name} } } } }'
   ```
4. **Read the top few** (`gh issue view <n> -R <owner>/<repo> --comments | head -80`) to get what people actually
   want and why, plus maintainers' reasons for declining.
5. Skim the READMEs (`gh api repos/<o>/<r>/readme --jq .content | base64 -d | head -120`) of the strongest projects
   for their feature lists: that's prior art.

Report the 👍 and 💬 counts as the signal. A closed issue marked completed means it was built; note that too.
