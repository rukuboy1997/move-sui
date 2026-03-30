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
    // Post Object
    // =========================
    struct Post has key {
        id: UID,
        owner: address,
        content: vector<u8>,
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
    // Create Post
    // =========================
    public entry fun create_post(content: vector<u8>, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);

        let post = Post {
            id: object::new(ctx),
            owner: sender,
            content,
            is_deleted: false,
        };

        transfer::transfer(post, sender);
    }

    // =========================
    // Update Post
    // =========================
    public entry fun update_post(post: &mut Post, new_content: vector<u8>, ctx: &TxContext) {
        let sender = tx_context::sender(ctx);

        // Only owner can update
        assert!(post.owner == sender, 0);

        // Cannot edit deleted post
        assert!(!post.is_deleted, 1);

        post.content = new_content;
    }

    // =========================
    // Soft Delete Post
    // =========================
    public entry fun delete_post(post: &mut Post, ctx: &TxContext) {
        let sender = tx_context::sender(ctx);

        // Only owner can delete
        assert!(post.owner == sender, 0);

        post.is_deleted = true;
    }
}
