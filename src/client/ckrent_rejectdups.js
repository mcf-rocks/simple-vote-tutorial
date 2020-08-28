
// this won't be in the tutorial, otherwise too long, it's just for my sanity
// 1. does it really check the System Rent account is the rent account?
// 2. does it really check the check-account is rent exempt?

import {
  SystemProgram,
  PublicKey,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
} from '@solana/web3.js'

import * as BufferLayout from 'buffer-layout';

import {sendAndConfirmTransaction} from './util/send-and-confirm-transaction';

import {getOurAccount} from './ourAccount'
import {getNodeConnection} from './nodeConnection'
import {getStore} from './storeConfig'

import {makeAccount} from './deploy'

async function main() {

  console.log(SYSVAR_RENT_PUBKEY.toString())
  console.log(SYSVAR_CLOCK_PUBKEY.toString())

  const ourAccount = await getOurAccount()

  const connection = await getNodeConnection()

  const s = await getStore(connection, 'rejectdups.json')

  if ( !s.inStore ) {
    console.log("Deploy program first")
    process.exit(1)
  }

  let test = process.argv[2];

  if ( ! test ) {
    console.log("Test: N = just vote like normal");
    console.log("      BSR = create and pass in random account instead of Sys Rent Account -- expect failure");
    console.log("      NSR = pass in a different Sys Account -- expect failure");
    console.log("      NRE = pass in Sys Rent Account but underfund the check-account -- expect failure");
    process.exit(1);
  }

  let candidate = "1"

  candidate = parseInt(candidate,10)

  console.log("-----")

  const instruction_data = Buffer.from([candidate])

  console.log("Voting for candidate:", candidate, "ProgramId:", s.programId.toString(), "DataAccount:", s.accountId.toString())

  const balBeforeVote = await connection.getBalance( ourAccount.publicKey )

  //--------------------------------
  // First create check-account...
  //--------------------------------

  const seed = 'checkvote'

  const numBytes = 4

  var rentExemption = await connection.getMinimumBalanceForRentExemption(numBytes);

  const newAccountPubkey = await PublicKey.createWithSeed(ourAccount.publicKey, seed, s.programId)

  const alreadyVoted = await connection.getAccountInfo(newAccountPubkey) 

  if ( alreadyVoted ) {
    console.log("check account exists already")
    const data = Buffer.from(alreadyVoted.data)
    const accountDataLayout = BufferLayout.struct([
      BufferLayout.u32('candidate'),
    ])
    const votedFor = accountDataLayout.decode(data)
    console.log("Dude, you already voted for",votedFor.candidate,"!!!!")
    process.exit(0)
  }

  if ( test === 'NRE' ) {
    // check account balance not rent exempt
    rentExemption = Math.floor(rentExemption / 2)  
  }

  let params = {

    fromPubkey: ourAccount.publicKey,       // payer
    lamports: rentExemption,                // funds to deposit on the new account
    space: numBytes,                        // space required in bytes

    basePubkey: ourAccount.publicKey,       // derive from... must be signer
    seed,                                   // derive from...
    programId: s.programId,                 // derive from... and will be owner of account

    newAccountPubkey,
  }

  let createTransaction = SystemProgram.createAccountWithSeed( params )

  await sendAndConfirmTransaction(
    'createAccountWithSeed',
    connection,
    createTransaction,
    ourAccount,            // payer, signer
  )

  console.log("Vote check-account created at:",newAccountPubkey.toString(),"for voter:",ourAccount.publicKey.toString())

  var sysvarRentPubkey = SYSVAR_RENT_PUBKEY


  if ( test === 'BSR' ) {
    // pass in some random account instead....
    sysvarRentPubkey = await makeAccount(connection, ourAccount, numBytes, s.programId)
  }

  if ( test === 'NSR' ) {
    // a different (the wrong) sys account
    sysvarRentPubkey = SYSVAR_CLOCK_PUBKEY
  }

  //-----------------
  // Then vote.... 
  //-----------------

  // NB: it's possible to be confused about instruction creation, 
  // when we say isSigner: true -- we are making an instruction where that is the case,
  // we are not telling the node if the account signed or not.

  const instruction = new TransactionInstruction({
    keys: [
             {pubkey: s.accountId, isSigner: false, isWritable: true},              // contract's data account
             {pubkey: newAccountPubkey, isSigner: false, isWritable: true},         // voter's check-account
             {pubkey: sysvarRentPubkey, isSigner: false, isWritable: false},        // a system account with rent variables
             {pubkey: ourAccount.publicKey, isSigner: true, isWritable: false}      // voter account 
          ],
    programId: s.programId,
    data: instruction_data,
  })
  await sendAndConfirmTransaction(
    'vote',
    connection,
    new Transaction().add(instruction),
    ourAccount,
  )

  const balAfterVote = await connection.getBalance( ourAccount.publicKey )

  const costOfVote = balBeforeVote - balAfterVote

  console.log("Cost of voting:",costOfVote,"lamports (", costOfVote/LAMPORTS_PER_SOL, ")")

  const accountInfo = await connection.getAccountInfo(s.accountId)
  const data = Buffer.from(accountInfo.data)
  
  const accountDataLayout = BufferLayout.struct([
    BufferLayout.u32('count1'),
    BufferLayout.u32('count2'),
  ]);

  const counts = accountDataLayout.decode(Buffer.from(accountInfo.data))

  console.log("Vote counts, candidate1:", counts.count1, "candidate2:", counts.count2) 

  console.log("-----")
}

main()
  .catch(err => {
    console.error(err)
  })
  .then(() => process.exit())
