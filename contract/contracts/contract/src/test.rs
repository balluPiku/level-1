#![cfg(test)]
use super::*;
use soroban_sdk::{
    symbol_short, testutils::Address as _, testutils::Ledger, vec, Address, Env, IntoVal, String,
    Val,
};

fn register_token(env: &Env) -> Address {
    let sac = env.register_stellar_asset_contract_v2(Address::generate(env));
    sac.address()
}

fn mint_tokens(env: &Env, token_addr: &Address, to: &Address, amount: i128) {
    let args: Vec<Val> = vec![&env, to.into_val(env), amount.into_val(env)];
    let _: () = env.invoke_contract(token_addr, &symbol_short!("mint"), args);
}

#[test]
fn test_create_and_get_bounty() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let token = register_token(&env);
    mint_tokens(&env, &token, &creator, 1000i128);

    client.create_bounty(
        &creator,
        &String::from_str(&env, "Fix Bug #42"),
        &String::from_str(&env, "Fix the login bug"),
        &token,
        &100i128,
        &9999999999u64,
    );

    let bounty = client.get_bounty(&0);
    assert!(bounty.is_some());
    let b = bounty.unwrap();
    assert_eq!(b.title, String::from_str(&env, "Fix Bug #42"));
    assert_eq!(b.reward, 100i128);
    assert_eq!(b.paid, false);

    let count = client.get_bounty_count();
    assert_eq!(count, 1);
}

#[test]
fn test_submit_and_vote() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let submitter = Address::generate(&env);
    let token = register_token(&env);
    mint_tokens(&env, &token, &creator, 1000i128);

    client.create_bounty(
        &creator,
        &String::from_str(&env, "Write Docs"),
        &String::from_str(&env, "Write API docs"),
        &token,
        &200i128,
        &9999999999u64,
    );

    client.submit(
        &submitter,
        &0,
        &String::from_str(&env, "https://docs.example.com"),
    );

    let subs = client.get_submissions(&0);
    assert_eq!(subs.len(), 1);
    assert_eq!(
        subs.get(0).unwrap().1.url,
        String::from_str(&env, "https://docs.example.com")
    );
    assert_eq!(subs.get(0).unwrap().1.votes, 0);

    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);
    client.vote(&voter1, &0, &0);
    client.vote(&voter2, &0, &0);

    let subs2 = client.get_submissions(&0);
    assert_eq!(subs2.get(0).unwrap().1.votes, 2);
}

#[test]
fn test_accept_and_payout() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let submitter = Address::generate(&env);
    let token = register_token(&env);
    mint_tokens(&env, &token, &creator, 1000i128);

    client.create_bounty(
        &creator,
        &String::from_str(&env, "Design Logo"),
        &String::from_str(&env, "Design our logo"),
        &token,
        &300i128,
        &9999999999u64,
    );

    client.submit(&submitter, &0, &String::from_str(&env, "https://logo.png"));

    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);
    client.vote(&voter1, &0, &0);
    client.vote(&voter2, &0, &0);

    env.ledger().set_timestamp(10000000000u64);
    client.accept(&0);

    let bounty = client.get_bounty(&0).unwrap();
    assert!(bounty.paid);

    let subs = client.get_submissions(&0);
    assert!(subs.get(0).unwrap().1.accepted);
}

#[test]
#[should_panic(expected = "deadline not reached")]
fn test_accept_before_deadline_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let submitter = Address::generate(&env);
    let token = register_token(&env);
    mint_tokens(&env, &token, &creator, 1000i128);

    client.create_bounty(
        &creator,
        &String::from_str(&env, "Test Bounty"),
        &String::from_str(&env, "Description"),
        &token,
        &100i128,
        &9999999999u64,
    );
    client.submit(&submitter, &0, &String::from_str(&env, "https://work.com"));

    let voter = Address::generate(&env);
    client.vote(&voter, &0, &0);

    client.accept(&0);
}

#[test]
#[should_panic(expected = "already voted")]
fn test_double_vote_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let voter = Address::generate(&env);
    let token = register_token(&env);
    mint_tokens(&env, &token, &creator, 1000i128);

    client.create_bounty(
        &creator,
        &String::from_str(&env, "Test"),
        &String::from_str(&env, "Desc"),
        &token,
        &100i128,
        &9999999999u64,
    );
    client.submit(&voter, &0, &String::from_str(&env, "https://sub.com"));

    client.vote(&voter, &0, &0);
    client.vote(&voter, &0, &0);
}

#[test]
fn test_multiple_bounties() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let token = register_token(&env);
    mint_tokens(&env, &token, &creator, 10000i128);

    client.create_bounty(
        &creator,
        &String::from_str(&env, "Bounty One"),
        &String::from_str(&env, "First bounty"),
        &token,
        &50i128,
        &9999999999u64,
    );
    client.create_bounty(
        &creator,
        &String::from_str(&env, "Bounty Two"),
        &String::from_str(&env, "Second bounty"),
        &token,
        &75i128,
        &9999999999u64,
    );

    assert_eq!(client.get_bounty_count(), 2);
    assert_eq!(
        client.get_bounty(&0).unwrap().title,
        String::from_str(&env, "Bounty One")
    );
    assert_eq!(
        client.get_bounty(&1).unwrap().title,
        String::from_str(&env, "Bounty Two")
    );
}

#[test]
fn test_multiple_submissions_and_votes() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let sub1 = Address::generate(&env);
    let sub2 = Address::generate(&env);
    let v1 = Address::generate(&env);
    let v2 = Address::generate(&env);
    let v3 = Address::generate(&env);
    let token = register_token(&env);
    mint_tokens(&env, &token, &creator, 1000i128);

    client.create_bounty(
        &creator,
        &String::from_str(&env, "Best Design"),
        &String::from_str(&env, "Open competition"),
        &token,
        &500i128,
        &9999999999u64,
    );

    client.submit(&sub1, &0, &String::from_str(&env, "https://design-a.com"));
    client.submit(&sub2, &0, &String::from_str(&env, "https://design-b.com"));

    client.vote(&v1, &0, &0);
    client.vote(&v2, &0, &0);
    client.vote(&v3, &0, &1);

    env.ledger().set_timestamp(10000000000u64);
    client.accept(&0);

    let subs = client.get_submissions(&0);
    assert!(subs.get(0).unwrap().1.accepted);
    assert!(!subs.get(1).unwrap().1.accepted);
}
