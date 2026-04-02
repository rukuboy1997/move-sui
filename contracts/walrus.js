import { readFileSync, writeFileSync } from "fs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const MNEMONIC =
  "oppose empty receive once fit wrestle rail spy siege hat invite spin";
const PACKAGE_ID =
  "0x0232fe5b5497cec87f0ad865a7058ae1cc716bba553d66e0262cd59bbb75fc0c";
const SUI_RPC = "https://fullnode.testnet.sui.io:443";

const WALRUS_PUBLISHER =
  "https://publisher.walrus-testnet.walrus.space";
const WALRUS_AGGREGATOR =
  "https://aggregator.walrus-testnet.walrus.space";
const EPOCHS = 5; // store for 5 epochs

// ─── STEP 1: Upload content to Walrus ────────────────────────────────────────
async function uploadToWalrus(content) {
  console.log("\n📤 Uploading to Walrus...");

  const bytes =
    typeof content === "string" ? Buffer.from(content, "utf8") : content;

  const response = await fetch(
    `${WALRUS_PUBLISHER}/v1/blobs?epochs=${EPOCHS}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: bytes,
    }
  );

  if (!response.ok) {
    throw new Error(`Walrus upload failed: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();

  // Handle both newlyCreated and alreadyCertified responses
  const blobData =
    result.newlyCreated?.blobObject ?? result.alreadyCertified?.blobObject;

  if (!blobData) {
    throw new Error("Unexpected Walrus response: " + JSON.stringify(result));
  }

  return {
    blobId: blobData.blobId,
    blobObjectId: blobData.id,
    size: blobData.size,
    endEpoch: blobData.storage?.endEpoch,
    cost: result.newlyCreated?.cost ?? 0,
    raw: result,
  };
}

// ─── STEP 2: Link Blob ID to Sui contract ────────────────────────────────────
async function linkToSui(blobId) {
  console.log("\n🔗 Linking blob to Sui contract...");

  const keypair = Ed25519Keypair.deriveKeypair(MNEMONIC);
  const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl("testnet") });

  const tx = new Transaction();

  // Pass the Walrus blob ID as the post content (vector<u8>)
  const contentBytes = Array.from(Buffer.from(blobId, "utf8"));

  tx.moveCall({
    target: `${PACKAGE_ID}::social::create_post`,
    arguments: [tx.pure.vector("u8", contentBytes)],
  });

  const result = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true, showObjectChanges: true },
  });

  // Find the created Post object ID
  const postObject = result.objectChanges?.find(
    (c) => c.type === "created" && c.objectType?.includes("::social::Post")
  );

  return {
    digest: result.digest,
    postObjectId: postObject?.objectId ?? "check explorer",
    status: result.effects?.status?.status,
  };
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  MyWorld × Walrus Integration");
  console.log("═══════════════════════════════════════════");

  // Read the sample file
  const content = readFileSync("./sample.txt", "utf8");
  console.log(`\n📄 Content to upload (${content.length} bytes):\n${content}`);

  // 1. Upload to Walrus
  const walrusResult = await uploadToWalrus(content);

  console.log("\n✅ Blob Uploaded to Walrus!");
  console.log("   Blob ID:        ", walrusResult.blobId);
  console.log("   Blob Object ID: ", walrusResult.blobObjectId);
  console.log("   Size:           ", walrusResult.size, "bytes");
  console.log("   Stored until:   Epoch", walrusResult.endEpoch);
  console.log("   Cost:           ", walrusResult.cost, "MIST");

  // 2. Link to Sui contract
  const suiResult = await linkToSui(walrusResult.blobId);

  console.log("\n✅ Linked to Sui Contract!");
  console.log("   Transaction:    ", suiResult.digest);
  console.log("   Post Object ID: ", suiResult.postObjectId);
  console.log("   Status:         ", suiResult.status);

  console.log("\n═══════════════════════════════════════════");
  console.log("  🔗 Explorer Links");
  console.log("═══════════════════════════════════════════");
  console.log(
    `  Walrus Blob: ${WALRUS_AGGREGATOR}/v1/blobs/${walrusResult.blobId}`
  );
  console.log(
    `  Sui Txn:     https://testnet.suivision.xyz/txblock/${suiResult.digest}`
  );
  console.log(
    `  Post Object: https://testnet.suivision.xyz/object/${suiResult.postObjectId}`
  );

  // Save results for read.js
  const resultData = {
    blobId: walrusResult.blobId,
    blobObjectId: walrusResult.blobObjectId,
    suiTxDigest: suiResult.digest,
    postObjectId: suiResult.postObjectId,
    timestamp: new Date().toISOString(),
  };

  writeFileSync("./walrus_result.json", JSON.stringify(resultData, null, 2));
  console.log("\n💾 Results saved to walrus_result.json");
  console.log("   Run: node read.js   to verify retrieval");
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message ?? err);
  process.exit(1);
});
