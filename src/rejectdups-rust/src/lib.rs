use byteorder::{ByteOrder, LittleEndian};
use solana_sdk::{
    account_info::AccountInfo, entrypoint, entrypoint::ProgramResult, info,
    program_error::ProgramError, account_info::next_account_info, pubkey::Pubkey,
    hash::Hasher, 
    sysvar::{self, Sysvar}, rent::Rent,
};
use std::mem;


pub fn create_address_with_seed(
    base: &Pubkey,
    seed: &str,
    program_id: &Pubkey,
) -> Pubkey {
    let mut hasher = Hasher::default();
    hasher.hashv(&[base.as_ref(), seed.as_ref(), program_id.as_ref()]);
    Pubkey::new( hasher.result().as_ref() )
}

// Declare and export the program's entrypoint
entrypoint!(process_instruction);

// Program entrypoint's implementation
fn process_instruction<'a>(
    program_id: &Pubkey,             // Public key of program account
    accounts: &'a [AccountInfo<'a>], // data accounts
    instruction_data: &[u8],         // 1 = vote for A, 2 = vote for B
) -> ProgramResult {

    info!("Rust program entrypoint");

    // Iterating accounts is safer then indexing
    let accounts_iter = &mut accounts.iter();

    // Get the account that holds the vote count
    let account = next_account_info(accounts_iter)?;

    // The account must be owned by the program in order to modify its data
    if account.owner != program_id {
        info!("Vote account does not have the correct program id");
        return Err(ProgramError::IncorrectProgramId);
    }

    // The data must be large enough to hold two u32 vote counts
    if account.try_data_len()? < 2 * mem::size_of::<u32>() {
        info!("Vote account data length too small for u32");
        return Err(ProgramError::InvalidAccountData);
    }

    // Get the account that checks for dups
    let check_account = next_account_info(accounts_iter)?;

    // The check account must be owned by the program in order to modify its data
    if check_account.owner != program_id {
        info!("Check account does not have the correct program id");
        return Err(ProgramError::IncorrectProgramId);
    }

    // The data must be large enough to hold one u32 int
    if check_account.try_data_len()? < mem::size_of::<u32>() {
        info!("Check account data length too small for u32");
        return Err(ProgramError::InvalidAccountData);
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
        return Err(ProgramError::InvalidAccountData);
    }

    // the voter 
    let voter_account = next_account_info(accounts_iter)?;

    if !voter_account.is_signer {
      return Err(ProgramError::MissingRequiredSignature);
    }

    let expected_check_account_address = create_address_with_seed(voter_account.key, 
                                                                  "checkvote", 
                                                                  program_id);

    if expected_check_account_address != *check_account.key {
        info!("Voter fraud! not the correct check_account.");
        return Err(ProgramError::InvalidAccountData);
    }

    let mut checkdata = check_account.try_borrow_mut_data()?;

    let cac = LittleEndian::read_u32(&checkdata[0..4]);

    if cac!=0 {
        info!("Voter fraud! You already voted.");
        return Err(ProgramError::InvalidAccountData);
    }


    // Increment vote count of candidate

    let mut data = account.try_borrow_mut_data()?;

    if 1 == instruction_data[0] { 
        let mut vc = LittleEndian::read_u32(&data[0..4]);
        vc += 1;
        LittleEndian::write_u32(&mut data[0..4], vc);
        info!("Voted for candidate1!");
        LittleEndian::write_u32(&mut checkdata[0..4], 1);
    }

    if 2 == instruction_data[0] { 
        let mut vc = LittleEndian::read_u32(&data[4..8]);
        vc += 1;
        LittleEndian::write_u32(&mut data[4..8], vc);
        info!("Voted for candidate2!");
        LittleEndian::write_u32(&mut checkdata[0..4], 2);
    }

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
