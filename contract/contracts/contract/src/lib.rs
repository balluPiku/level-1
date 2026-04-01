#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Map, String, Vec};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    BountyCount,
    Bounty(u64),
    Submissions(u64),
    Votes(u64, u64),
}

#[contracttype]
#[derive(Clone)]
pub struct Bounty {
    pub title: String,
    pub description: String,
    pub token: Address,
    pub reward: i128,
    pub deadline: u64,
    pub creator: Address,
    pub submission_count: u32,
    pub vote_count: u32,
    pub paid: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct Submission {
    pub url: String,
    pub submitter: Address,
    pub votes: u32,
    pub accepted: bool,
}

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    pub fn create_bounty(
        env: Env,
        creator: Address,
        title: String,
        description: String,
        token: Address,
        reward: i128,
        deadline: u64,
    ) {
        creator.require_auth();
        assert!(reward > 0, "reward must be positive");
        assert!(
            deadline > env.ledger().timestamp(),
            "deadline must be in the future"
        );

        let count_key = DataKey::BountyCount;
        let bounty_id = env
            .storage()
            .instance()
            .get::<_, u64>(&count_key)
            .unwrap_or(0);

        token::Client::new(&env, &token).transfer(
            &creator,
            &env.current_contract_address(),
            &reward,
        );

        let bounty = Bounty {
            title,
            description,
            token,
            reward,
            deadline,
            creator,
            submission_count: 0,
            vote_count: 0,
            paid: false,
        };

        env.storage()
            .instance()
            .set(&DataKey::Bounty(bounty_id), &bounty);
        env.storage().instance().set(&count_key, &(bounty_id + 1));
        env.storage().instance().set(
            &DataKey::Submissions(bounty_id),
            &Map::<u64, Submission>::new(&env),
        );
    }

    pub fn submit(env: Env, submitter: Address, bounty_id: u64, url: String) {
        submitter.require_auth();
        let mut bounty: Bounty = env
            .storage()
            .instance()
            .get(&DataKey::Bounty(bounty_id))
            .expect("bounty not found");
        assert!(!bounty.paid, "bounty already paid");
        assert!(
            env.ledger().timestamp() < bounty.deadline,
            "submission deadline passed"
        );

        let sid = bounty.submission_count;
        bounty.submission_count += 1;
        env.storage()
            .instance()
            .set(&DataKey::Bounty(bounty_id), &bounty);

        let mut submissions: Map<u64, Submission> = env
            .storage()
            .instance()
            .get(&DataKey::Submissions(bounty_id))
            .unwrap_or_else(|| Map::<u64, Submission>::new(&env));
        submissions.set(
            sid as u64,
            Submission {
                url,
                submitter,
                votes: 0,
                accepted: false,
            },
        );
        env.storage()
            .instance()
            .set(&DataKey::Submissions(bounty_id), &submissions);
    }

    pub fn vote(env: Env, voter: Address, bounty_id: u64, submission_id: u64) {
        voter.require_auth();
        let bounty: Bounty = env
            .storage()
            .instance()
            .get(&DataKey::Bounty(bounty_id))
            .expect("bounty not found");
        assert!(!bounty.paid, "bounty already paid");
        assert!(env.ledger().timestamp() < bounty.deadline, "voting ended");

        let mut submissions: Map<u64, Submission> = env
            .storage()
            .instance()
            .get(&DataKey::Submissions(bounty_id))
            .unwrap_or_else(|| Map::<u64, Submission>::new(&env));
        let mut sub: Submission = submissions
            .get(submission_id)
            .expect("submission not found");
        assert!(!sub.accepted, "submission already accepted");

        let mut votes: Map<Address, bool> = env
            .storage()
            .instance()
            .get(&DataKey::Votes(bounty_id, submission_id))
            .unwrap_or_else(|| Map::<Address, bool>::new(&env));
        assert!(!votes.get(voter.clone()).unwrap_or(false), "already voted");

        votes.set(voter, true);
        sub.votes += 1;
        submissions.set(submission_id, sub);
        env.storage()
            .instance()
            .set(&DataKey::Submissions(bounty_id), &submissions);
        env.storage()
            .instance()
            .set(&DataKey::Votes(bounty_id, submission_id), &votes);

        let mut b2: Bounty = env
            .storage()
            .instance()
            .get(&DataKey::Bounty(bounty_id))
            .unwrap();
        b2.vote_count += 1;
        env.storage()
            .instance()
            .set(&DataKey::Bounty(bounty_id), &b2);
    }

    pub fn accept(env: Env, bounty_id: u64) {
        let mut bounty: Bounty = env
            .storage()
            .instance()
            .get(&DataKey::Bounty(bounty_id))
            .expect("bounty not found");
        assert!(
            env.ledger().timestamp() >= bounty.deadline,
            "deadline not reached"
        );
        assert!(!bounty.paid, "already paid");

        let submissions: Map<u64, Submission> = env
            .storage()
            .instance()
            .get(&DataKey::Submissions(bounty_id))
            .unwrap_or_else(|| Map::<u64, Submission>::new(&env));

        let mut best_id = 0u64;
        let mut best_votes = 0u32;
        for (sid, sub) in submissions.iter() {
            if sub.accepted {
                assert!(false, "already accepted");
                return;
            }
            if sub.votes > best_votes {
                best_votes = sub.votes;
                best_id = sid;
            }
        }
        assert!(best_votes > 0, "no winning submission");

        let mut final_subs: Map<u64, Submission> = env
            .storage()
            .instance()
            .get(&DataKey::Submissions(bounty_id))
            .unwrap();
        let mut winner = final_subs.get(best_id).unwrap();
        winner.accepted = true;
        final_subs.set(best_id, winner.clone());
        env.storage()
            .instance()
            .set(&DataKey::Submissions(bounty_id), &final_subs);

        bounty.paid = true;
        env.storage()
            .instance()
            .set(&DataKey::Bounty(bounty_id), &bounty);

        token::Client::new(&env, &bounty.token).transfer(
            &env.current_contract_address(),
            &winner.submitter,
            &bounty.reward,
        );
    }

    pub fn get_bounty(env: Env, bounty_id: u64) -> Option<Bounty> {
        env.storage().instance().get(&DataKey::Bounty(bounty_id))
    }

    pub fn get_bounty_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::BountyCount)
            .unwrap_or(0)
    }

    pub fn get_submissions(env: Env, bounty_id: u64) -> Vec<(u64, Submission)> {
        let subs: Map<u64, Submission> = env
            .storage()
            .instance()
            .get(&DataKey::Submissions(bounty_id))
            .unwrap_or_else(|| Map::<u64, Submission>::new(&env));
        let mut result = Vec::new(&env);
        for (id, sub) in subs.iter() {
            result.push_back((id, sub));
        }
        result
    }

    pub fn has_voted(env: Env, voter: Address, bounty_id: u64, submission_id: u64) -> bool {
        let votes: Map<Address, bool> = env
            .storage()
            .instance()
            .get(&DataKey::Votes(bounty_id, submission_id))
            .unwrap_or_else(|| Map::<Address, bool>::new(&env));
        votes.get(voter).unwrap_or(false)
    }
}

mod test;
