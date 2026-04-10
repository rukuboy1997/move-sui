module myworld::social {

    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;

    // =========================
    // Profile Object
    // =========================
    struct Profile has key {
        id: UID,
        owner: address,
        username: vector<u8>,
    }

    // =========================
    // Post Object (UPGRADED)
    // =========================
    struct Post has key {
        id: UID,
        owner: address,
        blob_id: vector<u8>,   // Walrus reference
        title: vector<u8>,     // NEW
        created_at: u64,       // NEW
        is_deleted: bool,
    }

    // =========================
    // Create Profile
    // =========================
    public entry fun create_profile(username: vector<u8>, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);

        let profile = Profile {
            id: object::new(ctx),
            owner: sender,
            username,
        };

        transfer::transfer(profile, sender);
    }

    // =========================
    // Create Post (UPDATED)
    // =========================
    public entry fun create_post(
        blob_id: vector<u8>,
        title: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);

        let post = Post {
            id: object::new(ctx),
            owner: sender,
            blob_id,
            title,
            created_at: tx_context::epoch(ctx),
            is_deleted: false,
        };

        transfer::transfer(post, sender);
    }

    // =========================
    // Update Post
    // =========================
    public entry fun update_post(
        post: &mut Post,
        new_blob_id: vector<u8>,
        new_title: vector<u8>,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);

        assert!(post.owner == sender, 0);
        assert!(!post.is_deleted, 1);

        post.blob_id = new_blob_id;
        post.title = new_title;
    }

    // =========================
    // Soft Delete Post
    // =========================
    public entry fun delete_post(post: &mut Post, ctx: &TxContext) {
        let sender = tx_context::sender(ctx);

        assert!(post.owner == sender, 0);

        post.is_deleted = true;
    }
}
