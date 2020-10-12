use byteorder::{ByteOrder, LittleEndian};
use num_derive::FromPrimitive;
use solana_sdk::{
    account_info::next_account_info,
    account_info::AccountInfo,
    decode_error::DecodeError,
    //entrypoint,
    //entrypoint::ProgramResult,
    entrypoint_deprecated,
    entrypoint_deprecated::ProgramResult,
    info,
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
            info!("Vote must be for candidate 1 or 2");
            return Err(VoteError::UnexpectedCandidate.into());
        }
        Ok(Vote { candidate })
    }

    fn pack_into_slice(&self, _dst: &mut [u8]) {}
}

// Vote Check structure, which is one 4 byte u32 number
// contains zero if they havn't voted, or the candidate number if they have

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
entrypoint_deprecated!(process_instruction);

// Program entrypoint's implementation
fn process_instruction(
    program_id: &Pubkey,      // Public key of program account
    accounts: &[AccountInfo], // data accounts
    instruction_data: &[u8],  // 1 = vote for A, 2 = vote for B
) -> ProgramResult {
    info!("Rust program entrypoint");

    // get candidate to vote for from instruction_data (unchecked because data is not null)
    let candidate = Vote::unpack_unchecked(&instruction_data)?.candidate;

    // Iterating accounts is safer then indexing
    let accounts_iter = &mut accounts.iter();

    // Get the account that holds the vote count
    let count_account = next_account_info(accounts_iter)?;

    // The account must be owned by the program in order to modify its data
    if count_account.owner != program_id {
        info!("Vote count account not owned by program");
        return Err(VoteError::IncorrectOwner.into());
    }

    // Get the account that checks for dups
    let check_account = next_account_info(accounts_iter)?;

    // The check account must be owned by the program in order to modify its data
    if check_account.owner != program_id {
        info!("Check account not owned by program");
        return Err(VoteError::IncorrectOwner.into());
    }

    // The account must be rent exempt, i.e. live forever
    let sysvar_account = next_account_info(accounts_iter)?;
    let rent = &Rent::from_account_info(sysvar_account)?;
    if !sysvar::rent::check_id(sysvar_account.key) {
        info!("Rent system account is not rent system account");
        return Err(ProgramError::InvalidAccountData);
    }
    if !rent.is_exempt(check_account.lamports(), check_account.data_len()) {
        info!("Check account is not rent exempt");
        return Err(VoteError::AccountNotRentExempt.into());
    }

    // the voter
    let voter_account = next_account_info(accounts_iter)?;

    if !voter_account.is_signer {
        info!("Voter account is not signer");
        return Err(ProgramError::MissingRequiredSignature);
    }

    let expected_check_account_pubkey =
        Pubkey::create_with_seed(voter_account.key, "checkvote", program_id)?;

    if expected_check_account_pubkey != *check_account.key {
        info!("Voter fraud! not the correct check_account");
        return Err(VoteError::AccountNotCheckAccount.into());
    }

    let mut check_data = check_account.try_borrow_mut_data()?;

    // this unpack reads and deserialises the account data and also checks the data is the correct length

    let mut vote_check =
        VoterCheck::unpack_unchecked(&check_data).expect("Failed to read VoterCheck");

    if vote_check.voted_for != 0 {
        info!("Voter fraud! You already voted");
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
            info!("Voting for candidate1!");
        }
        2 => {
            vote_count.candidate2 += 1;
            vote_check.voted_for = 2;
            info!("Voting for candidate2!");
        }
        _ => {
            info!("Unknown candidate");
            return Err(ProgramError::InvalidInstructionData);
        }
    }

    VoteCount::pack(vote_count, &mut count_data).expect("Failed to write VoteCount");
    VoterCheck::pack(vote_check, &mut check_data).expect("Failed to write VoterCheck");

    Ok(())
}

// Required to support info! in tests
#[cfg(not(target_arch = "bpf"))]
solana_sdk::program_stubs!();

#[cfg(test)]
mod test {
    use super::*;
    use solana_sdk::{clock::Epoch, pubkey::Pubkey};
    use std::mem;

    fn pubkey_rand() -> Pubkey {
        Pubkey::new(&rand::random::<[u8; 32]>())
    }

    fn pubkey_sys() -> Pubkey {
        let system_account_bytes: &[u8] = &[
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0,
        ];
        Pubkey::new(system_account_bytes)
    }

    #[test]
    fn test_sanity1() {
        //++++++++++++++++++++++++++++++++++++
        // TEST: Simply vote for candidate 1
        //++++++++++++++++++++++++++++++++++++

        // mock program id

        let program_id = pubkey_rand(); // anything

        // mock contract data account

        let key = pubkey_rand(); // anything
        let mut lamports = 0;
        let mut data = vec![0; 2 * mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0); // set storage to zero
        LittleEndian::write_u32(&mut data[4..8], 0);
        let owner = program_id;

        let count_account_info = AccountInfo::new(
            &key,             // account pubkey
            false,            // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        // mock voter account

        let key = pubkey_rand(); // anything
        let mut lamports = 0;
        let mut data = vec![0; 0];
        let owner = pubkey_sys();

        let voter_account_info = AccountInfo::new(
            &key,             // account pubkey
            true,             // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        // mock voter check_account_info

        let key =
            Pubkey::create_with_seed(voter_account_info.key, "checkvote", &program_id).unwrap(); // derived (correctly)
        let mut lamports = 1000000; // must be rent exempt
        let mut data = vec![0; mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0); // set storage to zero
        let owner = program_id;

        let check_account_info = AccountInfo::new(
            &key,             // account pubkey
            false,            // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        // mock rent account

        let rent = Rent {
            lamports_per_byte_year: 10,
            exemption_threshold: 2.0,
            burn_percent: 5,
        };
        let rent_account = rent.create_account(1);
        let rent_pubkey = solana_sdk::sysvar::rent::id();
        let mut rent_tuple = (rent_pubkey, rent_account);
        let rent_info = AccountInfo::from(&mut rent_tuple);

        let mut instruction_data: Vec<u8> = vec![0];

        let accounts = vec![
            count_account_info,
            check_account_info,
            rent_info,
            voter_account_info,
        ];

        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[0..4]), 0);
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[4..8]), 0);

        // vote for candidate 1

        instruction_data[0] = 1;
        process_instruction(&program_id, &accounts, &instruction_data).unwrap();

        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[0..4]), 1);
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[4..8]), 0);
    }

    #[test]
    fn test_sanity2() {
        //++++++++++++++++++++++++++++++++++++
        // TEST: Simply vote for candidate 2
        //++++++++++++++++++++++++++++++++++++

        // mock program id

        let program_id = pubkey_rand();

        // mock contract data account

        let key = pubkey_rand();
        let mut lamports = 0;
        let mut data = vec![0; 2 * mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0);
        LittleEndian::write_u32(&mut data[4..8], 0);
        let owner = program_id;

        let count_account_info = AccountInfo::new(
            &key,             // account pubkey
            false,            // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        // mock voter account

        let key = pubkey_rand();
        let mut lamports = 0;
        let mut data = vec![0; 0];
        let owner = pubkey_sys();

        let voter_account_info = AccountInfo::new(
            &key,             // account pubkey
            true,             // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        // mock voter check_account_info

        let key =
            Pubkey::create_with_seed(voter_account_info.key, "checkvote", &program_id).unwrap(); // derived (correctly)
        let mut lamports = 1000000; // must be rent exempt
        let mut data = vec![0; mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0);
        let owner = program_id;

        let check_account_info = AccountInfo::new(
            &key,             // account pubkey
            false,            // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        // mock rent account

        let rent = Rent {
            lamports_per_byte_year: 10,
            exemption_threshold: 2.0,
            burn_percent: 5,
        };
        let rent_account = rent.create_account(1);
        let rent_pubkey = solana_sdk::sysvar::rent::id();
        let mut rent_tuple = (rent_pubkey, rent_account);
        let rent_info = AccountInfo::from(&mut rent_tuple);

        let mut instruction_data: Vec<u8> = vec![0];

        let accounts = vec![
            count_account_info,
            check_account_info,
            rent_info,
            voter_account_info,
        ];

        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[0..4]), 0);
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[4..8]), 0);

        // vote for candidate 2

        instruction_data[0] = 2;
        process_instruction(&program_id, &accounts, &instruction_data).unwrap();
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[0..4]), 0);
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[4..8]), 1);
    }

    #[test]
    fn test_sanity_both() {
        //++++++++++++++++++++++++++++++++++++
        // TEST: two voters, one each
        //++++++++++++++++++++++++++++++++++++

        // mock program id

        let program_id = pubkey_rand();

        // mock contract data account

        let key = pubkey_rand();
        let mut lamports = 0;
        let mut data = vec![0; 2 * mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0);
        LittleEndian::write_u32(&mut data[4..8], 0);
        let owner = program_id;

        let count_account_info = AccountInfo::new(
            &key,             // account pubkey
            false,            // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        // first mock voter account

        let key = pubkey_rand();
        let mut lamports = 0;
        let mut data = vec![0; 0];
        let owner = pubkey_sys();

        let first_voter_account_info = AccountInfo::new(
            &key,             // account pubkey
            true,             // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        // second mock voter account

        let key = pubkey_rand();
        let mut lamports = 0;
        let mut data = vec![0; 0];
        let owner = pubkey_sys();

        let second_voter_account_info = AccountInfo::new(
            &key,             // account pubkey
            true,             // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        // first mock voter check_account_info

        let key = Pubkey::create_with_seed(first_voter_account_info.key, "checkvote", &program_id)
            .unwrap(); // derived (correctly)
        let mut lamports = 1000000; // must be rent exempt
        let mut data = vec![0; mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0);
        let owner = program_id;

        let first_check_account_info = AccountInfo::new(
            &key,             // account pubkey
            false,            // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        // second mock voter check_account_info

        let key = Pubkey::create_with_seed(second_voter_account_info.key, "checkvote", &program_id)
            .unwrap(); // derived (correctly)
        let mut lamports = 1000000; // must be rent exempt
        let mut data = vec![0; mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0);
        let owner = program_id;

        let second_check_account_info = AccountInfo::new(
            &key,             // account pubkey
            false,            // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        // mock rent account

        let rent = Rent {
            lamports_per_byte_year: 10,
            exemption_threshold: 2.0,
            burn_percent: 5,
        };
        let rent_account = rent.create_account(1);
        let rent_pubkey = solana_sdk::sysvar::rent::id();
        let mut rent_tuple = (rent_pubkey, rent_account);
        let rent_info = AccountInfo::from(&mut rent_tuple);

        let mut instruction_data: Vec<u8> = vec![0];

        let accounts1 = vec![
            count_account_info,
            first_check_account_info,
            rent_info.clone(),
            first_voter_account_info,
        ];

        assert_eq!(LittleEndian::read_u32(&accounts1[0].data.borrow()[0..4]), 0);
        assert_eq!(LittleEndian::read_u32(&accounts1[0].data.borrow()[4..8]), 0);

        // first voter votes for candidate 1

        instruction_data[0] = 1;
        process_instruction(&program_id, &accounts1, &instruction_data).unwrap();

        assert_eq!(LittleEndian::read_u32(&accounts1[0].data.borrow()[0..4]), 1);
        assert_eq!(LittleEndian::read_u32(&accounts1[0].data.borrow()[4..8]), 0);

        // second voter votes for candidate 2

        let accounts2 = vec![
            accounts1[0].clone(),
            second_check_account_info,
            rent_info.clone(),
            second_voter_account_info,
        ];

        instruction_data[0] = 2;
        process_instruction(&program_id, &accounts2, &instruction_data).unwrap();

        assert_eq!(LittleEndian::read_u32(&accounts2[0].data.borrow()[0..4]), 1);
        assert_eq!(LittleEndian::read_u32(&accounts2[0].data.borrow()[4..8]), 1);
    }

    #[test]
    #[should_panic]
    fn test_rent() {
        //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++
        // TEST MUST FAIL: insufficient rent on check account
        //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++

        // mock program id

        let program_id = pubkey_rand();

        // mock contract data account

        let key = pubkey_rand();
        let mut lamports = 0;
        let mut data = vec![0; 2 * mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0);
        LittleEndian::write_u32(&mut data[4..8], 0);
        let owner = program_id;

        let count_account_info = AccountInfo::new(
            &key,             // account pubkey
            false,            // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        // mock voter account

        let key = pubkey_rand();
        let mut lamports = 0;
        let mut data = vec![0; 0];
        let owner = pubkey_sys();

        let voter_account_info = AccountInfo::new(
            &key,             // account pubkey
            true,             // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        // mock voter check_account_info

        let key =
            Pubkey::create_with_seed(voter_account_info.key, "checkvote", &program_id).unwrap(); // derived (correctly)

        let mut lamports = 0; // NOT RENT EXEMPT

        let mut data = vec![0; mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0);
        let owner = program_id;

        let check_account_info = AccountInfo::new(
            &key,             // account pubkey
            false,            // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        // mock rent account

        let rent = Rent {
            lamports_per_byte_year: 10,
            exemption_threshold: 2.0,
            burn_percent: 5,
        };
        let rent_account = rent.create_account(1);
        let rent_pubkey = solana_sdk::sysvar::rent::id();
        let mut rent_tuple = (rent_pubkey, rent_account);
        let rent_info = AccountInfo::from(&mut rent_tuple);

        let mut instruction_data: Vec<u8> = vec![0];

        let accounts = vec![
            count_account_info,
            check_account_info,
            rent_info,
            voter_account_info,
        ];

        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[0..4]), 0);
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[4..8]), 0);

        // vote for candidate 2

        instruction_data[0] = 2;
        process_instruction(&program_id, &accounts, &instruction_data).unwrap();
        // <-- expect panic here
    }

    #[test]
    #[should_panic]
    fn test_no_vote_without_check() {
        //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
        // TEST MUST FAIL: where client passes in wrong checking account
        //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

        // mock program id

        let program_id = pubkey_rand();

        // mock program data account

        let key = pubkey_rand();
        let mut lamports = 0;
        let mut data = vec![0; 2 * mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0);
        LittleEndian::write_u32(&mut data[4..8], 0);
        let owner = program_id;

        let count_account_info = AccountInfo::new(
            &key,             // account pubkey
            false,            // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        // mock voter account

        let key = pubkey_rand();
        let mut lamports = 0;
        let mut data = vec![0; 0];
        let owner = pubkey_sys();

        let voter_account_info = AccountInfo::new(
            &key,             // account pubkey
            true,             // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        // mock voter check_account_info

        let key = pubkey_rand(); // NOT THE CORRECT CHECK-ACCOUNT, WHICH SHOULD BE DETERMINISTICALLY DERIVED
        let mut lamports = 0;
        let mut data = vec![0; mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0);
        let owner = program_id;

        let check_account_info = AccountInfo::new(
            &key,             // account pubkey
            false,            // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        let mut instruction_data: Vec<u8> = vec![0];

        let accounts = vec![count_account_info, check_account_info, voter_account_info];

        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[0..4]), 0);
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[4..8]), 0);

        // vote for candidate 1 -- MUST FAIL, client supplied wrong check_account_info

        instruction_data[0] = 1;
        process_instruction(&program_id, &accounts, &instruction_data).unwrap();
        // <-- expect panic here
    }

    #[test]
    #[should_panic]
    fn test_nodup_vote1() {
        //++++++++++++++++++++++++++++++++++++++++++
        // TEST MUST FAIL: reject a duplicate vote
        //++++++++++++++++++++++++++++++++++++++++++

        // mock program account

        let program_id = pubkey_rand();

        // mock contract data account

        let key = pubkey_rand();
        let mut lamports = 0;
        let mut data = vec![0; 2 * mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0);
        LittleEndian::write_u32(&mut data[4..8], 0);
        let owner = program_id;

        let count_account_info = AccountInfo::new(
            &key,             // account pubkey
            false,            // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        // mock voter account

        let key = pubkey_rand();
        let mut lamports = 0;
        let mut data = vec![0; 0];
        let owner = pubkey_sys();

        let voter_account_info = AccountInfo::new(
            &key,             // account pubkey
            true,             // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        // mock voter check_account_info

        let key =
            Pubkey::create_with_seed(voter_account_info.key, "checkvote", &program_id).unwrap(); // derived (correctly)
        let mut lamports = 0;
        let mut data = vec![0; mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0);
        let owner = program_id;

        let check_account_info = AccountInfo::new(
            &key,             // account pubkey
            false,            // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        let mut instruction_data: Vec<u8> = vec![0];

        let accounts = vec![count_account_info, check_account_info, voter_account_info];

        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[0..4]), 0);
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[4..8]), 0);

        // vote for candidate 1 -- SHOULD WORK

        instruction_data[0] = 1;
        process_instruction(&program_id, &accounts, &instruction_data).unwrap();
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[0..4]), 1);
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[4..8]), 0);

        // vote for candidate 2 -- MUST FAIL

        instruction_data[0] = 2;
        process_instruction(&program_id, &accounts, &instruction_data).unwrap();
        // <-- expect panic here
    }

    #[test]
    #[should_panic]
    fn test_nodup_vote2() {
        //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
        // TEST MUST FAIL: reject a duplicate vote (other way round)
        //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

        // mock program account

        let program_id = pubkey_rand();

        // mock contract data account

        let key = pubkey_rand();
        let mut lamports = 0;
        let mut data = vec![0; 2 * mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0);
        LittleEndian::write_u32(&mut data[4..8], 0);
        let owner = program_id;

        let count_account_info = AccountInfo::new(
            &key,             // account pubkey
            false,            // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        // mock voter account

        let key = pubkey_rand();
        let mut lamports = 0;
        let mut data = vec![0; 0];
        let owner = pubkey_sys();

        let voter_account_info = AccountInfo::new(
            &key,             // account pubkey
            true,             // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        // mock voter check_account_info

        let key =
            Pubkey::create_with_seed(voter_account_info.key, "checkvote", &program_id).unwrap(); // derived (correctly)
        let mut lamports = 0;
        let mut data = vec![0; mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0);
        let owner = program_id;

        let check_account_info = AccountInfo::new(
            &key,             // account pubkey
            false,            // is_signer
            true,             // is_writable
            &mut lamports,    // balance in lamports
            &mut data,        // storage
            &owner,           // owner pubkey
            false,            // is_executable
            Epoch::default(), // rent_epoch
        );

        let mut instruction_data: Vec<u8> = vec![0];

        let accounts = vec![count_account_info, check_account_info, voter_account_info];

        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[0..4]), 0);
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[4..8]), 0);

        // vote for candidate 2 -- SHOULD WORK

        instruction_data[0] = 2;
        process_instruction(&program_id, &accounts, &instruction_data).unwrap();
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[0..4]), 0);
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[4..8]), 1);

        // vote for candidate 1 -- MUST FAIL

        instruction_data[0] = 1;
        process_instruction(&program_id, &accounts, &instruction_data).unwrap();
        // <-- expect panic here
    }
}
