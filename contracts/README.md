# myWorld Social Contract - Sui Testnet

## Project Overview
A Sui Move smart contract for a decentralized social platform with Profile and Post objects.
Successfully deployed and verified on Sui Testnet.

## Contract Features
- **create_profile** – Creates a user profile with a username
- **create_post** – Creates a new post with content
- **update_post** – Updates post content (owner only)
- **delete_post** – Soft-deletes a post (owner only)

## Deployment Info
| Field | Value |
|---|---|
| Network | Sui Testnet |
| Package ID | `0x0232fe5b5497cec87f0ad865a7058ae1cc716bba553d66e0262cd59bbb75fc0c` |
| Module | `social` |
| Transaction | `DE8dyd4752FLcXaBzXMxJg7pmsQSsuLzPLvjbKaTJX2T` |
| Upgrade Cap | `0x834aa0ba2e4be35ebe601a452a16fb2e81ea593975fe6c1b6c323110bdf9aba0` |
| Gas Used | 9,514,280 MIST (~0.0095 SUI) |
| Deploy Date | Mar 30, 2026 |

## Explorer Links
- **Package:** https://testnet.suivision.xyz/package/0x0232fe5b5497cec87f0ad865a7058ae1cc716bba553d66e0262cd59bbb75fc0c
- **Transaction:** https://testnet.suivision.xyz/txblock/DE8dyd4752FLcXaBzXMxJg7pmsQSsuLzPLvjbKaTJX2T
- **SuiScan:** https://suiscan.xyz/testnet/object/0x0232fe5b5497cec87f0ad865a7058ae1cc716bba553d66e0262cd59bbb75fc0c

## Wallet
- **Address:** `0x2598d09dd5113dc4c2abd298c3c08597eb4d1848d5633667854a05535f4d66ed`
- **Network:** Sui Testnet

## Project Structure
```
contracts/
  Move.toml          # Package config (legacy edition)
  sources/
    social.move      # Main contract
  build/             # Compiled artifacts
  README.md            # This file
```

## Tools
- Sui CLI v1.68.1 at `/home/runner/.local/bin/sui`
- RPC: `https://fullnode.testnet.sui.io:443`
