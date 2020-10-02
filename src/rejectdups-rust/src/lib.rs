use byteorder::{ByteOrder, LittleEndian};
use solana_sdk::{
    account_info::AccountInfo, entrypoint, entrypoint::ProgramResult, info,
    decode_error::DecodeError, program_error::ProgramError, account_info::next_account_info, pubkey::Pubkey,
    sysvar::{self, Sysvar}, rent::Rent,
    program_pack::{Pack, Sealed},
};

use num_derive::FromPrimitive;
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
        if src.len() != 1 {
            info!("Instruction data must be 1 byte"); 
            return Err(ProgramError::InvalidInstructionData);
        }

        let candidate = src[0];

        if candidate != 1 || candidate != 2 {
            info!("Vote must be for candidate 1 or 2");
            return Err(VoteError::UnexpectedCandidate.into());
        } 
        Ok(Vote {
            candidate,
        })
    }

    fn pack_into_slice(&self, _dst: &mut [u8]) {}
}


 

// Vote Check structure, which is one 4 byte u32 number
// contains zero if they havn't voted, or the candidate number if they have

pub struct VoteCheck {
    pub voted_for: u32,
}

impl Sealed for VoteCheck {}

impl Pack for VoteCheck {

    const LEN: usize = 4;

    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        Ok(VoteCheck {
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
    program_id: &Pubkey,             // Public key of program account
    accounts: &[AccountInfo],        // data accounts
    instruction_data: &[u8],         // 1 = vote for A, 2 = vote for B
) -> ProgramResult {

    info!("Rust program entrypoint");

    // get candidate to vote for from instruction_data
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
    let rent = <Rent as Sysvar>::from_account_info(sysvar_account)?;
    if ! sysvar::rent::check_id(sysvar_account.key) {
        info!("Rent system account is not rent system account");
        return Err(ProgramError::InvalidAccountData);
    }
    if ! rent.is_exempt(check_account.lamports(),check_account.data_len()) {
        info!("Check account is not rent exempt");
        return Err(VoteError::AccountNotRentExempt.into());
    }

    // the voter 
    let voter_account = next_account_info(accounts_iter)?;

    if !voter_account.is_signer {
      info!("Voter account is not signer");
      return Err(ProgramError::MissingRequiredSignature);
    }

    let expected_check_account_address = Pubkey::create_with_seed(voter_account.key, 
                                                                  "checkvote", 
                                                                  program_id);

    if expected_check_account_address != Ok(*check_account.key) {
        info!("Voter fraud! not the correct check_account.");
        return Err(VoteError::AccountNotCheckAccount.into());
    }

    let mut check_data = check_account.try_borrow_mut_data()?;

    // this unpack reads and deserialises the account data and also checks the data is the correct length

    let mut vote_check = VoteCheck::unpack_unchecked(&check_data).expect("Failed to read VoteCheck");

    if vote_check.voted_for != 0 {
        info!("Voter fraud! You already voted.");
        return Err(VoteError::AlreadyVoted.into());
    }


    // Increment vote count of candidate, and record voter's choice

    let mut count_data = count_account.try_borrow_mut_data()?;

    let mut vote_count = VoteCount::unpack_unchecked(&count_data).expect("Failed to read VoteCount"); 

    match candidate {
        1 => {
            vote_count.candidate1 += 1;
            vote_check.voted_for = 1; 
            info!("Voting for candidate1!");
        },
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
    VoteCheck::pack(vote_check, &mut check_data).expect("Failed to write VoteCheck");

    Ok(())
}


// tests
#[cfg(test)]
mod test {
    use super::*;
    use solana_sdk::clock::Epoch;

 
    static SYSTEM_ACCOUNT_PUBKEY_BYTES: &[u8] = &[
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0,
    ];

    static PROGRAM_ACCOUNT_PUBKEY_BYTES: &[u8] = &[
        1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0,
    ];

    static DATA_ACCOUNT_PUBKEY_BYTES: &[u8] = &[
        2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0,
    ];

    static VOTER_ACCOUNT_PUBKEY_BYTES: &[u8] = &[
        3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0,
    ];

    static FALSE_CHECK_ACCOUNT_PUBKEY_BYTES: &[u8] = &[
        4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0,
    ];



    // single vote

    #[test]
    fn test_sanity() {

        // mock program id 

        let program_id = Pubkey::new( PROGRAM_ACCOUNT_PUBKEY_BYTES );

        // mock contract data account

        let key = Pubkey::new( DATA_ACCOUNT_PUBKEY_BYTES ); // anything 
        let mut lamports = 0;
        let mut data = vec![0; 2 * mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0); // set storage to zero
        LittleEndian::write_u32(&mut data[4..8], 0);
        let owner = program_id;

        let contract_data_account = AccountInfo::new(
            &key,                             // account pubkey
            false,                            // is_signer
            true,                             // is_writable
            &mut lamports,                    // balance in lamports
            &mut data,                        // storage
            &owner,                           // owner pubkey
            false,                            // is_executable
            Epoch::default(),                 // rent_epoch
        );

        // mock voter account

        let key = Pubkey::new( VOTER_ACCOUNT_PUBKEY_BYTES );  // anything
        let mut lamports = 0;
        let mut data = vec![0; 0];
        let owner = Pubkey::new( SYSTEM_ACCOUNT_PUBKEY_BYTES ); 

        let voter_account = AccountInfo::new(
            &key,                             // account pubkey
            true,                             // is_signer
            true,                             // is_writable
            &mut lamports,                    // balance in lamports
            &mut data,                        // storage
            &owner,                           // owner pubkey
            false,                            // is_executable
            Epoch::default(),                 // rent_epoch
        );

        // mock voter check_account 

        let key = Pubkey::create_with_seed(voter_account.key, "checkvote", &program_id);  // derived (correctly)
        let mut lamports = 0;
        let mut data = vec![0; mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0); // set storage to zero
        let owner = program_id;

        let check_account = AccountInfo::new(
            &key,                             // account pubkey
            false,                            // is_signer
            true,                             // is_writable
            &mut lamports,                    // balance in lamports
            &mut data,                        // storage
            &owner,                           // owner pubkey
            false,                            // is_executable
            Epoch::default(),                 // rent_epoch
        );

        let mut instruction_data: Vec<u8> = vec![0];

        let accounts = vec![contract_data_account, check_account, voter_account];

        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[0..4]), 0);
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[4..8]), 0);

        // vote for candidate 1

        instruction_data[0] = 1;
        process_instruction(&program_id, &accounts, &instruction_data).unwrap();
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[0..4]), 1);
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[4..8]), 0);
    }


    // must fail where client passes in wrong checking account

    #[test]
    #[should_panic] 
    fn test_no_vote_without_check() {

        // mock program id 

        let program_id = Pubkey::new( PROGRAM_ACCOUNT_PUBKEY_BYTES );

        // mock contract data account

        let key = Pubkey::new( DATA_ACCOUNT_PUBKEY_BYTES );  // anything
        let mut lamports = 0;
        let mut data = vec![0; 2 * mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0); // set storage to zero
        LittleEndian::write_u32(&mut data[4..8], 0);
        let owner = program_id;

        let contract_data_account = AccountInfo::new(
            &key,                             // account pubkey
            false,                            // is_signer
            true,                             // is_writable
            &mut lamports,                    // balance in lamports
            &mut data,                        // storage
            &owner,                           // owner pubkey
            false,                            // is_executable
            Epoch::default(),                 // rent_epoch
        );

        // mock voter account

        let key = Pubkey::new( VOTER_ACCOUNT_PUBKEY_BYTES );  // anything
        let mut lamports = 0;
        let mut data = vec![0; 0];
        let owner = Pubkey::new( SYSTEM_ACCOUNT_PUBKEY_BYTES ); 

        let voter_account = AccountInfo::new(
            &key,                             // account pubkey
            true,                             // is_signer
            true,                             // is_writable
            &mut lamports,                    // balance in lamports
            &mut data,                        // storage
            &owner,                           // owner pubkey
            false,                            // is_executable
            Epoch::default(),                 // rent_epoch
        );

        // mock voter check_account 

        let key = Pubkey::new( FALSE_CHECK_ACCOUNT_PUBKEY_BYTES );  // anything - i.e. NOT THE CORRECT CHECK-ACCOUNT
        let mut lamports = 0;
        let mut data = vec![0; mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0); // set storage to zero
        let owner = program_id;

        let check_account = AccountInfo::new(
            &key,                             // account pubkey
            false,                            // is_signer
            true,                             // is_writable
            &mut lamports,                    // balance in lamports
            &mut data,                        // storage
            &owner,                           // owner pubkey
            false,                            // is_executable
            Epoch::default(),                 // rent_epoch
        );

        let mut instruction_data: Vec<u8> = vec![0];

        let accounts = vec![contract_data_account, check_account, voter_account];

        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[0..4]), 0);
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[4..8]), 0);

        // vote for candidate 1 -- MUST FAIL, client supplied wrong check_account

        instruction_data[0] = 1;
        process_instruction(&program_id, &accounts, &instruction_data).unwrap();  // <-- expect panic here
    }

    // must reject extra votes

    #[test]
    #[should_panic] 
    fn test_nodup_vote1() {

        // mock program id 

        let program_id = Pubkey::new( PROGRAM_ACCOUNT_PUBKEY_BYTES );

        // mock contract data account

        let key = Pubkey::new( DATA_ACCOUNT_PUBKEY_BYTES );  // anything
        let mut lamports = 0;
        let mut data = vec![0; 2 * mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0); // set storage to zero
        LittleEndian::write_u32(&mut data[4..8], 0);
        let owner = program_id;

        let contract_data_account = AccountInfo::new(
            &key,                             // account pubkey
            false,                            // is_signer
            true,                             // is_writable
            &mut lamports,                    // balance in lamports
            &mut data,                        // storage
            &owner,                           // owner pubkey
            false,                            // is_executable
            Epoch::default(),                 // rent_epoch
        );

        // mock voter account

        let key = Pubkey::new( VOTER_ACCOUNT_PUBKEY_BYTES );  // anything
        let mut lamports = 0;
        let mut data = vec![0; 0];
        let owner = Pubkey::new( SYSTEM_ACCOUNT_PUBKEY_BYTES ); 

        let voter_account = AccountInfo::new(
            &key,                             // account pubkey
            true,                             // is_signer
            true,                             // is_writable
            &mut lamports,                    // balance in lamports
            &mut data,                        // storage
            &owner,                           // owner pubkey
            false,                            // is_executable
            Epoch::default(),                 // rent_epoch
        );

        // mock voter check_account 

        let key = create_address_with_seed(voter_account.key, "checkvote", &program_id);  // derived (correctly)
        let mut lamports = 0;
        let mut data = vec![0; mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0); // set storage to zero
        let owner = program_id;

        let check_account = AccountInfo::new(
            &key,                             // account pubkey
            false,                            // is_signer
            true,                             // is_writable
            &mut lamports,                    // balance in lamports
            &mut data,                        // storage
            &owner,                           // owner pubkey
            false,                            // is_executable
            Epoch::default(),                 // rent_epoch
        );

        let mut instruction_data: Vec<u8> = vec![0];

        let accounts = vec![contract_data_account, check_account, voter_account];

        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[0..4]), 0);
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[4..8]), 0);

        // vote for candidate 1 -- SHOULD WORK

        instruction_data[0] = 1;
        process_instruction(&program_id, &accounts, &instruction_data).unwrap();
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[0..4]), 1);
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[4..8]), 0);

        // vote for candidate 2 -- MUST FAIL

        instruction_data[0] = 2;
        process_instruction(&program_id, &accounts, &instruction_data).unwrap();  // <-- expect panic here
    }

    #[test]
    #[should_panic] 
    fn test_nodup_vote2() {

        // mock program id 

        let program_id = Pubkey::new( PROGRAM_ACCOUNT_PUBKEY_BYTES );

        // mock contract data account

        let key = Pubkey::new( DATA_ACCOUNT_PUBKEY_BYTES );  // anything
        let mut lamports = 0;
        let mut data = vec![0; 2 * mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0); // set storage to zero
        LittleEndian::write_u32(&mut data[4..8], 0);
        let owner = program_id;

        let contract_data_account = AccountInfo::new(
            &key,                             // account pubkey
            false,                            // is_signer
            true,                             // is_writable
            &mut lamports,                    // balance in lamports
            &mut data,                        // storage
            &owner,                           // owner pubkey
            false,                            // is_executable
            Epoch::default(),                 // rent_epoch
        );

        // mock voter account

        let key = Pubkey::new( VOTER_ACCOUNT_PUBKEY_BYTES );  // anything
        let mut lamports = 0;
        let mut data = vec![0; 0];
        let owner = Pubkey::new( SYSTEM_ACCOUNT_PUBKEY_BYTES ); 

        let voter_account = AccountInfo::new(
            &key,                             // account pubkey
            true,                             // is_signer
            true,                             // is_writable
            &mut lamports,                    // balance in lamports
            &mut data,                        // storage
            &owner,                           // owner pubkey
            false,                            // is_executable
            Epoch::default(),                 // rent_epoch
        );

        // mock voter check_account 

        let key = create_address_with_seed(voter_account.key, "checkvote", &program_id);  // derived (correctly)
        let mut lamports = 0;
        let mut data = vec![0; mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0); // set storage to zero
        let owner = program_id;

        let check_account = AccountInfo::new(
            &key,                             // account pubkey
            false,                            // is_signer
            true,                             // is_writable
            &mut lamports,                    // balance in lamports
            &mut data,                        // storage
            &owner,                           // owner pubkey
            false,                            // is_executable
            Epoch::default(),                 // rent_epoch
        );

        let mut instruction_data: Vec<u8> = vec![0];

        let accounts = vec![contract_data_account, check_account, voter_account];

        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[0..4]), 0);
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[4..8]), 0);

        // vote for candidate 2 -- SHOULD WORK

        instruction_data[0] = 2;
        process_instruction(&program_id, &accounts, &instruction_data).unwrap();
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[0..4]), 0);
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[4..8]), 1);

        // vote for candidate 1 -- MUST FAIL

        instruction_data[0] = 1;
        process_instruction(&program_id, &accounts, &instruction_data).unwrap();  // <-- expect panic here
    }

}

// Required to support info! in tests
#[cfg(not(target_arch = "bpf"))]
solana_sdk::program_stubs!();
