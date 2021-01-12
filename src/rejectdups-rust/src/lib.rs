use byteorder::{ByteOrder, LittleEndian};
use num_derive::FromPrimitive;
use solana_program::{
    account_info::next_account_info,
    account_info::AccountInfo,
    decode_error::DecodeError,
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    program_pack::{Pack, Sealed},
    pubkey::Pubkey,
    rent::Rent,
    sysvar::{self, Sysvar},
};
use thiserror::Error;

#[derive(Clone, Debug, Eq, Error, FromPrimitive, PartialEq)]
pub enum VoteError {
    #[error("Unexpected Candidate")]
    UnexpectedCandidate,
    #[error("Incorrect Owner")]
    IncorrectOwner,
    #[error("Account Not Rent Exempt")]
    AccountNotRentExempt,
    #[error("Account Not Check Account")]
    AccountNotCheckAccount,
    #[error("Already Voted")]
    AlreadyVoted,
}
impl From<VoteError> for ProgramError {
    fn from(e: VoteError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
impl<T> DecodeError<T> for VoteError {
    fn type_of() -> &'static str {
        "Vote Error"
    }
}

// Instruction data

pub struct Vote {
    pub candidate: u8,
}

impl Sealed for Vote {}

impl Pack for Vote {
    const LEN: usize = 1;

    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        let candidate = src[0];

        if candidate != 1 && candidate != 2 {
            msg!("Vote must be for candidate 1 or 2");
            return Err(VoteError::UnexpectedCandidate.into());
        }
        Ok(Vote { candidate })
    }

    fn pack_into_slice(&self, _dst: &mut [u8]) {}
}

// Vote Check structure, which is one 4 byte u32 number
// contains zero if they havn't voted, or the candidatIsInitializede number if they have

pub struct VoterCheck {
    pub voted_for: u32,
}

impl Sealed for VoterCheck {}

impl Pack for VoterCheck {
    const LEN: usize = 4;

    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        Ok(VoterCheck {
            voted_for: LittleEndian::read_u32(&src[0..4]),
        })
    }

    fn pack_into_slice(&self, dst: &mut [u8]) {
        LittleEndian::write_u32(&mut dst[0..4], self.voted_for);
    }
}

// Vote Count structure, which is two 4 byte u32 numbers
// first number is candidate 1's vote count, second number is candidate 2's vote count

pub struct VoteCount {
    pub candidate1: u32,
    pub candidate2: u32,
}

impl Sealed for VoteCount {}

impl Pack for VoteCount {
    const LEN: usize = 8;

    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        Ok(VoteCount {
            candidate1: LittleEndian::read_u32(&src[0..4]),
            candidate2: LittleEndian::read_u32(&src[4..8]),
        })
    }

    fn pack_into_slice(&self, dst: &mut [u8]) {
        LittleEndian::write_u32(&mut dst[0..4], self.candidate1);
        LittleEndian::write_u32(&mut dst[4..8], self.candidate2);
    }
}

// Declare and export the program's entrypoint
entrypoint!(process_instruction);

// Program entrypoint's implementation
fn process_instruction(
    program_id: &Pubkey,      // Public key of program account
    accounts: &[AccountInfo], // data accounts
    instruction_data: &[u8],  // 1 = vote for A, 2 = vote for B
) -> ProgramResult {
    msg!("Rust program entrypoint");

    // get candidate to vote for from instruction_data (unchecked because data is not null)
    let candidate = Vote::unpack_unchecked(&instruction_data)?.candidate;

    // Iterating accounts is safer then indexing
    let accounts_iter = &mut accounts.iter();

    // Get the account that holds the vote count
    let count_account = next_account_info(accounts_iter)?;

    // The account must be owned by the program in order to modify its data
    if count_account.owner != program_id {
        msg!(
            "Vote count account ({}) not owned by program, actual: {}, expected: {}",
            count_account.key,
            count_account.owner,
            program_id
        );
        return Err(VoteError::IncorrectOwner.into());
    }

    // Get the account that checks for dups
    let check_account = next_account_info(accounts_iter)?;

    // The check account must be owned by the program in order to modify its data
    if check_account.owner != program_id {
        msg!("Check account not owned by program");
        return Err(VoteError::IncorrectOwner.into());
    }

    // The account must be rent exempt, i.e. live forever
    let sysvar_account = next_account_info(accounts_iter)?;
    let rent = &Rent::from_account_info(sysvar_account)?;
    if !sysvar::rent::check_id(sysvar_account.key) {
        msg!("Rent system account is not rent system account");
        return Err(ProgramError::InvalidAccountData);
    }
    if !rent.is_exempt(check_account.lamports(), check_account.data_len()) {
        msg!("Check account is not rent exempt");
        return Err(VoteError::AccountNotRentExempt.into());
    }

    // the voter
    let voter_account = next_account_info(accounts_iter)?;

    if !voter_account.is_signer {
        msg!("Voter account is not signer");
        return Err(ProgramError::MissingRequiredSignature);
    }

    let expected_check_account_pubkey =
        Pubkey::create_with_seed(voter_account.key, "checkvote", program_id)?;

    if expected_check_account_pubkey != *check_account.key {
        msg!("Voter fraud! not the correct check_account");
        return Err(VoteError::AccountNotCheckAccount.into());
    }

    let mut check_data = check_account.try_borrow_mut_data()?;

    // this unpack reads and deserialises the account data and also checks the data is the correct length

    let mut vote_check =
        VoterCheck::unpack_unchecked(&check_data).expect("Failed to read VoterCheck");

    if vote_check.voted_for != 0 {
        msg!("Voter fraud! You already voted");
        return Err(VoteError::AlreadyVoted.into());
    }

    // Increment vote count of candidate, and record voter's choice

    let mut count_data = count_account.try_borrow_mut_data()?;

    let mut vote_count =
        VoteCount::unpack_unchecked(&count_data).expect("Failed to read VoteCount");

    match candidate {
        1 => {
            vote_count.candidate1 += 1;
            vote_check.voted_for = 1;
            msg!("Voting for candidate1!");
        }
        2 => {
            vote_count.candidate2 += 1;
            vote_check.voted_for = 2;
            msg!("Voting for candidate2!");
        }
        _ => {
            msg!("Unknown candidate");
            return Err(ProgramError::InvalidInstructionData);
        }
    }

    VoteCount::pack(vote_count, &mut count_data).expect("Failed to write VoteCount");
    VoterCheck::pack(vote_check, &mut check_data).expect("Failed to write VoterCheck");

    Ok(())
}
#[cfg(test)]
mod test {
    use super::*;
    use assert_matches::*;
    use solana_program::instruction::InstructionError::Custom;
    use solana_program::{
        instruction::{AccountMeta, Instruction},
        pubkey::Pubkey,
        sysvar,
    };
    use solana_program_test::*;
    use solana_sdk::transaction::TransactionError;
    use solana_sdk::{
        account::Account,
        signature::{Keypair, Signer},
        transaction::Transaction,
    };
    use std::mem;

    impl From<VoteError> for TransactionError {
        fn from(e: VoteError) -> Self {
            TransactionError::InstructionError(0, Custom(e as u32))
        }
    }

    #[tokio::test]
    async fn test_sanity1() {
        //++++++++++++++++++++++++++++++++++++
        // TEST: Simply vote for candidate 1
        //++++++++++++++++++++++++++++++++++++

        let program_id = Pubkey::new_unique();

        let mut program_test =
            ProgramTest::new("vote_counter", program_id, processor!(process_instruction));

        // mock contract data account
        let count_key = Pubkey::new_unique();
        let data: Vec<u8> = vec![0; 2 * mem::size_of::<u32>()];
        program_test.add_account(
            count_key,
            Account {
                lamports: 60000,
                data,
                owner: program_id,
                executable: false,
                rent_epoch: 0,
            },
        );

        // voter account
        let voter_keypair = Keypair::new();
        let voter_key = voter_keypair.pubkey();

        // mock voter check_account_info
        let check_key = Pubkey::create_with_seed(&voter_key, "checkvote", &program_id).unwrap(); // derived (correctly)
        let mut data = vec![0; mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0); // set storage to zero
        program_test.add_account(
            check_key,
            Account {
                lamports: 1000000,
                data,
                owner: program_id,
                executable: false,
                rent_epoch: 0,
            },
        );

        let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

        let count_account = banks_client.get_account(count_key).await.unwrap().unwrap();
        let vote_count =
            VoteCount::unpack_unchecked(&count_account.data).expect("Failed to read VoteCount");
        assert_eq!(vote_count.candidate1, 0);
        assert_eq!(vote_count.candidate2, 0);

        // vote for candidate 1
        let accounts = vec![
            AccountMeta::new(count_key, false),
            AccountMeta::new(check_key, false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
            AccountMeta::new(voter_key, true),
        ];

        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id,
                accounts,
                data: vec![1],
            }],
            Some(&payer.pubkey()),
        );
        transaction.sign(&[&payer, &voter_keypair], recent_blockhash);

        assert_matches!(banks_client.process_transaction(transaction).await, Ok(()));
        let count_account = banks_client.get_account(count_key).await.unwrap().unwrap();
        let vote_count =
            VoteCount::unpack_unchecked(&count_account.data).expect("Failed to read VoteCount");
        assert_eq!(vote_count.candidate1, 1);
        assert_eq!(vote_count.candidate2, 0);
    }

    #[tokio::test]
    async fn test_sanity2() {
        //++++++++++++++++++++++++++++++++++++
        // TEST: Simply vote for candidate 2
        //++++++++++++++++++++++++++++++++++++

        let program_id = Pubkey::new_unique();

        let mut program_test =
            ProgramTest::new("vote_counter", program_id, processor!(process_instruction));

        // mock contract data account
        let count_key = Pubkey::new_unique();
        let data: Vec<u8> = vec![0; 2 * mem::size_of::<u32>()];
        program_test.add_account(
            count_key,
            Account {
                lamports: 60000,
                data,
                owner: program_id,
                executable: false,
                rent_epoch: 0,
            },
        );

        // voter account
        let voter_keypair = Keypair::new();
        let voter_key = voter_keypair.pubkey();

        // mock voter check_account_info
        let check_key = Pubkey::create_with_seed(&voter_key, "checkvote", &program_id).unwrap(); // derived (correctly)
        let mut data = vec![0; mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0); // set storage to zero
        program_test.add_account(
            check_key,
            Account {
                lamports: 1000000,
                data,
                owner: program_id,
                executable: false,
                rent_epoch: 0,
            },
        );

        let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

        let count_account = banks_client.get_account(count_key).await.unwrap().unwrap();
        let vote_count =
            VoteCount::unpack_unchecked(&count_account.data).expect("Failed to read VoteCount");
        assert_eq!(vote_count.candidate1, 0);
        assert_eq!(vote_count.candidate2, 0);

        // vote for candidate 1
        let accounts = vec![
            AccountMeta::new(count_key, false),
            AccountMeta::new(check_key, false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
            AccountMeta::new(voter_key, true),
        ];

        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id,
                accounts,
                data: vec![2],
            }],
            Some(&payer.pubkey()),
        );
        transaction.sign(&[&payer, &voter_keypair], recent_blockhash);

        assert_matches!(banks_client.process_transaction(transaction).await, Ok(()));
        let count_account = banks_client.get_account(count_key).await.unwrap().unwrap();
        let vote_count =
            VoteCount::unpack_unchecked(&count_account.data).expect("Failed to read VoteCount");
        assert_eq!(vote_count.candidate1, 0);
        assert_eq!(vote_count.candidate2, 1);
    }

    #[tokio::test]
    async fn test_sanity_both() {
        //++++++++++++++++++++++++++++++++++++
        // TEST: two voters, one each
        //++++++++++++++++++++++++++++++++++++

        let program_id = Pubkey::new_unique();

        let mut program_test =
            ProgramTest::new("vote_counter", program_id, processor!(process_instruction));

        // mock contract data account
        let count_key = Pubkey::new_unique();
        let data: Vec<u8> = vec![0; 2 * mem::size_of::<u32>()];
        program_test.add_account(
            count_key,
            Account {
                lamports: 60000,
                data,
                owner: program_id,
                executable: false,
                rent_epoch: 0,
            },
        );

        // voter 1 account
        let voter1_keypair = Keypair::new();
        let voter1_key = voter1_keypair.pubkey();

        // mock voter 1 check_account_info
        let check1_key = Pubkey::create_with_seed(&voter1_key, "checkvote", &program_id).unwrap(); // derived (correctly)
        let mut data = vec![0; mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0); // set storage to zero
        program_test.add_account(
            check1_key,
            Account {
                lamports: 1000000,
                data,
                owner: program_id,
                executable: false,
                rent_epoch: 0,
            },
        );

        // voter 2 account
        let voter2_keypair = Keypair::new();
        let voter2_key = voter2_keypair.pubkey();

        // mock voter 2 check_account_info
        let check2_key = Pubkey::create_with_seed(&voter2_key, "checkvote", &program_id).unwrap(); // derived (correctly)
        let mut data = vec![0; mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0); // set storage to zero
        program_test.add_account(
            check2_key,
            Account {
                lamports: 1000000,
                data,
                owner: program_id,
                executable: false,
                rent_epoch: 0,
            },
        );

        let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

        // account 1 votes for candidate 1
        let accounts = vec![
            AccountMeta::new(count_key, false),
            AccountMeta::new(check1_key, false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
            AccountMeta::new(voter1_key, true),
        ];

        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id,
                accounts,
                data: vec![1],
            }],
            Some(&payer.pubkey()),
        );
        transaction.sign(&[&payer, &voter1_keypair], recent_blockhash);

        // account 2 votes for candidate 2
        let accounts = vec![
            AccountMeta::new(count_key, false),
            AccountMeta::new(check2_key, false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
            AccountMeta::new(voter2_key, true),
        ];

        let mut transaction2 = Transaction::new_with_payer(
            &[Instruction {
                program_id,
                accounts,
                data: vec![2],
            }],
            Some(&payer.pubkey()),
        );
        transaction2.sign(&[&payer, &voter2_keypair], recent_blockhash);

        assert_matches!(
            banks_client
                .process_transactions([transaction, transaction2].to_vec())
                .await,
            Ok(())
        );

        let count_account = banks_client.get_account(count_key).await.unwrap().unwrap();
        let vote_count =
            VoteCount::unpack_unchecked(&count_account.data).expect("Failed to read VoteCount");
        assert_eq!(vote_count.candidate1, 1);
        assert_eq!(vote_count.candidate2, 1);
    }

    #[tokio::test]
    async fn test_rent() {
        //++++++++++++++++++++++++++++++++++++
        // TEST: insufficient rent on check account
        //++++++++++++++++++++++++++++++++++++

        let program_id = Pubkey::new_unique();

        let mut program_test =
            ProgramTest::new("vote_counter", program_id, processor!(process_instruction));

        // mock contract data account
        let count_key = Pubkey::new_unique();
        let data: Vec<u8> = vec![0; 2 * mem::size_of::<u32>()];
        program_test.add_account(
            count_key,
            Account {
                lamports: 60000,
                data,
                owner: program_id,
                executable: false,
                rent_epoch: 0,
            },
        );

        // voter account
        let voter_keypair = Keypair::new();
        let voter_key = voter_keypair.pubkey();

        // mock voter check_account_info
        let check_key = Pubkey::create_with_seed(&voter_key, "checkvote", &program_id).unwrap(); // derived (correctly)
        let mut data = vec![0; mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0); // set storage to zero
        program_test.add_account(
            check_key,
            Account {
                lamports: 1,
                data,
                owner: program_id,
                executable: false,
                rent_epoch: 0,
            },
        );

        let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

        // vote for candidate 1
        let accounts = vec![
            AccountMeta::new(count_key, false),
            AccountMeta::new(check_key, false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
            AccountMeta::new(voter_key, true),
        ];

        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id,
                accounts,
                data: vec![1],
            }],
            Some(&payer.pubkey()),
        );
        transaction.sign(&[&payer, &voter_keypair], recent_blockhash);

        let result = banks_client.process_transaction(transaction).await;
        assert_eq!(
            result.err().unwrap().unwrap(),
            TransactionError::from(VoteError::AccountNotRentExempt)
        );
    }

    #[tokio::test]
    async fn test_no_vote_without_check() {
        //++++++++++++++++++++++++++++++++++++
        // TEST: where client passes in wrong checking account
        //++++++++++++++++++++++++++++++++++++

        let program_id = Pubkey::new_unique();

        let mut program_test =
            ProgramTest::new("vote_counter", program_id, processor!(process_instruction));

        // mock contract data account
        let count_key = Pubkey::new_unique();
        let data: Vec<u8> = vec![0; 2 * mem::size_of::<u32>()];
        program_test.add_account(
            count_key,
            Account {
                lamports: 60000,
                data,
                owner: program_id,
                executable: false,
                rent_epoch: 0,
            },
        );

        // voter account
        let voter_keypair = Keypair::new();
        let voter_key = voter_keypair.pubkey();

        // mock voter check_account_info
        let check_key = Pubkey::new_unique(); // NOT THE CORRECT CHECK-ACCOUNT, WHICH SHOULD BE DETERMINISTICALLY DERIVED
        let mut data = vec![0; mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0); // set storage to zero
        program_test.add_account(
            check_key,
            Account {
                lamports: 1000000,
                data,
                owner: program_id,
                executable: false,
                rent_epoch: 0,
            },
        );

        let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

        // vote for candidate 1
        let accounts = vec![
            AccountMeta::new(count_key, false),
            AccountMeta::new(check_key, false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
            AccountMeta::new(voter_key, true),
        ];

        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id,
                accounts,
                data: vec![1],
            }],
            Some(&payer.pubkey()),
        );
        transaction.sign(&[&payer, &voter_keypair], recent_blockhash);

        let result = banks_client.process_transaction(transaction).await;
        assert_eq!(
            result.err().unwrap().unwrap(),
            TransactionError::from(VoteError::AccountNotCheckAccount)
        );
    }

    #[tokio::test]
    async fn test_nodup_vote1() {
        //++++++++++++++++++++++++++++++++++++
        // TEST: reject a duplicate vote
        //++++++++++++++++++++++++++++++++++++

        let program_id = Pubkey::new_unique();

        let mut program_test =
            ProgramTest::new("vote_counter", program_id, processor!(process_instruction));

        // mock contract data account
        let count_key = Pubkey::new_unique();
        let data: Vec<u8> = vec![0; 2 * mem::size_of::<u32>()];
        program_test.add_account(
            count_key,
            Account {
                lamports: 60000,
                data,
                owner: program_id,
                executable: false,
                rent_epoch: 0,
            },
        );

        // voter account
        let voter_keypair = Keypair::new();
        let voter_key = voter_keypair.pubkey();

        // mock voter check_account_info
        let check_key = Pubkey::create_with_seed(&voter_key, "checkvote", &program_id).unwrap(); // derived (correctly)
        let mut data = vec![0; mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0); // set storage to zero
        program_test.add_account(
            check_key,
            Account {
                lamports: 1000000,
                data,
                owner: program_id,
                executable: false,
                rent_epoch: 0,
            },
        );

        let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

        // vote for candidate 1
        let accounts = vec![
            AccountMeta::new(count_key, false),
            AccountMeta::new(check_key, false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
            AccountMeta::new(voter_key, true),
        ];

        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id,
                accounts,
                data: vec![1],
            }],
            Some(&payer.pubkey()),
        );
        transaction.sign(&[&payer, &voter_keypair], recent_blockhash);

        assert_matches!(banks_client.process_transaction(transaction).await, Ok(()));
        let count_account = banks_client.get_account(count_key).await.unwrap().unwrap();
        let vote_count =
            VoteCount::unpack_unchecked(&count_account.data).expect("Failed to read VoteCount");
        assert_eq!(vote_count.candidate1, 1);
        assert_eq!(vote_count.candidate2, 0);

        // vote AGAIN
        let accounts = vec![
            AccountMeta::new(count_key, false),
            AccountMeta::new(check_key, false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
            AccountMeta::new(voter_key, true),
        ];

        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id,
                accounts,
                data: vec![1],
            }],
            Some(&payer.pubkey()),
        );
        // Fetch a new blockhash to avoid the second transaction having the same signature as the first
        let recent_blockhash = banks_client
            .get_new_blockhash(&recent_blockhash)
            .await
            .unwrap()
            .0;
        transaction.sign(&[&payer, &voter_keypair], recent_blockhash);

        let result = banks_client.process_transaction(transaction).await;
        assert_eq!(
            result.err().unwrap().unwrap(),
            TransactionError::from(VoteError::AlreadyVoted)
        );
    }

    #[tokio::test]
    async fn test_nodup_vote2() {
        //++++++++++++++++++++++++++++++++++++
        // TEST: reject a second vote for a different candidate
        //++++++++++++++++++++++++++++++++++++

        let program_id = Pubkey::new_unique();

        let mut program_test =
            ProgramTest::new("vote_counter", program_id, processor!(process_instruction));

        // mock contract data account
        let count_key = Pubkey::new_unique();
        let data: Vec<u8> = vec![0; 2 * mem::size_of::<u32>()];
        program_test.add_account(
            count_key,
            Account {
                lamports: 60000,
                data,
                owner: program_id,
                executable: false,
                rent_epoch: 0,
            },
        );

        // voter account
        let voter_keypair = Keypair::new();
        let voter_key = voter_keypair.pubkey();

        // mock voter check_account_info
        let check_key = Pubkey::create_with_seed(&voter_key, "checkvote", &program_id).unwrap(); // derived (correctly)
        let mut data = vec![0; mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0); // set storage to zero
        program_test.add_account(
            check_key,
            Account {
                lamports: 1000000,
                data,
                owner: program_id,
                executable: false,
                rent_epoch: 0,
            },
        );

        let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

        // vote for candidate 1
        let accounts = vec![
            AccountMeta::new(count_key, false),
            AccountMeta::new(check_key, false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
            AccountMeta::new(voter_key, true),
        ];

        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id,
                accounts,
                data: vec![1],
            }],
            Some(&payer.pubkey()),
        );
        transaction.sign(&[&payer, &voter_keypair], recent_blockhash);

        assert_matches!(banks_client.process_transaction(transaction).await, Ok(()));
        let count_account = banks_client.get_account(count_key).await.unwrap().unwrap();
        let vote_count =
            VoteCount::unpack_unchecked(&count_account.data).expect("Failed to read VoteCount");
        assert_eq!(vote_count.candidate1, 1);
        assert_eq!(vote_count.candidate2, 0);

        // vote AGAIN, but for candidate 2
        let accounts = vec![
            AccountMeta::new(count_key, false),
            AccountMeta::new(check_key, false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
            AccountMeta::new(voter_key, true),
        ];

        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id,
                accounts,
                data: vec![2],
            }],
            Some(&payer.pubkey()),
        );
        transaction.sign(&[&payer, &voter_keypair], recent_blockhash);

        let result = banks_client.process_transaction(transaction).await;
        assert_eq!(
            result.err().unwrap().unwrap(),
            TransactionError::from(VoteError::AlreadyVoted)
        );
    }
}
