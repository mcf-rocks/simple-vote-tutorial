import {
  SystemProgram,
  Account,
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'

import {getOurAccount} from './ourAccount'
import {getNodeConnection} from './nodeConnection'

import {getStore, setStore} from './storeConfig'

import {sendAndConfirmTransaction} from './util/send-and-confirm-transaction';

async function main() {

  const ourAccount = await getOurAccount()

  const connection = await getNodeConnection()

  console.log("-----")

  const s = await getStore(connection, 'simplest.json')

  if ( !s || !s.inStore ) {
    console.log("Deploy program first")
    process.exit(1)
  }

  const programId = s.programId

  const seed = "somestring"

  const startingBalance = await connection.getBalance(ourAccount.publicKey)

  // create an account owned by a program, with a deterministically derived public key...

  const numBytes = 4

  const rentExemption = await connection.getMinimumBalanceForRentExemption(numBytes);

  const newAccountPubkey = await PublicKey.createWithSeed(ourAccount.publicKey, seed, programId)

  console.log("CreateWithSeed (")
  console.log("                Base:", ourAccount.publicKey.toString())
  console.log("                Seed:", seed)
  console.log("                ProgramId:", programId.toString())
  console.log("               )")
  console.log(" -> derived account address will be:",newAccountPubkey.toString())

  if ( await connection.getAccountInfo(newAccountPubkey) ) {
    console.log("\nBut that account already exists, so this will fail....\n")
  }


  // new account pub key must be hash of public keys (ourAccount, seed, programId)
  // the system program will check that this is the case
  // & that ourAccount is signer on transaction

  let params = {

    fromPubkey: ourAccount.publicKey,       // payer
    lamports: rentExemption,                // funds to deposit on the new account
    space: numBytes,                        // space required in bytes
 
    basePubkey: ourAccount.publicKey,       // derive from... must be signer
    seed,                                   // derive from...
    programId,                              // derive from... and will be owner of account

    newAccountPubkey,
  }

  let createTransaction = SystemProgram.createAccountWithSeed( params )

  await sendAndConfirmTransaction(
    'createAccountWithSeed',
    connection,
    createTransaction,
    ourAccount,            // payer, signer
  )

  const endingBalance = await connection.getBalance(ourAccount.publicKey)

  const cost = startingBalance - endingBalance

  console.log("Derived account created at", params.newAccountPubkey.toString(), "cost was:", cost, "lamports (", cost/LAMPORTS_PER_SOL, ")")

  console.log("-----")

}

main()
  .catch(err => {
    console.error(err)
  })
  .then(() => process.exit())
