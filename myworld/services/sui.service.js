import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';
import { PACKAGE_ID, MNEMONIC, SUI_RPC } from '../config.js';

const keypair = Ed25519Keypair.deriveKeypair(MNEMONIC);
const client = new SuiJsonRpcClient({ url: SUI_RPC });
export const senderAddress = keypair.getPublicKey().toSuiAddress();

async function signAndExecute(tx) {
  return client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true, showObjectChanges: true },
  });
}

export async function suiCreateProfile(username, bio) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::social::create_profile`,
    arguments: [
      tx.pure.vector('u8', Array.from(Buffer.from(username, 'utf8'))),
      tx.pure.vector('u8', Array.from(Buffer.from(bio, 'utf8'))),
    ],
  });
  return signAndExecute(tx);
}

export async function suiCreatePost(blobId, title) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::social::create_post`,
    arguments: [
      tx.pure.vector('u8', Array.from(Buffer.from(blobId, 'utf8'))),
      tx.pure.vector('u8', Array.from(Buffer.from(title, 'utf8'))),
    ],
  });
  const result = await signAndExecute(tx);
  const postObject = result.objectChanges?.find(
    c => c.type === 'created' && c.objectType?.includes('::social::Post')
  );
  return {
    digest: result.digest,
    postObjectId: postObject?.objectId ?? null,
    status: result.effects?.status?.status,
  };
}

export async function suiAddComment(postId, content) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::social::add_comment`,
    arguments: [
      tx.pure.id(postId),
      tx.pure.vector('u8', Array.from(Buffer.from(content, 'utf8'))),
    ],
  });
  return signAndExecute(tx);
}

export async function suiLikePost(postId) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::social::like_post`,
    arguments: [tx.pure.id(postId)],
  });
  return signAndExecute(tx);
}

export async function suiSendMessage(receiver, content) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::social::send_message`,
    arguments: [
      tx.pure.address(receiver),
      tx.pure.vector('u8', Array.from(Buffer.from(content, 'utf8'))),
    ],
  });
  return signAndExecute(tx);
}
