
import {
  SystemProgram,
  PublicKey,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js'

import * as BufferLayout from 'buffer-layout';

import {sendAndConfirmTransaction} from './util/send-and-confirm-transaction';

import {getOurAccount} from './ourAccount'
import {getNodeConnection} from './nodeConnection'
import {getStore} from './storeConfig'


async function main() {

  const ourAccount = await getOurAccount()

  const connection = await getNodeConnection()

  const s = await getStore(connection, 'rejectdups.json')

  if ( !s.inStore ) {
    console.log("Deploy program first")
    process.exit(1)
  }

  let candidate = process.argv[2];

  if ( ! candidate || candidate !== "1" && candidate !== "2" ) {
    console.log("No candidate supplied (should be 1 or 2)");
    process.exit(1);
  }

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

  const rentExemption = await connection.getMinimumBalanceForRentExemption(numBytes);

  const newAccountPubkey = await PublicKey.createWithSeed(ourAccount.publicKey, seed, s.programId)

  const alreadyVoted = await connection.getAccountInfo(newAccountPubkey) 

  if ( alreadyVoted ) {
    const data = Buffer.from(alreadyVoted.data)
    const accountDataLayout = BufferLayout.struct([
      BufferLayout.u32('candidate'),
    ])
    const votedFor = accountDataLayout.decode(data)
    console.log("Dude, you already voted for",votedFor.candidate,"!!!!")
    process.exit(0)
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
             {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},      // a system account with rent variables
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
