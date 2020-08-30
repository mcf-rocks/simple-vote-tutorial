use byteorder::{ByteOrder, LittleEndian};
use solana_sdk::{
    account_info::AccountInfo, entrypoint, entrypoint::ProgramResult, info,
    program_error::ProgramError, account_info::next_account_info, pubkey::Pubkey,
};
use std::mem;

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


    // Increment vote count of candidate

    let mut data = account.try_borrow_mut_data()?;

    if 1 == instruction_data[0] { 
        let mut vc = LittleEndian::read_u32(&data[0..4]);
        vc += 1;
        LittleEndian::write_u32(&mut data[0..4], vc);
        info!("Voted for candidate1!");
    }

    if 2 == instruction_data[0] { 
        let mut vc = LittleEndian::read_u32(&data[4..8]);
        vc += 1;
        LittleEndian::write_u32(&mut data[4..8], vc);
        info!("Voted for candidate2!");
    }

    Ok(())
}

// tests
#[cfg(test)]
mod test {
    use super::*;
    use solana_sdk::clock::Epoch;

    #[test]
    fn test_sanity() {

        // mock program id 

        let program_id = Pubkey::default();

        // mock accounts array...

        let key = Pubkey::default();  // anything
        let mut lamports = 0;

        let mut data = vec![0; 2 * mem::size_of::<u32>()];
        LittleEndian::write_u32(&mut data[0..4], 0); // set storage to zero
        LittleEndian::write_u32(&mut data[4..8], 0);

        let owner = Pubkey::default();

        let account = AccountInfo::new(
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

        let accounts = vec![account];

        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[0..4]), 0);
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[4..8]), 0);

        // vote for candidate 1

        instruction_data[0] = 1;
        process_instruction(&program_id, &accounts, &instruction_data).unwrap();
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[0..4]), 1);
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[4..8]), 0);

        // vote for candidate 2

        instruction_data[0] = 2;
        process_instruction(&program_id, &accounts, &instruction_data).unwrap();
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[0..4]), 1);
        assert_eq!(LittleEndian::read_u32(&accounts[0].data.borrow()[4..8]), 1);
    }
}

// Required to support info! in tests
#[cfg(not(target_arch = "bpf"))]
solana_sdk::program_stubs!();
