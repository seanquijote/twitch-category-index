# twitch-games-list

A complete, automatically-synced dataset of every game on Twitch — including game ID, name, box art URL, and IGDB ID.

Inspired from [Nerothos/TwithGameList](https://github.com/Nerothos/TwithGameList) and extended with automated daily syncing via GitHub Actions.

![Sync Status](https://github.com/seanquijote/twitch-games-list/actions/workflows/sync-twitch-games.yml/badge.svg)

---

## Data

The dataset lives in `data/games.json` and is automatically updated every day at **00:00 UTC** by fetching from the [Twitch Helix API](https://dev.twitch.tv/docs/api/reference/#get-top-games).

### JSON structure

```json
{
  "meta": {
    "last_synced": "2026-04-05T00:00:00.000Z",
    "total": 58000,
    "source": "https://api.twitch.tv/helix/games/top"
  },
  "games": [
    {
      "id": "509658",
      "name": "Just Chatting",
      "box_art_url": "https://static-cdn.jtvnw.net/ttv-boxart/509658-{width}x{height}.jpg",
      "igdb_id": null
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Twitch game ID |
| `name` | `string` | Game display name |
| `box_art_url` | `string` | Box art URL template — replace `{width}` and `{height}` with pixel dimensions |
| `igdb_id` | `string \| null` | IGDB ID, if available |

### Box art URL usage

Box art URLs use `{width}x{height}` placeholders rather than hardcoded dimensions. Replace them at runtime with whatever size you need:

```js
const url = game.box_art_url
  .replace('{width}', 285)
  .replace('{height}', 380);
```

Common sizes used by Twitch: `52x72`, `188x250`, `285x380`, `600x800`.

### Legacy files

The following files from the original upstream repo are retained for backwards compatibility:

| File | Description |
|---|---|
| `game_info.json` | Original JSON snapshot (static, not auto-updated) |
| `game_info.csv` | CSV with comma delimiter |
| `game_info_semicolon.csv` | CSV with semicolon delimiter |
| `game_info.sql` | MySQL/MariaDB dump |

For any new integration, prefer `data/games.json` as it is the actively maintained source of truth.

---

## Automated sync

A [GitHub Actions workflow](.github/workflows/sync-twitch-games.yml) runs daily and keeps `data/games.json` current.

### How it works

1. Authenticates with Twitch via the [Client Credentials flow](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow) — no user login required.
2. Paginates through `GET /helix/games/top` (100 games per page) until the cursor is exhausted.
3. Merges new and updated entries into the existing dataset — nothing is deleted, only added or updated.
4. Commits the result only if the data actually changed, keeping the git history clean.

### Manual trigger

You can trigger a sync at any time from the **Actions** tab. There is also a **Full Resync** option that ignores existing data and re-fetches everything from scratch — useful if the dataset gets corrupted or you want to force a clean rebuild.

### Required secrets

Set these in your repo under **Settings → Secrets and variables → Actions**:

| Secret | Description |
|---|---|
| `TWITCH_CLIENT_ID` | Your Twitch application client ID |
| `TWITCH_CLIENT_SECRET` | Your Twitch application client secret |

Register a Twitch application at [dev.twitch.tv/console](https://dev.twitch.tv/console) to obtain these credentials. The app doesn't need any special scopes — the games endpoint is public and only requires an app access token.

---

## Local development

### Prerequisites

- Node.js 18 or later
- A registered Twitch application (see above)

### Setup

```bash
git clone https://github.com/seanquijote/twitch-games-list.git
cd twitch-games-list
npm install
```

### Run the sync script locally

```bash
TWITCH_CLIENT_ID=your_client_id \
TWITCH_CLIENT_SECRET=your_client_secret \
node scripts/sync.js
```

To force a full resync from scratch:

```bash
TWITCH_CLIENT_ID=your_client_id \
TWITCH_CLIENT_SECRET=your_client_secret \
FULL_RESYNC=true \
node scripts/sync.js
```

The script writes output to `data/games.json`.

---

## Repository structure

```
.
├── .github/
│   └── workflows/
│       └── sync-twitch-games.yml   # Daily sync workflow
├── data/
│   └── games.json                  # Auto-updated dataset (primary)
├── lib/
│   └── api.js                      — fetchAllGames (pagination)
│   └── auth.js                     — getAccessToken (Twitch OAuth)
│   └── config.js                   — All constants and resolved file-system paths
│   └── http.js                     — httpsGet, httpsPost, sleep (no business logic)
│   └── store.js                    — readData, buildOutput, writeData (all fs usage)
│   └── transform.js                — normaliseGame, mergeGames (pure, zero I/O)
│   └── types.js                    — JSDoc @typedefs only (Game, RawGame, GamesOutput, etc.)
├── scripts/
│   └── sync.js                     # Sync script
├── tests/
│   └── sync.test.js                # Sync script unit test
├── .env.example                    # Sample .env file
├── .gitignore
├── LICENSE
├── package.json
├── package-lock.json
└── README.md
```

---

## Contributing

Pull requests are welcome. For bugs or suggestions, please [open an issue](https://github.com/seanquijote/twitch-games-list/issues).

If you notice the data is stale or a sync has failed, check the [Actions tab](https://github.com/seanquijote/twitch-games-list/actions) for workflow run logs.

---

## Credits

Original dataset and concept by [Nerothos](https://github.com/Nerothos/TwithGameList).

## License

[MIT](LICENSE)
