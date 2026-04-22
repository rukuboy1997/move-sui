module myworld::social {

    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;

    // =========================
    // Profile
    // =========================
    struct Profile has key {
        id: UID,
        owner: address,
        username: vector<u8>,
        bio: vector<u8>,
    }

    // =========================
    // Post
    // =========================
    struct Post has key {
        id: UID,
        owner: address,
        blob_id: vector<u8>,
        title: vector<u8>,
        created_at: u64,
        is_deleted: bool,
    }

    // =========================
    // Comment
    // =========================
    struct Comment has key {
        id: UID,
        post_id: ID,
        owner: address,
        content: vector<u8>,
    }

    // =========================
    // Like
    // =========================
    struct Like has key {
        id: UID,
        post_id: ID,
        owner: address,
    }

    // =========================
    // Message (Chat)
    // =========================
    struct Message has key {
        id: UID,
        sender: address,
        receiver: address,
        content: vector<u8>,
        created_at: u64,
    }

    // =========================
    // Create Profile
    // =========================
    public entry fun create_profile(
        username: vector<u8>,
        bio: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let profile = Profile {
            id: object::new(ctx),
            owner: sender,
            username,
            bio,
        };
        transfer::transfer(profile, sender);
    }

    // =========================
    // Create Post
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

    // =========================
    // Add Comment
    // =========================
    public entry fun add_comment(
        post_id: ID,
        content: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let comment = Comment {
            id: object::new(ctx),
            post_id,
            owner: sender,
            content,
        };
        transfer::transfer(comment, sender);
    }

    // =========================
    // Like Post
    // =========================
    public entry fun like_post(
        post_id: ID,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let like = Like {
            id: object::new(ctx),
            post_id,
            owner: sender,
        };
        transfer::transfer(like, sender);
    }

    // =========================
    // Send Message (Chat)
    // =========================
    public entry fun send_message(
        receiver: address,
        content: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let message = Message {
            id: object::new(ctx),
            sender,
            receiver,
            content,
            created_at: tx_context::epoch(ctx),
        };
        transfer::transfer(message, sender);
    }
}
