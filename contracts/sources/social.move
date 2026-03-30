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
}
